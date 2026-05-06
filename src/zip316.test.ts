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
