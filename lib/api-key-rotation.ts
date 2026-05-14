import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey } from '@/lib/api-keys';

export interface RotateResult { fullKey: string; prefix: string; newKeyId: string }

export async function rotateApiKey(input: {
  apiKeyId: string;
  graceHours: 24 | 168 | 720;
}): Promise<RotateResult> {
  const supabase = createAdminClient();

  const { data: source, error: loadErr } = await supabase
    .from('api_keys')
    .select('id, merchant_id, name, revoked_at, rotated_to')
    .eq('id', input.apiKeyId)
    .single();
  if (loadErr || !source) throw new Error('API key not found');
  if (source.revoked_at) throw new Error('Cannot rotate a revoked key');
  if (source.rotated_to) throw new Error('Key is already rotating');

  const fresh = await generateApiKey();
  const { data: inserted, error: insertErr } = await supabase
    .from('api_keys')
    .insert({
      merchant_id:   source.merchant_id,
      name:          source.name,
      prefix:        fresh.prefix,
      hashed_secret: fresh.hashedSecret,
    })
    .select('id')
    .single();
  if (insertErr || !inserted) throw new Error(insertErr?.message ?? 'Failed to insert new key');

  const expiresAt = new Date(Date.now() + input.graceHours * 3600 * 1000).toISOString();
  const { error: updateErr } = await supabase
    .from('api_keys')
    .update({ expires_at: expiresAt, rotated_to: inserted.id })
    .eq('id', source.id);
  if (updateErr) throw new Error(updateErr.message);

  return { fullKey: fresh.fullKey, prefix: fresh.prefix, newKeyId: inserted.id };
}
