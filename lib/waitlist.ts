import { createAdminClient } from '@/lib/supabase/admin';
import { parseWaitlistInput } from '@/lib/validation';

export type WaitlistResult =
  | { ok: true }
  | { ok: false; kind: 'validation'; error: string }
  | { ok: false; kind: 'internal';   error: string };

export async function joinWaitlist(input: { email: string; source?: string }): Promise<WaitlistResult> {
  let parsed: ReturnType<typeof parseWaitlistInput>;
  try { parsed = parseWaitlistInput(input); }
  catch (e) { return { ok: false, kind: 'validation', error: (e as Error).message }; }

  const supabase = createAdminClient();
  // Insert; if a row with the same lower(email) already exists, the unique
  // index rejects with 23505. We treat that as success per the spec.
  const { error } = await supabase
    .from('waitlist_signups')
    .insert({ email: parsed.email, source: parsed.source ?? null });
  if (error) {
    if (error.code === '23505') return { ok: true };  // duplicate is success
    // Any other Supabase error is infra (RLS, network, etc.). Caller should
    // log r.error server-side and surface a generic message to the public.
    return { ok: false, kind: 'internal', error: error.message };
  }
  return { ok: true };
}
