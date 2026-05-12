import { describe, it, expect } from 'vitest';
import { generateInvoiceId, generateApiKeySecret, INVOICE_ID_RE } from '@/lib/id';

describe('generateInvoiceId', () => {
  it('produces a prefixed, fixed-length, URL-safe id', () => {
    const id = generateInvoiceId();
    expect(id.startsWith('inv_')).toBe(true);
    expect(id.length).toBe(4 + 22);
    expect(id).toMatch(INVOICE_ID_RE);
  });

  it('produces unique ids', () => {
    const set = new Set<string>();
    for (let i = 0; i < 5000; i += 1) set.add(generateInvoiceId());
    expect(set.size).toBe(5000);
  });
});

describe('generateApiKeySecret', () => {
  it('produces a 22-character URL-safe secret', () => {
    const s = generateApiKeySecret();
    expect(s.length).toBe(22);
    expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});
