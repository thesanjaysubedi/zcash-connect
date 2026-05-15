import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreateApiKeyForm } from '@/components/dashboard/create-api-key-form';
import { ApiKeysTable } from '@/components/dashboard/api-keys-table';

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from('merchants').select('verified, payout_address, archived_at').eq('id', user!.id).single();
  if (!merchant!.verified || !merchant!.payout_address || merchant!.archived_at) redirect('/dashboard');

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at, revoked_at, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="px-8 py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold">API keys</h1>
      <p className="mt-1 text-gray-600">Use these to authenticate your integration requests.</p>
      <div className="mt-6">
        <CreateApiKeyForm />
      </div>
      <div className="mt-10">
        <ApiKeysTable keys={keys ?? []} />
      </div>
    </div>
  );
}
