// ZIP-316 Unified Address parsing — compactSize codec, F4Jumble, and TLV walker.
// Implemented from scratch per https://zips.z.cash/zip-0316.
//
// blakejs note: The published .d.ts for blakejs@1.2.x only declares the 3-arg
// form of blake2b(input, key?, outlen?), but the actual JS implementation also
// accepts (input, key, outlen, salt, personal).  We therefore use the streaming
// API — blake2bInit(outlen, key, salt, personal) / blake2bUpdate / blake2bFinal
// — which is both fully typed and supports personalization.

import { bech32m } from 'bech32';

// ── compactSize: Bitcoin/Zcash variable-length integer ───────────────
// < 253           → 1 byte (the value)
// ≤ 0xFFFF        → 0xFD + 2 bytes LE
// ≤ 0xFFFFFFFF    → 0xFE + 4 bytes LE
// else            → 0xFF + 8 bytes LE  (we use BigInt internally for this branch)

export function encodeCompactSize(value: number): Uint8Array {
  if (value < 0) throw new Error(`compactSize: negative value ${value}`);
  if (value < 253) {
    return new Uint8Array([value]);
  }
  if (value <= 0xFFFF) {
    return new Uint8Array([0xFD, value & 0xFF, (value >>> 8) & 0xFF]);
  }
  if (value <= 0xFFFFFFFF) {
    return new Uint8Array([
      0xFE,
      value         & 0xFF,
      (value >>>  8) & 0xFF,
      (value >>> 16) & 0xFF,
      (value >>> 24) & 0xFF,
    ]);
  }
  throw new Error(`compactSize: value ${value} exceeds 32-bit; 64-bit branch not implemented (not needed for UA)`);
}

export function decodeCompactSize(
  buf: Uint8Array,
  offset: number,
): { value: number; bytesRead: number } {
  if (offset >= buf.length) {
    throw new Error('compactSize: truncated input — no bytes to read');
  }
  const tag = buf[offset];
  if (tag < 253) {
    return { value: tag, bytesRead: 1 };
  }
  if (tag === 0xFD) {
    if (offset + 3 > buf.length) throw new Error('compactSize: truncated 0xFD prefix');
    const v = buf[offset + 1] | (buf[offset + 2] << 8);
    return { value: v, bytesRead: 3 };
  }
  if (tag === 0xFE) {
    if (offset + 5 > buf.length) throw new Error('compactSize: truncated 0xFE prefix');
    // Use unsigned multiply for the high byte to keep the result non-negative.
    const v =
      buf[offset + 1] |
      (buf[offset + 2] <<  8) |
      (buf[offset + 3] << 16) |
      (buf[offset + 4] * 0x1000000);
    return { value: v, bytesRead: 5 };
  }
  throw new Error(`compactSize: 0xFF (64-bit) branch not supported in this build`);
}

// ── F4Jumble — ZIP-316 §"Jumbling" ─────────────────────────────────
// Reference: https://zips.z.cash/zip-0316
//
// Length-preserving 4-round Feistel network over (a || b) where:
//   l_H = 64
//   l_L = min(l_H, floor(L/2))
//   l_R = L - l_L
//
// Forward (jumble):
//   x = b XOR G_0(a)
//   y = a XOR H_0(x)
//   d = x XOR G_1(y)
//   c = y XOR H_1(d)
//   return c || d
//
// Inverse (unjumble):
//   y = c XOR H_1(d)
//   x = d XOR G_1(y)
//   a = y XOR H_0(x)
//   b = x XOR G_0(a)
//   return a || b
//
// H_i(u): BLAKE2b, outlen = l_L bytes,
//         personal = "UA_F4Jumble_H" (13 B) || [i, 0, 0] (3 B) = 16 B
//
// G_i(u): first l_R bytes of concatenated BLAKE2b-512 chunks,
//         personal per chunk j = "UA_F4Jumble_G" (13 B) || [i] (1 B)
//                                || I2LEOSP_16(j) (2 B LE) = 16 B

// blakejs's published .d.ts only declares blake2bInit(outlen?, key?) — the actual
// JS implementation supports (outlen, key, salt, personal) but the types lag behind.
// We import the module as unknown and re-type only what we need so tsc stays clean.
import * as _blakejs from 'blakejs';
const _blib = _blakejs as unknown as {
  blake2bInit: (
    outlen: number,
    key: Uint8Array | null | undefined,
    salt: Uint8Array | null | undefined,
    personal: Uint8Array | null | undefined,
  ) => object;
  blake2bUpdate: (ctx: object, input: Uint8Array) => void;
  blake2bFinal: (ctx: object) => Uint8Array;
};
const blake2bInit   = _blib.blake2bInit.bind(_blib);
const blake2bUpdate = _blib.blake2bUpdate.bind(_blib);
const blake2bFinal  = _blib.blake2bFinal.bind(_blib);

const F4_PERSONAL_H = new TextEncoder().encode('UA_F4Jumble_H'); // 13 bytes
const F4_PERSONAL_G = new TextEncoder().encode('UA_F4Jumble_G'); // 13 bytes

const L_H = 64;
const L_M_MIN = 38;
const L_M_MAX = 4_194_368;

/** Build a 16-byte BLAKE2b personalization block from a 13-byte prefix + 3-byte suffix. */
function makePersonal(prefix: Uint8Array, b0: number, b1: number, b2: number): Uint8Array {
  const p = new Uint8Array(16);
  p.set(prefix, 0);
  p[13] = b0;
  p[14] = b1;
  p[15] = b2;
  return p;
}

/** XOR src into dst in-place (dst.length must equal src.length). */
function xorInto(dst: Uint8Array, src: Uint8Array): void {
  for (let i = 0; i < dst.length; i++) dst[i] ^= src[i];
}

/**
 * H_i(u) — output l_L bytes.
 * BLAKE2b with outlen = outLen, personal = "UA_F4Jumble_H" || [i, 0, 0].
 */
function H(i: number, u: Uint8Array, outLen: number): Uint8Array {
  const personal = makePersonal(F4_PERSONAL_H, i, 0, 0);
  // blake2bInit signature (from blakejs types): (outlen, key?, salt?, personal?)
  const ctx = blake2bInit(outLen, undefined, undefined, personal);
  blake2bUpdate(ctx, u);
  return blake2bFinal(ctx);
}

/**
 * G_i(u) — output l_R bytes.
 * Concatenate BLAKE2b-512 chunks; chunk j uses personal = "UA_F4Jumble_G" || [i, j_lo, j_hi].
 * Take only the first l_R bytes of the concatenation.
 */
function G(i: number, u: Uint8Array, outLen: number): Uint8Array {
  const out = new Uint8Array(outLen);
  const numChunks = Math.ceil(outLen / 64);
  let written = 0;
  for (let j = 0; j < numChunks; j++) {
    // I2LEOSP_16(j): j as little-endian 16-bit unsigned
    const jLo = j & 0xFF;
    const jHi = (j >>> 8) & 0xFF;
    const personal = makePersonal(F4_PERSONAL_G, i, jLo, jHi);
    const ctx = blake2bInit(64, undefined, undefined, personal);
    blake2bUpdate(ctx, u);
    const chunk = blake2bFinal(ctx);
    const take = Math.min(64, outLen - written);
    out.set(chunk.subarray(0, take), written);
    written += take;
  }
  return out;
}

function splitLR(L: number): { lL: number; lR: number } {
  const lL = Math.min(L_H, Math.floor(L / 2));
  return { lL, lR: L - lL };
}

/** F4Jumble: length-preserving forward permutation (ZIP-316). */
export function f4Jumble(input: Uint8Array): Uint8Array {
  if (input.length < L_M_MIN || input.length > L_M_MAX) {
    throw new Error(
      `F4Jumble: input length ${input.length} out of range [${L_M_MIN}, ${L_M_MAX}]`,
    );
  }
  const { lL, lR } = splitLR(input.length);
  const a = input.slice(0, lL);
  const b = input.slice(lL);

  // x = b XOR G_0(a)
  const x = new Uint8Array(b);
  xorInto(x, G(0, a, lR));
  // y = a XOR H_0(x)
  const y = new Uint8Array(a);
  xorInto(y, H(0, x, lL));
  // d = x XOR G_1(y)
  const d = new Uint8Array(x);
  xorInto(d, G(1, y, lR));
  // c = y XOR H_1(d)
  const c = new Uint8Array(y);
  xorInto(c, H(1, d, lL));

  const out = new Uint8Array(input.length);
  out.set(c, 0);
  out.set(d, lL);
  return out;
}

/** F4Unjumble: inverse of f4Jumble (ZIP-316). */
export function f4Unjumble(input: Uint8Array): Uint8Array {
  if (input.length < L_M_MIN || input.length > L_M_MAX) {
    throw new Error(
      `F4Jumble: input length ${input.length} out of range [${L_M_MIN}, ${L_M_MAX}]`,
    );
  }
  const { lL, lR } = splitLR(input.length);
  const c = input.slice(0, lL);
  const d = input.slice(lL);

  // y = c XOR H_1(d)
  const y = new Uint8Array(c);
  xorInto(y, H(1, d, lL));
  // x = d XOR G_1(y)
  const x = new Uint8Array(d);
  xorInto(x, G(1, y, lR));
  // a = y XOR H_0(x)
  const a = new Uint8Array(y);
  xorInto(a, H(0, x, lL));
  // b = x XOR G_0(a)
  const b2 = new Uint8Array(x);
  xorInto(b2, G(0, a, lR));

  const out = new Uint8Array(input.length);
  out.set(a, 0);
  out.set(b2, lL);
  return out;
}

// ── Public types ──────────────────────────────────────────────────────────────

export type Network = 'main' | 'test' | 'regtest';

export type ReceiverType = 'orchard' | 'sapling' | 'p2pkh' | 'p2sh' | 'unknown';

export interface Receiver {
  type:   ReceiverType;
  typeId: number;   // raw TLV typecode byte (0=p2pkh, 1=p2sh, 2=sapling, 3=orchard)
  length: number;   // raw TLV value length in bytes
}

export interface UnifiedAddress {
  network:          Network;
  receivers:        Receiver[];
  isOrchardCapable: boolean;
}

// ── HRP → network ────────────────────────────────────────────────────────────

const HRP_TO_NETWORK: Record<string, Network> = {
  u:        'main',
  utest:    'test',
  uregtest: 'regtest',
};

// Expected lengths for known typecodes; unknown typecodes pass through.
const KNOWN_RECEIVER_LENGTHS: Record<number, { name: ReceiverType; len: number }> = {
  0x00: { name: 'p2pkh',   len: 20 },
  0x01: { name: 'p2sh',    len: 20 },
  0x02: { name: 'sapling', len: 43 },
  0x03: { name: 'orchard', len: 43 },
};

// ── textToBytes helper ────────────────────────────────────────────────────────

function textToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ── parseUnifiedAddress ───────────────────────────────────────────────────────

export function parseUnifiedAddress(addr: string): UnifiedAddress {
  if (!addr || addr.length === 0) {
    throw new Error('parseUnifiedAddress: empty input');
  }

  // Step 1: bech32m decode (generous LIMIT for long UAs).
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32m.decode(addr.toLowerCase(), 1024);
  } catch (e) {
    throw new Error(`parseUnifiedAddress: invalid bech32m: ${(e as Error).message}`);
  }

  // Step 2: HRP → network
  const network = HRP_TO_NETWORK[decoded.prefix];
  if (!network) {
    throw new Error(`parseUnifiedAddress: unknown HRP "${decoded.prefix}"`);
  }

  // Step 3: 5-bit words → 8-bit bytes
  const bytes = new Uint8Array(bech32m.fromWords(decoded.words));

  // Step 4: F4Unjumble
  let raw: Uint8Array;
  try {
    raw = f4Unjumble(bytes);
  } catch (e) {
    throw new Error(`parseUnifiedAddress: F4Unjumble failed: ${(e as Error).message}`);
  }

  // Step 5: verify and strip the 16-byte HRP padding at the end
  if (raw.length < 16) {
    throw new Error('parseUnifiedAddress: payload too short for HRP padding');
  }
  const padding = new Uint8Array(16);
  const hrpBytes = textToBytes(decoded.prefix);
  padding.set(hrpBytes, 0); // rest is already zero
  const padStart = raw.length - 16;
  for (let i = 0; i < 16; i++) {
    if (raw[padStart + i] !== padding[i]) {
      throw new Error('parseUnifiedAddress: HRP padding mismatch (corrupted UA or wrong HRP)');
    }
  }
  const tlv = raw.subarray(0, padStart);

  // Step 6: walk TLV — typecode (compactSize), length (compactSize), value (skip)
  const receivers: Receiver[] = [];
  let pos = 0;
  while (pos < tlv.length) {
    const t = decodeCompactSize(tlv, pos);
    pos += t.bytesRead;
    const l = decodeCompactSize(tlv, pos);
    pos += l.bytesRead;
    if (pos + l.value > tlv.length) {
      throw new Error(
        `parseUnifiedAddress: TLV claims length ${l.value} but only ${tlv.length - pos} bytes remain`,
      );
    }
    pos += l.value; // skip address bytes; no cryptographic validation needed

    const known = KNOWN_RECEIVER_LENGTHS[t.value];
    receivers.push({
      type:   known ? known.name : 'unknown',
      typeId: t.value,
      length: l.value,
    });
  }

  if (receivers.length === 0) {
    throw new Error('parseUnifiedAddress: no receivers decoded');
  }

  return {
    network,
    receivers,
    isOrchardCapable: receivers.some(r => r.type === 'orchard'),
  };
}
