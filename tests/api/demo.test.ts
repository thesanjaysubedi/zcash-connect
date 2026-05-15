import { describe, it, expect, afterAll } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { POST as DEMO } from '@/app/api/demo/route';

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

function req(cookieHeader?: string) {
  const headers: Record<string,string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;
  return new Request('http://x/api/demo', { method: 'POST', headers: new Headers(headers) }) as any;
}

describe('POST /api/demo', () => {
  it('200 + creates a demo merchant', async () => {
    const r = await DEMO(req());
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.redirect).toBe('/dashboard');

    // Note: signInWithPassword inside createDemoSandbox writes Supabase auth
    // cookies through Next's cookies() store, which isn't fully wired up
    // when we invoke the route function directly in vitest. The cookie
    // path is exercised in the manual E2E walkthrough (Task 11). Here we
    // just verify the provisioning side effects landed in the database.
    const { data: demos } = await admin.from('merchants')
      .select('id').eq('is_demo', true).order('created_at', { ascending: false }).limit(1);
    expect(demos!.length).toBe(1);
    createdMerchantIds.push(demos![0].id);
  });

  it('429 when the zc_last_demo_at cookie is younger than 60s', async () => {
    const recent = new Date(Date.now() - 5_000).toISOString();
    const r = await DEMO(req(`zc_last_demo_at=${encodeURIComponent(recent)}`));
    expect(r.status).toBe(429);
    const body = await r.json();
    expect(body.error.code).toBe('rate_limited');
  });

  it('200 when the zc_last_demo_at cookie is older than 60s', async () => {
    const old = new Date(Date.now() - 120_000).toISOString();
    const r = await DEMO(req(`zc_last_demo_at=${encodeURIComponent(old)}`));
    expect(r.status).toBe(200);
    const { data: latest } = await admin.from('merchants')
      .select('id').eq('is_demo', true).order('created_at', { ascending: false }).limit(1).single();
    createdMerchantIds.push(latest!.id);
  });
});
