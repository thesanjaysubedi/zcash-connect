'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ArchiveResult { ok: boolean; error?: string }

export async function archiveMerchant(): Promise<ArchiveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const now = new Date().toISOString();
  const { error: archiveErr } = await supabase.from('merchants')
    .update({ archived_at: now })
    .eq('id', user.id);
  if (archiveErr) return { ok: false, error: archiveErr.message };

  // Revoke every active API key so partners can't keep authenticating.
  await supabase.from('api_keys')
    .update({ revoked_at: now })
    .is('revoked_at', null)
    .eq('merchant_id', user.id);

  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}

export async function unarchiveMerchant(): Promise<ArchiveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const { error } = await supabase.from('merchants')
    .update({ archived_at: null })
    .eq('id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}
