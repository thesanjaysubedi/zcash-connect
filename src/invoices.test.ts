import { describe, it, expect, beforeEach } from 'vitest';
import * as Invoices from './invoices';

const baseParams = {
  address:     'u1example',
  amountZec:   '0.01',
  memoText:    'ZC1:abc',
  paymentUri:  'zcash:u1example?amount=0.01',
  currentBlock: 1000,
};

beforeEach(() => Invoices._resetForTests());

describe('create', () => {
  it('returns invoice with status CREATED', () => {
    const inv = Invoices.create(baseParams);
    expect(inv.status).toBe('CREATED');
    expect(inv.id).toBeTypeOf('string');
    expect(inv.id.length).toBeGreaterThan(0);
  });

  it('defaults expiresAtBlock to currentBlock + 24', () => {
    const inv = Invoices.create(baseParams);
    expect(inv.expiresAtBlock).toBe(1024);
    expect(inv.createdAtBlock).toBe(1000);
  });

  it('honors a custom expiryBlocks', () => {
    const inv = Invoices.create({ ...baseParams, expiryBlocks: 100 });
    expect(inv.expiresAtBlock).toBe(1100);
  });
});

describe('get and list', () => {
  it('get returns undefined for unknown id', () => {
    expect(Invoices.get('nope')).toBeUndefined();
  });

  it('list returns invoices newest first', async () => {
    const a = Invoices.create(baseParams);
    await new Promise(r => setTimeout(r, 5));
    const b = Invoices.create(baseParams);
    const all = Invoices.list();
    expect(all[0].id).toBe(b.id);
    expect(all[1].id).toBe(a.id);
  });
});

describe('updateStatus', () => {
  it('updates status and returns invoice', () => {
    const inv = Invoices.create(baseParams);
    const updated = Invoices.updateStatus(inv.id, 'CONFIRMED', 'tx-abc');
    expect(updated?.status).toBe('CONFIRMED');
    expect(updated?.detectedTxId).toBe('tx-abc');
  });

  it('returns undefined for unknown id', () => {
    expect(Invoices.updateStatus('nope', 'CONFIRMED')).toBeUndefined();
  });
});

describe('expireStale', () => {
  it('flips CREATED past deadline to EXPIRED', () => {
    const inv = Invoices.create(baseParams); // expires at 1024
    const expired = Invoices.expireStale(2000);
    expect(expired).toContain(inv.id);
    expect(Invoices.get(inv.id)?.status).toBe('EXPIRED');
  });

  it('does not flip CONFIRMED invoices', () => {
    const inv = Invoices.create(baseParams);
    Invoices.updateStatus(inv.id, 'CONFIRMED');
    const expired = Invoices.expireStale(2000);
    expect(expired).not.toContain(inv.id);
    expect(Invoices.get(inv.id)?.status).toBe('CONFIRMED');
  });

  it('does not flip invoices still within deadline', () => {
    const inv = Invoices.create(baseParams); // expires at 1024
    const expired = Invoices.expireStale(1010);
    expect(expired).toEqual([]);
    expect(Invoices.get(inv.id)?.status).toBe('CREATED');
  });

  it('also expires DETECTING invoices past deadline', () => {
    const inv = Invoices.create(baseParams);
    Invoices.updateStatus(inv.id, 'DETECTING');
    const expired = Invoices.expireStale(2000);
    expect(expired).toContain(inv.id);
    expect(Invoices.get(inv.id)?.status).toBe('EXPIRED');
  });
});
