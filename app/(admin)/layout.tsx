import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/admin-auth';
import { SignOutButton } from '@/components/dashboard/sign-out-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminUser();
  if (!admin) redirect('/dashboard');

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-gray-200 bg-gray-50 px-4 py-6">
        <Link href="/admin" className="text-lg font-semibold">Admin · ZcashConnect</Link>
        <p className="mt-1 text-sm text-gray-600 truncate">{admin.email}</p>
        <nav className="mt-6 space-y-1 text-sm">
          <Link href="/admin" className="block rounded px-2 py-1.5 hover:bg-gray-100">Merchants</Link>
          <Link href="/dashboard" className="block rounded px-2 py-1.5 hover:bg-gray-100">My dashboard</Link>
        </nav>
        <div className="mt-10">
          <SignOutButton />
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
