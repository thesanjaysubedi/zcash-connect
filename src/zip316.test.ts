import { describe, it, expect } from 'vitest';
import { encodeCompactSize, decodeCompactSize, f4Jumble, f4Unjumble, parseUnifiedAddress } from './zip316';

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

describe('parseUnifiedAddress', () => {
  // Official test vector from zcash-hackworks/zcash-test-vectors (account 1, div_index 3).
  // Substituted for the task-description vector which had an invalid checksum.
  // Contains p2pkh (typecode 0), sapling (2), and orchard (3) receivers.
  const TEST_UA_MAIN = 'u1pg2aaph7jp8rpf6yhsza25722sg5fcn3vaca6ze27hqjw7jvvhhuxkpcg0ge9xh6drsgdkda8qjq5chpehkcpxf87rnjryjqwymdheptpvnljqqrjqzjwkc2ma6hcq666kgwfytxwac8eyex6ndgr6ezte66706e3vaqrd25dzvzkc69kw0jgywtd0cmq52q5lkw6uh7hyvzjse8ksx';

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
    // bech32m with HRP "xx" — valid checksum, unknown to Zcash UA spec
    expect(() => parseUnifiedAddress('xx1qqqsyrn4uq5')).toThrow(/HRP|prefix|unknown/i);
  });

  it('exposes the typecodes of decoded receivers', () => {
    const ua = parseUnifiedAddress(TEST_UA_MAIN);
    const typeIds = ua.receivers.map(r => r.typeId).sort((a, b) => a - b);
    expect(typeIds[0]).toBeGreaterThanOrEqual(0);
  });
});
