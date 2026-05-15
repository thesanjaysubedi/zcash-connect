import { describe, it, expect, afterAll } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { createDemoSandbox } from '@/lib/demo-provision';

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const createdMerchantIds: string[] = [];

afterAll(async () => {
  for (const id of createdMerchantIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe('createDemoSandbox', () => {
  it('creates a demo auth.user, promotes merchant, mints a real API key', async () => {
    const r = await createDemoSandbox();
    createdMerchantIds.push(r.merchantId);

    expect(r.fullKey).toMatch(/^zk_live_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{22}$/);

    const { data: { user } } = await admin.auth.admin.getUserById(r.merchantId);
    expect(user!.email).toMatch(/^demo-[0-9a-f-]+@zcashconnect\.demo$/);

    const { data: m } = await admin.from('merchants')
      .select('is_demo, demo_expires_at, verified, payout_address, store_name')
      .eq('id', r.merchantId).single();
    expect(m!.is_demo).toBe(true);
    expect(m!.verified).toBe(true);
    expect(m!.store_name).toBe('Demo store');
    expect(m!.payout_address).toMatch(/^utest1[a-z0-9]{180}$/);
    const expiresAt = new Date(m!.demo_expires_at!).getTime();
    const expected  = Date.now() + 7 * 24 * 3600 * 1000;
    expect(Math.abs(expiresAt - expected)).toBeLessThan(60_000);

    const { data: k } = await admin.from('api_keys')
      .select('name, revoked_at, expires_at').eq('merchant_id', r.merchantId).single();
    expect(k!.name).toBe('Demo key');
    expect(k!.revoked_at).toBeNull();
    expect(k!.expires_at).toBeNull();
  });
});
