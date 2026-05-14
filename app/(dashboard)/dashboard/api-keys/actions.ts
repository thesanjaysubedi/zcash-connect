'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseApiKeyCreate, parseApiKeyRename } from '@/lib/validation';
import { generateApiKey } from '@/lib/api-keys';

export async function createApiKey(input: { name: string }): Promise<
  | { ok: true; fullKey: string; prefix: string }
  | { ok: false; error: string }
> {
  let parsed: ReturnType<typeof parseApiKeyCreate>;
  try { parsed = parseApiKeyCreate(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in' };

  const { fullKey, prefix, hashedSecret } = await generateApiKey();
  const { error } = await supabase.from('api_keys').insert({
    merchant_id: user.id,
    name: parsed.name,
    prefix,
    hashed_secret: hashedSecret,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/api-keys');
  return { ok: true, fullKey, prefix };
}

export async function revokeApiKey(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/api-keys');
  return { ok: true };
}

export async function renameApiKey(input: { id: string; name: string }): Promise<{ ok: boolean; error?: string }> {
  let parsed: ReturnType<typeof parseApiKeyRename>;
  try { parsed = parseApiKeyRename(input); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  const supabase = await createClient();
  const { error } = await supabase
    .from('api_keys')
    .update({ name: parsed.name })
    .eq('id', parsed.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/dashboard/api-keys');
  return { ok: true };
}
