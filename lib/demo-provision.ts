import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createSsrClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/api-keys';

export interface DemoSandboxResult {
  merchantId: string;
  fullKey:    string;
}

const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomTestnetUA(): string {
  let out = 'utest1';
  for (let i = 0; i < 180; i++) {
    out += ALNUM[Math.floor(Math.random() * ALNUM.length)];
  }
  return out;
}

export async function createDemoSandbox(): Promise<DemoSandboxResult> {
  const admin = createAdminClient();
  const uuid = randomUUID();
  const email = `demo-${uuid}@zcashconnect.demo`;
  const password = randomUUID() + randomUUID();   // ~64 chars of entropy

  // 1. Create auth.users (handle_new_user trigger creates the merchants row).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { store_name: 'Demo store' },
  });
  if (createErr || !created.user) throw new Error(createErr?.message ?? 'createUser failed');
  const merchantId = created.user.id;

  // 2. Promote the merchant: demo flag, expiry, verified, fake payout, store_name.
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { error: updErr } = await admin.from('merchants').update({
    is_demo: true,
    demo_expires_at: expiresAt,
    verified: true,
    verified_at: new Date().toISOString(),
    payout_address: randomTestnetUA(),
    store_name: 'Demo store',
  }).eq('id', merchantId);
  if (updErr) throw new Error(updErr.message);

  // 3. Mint an initial API key.
  const fresh = await generateApiKey();
  const { error: keyErr } = await admin.from('api_keys').insert({
    merchant_id: merchantId,
    name: 'Demo key',
    prefix: fresh.prefix,
    hashed_secret: fresh.hashedSecret,
  });
  if (keyErr) throw new Error(keyErr.message);

  // 4. Sign the visitor in via the SSR-aware client so Supabase session
  // cookies get written through Next's cookies() store. This step requires
  // a Next request scope (cookies() must be callable); outside one (e.g. a
  // vitest run) it will throw — we swallow that so the function remains
  // testable end-to-end. Callers in a real request will get a real session.
  try {
    const ssr = await createSsrClient();
    const { error: signInErr } = await ssr.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(signInErr.message);
  } catch (e) {
    if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') throw e;
  }

  return { merchantId, fullKey: fresh.fullKey };
}
