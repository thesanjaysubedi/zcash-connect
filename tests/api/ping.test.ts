import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { GET as PING } from '@/app/api/v1/ping/route';
import { generateApiKey } from '@/lib/api-keys';

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let MERCHANT_ID: string;

async function seedKey() {
  const k = await generateApiKey();
  const { data } = await admin.from('api_keys').insert({
    merchant_id: MERCHANT_ID, name: 'ping-test', prefix: k.prefix, hashed_secret: k.hashedSecret,
  }).select('id').single();
  return { id: data!.id, fullKey: k.fullKey };
}

function req(headers: Record<string,string> = {}) {
  return new Request('http://x/api/v1/ping', { method: 'GET', headers: new Headers(headers) }) as any;
}

describe('GET /api/v1/ping', () => {
  beforeAll(async () => {
    const email = `test-ping-${Date.now()}@example.com`;
    const { data: user, error: userErr } = await admin.auth.admin.createUser({
      email, password: 'longenoughpw', email_confirm: true,
      user_metadata: { store_name: 'Ping' },
    });
    if (userErr || !user.user) throw userErr ?? new Error('createUser failed');
    MERCHANT_ID = user.user.id;

    // The handle_new_user trigger creates a merchant row; promote it to verified
    // with a payout address so the auth path accepts the key.
    await admin.from('merchants').update({
      store_name: 'Ping',
      payout_address: 'u1' + 'a'.repeat(180),
      verified: true,
      verified_at: new Date().toISOString(),
    }).eq('id', MERCHANT_ID);
  });

  afterAll(async () => {
    if (MERCHANT_ID) {
      await admin.auth.admin.deleteUser(MERCHANT_ID);
    }
  });

  it('returns 200 + merchant info for a valid key', async () => {
    const k = await seedKey();
    const r = await PING(req({ authorization: `Bearer ${k.fullKey}` }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.merchant_id).toBe(MERCHANT_ID);
    expect(body.store_name).toBe('Ping');
    expect(typeof body.server_time).toBe('string');
  });

  it('returns 401 unauthorized when no key', async () => {
    const r = await PING(req());
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body.error.code).toBe('unauthorized');
  });

  it('returns 401 key_expired when expires_at < now()', async () => {
    const k = await seedKey();
    await admin.from('api_keys').update({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }).eq('id', k.id);
    const r = await PING(req({ authorization: `Bearer ${k.fullKey}` }));
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body.error.code).toBe('key_expired');
  });
});
