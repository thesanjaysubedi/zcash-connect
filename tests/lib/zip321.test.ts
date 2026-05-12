import { describe, it, expect } from 'vitest';
import { buildZip321Uri, zatoshisToZecString } from '@/lib/zip321';

describe('zatoshisToZecString', () => {
  it('formats zatoshis as a decimal ZEC string with 8 places and trims trailing zeros', () => {
    expect(zatoshisToZecString(150_000_000n)).toBe('1.5');
    expect(zatoshisToZecString(1n)).toBe('0.00000001');
    expect(zatoshisToZecString(2_100_000_000_000_000n)).toBe('21000000');
  });
});

describe('buildZip321Uri', () => {
  it('builds a minimal URI with just address and amount', () => {
    const u = buildZip321Uri({ address: 'u1xxx', amount_zatoshis: 150_000_000n });
    expect(u).toBe('zcash:u1xxx?amount=1.5');
  });

  it('adds memo as base64url (no padding), label, message percent-encoded', () => {
    const u = buildZip321Uri({
      address: 'u1xxx', amount_zatoshis: 100_000_000n,
      memo_text: 'Order #1234', label: 'Test Store', message: 'Hello world',
    });
    expect(u).toContain('amount=1');
    expect(u).toContain('memo=T3JkZXIgIzEyMzQ');
    expect(u).not.toContain('==');
    expect(u).toContain('label=Test%20Store');
    expect(u).toContain('message=Hello%20world');
  });

  it('omits empty optional fields', () => {
    const u = buildZip321Uri({ address: 'u1xxx', amount_zatoshis: 100_000_000n, memo_text: '' });
    expect(u).not.toContain('memo=');
  });
});
