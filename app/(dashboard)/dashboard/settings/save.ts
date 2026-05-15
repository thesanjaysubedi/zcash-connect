'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseSettingsForm } from '@/lib/validation';

export interface SaveResult { ok: boolean; error?: string }

export interface SettingsInput {
  store_name: string;
  payout_address: string;
  contact_email?: string;
  support_url?: string;
  brand_color?: string;
  logo_url?: string;
}

export async function saveSettings(input: SettingsInput): Promise<SaveResult> {
  let parsed: ReturnType<typeof parseSettingsForm>;
  try { parsed = parseSettingsForm(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const { error } = await supabase.from('merchants')
    .update({
      store_name:     parsed.store_name,
      payout_address: parsed.payout_address,
      contact_email:  parsed.contact_email ?? null,
      support_url:    parsed.support_url ?? null,
      brand_color:    parsed.brand_color ?? null,
      logo_url:       parsed.logo_url ?? null,
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  return { ok: true };
}
