import { describe, it, expect, beforeEach } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { POST as WAITLIST } from '@/app/api/waitlist/route';

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function req(body: unknown) {
  return new Request('http://x/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/waitlist', () => {
  beforeEach(async () => {
    await admin.from('waitlist_signups').delete().like('email', 'test-wl-route-%');
  });

  it('200 + persists row for valid email + source', async () => {
    const email = `test-wl-route-${Date.now()}@example.com`;
    const r = await WAITLIST(req({ email, source: 'landing-hero' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const { data } = await admin.from('waitlist_signups')
      .select('email, source').eq('email', email).single();
    expect(data!.source).toBe('landing-hero');
  });

  it('200 on duplicate email (re-submit)', async () => {
    const email = `test-wl-route-${Date.now()}-dup@example.com`;
    await WAITLIST(req({ email }));
    const r = await WAITLIST(req({ email }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('400 on malformed email', async () => {
    const r = await WAITLIST(req({ email: 'not-email' }));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error.code).toBe('validation_error');
  });

  it('400 on missing body / wrong content-type', async () => {
    const r = await WAITLIST(new Request('http://x/api/waitlist', { method: 'POST' }) as any);
    expect(r.status).toBe(400);
  });
});
