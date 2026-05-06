import { describe, it, expect } from 'vitest';
import { buildPaymentUri, buildMemo } from './zip321';

describe('buildPaymentUri', () => {
  const ADDR = 'u1exampleorchardunifiedaddress';

  it('emits zcash:<addr>?amount=... with required params only', () => {
    const uri = buildPaymentUri({ address: ADDR, amount: '0.01' });
    expect(uri).toBe(`zcash:${ADDR}?amount=0.01`);
  });

  it('omits optional params when undefined', () => {
    const uri = buildPaymentUri({ address: ADDR, amount: '1' });
    expect(uri).not.toContain('memo=');
    expect(uri).not.toContain('label=');
    expect(uri).not.toContain('message=');
  });

  it('encodes memo as base64url and includes label and message', () => {
    const uri = buildPaymentUri({
      address: ADDR,
      amount:  '0.5',
      memo:    'hello world',
      label:   'Order 1',
      message: 'thanks',
    });
    const params = new URLSearchParams(uri.split('?')[1]);
    expect(params.get('amount')).toBe('0.5');
    // base64url has no '+', '/', or '=' padding
    const memoParam = params.get('memo')!;
    expect(memoParam).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(params.get('label')).toBe('Order 1');
    expect(params.get('message')).toBe('thanks');
  });

  it('preserves UTF-8 multibyte characters in memo', () => {
    const uri = buildPaymentUri({ address: ADDR, amount: '1', memo: '日本語' });
    const memoParam = new URLSearchParams(uri.split('?')[1]).get('memo')!;
    // Decode and verify round-trip
    const padded = memoParam + '='.repeat((4 - memoParam.length % 4) % 4);
    const decoded = Buffer.from(
      padded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    expect(decoded).toBe('日本語');
  });
});

describe('buildMemo', () => {
  it('produces a string starting with the ZC1: prefix', () => {
    const memo = buildMemo({ invoiceId: 'abc' });
    expect(memo.startsWith('ZC1:')).toBe(true);
  });

  it('encodes the JSON body as base64url with no padding', () => {
    const memo = buildMemo({ invoiceId: 'abc', orderId: '123' });
    const body = memo.slice('ZC1:'.length);
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/); // base64url alphabet, no '='
  });

  it('round-trips: decoding the base64url body yields the original JSON', () => {
    const data = { invoiceId: 'inv-xyz', orderId: 'ord-42' };
    const memo = buildMemo(data);
    const body = memo.slice('ZC1:'.length);
    const padded = body + '='.repeat((4 - body.length % 4) % 4);
    const json = Buffer.from(
      padded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    expect(JSON.parse(json)).toEqual(data);
  });

  it('throws when encoded length exceeds 512 bytes', () => {
    // a 600-byte string of ASCII chars will encode to ~800 chars in base64url
    const huge = { invoiceId: 'x'.repeat(600) };
    expect(() => buildMemo(huge)).toThrow(/Memo too long/);
  });

  it('accepts payloads at the 512-byte boundary', () => {
    // build payload size that lands the encoded result at <= 512 bytes
    // 'ZC1:' is 4 bytes; remaining 508 base64url chars decode to 381 bytes
    // JSON overhead for {"invoiceId":"..."} is 16 bytes -> id can be ~365 chars
    const id = 'x'.repeat(360);
    expect(() => buildMemo({ invoiceId: id })).not.toThrow();
  });
});
