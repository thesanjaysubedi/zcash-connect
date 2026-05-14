'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseAdminVerify } from '@/lib/validation';

export interface AdminActionResult { ok: boolean; error?: string }

export async function verifyMerchant(input: { merchant_id: string }): Promise<AdminActionResult> {
  const admin = await requireAdminUser();
  if (!admin) return { ok: false, error: 'Not authorized' };

  let parsed: ReturnType<typeof parseAdminVerify>;
  try { parsed = parseAdminVerify(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from('merchants')
    .update({ verified: true, verified_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', parsed.merchant_id)
    .eq('verified', false);
  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: 'Merchant not found or already verified' };

  revalidatePath('/admin');
  return { ok: true };
}
