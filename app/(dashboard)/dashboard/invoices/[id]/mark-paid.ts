'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const markPaidSchema = z.object({
  invoice_id: z.string().regex(/^inv_[A-Za-z0-9_-]{22}$/),
  paid_txid: z.string().min(0).max(128).optional(),
});

export async function markPaid(input: { invoice_id: string; paid_txid?: string }):
  Promise<{ ok: true } | { ok: false; error: string }> {
  let parsed;
  try { parsed = markPaidSchema.parse(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const { data: invoice } = await supabase
    .from('invoices').select('id, status').eq('id', parsed.invoice_id).single();
  if (!invoice) return { ok: false, error: 'Invoice not found' };
  if (invoice.status !== 'open') return { ok: false, error: `Cannot mark ${invoice.status} invoice as paid` };

  const { error } = await supabase.from('invoices').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    paid_txid: parsed.paid_txid ?? null,
  }).eq('id', parsed.invoice_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/invoices/${parsed.invoice_id}`);
  revalidatePath('/dashboard/invoices');
  return { ok: true };
}
