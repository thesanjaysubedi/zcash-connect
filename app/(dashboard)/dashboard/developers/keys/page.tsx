import { createClient } from '@/lib/supabase/server';
import { CreateApiKeyForm } from '@/components/dashboard/create-api-key-form';
import { ApiKeysTable } from '@/components/dashboard/api-keys-table';
import { QuickTestCard } from '@/components/dashboard/developers/quick-test-card';

export const dynamic = 'force-dynamic';

export default async function KeysTab() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at, revoked_at, expires_at, rotated_to, created_at')
    .eq('merchant_id', user!.id)
    .order('created_at', { ascending: false });

  const activeKey = (keys ?? []).find((k) =>
    !k.revoked_at && (!k.expires_at || new Date(k.expires_at) > new Date()),
  );

  return (
    <div className="space-y-10">
      <QuickTestCard activePrefix={activeKey?.prefix ?? null} />
      <section>
        <h2 className="text-sm font-semibold text-gray-900">Create a new key</h2>
        <div className="mt-3"><CreateApiKeyForm /></div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-900">Your keys</h2>
        <div className="mt-3"><ApiKeysTable keys={keys ?? []} /></div>
      </section>
    </div>
  );
}
