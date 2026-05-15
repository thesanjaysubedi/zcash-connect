import { describe, it, expect, beforeEach } from 'vitest';
import { createClient as createSb } from '@supabase/supabase-js';
import { joinWaitlist } from '@/lib/waitlist';

const admin = createSb(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

describe('joinWaitlist', () => {
  beforeEach(async () => {
    await admin.from('waitlist_signups').delete().like('email', 'test-waitlist-%');
  });

  it('inserts a new signup and returns ok', async () => {
    const email = `test-waitlist-${Date.now()}@example.com`;
    const r = await joinWaitlist({ email, source: 'landing-hero' });
    expect(r).toEqual({ ok: true });
    const { data } = await admin.from('waitlist_signups')
      .select('email, source').eq('email', email).single();
    expect(data!.source).toBe('landing-hero');
  });

  it('treats duplicate email as success (no error)', async () => {
    const email = `test-waitlist-${Date.now()}-dup@example.com`;
    const a = await joinWaitlist({ email });
    const b = await joinWaitlist({ email });
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    const { count } = await admin.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('email', email);
    expect(count).toBe(1);
  });

  it('case-insensitive duplicate detection', async () => {
    const lower = `test-waitlist-${Date.now()}-case@example.com`;
    const upper = lower.toUpperCase();
    await joinWaitlist({ email: lower });
    const r = await joinWaitlist({ email: upper });
    expect(r).toEqual({ ok: true });
    const { count } = await admin.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).ilike('email', lower);
    expect(count).toBe(1);
  });

  it('rejects invalid email payload', async () => {
    const r = await joinWaitlist({ email: 'not-email' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/email/i);
  });
});
