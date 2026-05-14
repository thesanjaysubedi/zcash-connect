import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from('merchants')
    .select('store_name, verified, payout_address, archived_at')
    .eq('id', user!.id)
    .single();

  const archived = merchant!.archived_at !== null;

  return (
    <div className="px-8 py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="mt-1 text-gray-600">Welcome, {merchant!.store_name}.</p>

      {archived && (
        <div className="mt-8 rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium text-amber-900">Account archived</h2>
          <p className="mt-1 text-sm text-amber-900">
            All API keys are revoked and new payments are blocked. Restore the account from{' '}
            <Link href="/dashboard/settings" className="underline">Settings</Link>.
          </p>
        </div>
      )}

      {!archived && !merchant!.verified && (
        <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-medium text-amber-900">Pending verification</h2>
          <p className="mt-1 text-sm text-amber-900">
            We&apos;re reviewing your application. You&apos;ll get an email when approved.
          </p>
        </div>
      )}

      {!archived && merchant!.verified && !merchant!.payout_address && (
        <div className="mt-8 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-medium text-blue-900">Set your Zcash payout address</h2>
          <p className="mt-1 text-sm text-blue-900">
            Configure where customers&apos; payments will arrive before you can create invoices.
          </p>
          <Link href="/dashboard/settings" className="mt-3 inline-block rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800">
            Go to settings
          </Link>
        </div>
      )}

      {!archived && merchant!.verified && merchant!.payout_address && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/dashboard/api-keys" className="rounded border border-gray-200 p-4 hover:border-gray-400">
            <h2 className="font-medium">API keys</h2>
            <p className="mt-1 text-sm text-gray-600">Create and manage keys for your integrations.</p>
          </Link>
          <Link href="/dashboard/invoices" className="rounded border border-gray-200 p-4 hover:border-gray-400">
            <h2 className="font-medium">Invoices</h2>
            <p className="mt-1 text-sm text-gray-600">View your recent invoices and statuses.</p>
          </Link>
        </div>
      )}
    </div>
  );
}
