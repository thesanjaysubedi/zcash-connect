import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-auth';
import { SignOutButton } from '@/components/dashboard/sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: merchant } = await supabase
    .from('merchants')
    .select('store_name, verified, payout_address, archived_at')
    .eq('id', user.id)
    .single();

  if (!merchant) redirect('/login');

  const archived = merchant.archived_at !== null;
  const canCreate = merchant.verified && merchant.payout_address && !archived;
  const isAdmin = isAdminEmail(user.email);

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-gray-200 bg-gray-50 px-4 py-6 flex flex-col">
        <Link href="/dashboard" className="text-lg font-semibold">ZcashConnect</Link>
        <p className="mt-1 text-sm text-gray-600 truncate">{merchant.store_name}</p>
        {archived && (
          <span className="mt-2 inline-block w-fit rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
            Archived
          </span>
        )}
        <nav className="mt-6 space-y-1 text-sm">
          <Link href="/dashboard" className="block rounded px-2 py-1.5 hover:bg-gray-100">Overview</Link>
          {merchant.verified && (
            <Link href="/dashboard/settings" className="block rounded px-2 py-1.5 hover:bg-gray-100">Settings</Link>
          )}
          {canCreate && (
            <>
              <Link href="/dashboard/developers/keys" className="block rounded px-2 py-1.5 hover:bg-gray-100">Developers</Link>
              <Link href="/dashboard/invoices" className="block rounded px-2 py-1.5 hover:bg-gray-100">Invoices</Link>
            </>
          )}
        </nav>
        {isAdmin && (
          <nav className="mt-8 border-t border-gray-200 pt-4 space-y-1 text-sm">
            <p className="px-2 text-xs uppercase tracking-wide text-gray-500">Operator</p>
            <Link href="/admin" className="block rounded px-2 py-1.5 hover:bg-gray-100">Admin</Link>
          </nav>
        )}
        <div className="mt-auto pt-10">
          <SignOutButton />
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
