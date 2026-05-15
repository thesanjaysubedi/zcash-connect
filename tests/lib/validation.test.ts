import { describe, it, expect } from 'vitest';
import {
  parseSignupForm, parseSettingsForm,
  parseApiKeyCreate, parseApiKeyRename,
  parseInvoiceCreate, parseAdminVerify,
  parseAmountZec, isOrchardUnifiedAddress,
} from '@/lib/validation';

const UA = 'u1' + 'a'.repeat(180);
const UUID = '00000000-0000-0000-0000-000000000001';

describe('parseAmountZec', () => {
  it('accepts decimal strings up to 8 fractional digits', () => {
    expect(parseAmountZec('1.5')).toBe(150_000_000n);
    expect(parseAmountZec('0.00000001')).toBe(1n);
    expect(parseAmountZec('21000000')).toBe(2_100_000_000_000_000n);
  });
  it('rejects too many fractional digits', () => {
    expect(() => parseAmountZec('0.123456789')).toThrow(/fractional/);
  });
  it('rejects zero and negative', () => {
    expect(() => parseAmountZec('0')).toThrow(/positive/);
    expect(() => parseAmountZec('-1')).toThrow(/positive/);
  });
  it('rejects non-numeric', () => {
    expect(() => parseAmountZec('abc')).toThrow();
  });
});

describe('isOrchardUnifiedAddress', () => {
  it('accepts u1 prefix and plausible length', () => {
    expect(isOrchardUnifiedAddress('u1' + 'a'.repeat(180))).toBe(true);
  });
  it('accepts testnet utest1 prefix and plausible length', () => {
    expect(isOrchardUnifiedAddress('utest1' + 'a'.repeat(180))).toBe(true);
  });
  it('rejects wrong prefix or too short', () => {
    expect(isOrchardUnifiedAddress('t1abc')).toBe(false);
    expect(isOrchardUnifiedAddress('u1')).toBe(false);
    expect(isOrchardUnifiedAddress('utest1')).toBe(false);
    expect(isOrchardUnifiedAddress('')).toBe(false);
  });
});

describe('parseSignupForm', () => {
  it('accepts valid input', () => {
    const r = parseSignupForm({ email: 'a@b.co', password: 'longenoughpw', store_name: 'X' });
    expect(r.email).toBe('a@b.co');
  });
  it('rejects short passwords', () => {
    expect(() => parseSignupForm({ email: 'a@b.co', password: 'short', store_name: 'X' }))
      .toThrow();
  });
  it('rejects missing store_name', () => {
    expect(() => parseSignupForm({ email: 'a@b.co', password: 'longenoughpw', store_name: '' }))
      .toThrow();
  });
});

describe('parseSettingsForm', () => {
  it('accepts valid input', () => {
    expect(parseSettingsForm({ store_name: 'Y', payout_address: UA }))
      .toMatchObject({ store_name: 'Y' });
  });
  it('rejects bad payout address', () => {
    expect(() => parseSettingsForm({ store_name: 'Y', payout_address: 'nope' })).toThrow();
  });
  it('accepts new optional profile fields', () => {
    const r = parseSettingsForm({
      store_name: 'Y',
      payout_address: UA,
      contact_email: 'hi@store.co',
      support_url:   'https://store.co/help',
      brand_color:   '#1a2b3c',
      logo_url:      'https://store.co/logo.png',
    });
    expect(r.contact_email).toBe('hi@store.co');
    expect(r.brand_color).toBe('#1a2b3c');
  });
  it('treats empty strings as not-provided for optional fields', () => {
    const r = parseSettingsForm({
      store_name: 'Y', payout_address: UA,
      contact_email: '', support_url: '', brand_color: '', logo_url: '',
    });
    expect(r.contact_email).toBeUndefined();
    expect(r.brand_color).toBeUndefined();
  });
  it('rejects malformed contact_email and brand_color', () => {
    expect(() => parseSettingsForm({ store_name: 'Y', payout_address: UA, contact_email: 'not-email' })).toThrow();
    expect(() => parseSettingsForm({ store_name: 'Y', payout_address: UA, brand_color: 'red' })).toThrow();
    expect(() => parseSettingsForm({ store_name: 'Y', payout_address: UA, brand_color: '#12345' })).toThrow();
  });
  it('rejects malformed support_url and logo_url', () => {
    expect(() => parseSettingsForm({ store_name: 'Y', payout_address: UA, support_url: 'not a url' })).toThrow();
    expect(() => parseSettingsForm({ store_name: 'Y', payout_address: UA, logo_url:    'also not' })).toThrow();
  });
});

describe('parseApiKeyCreate', () => {
  it('requires non-empty name', () => {
    expect(parseApiKeyCreate({ name: 'Production' })).toEqual({ name: 'Production' });
    expect(() => parseApiKeyCreate({ name: '' })).toThrow();
  });
});

describe('parseApiKeyRename', () => {
  it('accepts valid uuid + name', () => {
    expect(parseApiKeyRename({ id: UUID, name: 'Staging' }))
      .toEqual({ id: UUID, name: 'Staging' });
  });
  it('rejects bad id or empty / too-long name', () => {
    expect(() => parseApiKeyRename({ id: 'not-uuid', name: 'X' })).toThrow();
    expect(() => parseApiKeyRename({ id: UUID, name: '' })).toThrow();
    expect(() => parseApiKeyRename({ id: UUID, name: 'a'.repeat(51) })).toThrow();
  });
});

describe('parseAdminVerify', () => {
  it('accepts a uuid merchant_id', () => {
    expect(parseAdminVerify({ merchant_id: UUID })).toEqual({ merchant_id: UUID });
  });
  it('rejects non-uuid input', () => {
    expect(() => parseAdminVerify({ merchant_id: 'nope' })).toThrow();
    expect(() => parseAdminVerify({})).toThrow();
  });
});

describe('parseInvoiceCreate', () => {
  it('accepts minimal valid payload', () => {
    const r = parseInvoiceCreate({ amount_zec: '1.5' });
    expect(r.amount_zec).toBe('1.5');
    expect(r.expires_in).toBe(3600);
  });
  it('clamps and validates expires_in', () => {
    expect(() => parseInvoiceCreate({ amount_zec: '1', expires_in: 0 })).toThrow();
    expect(() => parseInvoiceCreate({ amount_zec: '1', expires_in: 100_000 })).toThrow();
  });
  it('enforces memo byte-length', () => {
    const long = 'A'.repeat(513);
    expect(() => parseInvoiceCreate({ amount_zec: '1', memo_text: long })).toThrow(/512/);
  });
});
