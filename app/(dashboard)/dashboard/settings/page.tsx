import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/dashboard/settings-form';
import { DangerZone } from '@/components/dashboard/danger-zone';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from('merchants')
    .select('store_name, payout_address, verified, contact_email, support_url, brand_color, logo_url, archived_at')
    .eq('id', user!.id)
    .single();

  if (!merchant!.verified) redirect('/dashboard');

  return (
    <div className="px-8 py-10 max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-gray-600">Your store profile and Zcash payout address.</p>
      <SettingsForm
        initial={{
          storeName:     merchant!.store_name,
          payoutAddress: merchant!.payout_address ?? '',
          contactEmail:  merchant!.contact_email  ?? '',
          supportUrl:    merchant!.support_url    ?? '',
          brandColor:    merchant!.brand_color    ?? '',
          logoUrl:       merchant!.logo_url       ?? '',
        }}
      />
      <DangerZone archived={merchant!.archived_at !== null} />
    </div>
  );
}
