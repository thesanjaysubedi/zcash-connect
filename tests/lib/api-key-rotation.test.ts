import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { rotateApiKey } from '@/lib/api-key-rotation';
import { generateApiKey } from '@/lib/api-keys';

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const MERCHANT_ID = '00000000-0000-0000-0000-000000000001';

async function makeKey(name = 'test') {
  const k = await generateApiKey();
  const { data, error } = await admin.from('api_keys').insert({
    merchant_id: MERCHANT_ID, name, prefix: k.prefix, hashed_secret: k.hashedSecret,
  }).select('id, prefix').single();
  if (error) throw error;
  return { id: data.id, prefix: data.prefix, fullKey: k.fullKey };
}

describe('rotateApiKey', () => {
  beforeAll(async () => {
    // Ensure demo merchant exists (idempotent).
    await admin.from('merchants').upsert({
      id: MERCHANT_ID,
      store_name: 'Rotation test',
      payout_address: 'u1' + 'a'.repeat(180),
      verified: true,
      verified_at: new Date().toISOString(),
    });
  });

  beforeEach(async () => {
    await admin.from('api_keys').delete().eq('merchant_id', MERCHANT_ID);
  });

  it('issues a new key and sets expires_at + rotated_to on the old', async () => {
    const old = await makeKey('production');
    const { fullKey, prefix } = await rotateApiKey({ apiKeyId: old.id, graceHours: 24 });
    expect(fullKey).toMatch(/^zk_live_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{22}$/);
    expect(prefix).not.toBe(old.prefix);

    const { data: oldRow } = await admin.from('api_keys')
      .select('expires_at, rotated_to, revoked_at').eq('id', old.id).single();
    expect(oldRow!.expires_at).not.toBeNull();
    expect(oldRow!.rotated_to).not.toBeNull();
    expect(oldRow!.revoked_at).toBeNull();

    const expiresAt = new Date(oldRow!.expires_at!).getTime();
    const expected  = Date.now() + 24 * 3600 * 1000;
    expect(Math.abs(expiresAt - expected)).toBeLessThan(60_000); // within a minute
  });

  it('refuses to rotate an already-rotating key', async () => {
    const old = await makeKey('production');
    await rotateApiKey({ apiKeyId: old.id, graceHours: 24 });
    await expect(rotateApiKey({ apiKeyId: old.id, graceHours: 24 })).rejects.toThrow(/already rotating/);
  });

  it('refuses to rotate a revoked key', async () => {
    const old = await makeKey('production');
    await admin.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', old.id);
    await expect(rotateApiKey({ apiKeyId: old.id, graceHours: 24 })).rejects.toThrow(/revoked/);
  });
});
