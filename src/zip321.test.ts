import { describe, it, expect } from 'vitest';
import { buildPaymentUri, buildMemo, parsePaymentUri } from './zip321';

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

  it('percent-encodes spaces as %20, not +, in label and message', () => {
    const uri = buildPaymentUri({
      address: ADDR,
      amount:  '1',
      label:   'Order 1',
      message: 'thank you',
    });
    expect(uri).toContain('label=Order%201');
    expect(uri).toContain('message=thank%20you');
    expect(uri).not.toMatch(/[?&](label|message)=[^&]*\+/);
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

  it('accepts a payload at exactly 512 bytes', () => {
    // For invoiceId of length 365: JSON is {"invoiceId":"x...x"} = 381 bytes,
    // base64url-encoded = 508 chars (no padding because 381 % 3 == 0),
    // total memo length = 4 ('ZC1:') + 508 = 512 bytes exactly.
    const id = 'x'.repeat(365);
    const memo = buildMemo({ invoiceId: id });
    expect(Buffer.byteLength(memo, 'utf8')).toBe(512);
  });

  it('throws when payload is just one increment over 512 bytes', () => {
    // invoiceId of length 366 produces a 514-byte memo (the next valid base64
    // length after 512), confirming the cap rejects values just over the limit.
    expect(() => buildMemo({ invoiceId: 'x'.repeat(366) })).toThrow(/Memo too long/);
  });
});

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
