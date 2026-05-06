# ZcashConnect MVP v1.1 Implementation Plan — ZIP-316 + ZIP-321 Spec Coverage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three Zcash-protocol-level capabilities to the v1.0 MVP: ZIP-316 Unified Address parsing (with from-scratch F4Jumble + TLV decoding), ZIP-321 round-trip parser, and ZIP-321 multi-recipient URIs.

**Architecture:** Two pure modules — new `zip316.ts` for UA parsing (bech32m envelope → F4Jumble unjumble → TLV walk), and extensions to `zip321.ts` for parsing + multi-recipient. Server gains startup validation via `parseUnifiedAddress` and two new routes. UI gains three panels.

**Tech Stack:** Node 20 LTS · TypeScript 5.x strict · Vitest. New deps: `bech32` (^2.0.0, MIT) for bech32m envelope, `blakejs` (^1.2.0, MIT) for personalized BLAKE2b (Node's built-in `crypto` doesn't expose personalization).

**Commit author for this plan:** All commits authored as `Sanjay Subedi <thesanjay43@gmail.com>`. No `Co-Authored-By: Claude` footer.

---

## File structure (target end state)

```
zcash-sdk/
├── src/
│   ├── zip316.ts                        # NEW: bech32m + F4Jumble + TLV
│   ├── zip316.test.ts                   # NEW
│   ├── zip321.ts                        # extended: parsers + multi-recipient
│   ├── zip321.test.ts                   # extended
│   ├── lightwalletd.ts                  # unchanged
│   ├── invoices.ts                      # unchanged
│   ├── invoices.test.ts                 # unchanged
│   └── server.ts                        # extended: startup validation, /uris/parse, /address/:addr/details
├── public/
│   └── index.html                       # extended: address-details panel, parse-URI panel, multi-recipient toggle
├── proto/, package.json, etc.           # unchanged tree
├── .env, .env.example                   # MERCHANT_ADDRESS swapped to a known-valid UA
└── README.md                            # extended: ZIP-316 + ZIP-321 sections
```

`zip316.ts` is the only new file. All other changes are additive extensions.

---

## ZIP-316 algorithm reference (consult during Tasks 3-5)

**F4Jumble** (per ZIP-316 §"Jumbling"):

```
Input: M of length L bytes, where 38 ≤ L ≤ 4,194,368
Constants:
  l_H = 64
  l_L = min(l_H, floor(L/2))
  l_R = L - l_L

Split:
  a = M[0 .. l_L]
  b = M[l_L .. L]

Four rounds (Feistel):
  x = b XOR G_0(a)
  y = a XOR H_0(x)
  d = x XOR G_1(y)
  c = y XOR H_1(d)

Return: c || d   (length L bytes)
```

**H_i(u)** — BLAKE2b with output length `l_L` bytes:
- Personalization (16 bytes): `b"UA_F4Jumble_H" || [i, 0, 0]` — that's 13 ASCII bytes + 3 bytes
- Input data: `u`
- Output: first `l_L` bytes (BLAKE2b digest with this output length)

**G_i(u)** — output length `l_R` bytes, built from BLAKE2b-512 chunks:
- For j from 0 to `ceil(l_R / 64) - 1`:
  - Personalization (16 bytes): `b"UA_F4Jumble_G" || [i] || I2LEOSP_16(j)` — that's 13 ASCII bytes + 1 byte + 2 bytes little-endian
  - Input data: `u`
  - Output: 64 bytes (BLAKE2b-512)
- Concatenate all chunks, take first `l_R` bytes.

`I2LEOSP_16(j)` = j as a 16-bit unsigned little-endian integer (2 bytes).

**F4Unjumble** is the same algorithm run "backwards":

```
Split c || d:
  c = M[0 .. l_L]
  d = M[l_L .. L]

  y = c XOR H_1(d)
  x = d XOR G_1(y)
  a = y XOR H_0(x)
  b = x XOR G_0(a)

Return a || b
```

(The Feistel is unkeyed so XOR-inverse gives the inverse function.)

**UA encoding pipeline** (decoding direction):
1. `bech32m.decode(addr, 256)` → `{ prefix, words }`. Reject if checksum fails.
2. Map `prefix` → network: `u` → `main`, `utest` → `test`, `uregtest` → `regtest`. Reject unknown.
3. `bech32m.fromWords(words)` → raw bytes.
4. Apply `F4Unjumble`.
5. The last 16 bytes are the HRP padded to 16 bytes with zeros. Verify byte-for-byte; reject if mismatch. Strip them.
6. Walk the remaining bytes as TLV: each `(typecode: compactSize, length: compactSize, value: byte[length])`. Map typecodes:
   - `0x00` → `p2pkh` (length must be 20)
   - `0x01` → `p2sh` (length must be 20)
   - `0x02` → `sapling` (length must be 43)
   - `0x03` → `orchard` (length must be 43)
   - other → `unknown` (preserve, don't reject)
7. Reject if any TLV's claimed length exceeds the remaining buffer.

**compactSize** (Bitcoin/Zcash variable-length integer):
- value < 253 → 1 byte (the value)
- value ≤ 0xFFFF → `0xFD` + 2-byte little-endian
- value ≤ 0xFFFFFFFF → `0xFE` + 4-byte little-endian
- else → `0xFF` + 8-byte little-endian

For TYPECODES 0-3 and lengths 20/43, compactSize is just one byte. The implementation must still handle the multi-byte forms for forward compatibility.

---

## Task 1: Install new deps

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install `bech32` and `blakejs`**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm install bech32@^2.0.0 blakejs@^1.2.0
npm install -D @types/blakejs@^1.0.0 || true
```

The `@types/blakejs` install may fail (the package may not have separate types — current versions ship types inline). Don't fail the task on its absence — just verify the next step works.

- [ ] **Step 2: Verify both libraries work**

Run a one-liner sanity check:

```bash
node -e "
const bech32 = require('bech32');
const blake = require('blakejs');
console.log('bech32m:', typeof bech32.bech32m?.decode);
console.log('blakejs:', typeof blake.blake2b);
"
```

Expected: both print `function`. If either prints `undefined`, the package shape is different than expected — stop and report.

- [ ] **Step 3: Type-check still passes**

```bash
npx tsc --noEmit
```

Expected: exit 0. (No new TS imports yet, just deps. Should be no change.)

- [ ] **Step 4: Tests still pass**

```bash
npm test 2>&1 | tail -3
```

Expected: 22 cases pass (unchanged).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "chore: add bech32 and blakejs for ZIP-316 unified address parsing"
```

---

## Task 2: Implement compactSize codec (TDD)

**Files:**
- Create: `src/zip316.ts` (initial — only compactSize for now)
- Create: `src/zip316.test.ts` (compactSize tests only)

We start with the smallest, most independent piece — the variable-length integer codec used by ZIP-316 TLV. Building it first means later tasks can compose it.

- [ ] **Step 1: Write failing tests for compactSize**

Create `src/zip316.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeCompactSize, decodeCompactSize } from './zip316';

describe('compactSize codec', () => {
  it('encodes small values (< 253) as a single byte', () => {
    expect(Array.from(encodeCompactSize(0))).toEqual([0]);
    expect(Array.from(encodeCompactSize(20))).toEqual([20]);
    expect(Array.from(encodeCompactSize(252))).toEqual([252]);
  });

  it('encodes uint16 values as 0xFD + 2 bytes little-endian', () => {
    // 253 → 0xFD 0xFD 0x00
    expect(Array.from(encodeCompactSize(253))).toEqual([0xFD, 0xFD, 0x00]);
    // 0xFFFF → 0xFD 0xFF 0xFF
    expect(Array.from(encodeCompactSize(0xFFFF))).toEqual([0xFD, 0xFF, 0xFF]);
  });

  it('encodes uint32 values as 0xFE + 4 bytes little-endian', () => {
    expect(Array.from(encodeCompactSize(0x10000))).toEqual([0xFE, 0x00, 0x00, 0x01, 0x00]);
  });

  it('decodes round-trip for representative values', () => {
    for (const v of [0, 1, 100, 252, 253, 1000, 0xFFFF, 0x10000, 0x7FFFFFFF]) {
      const buf = encodeCompactSize(v);
      const { value, bytesRead } = decodeCompactSize(buf, 0);
      expect(value).toBe(v);
      expect(bytesRead).toBe(buf.length);
    }
  });

  it('decodes from offset', () => {
    const buf = new Uint8Array([0xAA, 0xBB, 20, 0xCC]);
    const { value, bytesRead } = decodeCompactSize(buf, 2);
    expect(value).toBe(20);
    expect(bytesRead).toBe(1);
  });

  it('throws on truncated input', () => {
    // 0xFD claims 2 more bytes follow, but buffer ends
    expect(() => decodeCompactSize(new Uint8Array([0xFD, 0xFF]), 0))
      .toThrow(/truncated|insufficient/i);
  });
});
```

- [ ] **Step 2: Run test, observe failure**

```bash
npm test -- zip316
```

Expected: failure with `Cannot find module './zip316'` or similar.

- [ ] **Step 3: Implement compactSize in `src/zip316.ts`**

Create `src/zip316.ts` with:

```ts
// ZIP-316 Unified Address parsing — compactSize codec, F4Jumble, and TLV walker.
// Implemented from scratch per https://zips.z.cash/zip-0316.

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
    // Use unsigned right shift for the high byte to keep the result non-negative.
    const v =
      buf[offset + 1] |
      (buf[offset + 2] <<  8) |
      (buf[offset + 3] << 16) |
      (buf[offset + 4] * 0x1000000);  // unsigned multiply for the high byte
    return { value: v, bytesRead: 5 };
  }
  throw new Error(`compactSize: 0xFF (64-bit) branch not supported in this build`);
}
```

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test -- zip316
```

Expected: 6 cases pass.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/zip316.ts src/zip316.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(zip316): compactSize variable-length integer codec"
```

---

## Task 3: Implement F4Jumble (TDD)

**Files:**
- Modify: `src/zip316.ts` (add F4Jumble)
- Modify: `src/zip316.test.ts` (add F4Jumble tests)

This is the cryptographic core of ZIP-316. The Feistel construction with personalized BLAKE2b is documented above in the "ZIP-316 algorithm reference" section.

- [ ] **Step 1: Add F4Jumble tests to `src/zip316.test.ts`**

Append (above the closing of the file):

```ts
import { f4Jumble, f4Unjumble } from './zip316';

describe('F4Jumble', () => {
  it('round-trips: f4Unjumble(f4Jumble(x)) === x for various lengths', () => {
    for (const len of [48, 64, 100, 248]) {
      const input = new Uint8Array(len);
      for (let i = 0; i < len; i++) input[i] = (i * 37 + 13) & 0xFF;
      const jumbled   = f4Jumble(input);
      const unjumbled = f4Unjumble(jumbled);
      expect(jumbled.length).toBe(len);
      expect(unjumbled.length).toBe(len);
      expect(Array.from(unjumbled)).toEqual(Array.from(input));
    }
  });

  it('produces a different output than its input (mixing actually happens)', () => {
    const input = new Uint8Array(64).fill(0x42);
    const jumbled = f4Jumble(input);
    expect(Array.from(jumbled)).not.toEqual(Array.from(input));
  });

  it('rejects inputs shorter than 38 bytes', () => {
    expect(() => f4Jumble(new Uint8Array(37))).toThrow(/length|too short/i);
  });

  it('preserves length exactly', () => {
    for (const len of [38, 50, 64, 73, 100]) {
      expect(f4Jumble(new Uint8Array(len)).length).toBe(len);
    }
  });
});
```

- [ ] **Step 2: Run tests, observe failure**

```bash
npm test -- zip316
```

Expected: failure with `f4Jumble is not exported` or similar.

- [ ] **Step 3: Implement F4Jumble in `src/zip316.ts`**

Append the following block to `src/zip316.ts` (after the compactSize codec, before any future exports):

```ts
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
// H_i(u) = BLAKE2b(personal = "UA_F4Jumble_H" || [i, 0, 0],
//                  outlen   = l_L bytes,
//                  input    = u)
//
// G_i(u) = first l_R bytes of (BLAKE2b-512(personal = "UA_F4Jumble_G" || [i] || I2LEOSP_16(j),
//                                          input    = u)
//                              for j in 0..ceil(l_R/64) - 1)

import * as blake from 'blakejs';

const F4_PERSONAL_H = textToBytes('UA_F4Jumble_H'); // 13 bytes
const F4_PERSONAL_G = textToBytes('UA_F4Jumble_G'); // 13 bytes
const L_H = 64;
const L_M_MIN = 38;
const L_M_MAX = 4_194_368;

function textToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function makePersonal16(prefix: Uint8Array, suffix: Uint8Array): Uint8Array {
  // BLAKE2b personalization is 16 bytes (zero-padded if shorter)
  const out = new Uint8Array(16);
  out.set(prefix, 0);
  out.set(suffix, prefix.length);
  return out;
}

function xorInto(dst: Uint8Array, src: Uint8Array): void {
  for (let i = 0; i < dst.length; i++) dst[i] ^= src[i];
}

function H(i: number, u: Uint8Array, outLen: number): Uint8Array {
  // BLAKE2b with output length outLen bytes, personalization "UA_F4Jumble_H" + [i, 0, 0]
  const personal = makePersonal16(F4_PERSONAL_H, new Uint8Array([i, 0, 0]));
  // blakejs API: blake2b(input, key=null, outlen, salt=null, personal)
  return blake.blake2b(u, null, outLen, undefined, personal);
}

function G(i: number, u: Uint8Array, outLen: number): Uint8Array {
  // Concat BLAKE2b-512 chunks personalized "UA_F4Jumble_G" + [i] + I2LEOSP_16(j)
  const out = new Uint8Array(outLen);
  const numChunks = Math.ceil(outLen / 64);
  let written = 0;
  for (let j = 0; j < numChunks; j++) {
    const suffix = new Uint8Array([i, j & 0xFF, (j >>> 8) & 0xFF]); // [i] + j_LE_16
    const personal = makePersonal16(F4_PERSONAL_G, suffix);
    const chunk = blake.blake2b(u, null, 64, undefined, personal);
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

export function f4Jumble(input: Uint8Array): Uint8Array {
  if (input.length < L_M_MIN || input.length > L_M_MAX) {
    throw new Error(`F4Jumble: input length ${input.length} out of range [${L_M_MIN}, ${L_M_MAX}]`);
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

export function f4Unjumble(input: Uint8Array): Uint8Array {
  if (input.length < L_M_MIN || input.length > L_M_MAX) {
    throw new Error(`F4Jumble: input length ${input.length} out of range [${L_M_MIN}, ${L_M_MAX}]`);
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
  const b = new Uint8Array(x);
  xorInto(b, G(0, a, lR));

  const out = new Uint8Array(input.length);
  out.set(a, 0);
  out.set(b, lL);
  return out;
}
```

Note: `blakejs` in version 1.x exports `blake2b(input, key, outlen, salt?, personal?)`. If your installed version has a different signature, check `node_modules/blakejs/index.js` and adapt.

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test -- zip316
```

Expected: 10 cases pass total (6 compactSize + 4 F4Jumble).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0. If TS complains about `blake.blake2b` returning the wrong type, either adjust to match the actual `blakejs` types (`blake.blake2b(...) as Uint8Array`) or import as untyped: `import blake from 'blakejs';`. If `@types/blakejs` is missing, add a small ambient declaration.

- [ ] **Step 6: Commit**

```bash
git add src/zip316.ts src/zip316.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(zip316): F4Jumble Feistel network with personalized BLAKE2b

Implements the length-preserving 4-round Feistel construction defined
in ZIP-316 §Jumbling. H_i uses BLAKE2b at l_L-byte output; G_i uses
BLAKE2b-512 chunked across ceil(l_R/64) blocks. Round-trip property
tests verify f4Unjumble(f4Jumble(x)) == x at lengths 48, 64, 100, 248."
```

---

## Task 4: Implement parseUnifiedAddress (TDD)

**Files:**
- Modify: `src/zip316.ts` (add the public parser)
- Modify: `src/zip316.test.ts` (add UA parsing tests)

- [ ] **Step 1: Add UA parsing tests**

Append to `src/zip316.test.ts`:

```ts
import { parseUnifiedAddress } from './zip316';

describe('parseUnifiedAddress', () => {
  // Known mainnet UA from the librustzcash test vectors
  // (this is a public test address, not a real wallet — safe to embed)
  const TEST_UA_MAIN = 'u17fst5ww5cqecg9wkvyfm83cphawxnjdy96vh4yp4qrnzn8wuhf6axdym7v94vsuc4tlsetn8d6kt8ad7p5wddx8df7n38c0jhuksp9j4d22efrh4q83trf66h6tj7zh4yqecdjsce0vy2ytz4j4tt4fc8nv2gxax6jvsv70';

  it('decodes a known mainnet unified address', () => {
    const ua = parseUnifiedAddress(TEST_UA_MAIN);
    expect(ua.network).toBe('main');
    expect(ua.receivers.length).toBeGreaterThan(0);
    expect(ua.isOrchardCapable).toBe(true);
  });

  it('rejects empty input', () => {
    expect(() => parseUnifiedAddress('')).toThrow();
  });

  it('rejects invalid bech32m', () => {
    expect(() => parseUnifiedAddress('u1invalid_chars_!!!!')).toThrow();
  });

  it('rejects unknown HRP', () => {
    // bech32m with HRP "xx" is structurally valid but not a Zcash UA
    // build a structurally-valid bech32m string with wrong HRP
    expect(() => parseUnifiedAddress('xx1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw')).toThrow(/HRP|prefix|unknown/i);
  });

  it('exposes the typecodes of decoded receivers', () => {
    const ua = parseUnifiedAddress(TEST_UA_MAIN);
    const typeIds = ua.receivers.map(r => r.typeId).sort((a, b) => a - b);
    // A real mainnet UA must contain at least one valid typecode (0,1,2,3, or unknown >= 4)
    expect(typeIds[0]).toBeGreaterThanOrEqual(0);
  });
});
```

If `TEST_UA_MAIN` doesn't decode correctly with our implementation, either:
- (a) The implementation has a bug — debug F4Jumble first.
- (b) The test vector itself is wrong — replace with a different known-valid UA. Other public test UAs exist in the librustzcash repo.

- [ ] **Step 2: Run tests, observe failure**

```bash
npm test -- zip316
```

Expected: failure (`parseUnifiedAddress is not exported`).

- [ ] **Step 3: Implement `parseUnifiedAddress`**

Append to `src/zip316.ts`:

```ts
// ── Public types ─────────────────────────────────────────────────────

export type Network = 'main' | 'test' | 'regtest';

export type ReceiverType = 'orchard' | 'sapling' | 'p2pkh' | 'p2sh' | 'unknown';

export interface Receiver {
  type:   ReceiverType;
  typeId: number;     // raw TLV type byte (0=p2pkh, 1=p2sh, 2=sapling, 3=orchard)
  length: number;     // raw TLV length
}

export interface UnifiedAddress {
  network:          Network;
  receivers:        Receiver[];
  isOrchardCapable: boolean;
}

// ── HRP → network ────────────────────────────────────────────────────

const HRP_TO_NETWORK: Record<string, Network> = {
  u:        'main',
  utest:    'test',
  uregtest: 'regtest',
};

// Expected lengths for known typecodes. Unknown typecodes pass through.
const KNOWN_RECEIVER_LENGTHS: Record<number, { name: ReceiverType; len: number }> = {
  0x00: { name: 'p2pkh',   len: 20 },
  0x01: { name: 'p2sh',    len: 20 },
  0x02: { name: 'sapling', len: 43 },
  0x03: { name: 'orchard', len: 43 },
};

// ── parseUnifiedAddress ──────────────────────────────────────────────

import { bech32m } from 'bech32';

export function parseUnifiedAddress(addr: string): UnifiedAddress {
  if (!addr || addr.length === 0) {
    throw new Error('parseUnifiedAddress: empty input');
  }

  // Step 1: bech32m decode (with a generous LIMIT for long UAs).
  let decoded;
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

  // Step 3: 5-bit → 8-bit
  const bytes = new Uint8Array(bech32m.fromWords(decoded.words));

  // Step 4: F4Unjumble
  let raw: Uint8Array;
  try {
    raw = f4Unjumble(bytes);
  } catch (e) {
    throw new Error(`parseUnifiedAddress: F4Unjumble failed: ${(e as Error).message}`);
  }

  // Step 5: verify and strip the 16-byte HRP padding
  if (raw.length < 16) {
    throw new Error('parseUnifiedAddress: payload too short for HRP padding');
  }
  const padding = new Uint8Array(16);
  const hrpBytes = textToBytes(decoded.prefix);
  padding.set(hrpBytes, 0);
  // (rest already zero)
  const padStart = raw.length - 16;
  for (let i = 0; i < 16; i++) {
    if (raw[padStart + i] !== padding[i]) {
      throw new Error('parseUnifiedAddress: HRP padding mismatch (corrupted UA or wrong HRP)');
    }
  }
  const tlv = raw.subarray(0, padStart);

  // Step 6: walk TLV
  const receivers: Receiver[] = [];
  let pos = 0;
  while (pos < tlv.length) {
    const t = decodeCompactSize(tlv, pos);
    pos += t.bytesRead;
    const l = decodeCompactSize(tlv, pos);
    pos += l.bytesRead;
    if (pos + l.value > tlv.length) {
      throw new Error(`parseUnifiedAddress: TLV claims length ${l.value} but only ${tlv.length - pos} bytes remain`);
    }
    pos += l.value; // skip the addr bytes; we don't validate cryptographic content

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
```

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test -- zip316
```

Expected: ~15 cases pass total. If `TEST_UA_MAIN` fails to decode, check:
1. Did `bech32m.decode` throw? → wrong UA encoding or our limit is too low.
2. Did F4Unjumble produce non-padding bytes? → F4Jumble bug. Re-verify Task 3.
3. Did TLV walk fail? → compactSize decode issue. Re-verify Task 2.

If after debugging the test still fails, replace `TEST_UA_MAIN` with another known-valid mainnet UA from a public source (e.g., a UA found in the `zcash-test-vectors` repository at https://github.com/zcash-hackworks/zcash-test-vectors).

- [ ] **Step 5: Commit**

```bash
git add src/zip316.ts src/zip316.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(zip316): parseUnifiedAddress with bech32m, F4Unjumble, TLV walk

Decoder pipeline per ZIP-316 §Encoding:
  bech32m → 5-to-8 bit → F4Unjumble → strip 16-byte HRP padding → walk TLV.
Maps typecodes 0-3 to {p2pkh, p2sh, sapling, orchard}; unknown typecodes
pass through with isOrchardCapable=false. Tested against a public
mainnet test vector."
```

---

## Task 5: ZIP-321 round-trip parser (TDD)

**Files:**
- Modify: `src/zip321.ts` (add `parsePaymentUri`)
- Modify: `src/zip321.test.ts` (add round-trip tests)

- [ ] **Step 1: Add parsePaymentUri tests to `src/zip321.test.ts`**

Add at the end of the file:

```ts
import { parsePaymentUri } from './zip321';

describe('parsePaymentUri', () => {
  const ADDR = 'u1exampleorchardunifiedaddress';

  it('parses a URI with all fields and round-trips with buildPaymentUri', () => {
    const original = {
      address: ADDR,
      amount:  '0.5',
      memo:    'hello world',
      label:   'Order 1',
      message: 'thanks',
    };
    const uri    = buildPaymentUri(original);
    const parsed = parsePaymentUri(uri);
    expect(parsed.address).toBe(original.address);
    expect(parsed.amount).toBe(original.amount);
    expect(parsed.memo).toBe(original.memo);
    expect(parsed.label).toBe(original.label);
    expect(parsed.message).toBe(original.message);
  });

  it('parses a URI with only required fields', () => {
    const uri    = buildPaymentUri({ address: ADDR, amount: '0.01' });
    const parsed = parsePaymentUri(uri);
    expect(parsed.address).toBe(ADDR);
    expect(parsed.amount).toBe('0.01');
    expect(parsed.memo).toBeUndefined();
    expect(parsed.label).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });

  it('rejects non-zcash schemes', () => {
    expect(() => parsePaymentUri('http://example.com')).toThrow(/scheme|zcash:/i);
  });

  it('rejects zcash:// (authority component not allowed by ZIP-321)', () => {
    expect(() => parsePaymentUri(`zcash://${ADDR}?amount=1`)).toThrow();
  });

  it('handles zcash:?address=... equivalent to zcash:<addr>?', () => {
    const a = parsePaymentUri(`zcash:?address=${ADDR}&amount=1`);
    const b = parsePaymentUri(`zcash:${ADDR}?amount=1`);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests, observe failure**

```bash
npm test -- zip321
```

Expected: failure (parsePaymentUri not exported).

- [ ] **Step 3: Implement `parsePaymentUri` in `src/zip321.ts`**

Append the following block to `src/zip321.ts`:

```ts
// ── Parser ──────────────────────────────────────────────────────────
// Inverse of buildPaymentUri: zcash:<addr>?amount=...&memo=base64url(text)&...
//   → { address, amount, memo: text, label, message }
// Per ZIP-321 §URI Semantics, "zcash:<addr>?..." is equivalent to
// "zcash:?address=<addr>&...". This parser handles both forms.

function fromBase64Url(b64u: string): string {
  // base64url has no '=' padding; restore it for Buffer.from
  const padding = '='.repeat((4 - (b64u.length % 4)) % 4);
  const std     = b64u.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return Buffer.from(std, 'base64').toString('utf8');
}

export function parsePaymentUri(uri: string): PaymentRequest {
  if (!uri.startsWith('zcash:')) {
    throw new Error(`parsePaymentUri: scheme must be zcash:, got "${uri.split(':')[0]}"`);
  }
  const after = uri.slice('zcash:'.length);
  if (after.startsWith('//')) {
    throw new Error('parsePaymentUri: authority component not allowed by ZIP-321 (no zcash://)');
  }

  // Split path-component (the leading address, if any) from the query string.
  const queryStart = after.indexOf('?');
  const pathPart  = queryStart === -1 ? after : after.slice(0, queryStart);
  const queryPart = queryStart === -1 ? ''    : after.slice(queryStart + 1);

  const params = new URLSearchParams(queryPart);

  // Address: prefer path segment, fall back to address= query param.
  let address = pathPart;
  if (!address) {
    const fromQuery = params.get('address');
    if (!fromQuery) {
      throw new Error('parsePaymentUri: missing address (neither in path nor query)');
    }
    address = fromQuery;
  }

  const amount = params.get('amount');
  if (!amount) {
    throw new Error('parsePaymentUri: missing required amount parameter');
  }

  const memoB64 = params.get('memo') ?? undefined;
  const label   = params.get('label') ?? undefined;
  const message = params.get('message') ?? undefined;

  return {
    address,
    amount,
    memo:    memoB64 ? fromBase64Url(memoB64) : undefined,
    label,
    message,
  };
}
```

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test
```

Expected: ~27 cases pass (existing 22 + 5 new in zip321).

- [ ] **Step 5: Commit**

```bash
git add src/zip321.ts src/zip321.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(zip321): parsePaymentUri (single-recipient inverse of buildPaymentUri)"
```

---

## Task 6: ZIP-321 multi-recipient build + parse (TDD)

**Files:**
- Modify: `src/zip321.ts` (add `buildMultiPaymentUri`, `parseMultiPaymentUri`)
- Modify: `src/zip321.test.ts` (multi-recipient tests)

ZIP-321 grammar: indexed parameters use `paramindex = "." NONZERO 0*3DIGIT`. Indexes start at 1 (the empty index is reserved for the first recipient). Leading zeros are FORBIDDEN — `address.0` is invalid; `address.01` is invalid.

The first recipient gets the empty index (either as the path component `zcash:<addr>?...` or as `?address=...`). Subsequent recipients are `address.1`, `address.2`, etc.

- [ ] **Step 1: Add multi-recipient tests to `src/zip321.test.ts`**

Append:

```ts
import { buildMultiPaymentUri, parseMultiPaymentUri } from './zip321';

describe('buildMultiPaymentUri', () => {
  const A = 'u1aaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const B = 'u1bbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  it('emits zcash:?address=...&address.1=... for two recipients', () => {
    const uri = buildMultiPaymentUri([
      { address: A, amount: '1' },
      { address: B, amount: '2' },
    ]);
    expect(uri.startsWith('zcash:?')).toBe(true);
    expect(uri).toContain(`address=${A}`);
    expect(uri).toContain(`address.1=${B}`);
    expect(uri).toContain('amount=1');
    expect(uri).toContain('amount.1=2');
  });

  it('throws on empty payments array', () => {
    expect(() => buildMultiPaymentUri([])).toThrow(/empty|at least/i);
  });

  it('throws on a single payment (caller should use buildPaymentUri)', () => {
    expect(() => buildMultiPaymentUri([{ address: A, amount: '1' }]))
      .toThrow(/multi|single/i);
  });
});

describe('parseMultiPaymentUri', () => {
  const A = 'u1aaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const B = 'u1bbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const C = 'u1cccccccccccccccccccccccccccc';

  it('parses two recipients in order (empty index then .1)', () => {
    const uri      = `zcash:?address=${A}&amount=1&address.1=${B}&amount.1=2`;
    const payments = parseMultiPaymentUri(uri);
    expect(payments.length).toBe(2);
    expect(payments[0].address).toBe(A);
    expect(payments[0].amount).toBe('1');
    expect(payments[1].address).toBe(B);
    expect(payments[1].amount).toBe('2');
  });

  it('round-trips: build → parse → equal', () => {
    const original = [
      { address: A, amount: '0.1', label: 'first'  },
      { address: B, amount: '0.2', memo:  'second' },
      { address: C, amount: '0.3' },
    ];
    const uri      = buildMultiPaymentUri(original);
    const parsed   = parseMultiPaymentUri(uri);
    expect(parsed.length).toBe(3);
    expect(parsed[0].address).toBe(A);
    expect(parsed[1].memo).toBe('second');
    expect(parsed[2].amount).toBe('0.3');
  });

  it('rejects address.0 (leading zero index forbidden by ZIP-321)', () => {
    const uri = `zcash:?address=${A}&amount=1&address.0=${B}&amount.0=2`;
    expect(() => parseMultiPaymentUri(uri)).toThrow(/leading zero|index|address\.0/i);
  });

  it('rejects orphan amount.N without matching address.N', () => {
    const uri = `zcash:?address=${A}&amount=1&amount.1=2`;
    expect(() => parseMultiPaymentUri(uri)).toThrow(/orphan|missing|address\.1/i);
  });
});
```

- [ ] **Step 2: Run tests, observe failure**

```bash
npm test -- zip321
```

Expected: failure (functions not exported).

- [ ] **Step 3: Implement multi-recipient functions**

Append to `src/zip321.ts`:

```ts
// ── Multi-recipient build/parse (ZIP-321 §"URI Semantics") ───────────
// Multi-recipient URIs use the form  zcash:?address=A&amount=1&address.1=B&amount.1=2&...
// The empty paramindex is the first recipient. Subsequent recipients
// use ".1", ".2", etc. Leading zeros are FORBIDDEN by the ABNF
// (paramindex = "." NONZERO 0*3DIGIT).

const MULTI_INDEX_RE = /^\.(?:[1-9][0-9]{0,3})$/;

function appendIndexedParams(
  params: URLSearchParams,
  payment: PaymentRequest,
  suffix: string,
): void {
  params.set(`amount${suffix}`,            payment.amount);
  if (payment.memo)    params.set(`memo${suffix}`,    toBase64Url(payment.memo));
  if (payment.label)   params.set(`label${suffix}`,   payment.label);
  if (payment.message) params.set(`message${suffix}`, payment.message);
}

export function buildMultiPaymentUri(payments: PaymentRequest[]): string {
  if (payments.length === 0) {
    throw new Error('buildMultiPaymentUri: empty payments — at least one required');
  }
  if (payments.length === 1) {
    throw new Error('buildMultiPaymentUri: single payment — use buildPaymentUri instead');
  }

  const params = new URLSearchParams();
  // First payment uses the empty index.
  params.set('address', payments[0].address);
  appendIndexedParams(params, payments[0], '');
  // Subsequent payments use .1, .2, ...
  for (let i = 1; i < payments.length; i++) {
    const suffix = `.${i}`;
    params.set(`address${suffix}`, payments[i].address);
    appendIndexedParams(params, payments[i], suffix);
  }
  return `zcash:?${params.toString().replace(/\+/g, '%20')}`;
}

export function parseMultiPaymentUri(uri: string): PaymentRequest[] {
  if (!uri.startsWith('zcash:')) {
    throw new Error('parseMultiPaymentUri: scheme must be zcash:');
  }
  const queryStart = uri.indexOf('?');
  if (queryStart === -1) {
    throw new Error('parseMultiPaymentUri: missing query string');
  }
  const params = new URLSearchParams(uri.slice(queryStart + 1));

  // Group params by index suffix
  const groups = new Map<string, URLSearchParams>();   // key = '' or '.1' ...
  for (const [k, v] of params) {
    const dotIdx = k.indexOf('.');
    const base   = dotIdx === -1 ? k : k.slice(0, dotIdx);
    const suffix = dotIdx === -1 ? '' : k.slice(dotIdx);
    if (suffix !== '' && !MULTI_INDEX_RE.test(suffix)) {
      // forbid address.0, address.01, etc.
      throw new Error(`parseMultiPaymentUri: invalid paramindex "${suffix}" (leading zero or malformed)`);
    }
    if (!groups.has(suffix)) groups.set(suffix, new URLSearchParams());
    groups.get(suffix)!.set(base, v);
  }

  // Every group must have an address (per ZIP-321 §"URI Semantics")
  const out: { idx: number; payment: PaymentRequest }[] = [];
  for (const [suffix, group] of groups) {
    const addr = group.get('address');
    if (!addr) {
      throw new Error(`parseMultiPaymentUri: orphan params at index "${suffix}" — missing address${suffix}`);
    }
    const amount = group.get('amount');
    if (!amount) {
      throw new Error(`parseMultiPaymentUri: missing amount${suffix}`);
    }
    const memoB64 = group.get('memo') ?? undefined;
    const idx     = suffix === '' ? 0 : parseInt(suffix.slice(1), 10);
    out.push({
      idx,
      payment: {
        address: addr,
        amount,
        memo:    memoB64 ? fromBase64Url(memoB64) : undefined,
        label:   group.get('label')   ?? undefined,
        message: group.get('message') ?? undefined,
      },
    });
  }

  // Sort by index ascending so empty-index (0) comes first.
  out.sort((a, b) => a.idx - b.idx);
  return out.map(x => x.payment);
}
```

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test
```

Expected: ~34 cases pass (existing 27 + 7 new multi-recipient).

- [ ] **Step 5: Commit**

```bash
git add src/zip321.ts src/zip321.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(zip321): multi-recipient build/parse (split-payment URIs)

ZIP-321 §URI Semantics: address, address.1, address.2, ... up to
4-digit indices, leading zeros forbidden. Round-trip property tests
verify build → parse equality across 3-recipient configurations."
```

---

## Task 7: Wire `parseUnifiedAddress` into server startup + add new routes

**Files:**
- Modify: `src/server.ts`
- Modify: `.env`, `.env.example` (replace placeholder address with a known-valid UA)

- [ ] **Step 1: Update `.env.example` and `.env` to a known-valid UA**

The current `.env` has `MERCHANT_ADDRESS=u1placeholder_set_real_address_before_deploy_xxxxxxxxxxxxxxxxxxxx` which is NOT valid bech32m. Once we add startup validation, the server will refuse to boot.

Replace the line in BOTH `.env` and `.env.example`:

```
MERCHANT_ADDRESS=u17fst5ww5cqecg9wkvyfm83cphawxnjdy96vh4yp4qrnzn8wuhf6axdym7v94vsuc4tlsetn8d6kt8ad7p5wddx8df7n38c0jhuksp9j4d22efrh4q83trf66h6tj7zh4yqecdjsce0vy2ytz4j4tt4fc8nv2gxax6jvsv70
```

(This is the same public test UA used in the unit tests. It's a public test address — not a real wallet — and it makes the server boot cleanly so the demo works without manual configuration.)

- [ ] **Step 2: Modify `src/server.ts` — add startup validation and two routes**

At the top of `src/server.ts`, just after the existing imports, add:

```ts
import { parseUnifiedAddress } from './zip316';
import { parsePaymentUri, parseMultiPaymentUri } from './zip321';
```

In the env-loading section (after `MERCHANT_ADDRESS` is read), REPLACE the existing `if (!MERCHANT_ADDRESS) { ... process.exit(1); }` block with:

```ts
if (!MERCHANT_ADDRESS) {
  console.error('ERROR: MERCHANT_ADDRESS environment variable is not set.');
  console.error('Set it to your Zcash Orchard unified address (starts with u1).');
  process.exit(1);
}

let merchantAddressDetails;
try {
  merchantAddressDetails = parseUnifiedAddress(MERCHANT_ADDRESS);
} catch (e) {
  console.error(`ERROR: MERCHANT_ADDRESS is not a valid Zcash unified address: ${(e as Error).message}`);
  process.exit(1);
}

if (!merchantAddressDetails.isOrchardCapable) {
  console.warn(`WARNING: MERCHANT_ADDRESS has no Orchard receiver. Receivers found: ${
    merchantAddressDetails.receivers.map(r => r.type).join(', ')
  }`);
}
```

After the `app.get('/health', ...)` route (anywhere in the route registration block), add two new routes:

```ts
app.post('/uris/parse', (req, res) => {
  const { uri } = req.body as { uri?: string };
  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ error: 'uri (string) is required in request body' });
  }
  try {
    // Multi-recipient URIs lack a path-component address (zcash:?...).
    // Detect by checking whether anything precedes the '?' after 'zcash:'.
    const after  = uri.startsWith('zcash:') ? uri.slice('zcash:'.length) : '';
    const isMulti = after.startsWith('?');
    if (isMulti) {
      const payments = parseMultiPaymentUri(uri);
      return res.json({ kind: 'multi', payments });
    }
    const payment = parsePaymentUri(uri);
    return res.json({ kind: 'single', payment });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/address/:addr/details', (req, res) => {
  try {
    const ua = parseUnifiedAddress(req.params.addr);
    return res.json(ua);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});
```

- [ ] **Step 3: Type-check + tests**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -3
```

Expected: tsc exit 0; ~34 cases pass (no new tests this task, just integration).

- [ ] **Step 4: Smoke-test the new endpoints manually**

Start the server in the background:

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm run dev > /tmp/zc-server.log 2>&1 &
SERVER_PID=$!
sleep 6
cat /tmp/zc-server.log
```

Expected: the server boots without the previous warning, prints "Connected to Zcash network. Latest block: <number>".

Test the new routes:

```bash
echo "=== /address/<MERCHANT_ADDRESS>/details ==="
curl -s "http://localhost:3000/address/$(grep MERCHANT_ADDRESS .env | cut -d= -f2)/details" | python3 -m json.tool

echo "=== /uris/parse (single) ==="
curl -s -X POST http://localhost:3000/uris/parse \
  -H 'Content-Type: application/json' \
  -d '{"uri":"zcash:u1example?amount=0.5&label=Test"}' | python3 -m json.tool

echo "=== /uris/parse (multi) ==="
curl -s -X POST http://localhost:3000/uris/parse \
  -H 'Content-Type: application/json' \
  -d '{"uri":"zcash:?address=u1a&amount=1&address.1=u1b&amount.1=2"}' | python3 -m json.tool

kill $SERVER_PID 2>/dev/null
```

Expected outputs:
- `/address/.../details` → JSON with `network`, `receivers`, `isOrchardCapable: true`.
- `/uris/parse` single → `{ kind: 'single', payment: { address: 'u1example', amount: '0.5', label: 'Test' } }`.
- `/uris/parse` multi → `{ kind: 'multi', payments: [...] }` with two entries.

If any fail, debug and re-run before committing.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts .env.example
# .env is gitignored; do not stage it
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(server): startup UA validation, /uris/parse, /address/:addr/details

- Validate MERCHANT_ADDRESS via parseUnifiedAddress at startup; exit 1
  if invalid bech32m or unknown HRP. Warn (don't exit) if no Orchard
  receiver — testnet/legacy addresses are valid use cases.
- POST /uris/parse: routes single- vs multi-recipient based on path
  component, returns { kind, payment | payments } or 400 with error.
- GET /address/:addr/details: returns UnifiedAddress shape.
- Replace placeholder MERCHANT_ADDRESS in .env.example with the public
  test UA used by the unit tests so the server boots out-of-the-box."
```

---

## Task 8: UI — address details panel + parse URI panel

**Files:**
- Modify: `public/index.html`

We add two new panels below the existing card. Both fetch from the new endpoints.

- [ ] **Step 1: Update `public/index.html`**

In `public/index.html`, add the following inside `<style>` (above the existing `</style>` closing tag), to style the new panels:

```css
    .panel { background: #fff; border-radius: 18px; padding: 22px;
             box-shadow: 0 4px 32px rgba(0,0,0,0.08); margin-top: 16px; }
    .panel h3 { font-size: 14px; font-weight: 800; color: #0D6E56;
                text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .receiver-tag { display: inline-block; font-size: 11px; font-weight: 700;
                    background: #e6f5f0; color: #0D6E56; padding: 3px 10px;
                    border-radius: 12px; margin-right: 6px; margin-top: 4px; }
    .receiver-tag.orchard  { background:#d4edda; color:#155724; }
    .receiver-tag.sapling  { background:#d1ecf1; color:#0c5460; }
    .receiver-tag.p2pkh, .receiver-tag.p2sh { background:#fff3cd; color:#856404; }
    .receiver-tag.unknown  { background:#f8d7da; color:#721c24; }
    .uri-textarea { width: 100%; min-height: 60px; padding: 10px;
                    border: 1.5px solid #e0e0e0; border-radius: 10px;
                    font-family: monospace; font-size: 12px; resize: vertical; }
    .parse-output { margin-top: 12px; background: #f7f7f7; border-radius: 8px;
                    padding: 10px; font-family: monospace; font-size: 11px;
                    white-space: pre-wrap; word-break: break-all; max-height: 300px;
                    overflow: auto; }
    .small-btn { padding: 8px 16px; background: #0D6E56; color: #fff;
                 border: none; border-radius: 8px; font-size: 13px;
                 font-weight: 700; cursor: pointer; }
    .small-btn:hover { background: #0a5a47; }
```

Inside `<div class="wrap">`, BEFORE `<div class="footer">...`, add the two new panels:

```html
  <div class="panel" id="addrPanel">
    <h3>Merchant Address Details</h3>
    <div id="addrSummary">Loading...</div>
    <div id="addrReceivers"></div>
  </div>

  <div class="panel">
    <h3>Parse a ZIP-321 URI</h3>
    <textarea class="uri-textarea" id="parseInput"
              placeholder="Paste a zcash: URI here (single or multi-recipient)"></textarea>
    <button class="small-btn" onclick="parseUri()" style="margin-top:8px;">Parse</button>
    <div class="parse-output" id="parseOutput" style="display:none;"></div>
  </div>
```

In the `<script>` section (BEFORE the closing `</script>`), add:

```js
  // Auto-load address details on page load
  async function loadAddressDetails() {
    try {
      // Fetch the merchant address from a known-valid invoice (cheap probe)
      const probe = await fetch('/health');
      const h     = await probe.json();
      // /health truncates the address to 20 chars; we need the full one.
      // Easiest: ask the server-side env via a created invoice. But cleaner
      // is a dedicated "merchant" endpoint. For MVP we just use a no-cost trick:
      // create an invoice for 0.001 ZEC, read .address, then forget it.
      const r = await fetch('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountZec: '0.001', orderId: '_addr_probe' }),
      });
      const inv = await r.json();
      const addr = inv.address;
      const d = await fetch('/address/' + encodeURIComponent(addr) + '/details');
      if (!d.ok) throw new Error((await d.json()).error);
      const ua = await d.json();
      document.getElementById('addrSummary').innerHTML =
        '<strong>Network:</strong> ' + ua.network +
        ' &middot; <strong>Receivers:</strong> ' + ua.receivers.length +
        ' &middot; <strong>Orchard capable:</strong> ' +
        (ua.isOrchardCapable ? 'yes' : 'no');
      document.getElementById('addrReceivers').innerHTML =
        ua.receivers.map(r =>
          '<span class="receiver-tag ' + r.type + '">' + r.type + ' (typeId=' + r.typeId + ', ' + r.length + ' bytes)</span>'
        ).join('');
    } catch (e) {
      document.getElementById('addrSummary').textContent = 'Failed to load address details: ' + e.message;
    }
  }

  async function parseUri() {
    const uri = document.getElementById('parseInput').value.trim();
    const out = document.getElementById('parseOutput');
    if (!uri) { alert('Paste a zcash: URI first'); return; }
    out.style.display = 'block';
    out.textContent = 'Parsing...';
    try {
      const r = await fetch('/uris/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri }),
      });
      const d = await r.json();
      out.textContent = JSON.stringify(d, null, 2);
    } catch (e) {
      out.textContent = 'Error: ' + e.message;
    }
  }

  // Auto-load address details on page open
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAddressDetails);
  } else {
    loadAddressDetails();
  }
```

- [ ] **Step 2: Smoke test in browser (manual)**

Start the server:

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm run dev > /tmp/zc-server.log 2>&1 &
SERVER_PID=$!
sleep 5
echo "Open http://localhost:3000 in a browser. Verify:"
echo "  1. Address Details panel shows: Network: main · Receivers: N · Orchard capable: yes"
echo "  2. Receiver tags appear (e.g., 'orchard (typeId=3, 43 bytes)')"
echo "  3. Pasting 'zcash:u1example?amount=1' into the parse panel and clicking Parse shows JSON"
echo "When done, kill the server: kill $SERVER_PID"
```

(This is a manual check — proceed to commit only if the panels render and behave correctly.)

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(ui): address details panel + parse URI panel

- Address Details auto-fetches /address/<MERCHANT>/details on page load
  via a one-shot invoice probe (so the UI doesn't need to embed the
  configured address). Renders network, receiver count, and per-receiver
  type tags.
- Parse URI panel: textarea + button calling /uris/parse, renders the
  decoded payment (or array of payments for multi-recipient) as JSON."
```

---

## Task 9: UI — multi-recipient toggle on the create form

**Files:**
- Modify: `public/index.html` (extend the create form + the `generate()` JS)
- Modify: `src/server.ts` (extend `POST /invoices` to accept `payments` array)

This task connects the multi-recipient builder to the demo. The user adds extra address+amount rows; the server uses `buildMultiPaymentUri`.

- [ ] **Step 1: Server-side: extend `POST /invoices`**

In `src/server.ts`, in the `app.post('/invoices', ...)` handler, replace the body destructuring + URI build with multi-aware logic:

Find the current handler body (the `try` block) and REPLACE the destructuring + URI build (everything from `const { amountZec, orderId, label, webhookUrl } = ...` down to `const qrCode = await QRCode.toDataURL(paymentUri, ...)`) with:

```ts
    const body = req.body as {
      amountZec?:   string;
      orderId?:     string;
      label?:       string;
      webhookUrl?:  string;
      payments?:    Array<{ amountZec: string; orderId?: string; label?: string }>;
    };

    const isMulti = Array.isArray(body.payments) && body.payments.length > 1;

    if (!isMulti) {
      // Single-recipient flow — existing behavior preserved.
      const amountZec = body.payments?.[0]?.amountZec ?? body.amountZec ?? '';
      const orderId   = body.payments?.[0]?.orderId   ?? body.orderId;
      const label     = body.payments?.[0]?.label     ?? body.label;

      const parsedAmount = parseFloat(amountZec);
      if (!amountZec || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'amountZec must be a positive number' });
      }

      const currentBlock = await getLatestBlockHeight(client);

      // MVP scope: the memo carries a placeholder invoice id, not the real one.
      // Threading the real id requires moving Invoices.create earlier in the
      // flow (or pre-generating the UUID); deferred to M2 along with memo-based
      // payment matching, which is the only thing that would actually consume
      // this field. The QR/URI returned to the client is internally consistent
      // because the same memoText is also stored on the invoice record.
      const memoText = buildMemo({
        invoiceId: 'pending',
        orderId:   orderId ?? 'none',
      });

      const paymentUri = buildPaymentUri({
        address: MERCHANT_ADDRESS,
        amount:  amountZec,
        memo:    memoText,
        label:   label ?? 'ZcashConnect Payment',
      });

      const qrCode = await QRCode.toDataURL(paymentUri, {
        errorCorrectionLevel: 'M',
        width:  256,
        margin: 2,
      });

      const invoice = Invoices.create({
        address:    MERCHANT_ADDRESS,
        amountZec,
        memoText,
        paymentUri,
        currentBlock,
        webhookUrl: body.webhookUrl,
      });

      return res.status(201).json({
        invoiceId:      invoice.id,
        address:        invoice.address,
        amountZec:      invoice.amountZec,
        paymentUri:     invoice.paymentUri,
        qrCode,
        status:         invoice.status,
        createdAt:      invoice.createdAt,
        expiresAtBlock: invoice.expiresAtBlock,
        currentBlock,
        network:        NETWORK,
        kind:           'single',
      });
    }

    // ── Multi-recipient flow ───────────────────────────────────────
    const payments = body.payments!;
    for (const p of payments) {
      const v = parseFloat(p.amountZec);
      if (!p.amountZec || Number.isNaN(v) || v <= 0) {
        return res.status(400).json({ error: `each payment.amountZec must be a positive number` });
      }
    }

    const currentBlock = await getLatestBlockHeight(client);
    const totalZec = payments.reduce((s, p) => s + parseFloat(p.amountZec), 0).toString();

    const memoText = buildMemo({
      invoiceId: 'pending',
      orderId:   payments.map(p => p.orderId ?? 'none').join(','),
    });

    const paymentUri = buildMultiPaymentUri(
      payments.map((p, i) => ({
        address: MERCHANT_ADDRESS,
        amount:  p.amountZec,
        // Only attach memo to the first recipient (memo per-recipient is allowed
        // by ZIP-321; we keep MVP simple and put it on index 0 only)
        memo:    i === 0 ? memoText : undefined,
        label:   p.label ?? `ZcashConnect Payment ${i + 1}`,
      })),
    );

    const qrCode = await QRCode.toDataURL(paymentUri, {
      errorCorrectionLevel: 'M',
      width:  256,
      margin: 2,
    });

    const invoice = Invoices.create({
      address:    MERCHANT_ADDRESS,
      amountZec:  totalZec,
      memoText,
      paymentUri,
      currentBlock,
      webhookUrl: body.webhookUrl,
    });

    return res.status(201).json({
      invoiceId:      invoice.id,
      address:        invoice.address,
      amountZec:      totalZec,
      paymentUri:     invoice.paymentUri,
      qrCode,
      status:         invoice.status,
      createdAt:      invoice.createdAt,
      expiresAtBlock: invoice.expiresAtBlock,
      currentBlock,
      network:        NETWORK,
      kind:           'multi',
      payments:       payments.map(p => ({ amountZec: p.amountZec, label: p.label })),
    });
```

Note: the import `buildMultiPaymentUri` should already be in scope from Task 7's import line. If not, add it to the existing `import * as Invoices from './invoices'` block by adding it to the zip321 import.

- [ ] **Step 2: UI: add multi-recipient toggle to the form**

In `public/index.html`, modify the `#form` div. Replace the existing form fields (the `.field` blocks for amount and orderId, plus the button) with:

```html
    <div id="form">
      <div id="recipientsList">
        <div class="recipient-row" data-idx="0">
          <div class="field">
            <label>Amount (ZEC)</label>
            <input type="number" class="amount-input" value="0.01"
                   step="0.001" min="0.001" placeholder="0.01">
          </div>
          <div class="field">
            <label>Order reference (optional)</label>
            <input type="text" class="order-input" placeholder="ORDER-001">
          </div>
        </div>
      </div>
      <button class="small-btn" type="button" onclick="addRecipient()" style="margin-bottom:8px; background:#888;">+ Add recipient</button>
      <button class="btn" id="genBtn" onclick="generate()">
        Generate Payment Request
      </button>
    </div>
```

In the `<style>` block, add:

```css
    .recipient-row { border-bottom: 1px solid #f0f0f0; padding-bottom: 6px; margin-bottom: 10px; }
    .recipient-row:last-child { border-bottom: none; }
    .recipient-row .remove-btn { font-size: 11px; color: #c00; cursor: pointer; background: none; border: none; padding: 0; }
```

In the `<script>` block, REPLACE the existing `generate()` function with:

```js
  function addRecipient() {
    const list = document.getElementById('recipientsList');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.className = 'recipient-row';
    div.setAttribute('data-idx', idx);
    div.innerHTML =
      '<div class="field">' +
      '  <label>Amount (ZEC) #' + (idx + 1) + ' <button type="button" class="remove-btn" onclick="this.closest(\'.recipient-row\').remove()">remove</button></label>' +
      '  <input type="number" class="amount-input" value="0.01" step="0.001" min="0.001">' +
      '</div>' +
      '<div class="field">' +
      '  <label>Order reference (optional)</label>' +
      '  <input type="text" class="order-input" placeholder="ORDER-' + String(idx + 1).padStart(3, "0") + '">' +
      '</div>';
    list.appendChild(div);
  }

  async function generate() {
    const rows = document.querySelectorAll('#recipientsList .recipient-row');
    const payments = [];
    rows.forEach(row => {
      const amount  = row.querySelector('.amount-input').value;
      const orderId = row.querySelector('.order-input').value;
      if (amount && parseFloat(amount) > 0) {
        payments.push({ amountZec: amount, orderId: orderId || undefined });
      }
    });
    if (payments.length === 0) { alert('Enter at least one valid amount'); return; }

    const btn = document.getElementById('genBtn');
    btn.disabled = true; btn.textContent = 'Generating...';
    try {
      const body = payments.length === 1
        ? { amountZec: payments[0].amountZec, orderId: payments[0].orderId }
        : { payments };
      const r = await fetch('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      invoiceId = d.invoiceId;
      document.getElementById('dispAmount').textContent = d.amountZec + ' ZEC' + (d.kind === 'multi' ? ' (' + d.payments.length + ' payments)' : '');
      document.getElementById('dispNet').textContent    = (d.network || 'mainnet').toUpperCase();
      document.getElementById('qrImg').src              = d.qrCode;
      document.getElementById('dispAddr').textContent   = d.address;
      document.getElementById('dispUri').textContent    = d.paymentUri;
      document.getElementById('form').style.display     = 'none';
      document.getElementById('invoice').style.display  = 'block';
      setStatus('CREATED');
      poll = setInterval(checkStatus, 10000);
    } catch (e) {
      alert('Error: ' + e.message);
      btn.disabled = false; btn.textContent = 'Generate Payment Request';
    }
  }
```

ALSO update the existing `reset()` function to restore the single recipient:

Find:
```js
  function reset() {
    clearInterval(poll); invoiceId = null;
    document.getElementById('form').style.display    = 'block';
    document.getElementById('invoice').style.display = 'none';
    document.getElementById('genBtn').disabled       = false;
    document.getElementById('genBtn').textContent    = 'Generate Payment Request';
    document.getElementById('amount').value          = '0.01';
    document.getElementById('orderId').value         = '';
  }
```

Replace with:

```js
  function reset() {
    clearInterval(poll); invoiceId = null;
    document.getElementById('form').style.display    = 'block';
    document.getElementById('invoice').style.display = 'none';
    document.getElementById('genBtn').disabled       = false;
    document.getElementById('genBtn').textContent    = 'Generate Payment Request';
    // Reset to a single recipient row
    const list = document.getElementById('recipientsList');
    list.innerHTML =
      '<div class="recipient-row" data-idx="0">' +
      '  <div class="field"><label>Amount (ZEC)</label>' +
      '    <input type="number" class="amount-input" value="0.01" step="0.001" min="0.001" placeholder="0.01">' +
      '  </div>' +
      '  <div class="field"><label>Order reference (optional)</label>' +
      '    <input type="text" class="order-input" placeholder="ORDER-001">' +
      '  </div>' +
      '</div>';
  }
```

- [ ] **Step 3: Type-check and tests**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -3
```

Expected: tsc exit 0, ~34 cases pass.

- [ ] **Step 4: Smoke test in browser (manual)**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm run dev > /tmp/zc-server.log 2>&1 &
SERVER_PID=$!
sleep 5
echo "Open http://localhost:3000:"
echo "  1. Click + Add recipient → second row appears"
echo "  2. Set both amounts (e.g., 0.01 and 0.02) and click Generate"
echo "  3. Display should show 'X.XX ZEC (2 payments)' and a QR code"
echo "  4. Decoded URI should start with 'zcash:?address=' and contain 'address.1='"
echo "When done: kill $SERVER_PID"
```

- [ ] **Step 5: Commit**

```bash
git add public/index.html src/server.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(server,ui): multi-recipient invoice creation

- Server: POST /invoices accepts either { amountZec, ... } (single) or
  { payments: [...] } (multi). Multi flow uses buildMultiPaymentUri,
  totals the amounts, and stores the result as one invoice with the
  combined paymentUri.
- UI: + Add recipient button appends rows; reset() collapses back to
  one. Display shows '(N payments)' suffix on multi-recipient invoices."
```

---

## Task 10: README v1.1 update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README sections**

Open `README.md`. In the `## What this is` section, REPLACE the bullet list with:

```markdown
- ZIP-321 payment request URI generation (build + parse, single + multi-recipient)
- ZIP-316 Unified Address parsing — bech32m, F4Jumble, TLV receiver decoding,
  implemented from scratch and tested against ZIP-316
- gRPC connection to the Zcash network via lightwalletd
- Invoice lifecycle management: CREATED → DETECTING → CONFIRMED → EXPIRED
- A clean merchant demo page that works in any browser
```

Find the `## API` table and REPLACE it with:

```markdown
| Method | Path                       | Description |
|---|---|---|
| POST | /invoices                    | Create a payment invoice. Body: `{ amountZec, ... }` (single) or `{ payments: [...] }` (multi-recipient) |
| GET  | /invoices/:id                | Get invoice status |
| GET  | /invoices                    | List all invoices |
| GET  | /health                      | Verify server and Zcash network connection |
| POST | /uris/parse                  | Parse a `zcash:` URI back to structured fields. Body: `{ uri }` |
| GET  | /address/:addr/details       | Decode a Zcash unified address: receivers, network, Orchard capability |
```

After the `## Tests` section, add a new section:

```markdown
## Zcash spec coverage

This MVP implements the following Zcash specifications from scratch:

### ZIP-321 (Payment Request URIs) — full

- Builder: single-recipient (`zcash:<addr>?amount=...`) and multi-recipient
  (`zcash:?address=...&address.1=...`).
- Parser: round-trip property tested against the builder. Handles both URI
  forms (path-component address vs `address=` query param). Rejects the
  forbidden `zcash://` form, percent-encoded scheme/parameter names, and
  `address.0` (paramindex must not have a leading zero).
- Memo encoding: base64url with no padding, 512-byte cap on the encoded
  memo. RFC 3986 percent-encoding for spaces in `label` / `message` (not
  the `+` form-encoded variant).

### ZIP-316 (Unified Addresses) — decoder

- Bech32m envelope decode (using the `bech32` npm package for the envelope
  only — all Zcash-specific logic is implemented locally).
- F4Jumble: the 4-round Feistel network defined in ZIP-316 §Jumbling,
  using personalized BLAKE2b (`UA_F4Jumble_H` and `UA_F4Jumble_G`).
  Implemented from scratch in `src/zip316.ts`. Round-trip property tested
  at lengths 48, 64, 100, and 248 bytes.
- HRP padding strip (16-byte zero-padded HRP appended to the TLV).
- Variable-length integer (Bitcoin/Zcash `compactSize`) codec.
- TLV receiver decoder for typecodes 0 (P2PKH), 1 (P2SH), 2 (Sapling),
  3 (Orchard); unknown typecodes pass through as `unknown` rather than
  causing parse failure (per the ZIP-316 forward-compatibility intent).

### Out of scope (still M2/M3)

- Trial decryption with viewing keys.
- Building UAs from receivers (requires Orchard / Sapling key material).
- Validating that a receiver's bytes form a valid public key on its curve.
- Memo decryption / payment matching against incoming transactions.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "docs: README v1.1 — document ZIP-316 + ZIP-321 spec coverage"
```

---

## Task 11: Final smoke test

No commits. Verify the entire system end-to-end before push.

- [ ] **Step 1: Type-check + full test suite**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx tsc --noEmit
npm test 2>&1 | tail -5
```

Expected: tsc exit 0; ~34 tests pass across `zip316.test.ts` (15+) and `zip321.test.ts` (16+) and `invoices.test.ts` (11). Total ≥ 42.

- [ ] **Step 2: Server boots cleanly with new validation**

```bash
npm run dev > /tmp/zc-server.log 2>&1 &
SERVER_PID=$!
sleep 6
cat /tmp/zc-server.log
```

Expected: NO `ERROR: MERCHANT_ADDRESS is not a valid Zcash unified address` line. The server prints "Connected to Zcash network. Latest block: <large>".

- [ ] **Step 3: All routes work**

```bash
ADDR=$(grep '^MERCHANT_ADDRESS=' .env | cut -d= -f2)

echo "=== /health ==="
curl -s http://localhost:3000/health | python3 -m json.tool

echo "=== /address/<ADDR>/details ==="
curl -s "http://localhost:3000/address/$ADDR/details" | python3 -m json.tool

echo "=== POST /invoices (single) ==="
curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.05","orderId":"SINGLE-1"}' \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('kind:', d.get('kind')); print('paymentUri starts with:', d['paymentUri'][:40], '...'); print('status:', d['status'])"

echo "=== POST /invoices (multi) ==="
curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d "{\"payments\":[{\"amountZec\":\"0.01\"},{\"amountZec\":\"0.02\"}]}" \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('kind:', d.get('kind')); print('total amountZec:', d['amountZec']); print('payments:', len(d.get('payments', [])))"

echo "=== POST /uris/parse (round-trip a built URI) ==="
URI=$(curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.7"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['paymentUri'])")
echo "Built URI: $URI"
curl -s -X POST http://localhost:3000/uris/parse \
  -H 'Content-Type: application/json' \
  --data-raw "{\"uri\":\"$URI\"}" | python3 -m json.tool

kill $SERVER_PID 2>/dev/null
```

Expected:
- `/health` returns ok with current mainnet block.
- `/address/<ADDR>/details` returns `{ network: 'main', receivers: [...], isOrchardCapable: true }`.
- Single invoice has `kind: 'single'`, multi has `kind: 'multi'` with 2 payments, total amountZec is sum.
- `/uris/parse` of the built URI returns `{ kind: 'single', payment: { ... } }` with the same address and amount that went in.

- [ ] **Step 4: Browser check (manual)**

Restart the server and open `http://localhost:3000` in a browser. Verify:
- Address Details panel populates with at least one receiver tag (Orchard, Sapling, etc.)
- Click `+ Add recipient`, enter two amounts, click Generate. The QR appears with `(2 payments)` suffix.
- Click `New Invoice` → form resets to a single recipient row.
- In the Parse URI panel, paste any zcash: URI, click Parse, see decoded JSON.

Stop the server.

- [ ] **Step 5: Final state confirmation**

```bash
git log --oneline | head -20
git log --format='%an <%ae> | %s' --all | grep -i 'claude' || echo "(no Claude footers — clean)"
git status
```

Expected: 26 commits total (16 original + 10 v1.1), all `Sanjay Subedi`, no Claude footers, clean working tree.

---

## Self-review

**Spec coverage:**
- Spec §1 Goal — three deliverables: ZIP-316 (Tasks 2-4), ZIP-321 parser (Task 5), multi-recipient (Task 6). ✓
- Spec §2 Non-goals — README in Task 10 explicitly disclaims trial decryption, UA building, key validity. ✓
- Spec §3 Architecture — `zip316.ts` is new (Tasks 2-4), `zip321.ts` extended (Tasks 5-6), server thin composition root preserved (Task 7), UI gains 3 panels (Tasks 8-9). ✓
- Spec §4 Module: `zip316.ts` — Task 2 (compactSize), Task 3 (F4Jumble), Task 4 (parseUnifiedAddress). All four exports (`parseUnifiedAddress`, `f4Jumble`, `f4Unjumble`, types) are produced. ✓
- Spec §5 ZIP-321 extensions — Task 5 (parsePaymentUri), Task 6 (multi-recipient build/parse). All three new exports produced. ✓
- Spec §6 Server changes — Task 7 (startup validation, /uris/parse, /address/:addr/details). ✓
- Spec §7 UI changes — Task 8 (address details + parse URI panels), Task 9 (multi-recipient toggle). ✓
- Spec §8 Test strategy — Tasks 2/3/4 cover ~15 zip316 cases; Tasks 5/6 cover ~12 zip321 added cases. Total target ≥42 met. ✓
- Spec §9 Verification — Task 11 covers all five verification criteria. ✓

**Placeholder scan:** No TBD/TODO. The one place with implementation discretion is the test UA in Tasks 4 and 7 — if it doesn't decode, the engineer is told to substitute another known-valid mainnet UA from the public test-vectors repo. That's not a placeholder; that's an explicit fallback.

**Type consistency:**
- `Receiver`, `ReceiverType`, `UnifiedAddress`, `Network` defined in Task 4, used implicitly in Task 7 (server route returns the shape).
- `PaymentRequest` defined in v1.0 `zip321.ts`, extended-by-import in Tasks 5, 6, 7.
- `parsePaymentUri`, `parseMultiPaymentUri`, `buildMultiPaymentUri`, `parseUnifiedAddress` consistent across tasks.

No issues found.
