import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateApiKey } from '@/lib/api-auth';
import { generateApiKey } from '@/lib/api-keys';

const mockSingle = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
      update: mockUpdate,
    }),
  }),
}));

describe('authenticateApiKey', () => {
  beforeEach(() => { mockSingle.mockReset(); mockUpdate.mockClear(); });

  it('returns 401 when header missing', async () => {
    const r = await authenticateApiKey(new Headers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('returns 401 on malformed bearer', async () => {
    const r = await authenticateApiKey(new Headers({ authorization: 'Bearer garbage' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('returns 401 when key not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const r = await authenticateApiKey(new Headers({ authorization: 'Bearer zk_live_abcdEFGH_' + 'x'.repeat(22) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('returns 403 when merchant unverified', async () => {
    const { fullKey, prefix, hashedSecret } = await generateApiKey();
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'kid', merchant_id: 'mid', prefix, hashed_secret: hashedSecret, revoked_at: null,
        merchants: { id: 'mid', verified: false, payout_address: null },
      },
      error: null,
    });
    const r = await authenticateApiKey(new Headers({ authorization: `Bearer ${fullKey}` }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.code).toBe('merchant_unverified');
    }
  });

  it('returns 403 when payout address missing', async () => {
    const { fullKey, prefix, hashedSecret } = await generateApiKey();
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'kid', merchant_id: 'mid', prefix, hashed_secret: hashedSecret, revoked_at: null,
        merchants: { id: 'mid', verified: true, payout_address: null },
      },
      error: null,
    });
    const r = await authenticateApiKey(new Headers({ authorization: `Bearer ${fullKey}` }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.code).toBe('payout_address_missing');
    }
  });

  it('returns merchant context on success', async () => {
    const { fullKey, prefix, hashedSecret } = await generateApiKey();
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'kid', merchant_id: 'mid', prefix, hashed_secret: hashedSecret, revoked_at: null,
        merchants: { id: 'mid', verified: true, payout_address: 'u1' + 'a'.repeat(180), store_name: 'S' },
      },
      error: null,
    });
    const r = await authenticateApiKey(new Headers({ authorization: `Bearer ${fullKey}` }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.merchantId).toBe('mid');
      expect(r.payoutAddress).toMatch(/^u1/);
    }
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns 401 on bcrypt mismatch', async () => {
    const { fullKey, prefix } = await generateApiKey();
    const otherKey = await generateApiKey();
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'kid', merchant_id: 'mid', prefix,
        hashed_secret: otherKey.hashedSecret, revoked_at: null,
        merchants: { id: 'mid', verified: true, payout_address: 'u1' + 'a'.repeat(180) },
      },
      error: null,
    });
    const r = await authenticateApiKey(new Headers({ authorization: `Bearer ${fullKey}` }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});
