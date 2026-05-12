import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Bypasses RLS. NEVER import this from a Client
 * Component. Only use in: route handlers, server actions, Server Components
 * that explicitly need to read public data with no JWT.
 */
export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE env vars for admin client');
  cached = createSupabaseClient(url, key, { auth: { persistSession: false } });
  return cached;
}
