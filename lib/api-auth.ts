import { createAdminClient } from '@/lib/supabase/admin';
import { parseApiKey, verifyApiKey } from '@/lib/api-keys';

export type AuthResult =
  | { ok: true; merchantId: string; payoutAddress: string; storeName: string; apiKeyId: string }
  | { ok: false; status: 401 | 403; code: string; message: string };

export async function authenticateApiKey(headers: Headers): Promise<AuthResult> {
  const header = headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) {
    return { ok: false, status: 401, code: 'unauthorized', message: 'Missing Bearer token' };
  }
  const parsed = parseApiKey(header.slice('Bearer '.length).trim());
  if (!parsed) {
    return { ok: false, status: 401, code: 'unauthorized', message: 'Malformed API key' };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, merchant_id, hashed_secret, revoked_at, merchants:merchants!inner(id, verified, payout_address, store_name)')
    .eq('prefix', parsed.prefix)
    .single();

  if (error || !data) {
    return { ok: false, status: 401, code: 'unauthorized', message: 'Unknown API key' };
  }
  if (data.revoked_at) {
    return { ok: false, status: 401, code: 'unauthorized', message: 'API key revoked' };
  }
  const match = await verifyApiKey(parsed.secret, data.hashed_secret);
  if (!match) {
    return { ok: false, status: 401, code: 'unauthorized', message: 'Invalid API key' };
  }
  const merchant = Array.isArray(data.merchants) ? data.merchants[0] : data.merchants;
  if (!merchant.verified) {
    return { ok: false, status: 403, code: 'merchant_unverified', message: 'Merchant not verified yet' };
  }
  if (!merchant.payout_address) {
    return { ok: false, status: 403, code: 'payout_address_missing', message: 'Set your payout address first' };
  }

  void supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return {
    ok: true,
    merchantId: merchant.id,
    payoutAddress: merchant.payout_address as string,
    storeName: merchant.store_name as string,
    apiKeyId: data.id as string,
  };
}
