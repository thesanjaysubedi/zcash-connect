import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/dashboard/settings-form';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from('merchants')
    .select('store_name, payout_address, verified')
    .eq('id', user!.id)
    .single();

  if (!merchant!.verified) redirect('/dashboard');

  return (
    <div className="px-8 py-10 max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-gray-600">Your store name and Zcash payout address.</p>
      <SettingsForm
        initialStoreName={merchant!.store_name}
        initialPayoutAddress={merchant!.payout_address ?? ''}
      />
    </div>
  );
}
