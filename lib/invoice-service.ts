import { createAdminClient } from '@/lib/supabase/admin';
import { generateInvoiceId } from '@/lib/id';
import { buildZip321Uri, zatoshisToZecString } from '@/lib/zip321';
import { parseAmountZec } from '@/lib/validation';

export interface CreateInvoiceInput {
  merchantId: string;
  payoutAddress: string;
  storeName: string;
  amount_zec: string;
  memo_text?: string;
  reference?: string;
  description?: string;
  expires_in: number;
}

export interface InvoiceDto {
  id: string;
  amount_zec: string;
  amount_zatoshis: number;
  payout_address: string;
  memo_text: string | null;
  reference: string | null;
  description: string | null;
  status: 'open' | 'paid' | 'expired' | 'void';
  expires_at: string;
  paid_at: string | null;
  paid_txid: string | null;
  created_at: string;
  checkout_url: string;
  zip321_uri: string;
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function toDto(row: any, storeName: string): InvoiceDto {
  const zatoshis = BigInt(row.amount_zatoshis);
  const zec = zatoshisToZecString(zatoshis);
  const uri = buildZip321Uri({
    address: row.payout_address,
    amount_zatoshis: zatoshis,
    memo_text: row.memo_text ?? undefined,
    label: storeName,
  });
  return {
    id: row.id,
    amount_zec: zec,
    amount_zatoshis: Number(zatoshis),
    payout_address: row.payout_address,
    memo_text: row.memo_text,
    reference: row.reference,
    description: row.description,
    status: row.status,
    expires_at: row.expires_at,
    paid_at: row.paid_at,
    paid_txid: row.paid_txid,
    created_at: row.created_at,
    checkout_url: `${appBaseUrl()}/pay/${row.id}`,
    zip321_uri: uri,
  };
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDto> {
  const id = generateInvoiceId();
  const zatoshis = parseAmountZec(input.amount_zec);
  const expiresAt = new Date(Date.now() + input.expires_in * 1000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('invoices').insert({
    id,
    merchant_id: input.merchantId,
    amount_zatoshis: zatoshis.toString(),
    payout_address: input.payoutAddress,
    memo_text: input.memo_text ?? null,
    reference: input.reference ?? null,
    description: input.description ?? null,
    expires_at: expiresAt,
  }).select('*').single();

  if (error) throw new Error(`invoice insert failed: ${error.message}`);
  return toDto(data, input.storeName);
}

export async function getInvoiceForMerchant(id: string, merchantId: string, storeName: string): Promise<InvoiceDto | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('invoices').select('*').eq('id', id).eq('merchant_id', merchantId).single();
  if (error || !data) return null;
  return toDto(data, storeName);
}

export async function listInvoicesForMerchant(
  merchantId: string, storeName: string,
  opts: { status?: string; limit: number; before?: string } = { limit: 50 },
): Promise<{ data: InvoiceDto[]; has_more: boolean; next_cursor: string | null }> {
  const supabase = createAdminClient();
  let q = supabase
    .from('invoices')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(opts.limit + 1);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.before) {
    const { data: cursor } = await supabase
      .from('invoices').select('created_at').eq('id', opts.before).single();
    if (cursor) q = q.lt('created_at', cursor.created_at);
  }
  const { data, error } = await q;
  if (error || !data) return { data: [], has_more: false, next_cursor: null };

  const slice = data.slice(0, opts.limit);
  const has_more = data.length > opts.limit;
  const next_cursor = has_more ? slice[slice.length - 1].id : null;
  return { data: slice.map((r) => toDto(r, storeName)), has_more, next_cursor };
}
