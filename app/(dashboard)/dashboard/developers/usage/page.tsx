import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Bucket { total: number; s2: number; s4: number; s5: number }

async function bucket(supabase: Awaited<ReturnType<typeof createClient>>, since: Date, merchantId: string): Promise<Bucket> {
  const { data } = await supabase
    .from('api_requests')
    .select('status')
    .eq('merchant_id', merchantId)
    .gte('created_at', since.toISOString());
  const rows = data ?? [];
  return {
    total: rows.length,
    s2: rows.filter((r) => r.status >= 200 && r.status < 300).length,
    s4: rows.filter((r) => r.status >= 400 && r.status < 500).length,
    s5: rows.filter((r) => r.status >= 500 && r.status < 600).length,
  };
}

export default async function UsageTab() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today     = new Date(new Date().setHours(0, 0, 0, 0));
  const weekAgo   = new Date(Date.now() - 7  * 24 * 3600 * 1000);
  const monthAgo  = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [d, w, m] = await Promise.all([
    bucket(supabase, today,    user!.id),
    bucket(supabase, weekAgo,  user!.id),
    bucket(supabase, monthAgo, user!.id),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card label="Today"       b={d} />
      <Card label="Last 7 days" b={w} />
      <Card label="Last 30 days" b={m} />
    </div>
  );
}

function Card({ label, b }: { label: string; b: Bucket }) {
  return (
    <div className="rounded-md border border-gray-200 p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{b.total.toLocaleString()}</p>
      <p className="mt-1 text-sm text-gray-600">total requests</p>
      <p className="mt-3 text-xs text-gray-600">
        <span className="text-green-700">{b.s2.toLocaleString()} 2xx</span> ·{' '}
        <span className="text-amber-700">{b.s4.toLocaleString()} 4xx</span> ·{' '}
        <span className="text-red-700">{b.s5.toLocaleString()} 5xx</span>
      </p>
    </div>
  );
}
