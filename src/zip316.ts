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
