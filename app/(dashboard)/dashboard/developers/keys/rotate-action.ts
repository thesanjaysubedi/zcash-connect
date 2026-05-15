'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseRotateInput } from '@/lib/validation';
import { rotateApiKey } from '@/lib/api-key-rotation';

export type RotateResult =
  | { ok: true; fullKey: string; prefix: string }
  | { ok: false; error: string };

export async function rotateKeyAction(input: { apiKeyId: string; graceHours: number }): Promise<RotateResult> {
  let parsed: ReturnType<typeof parseRotateInput>;
  try { parsed = parseRotateInput(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  // Authorize: this RLS-scoped SELECT is the ownership gate (rotateApiKey
  // uses the admin client and bypasses RLS, so we must check ownership here).
  const { data: row } = await supabase.from('api_keys')
    .select('id').eq('id', parsed.apiKeyId).eq('merchant_id', user.id).maybeSingle();
  if (!row) return { ok: false, error: 'API key not found' };

  try {
    const r = await rotateApiKey({ apiKeyId: parsed.apiKeyId, graceHours: parsed.graceHours });
    revalidatePath('/dashboard/developers/keys');
    return { ok: true, fullKey: r.fullKey, prefix: r.prefix };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
