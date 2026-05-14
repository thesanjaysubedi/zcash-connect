import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const TABS: Array<{ href: string; label: string }> = [
  { href: '/dashboard/developers/keys',  label: 'Keys'  },
  { href: '/dashboard/developers/logs',  label: 'Logs'  },
  { href: '/dashboard/developers/usage', label: 'Usage' },
];

export default async function DevelopersLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: merchant } = await supabase
    .from('merchants').select('verified, payout_address, archived_at').eq('id', user.id).single();
  if (!merchant?.verified || !merchant.payout_address || merchant.archived_at) redirect('/dashboard');

  const path = (await headers()).get('x-pathname') ?? '';

  return (
    <div className="px-8 py-10 max-w-5xl">
      <h1 className="text-2xl font-semibold">Developers</h1>
      <p className="mt-1 text-gray-600">Keys, logs, usage and a quick health check for your API.</p>
      <nav className="mt-6 border-b border-gray-200 flex gap-6 text-sm">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`pb-2 -mb-px border-b-2 ${active
                ? 'border-gray-900 text-gray-900 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
