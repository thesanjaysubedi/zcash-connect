import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/dashboard/sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: merchant } = await supabase
    .from('merchants')
    .select('store_name, verified, payout_address')
    .eq('id', user.id)
    .single();

  if (!merchant) redirect('/login');

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-gray-200 bg-gray-50 px-4 py-6">
        <Link href="/dashboard" className="text-lg font-semibold">ZcashConnect</Link>
        <p className="mt-1 text-sm text-gray-600 truncate">{merchant.store_name}</p>
        <nav className="mt-6 space-y-1 text-sm">
          <Link href="/dashboard" className="block rounded px-2 py-1.5 hover:bg-gray-100">Overview</Link>
          {merchant.verified && (
            <>
              <Link href="/dashboard/settings" className="block rounded px-2 py-1.5 hover:bg-gray-100">Settings</Link>
              {merchant.payout_address && (
                <>
                  <Link href="/dashboard/api-keys" className="block rounded px-2 py-1.5 hover:bg-gray-100">API keys</Link>
                  <Link href="/dashboard/invoices" className="block rounded px-2 py-1.5 hover:bg-gray-100">Invoices</Link>
                </>
              )}
            </>
          )}
        </nav>
        <div className="mt-10">
          <SignOutButton />
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
