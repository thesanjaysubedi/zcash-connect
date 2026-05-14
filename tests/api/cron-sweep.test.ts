import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { POST as SWEEP } from '@/app/api/cron/expire-invoices/route';
import { generateApiKey } from '@/lib/api-keys';

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SECRET = process.env.CRON_SECRET!;
let MERCHANT_ID: string;

const req = () => new Request('http://x/api/cron/expire-invoices', {
  method: 'POST', headers: new Headers({ authorization: `Bearer ${SECRET}` }),
}) as any;

describe('cron sweep', () => {
  beforeAll(async () => {
    const email = `test-cron-${Date.now()}@example.com`;
    const { data: user, error } = await admin.auth.admin.createUser({
      email, password: 'longenoughpw', email_confirm: true,
      user_metadata: { store_name: 'Cron' },
    });
    if (error || !user.user) throw error ?? new Error('createUser failed');
    MERCHANT_ID = user.user.id;
    await admin.from('merchants').update({
      payout_address: 'u1' + 'a'.repeat(180),
      verified: true, verified_at: new Date().toISOString(),
    }).eq('id', MERCHANT_ID);
  });

  afterAll(async () => {
    if (MERCHANT_ID) await admin.auth.admin.deleteUser(MERCHANT_ID);
  });

  beforeEach(async () => {
    // Clean state per test for the keys this suite seeds.
    await admin.from('api_keys').delete().eq('merchant_id', MERCHANT_ID);
  });

  it('revokes keys whose expires_at has passed', async () => {
    const k = await generateApiKey();
    const { data: row } = await admin.from('api_keys').insert({
      merchant_id: MERCHANT_ID, name: 'sweep-test',
      prefix: k.prefix, hashed_secret: k.hashedSecret,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }).select('id').single();

    const r = await SWEEP(req());
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.keys_expired).toBeGreaterThanOrEqual(1);

    const { data: after } = await admin.from('api_keys')
      .select('revoked_at').eq('id', row!.id).single();
    expect(after!.revoked_at).not.toBeNull();
  });

  it('purges api_requests older than 90 days', async () => {
    const { data: stale } = await admin.from('api_requests').insert({
      method: 'GET', path: '/x', status: 200, latency_ms: 1,
      created_at: new Date(Date.now() - 91 * 24 * 3600 * 1000).toISOString(),
    }).select('id').single();

    const r = await SWEEP(req());
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.logs_purged).toBeGreaterThanOrEqual(1);

    const { data: after } = await admin.from('api_requests').select('id').eq('id', stale!.id).maybeSingle();
    expect(after).toBeNull();
  });
});
