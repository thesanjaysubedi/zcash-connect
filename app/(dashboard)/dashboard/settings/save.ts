'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseSettingsForm } from '@/lib/validation';

export interface SaveResult { ok: boolean; error?: string }

export async function saveSettings(input: { store_name: string; payout_address: string }): Promise<SaveResult> {
  let parsed: ReturnType<typeof parseSettingsForm>;
  try { parsed = parseSettingsForm(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const { error } = await supabase.from('merchants')
    .update({ store_name: parsed.store_name, payout_address: parsed.payout_address })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  return { ok: true };
}
