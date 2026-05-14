import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogsFilters } from '@/components/dashboard/developers/logs-filters';

export const dynamic = 'force-dynamic';

type Search = { key?: string; status?: string; range?: string; before?: string };

function rangeStart(range: string | undefined): Date {
  switch (range) {
    case 'last7d':  return new Date(Date.now() - 7  * 24 * 3600 * 1000);
    case 'last30d': return new Date(Date.now() - 30 * 24 * 3600 * 1000);
    case 'last24h': return new Date(Date.now() - 24 * 3600 * 1000);
    case 'today':
    default:        return new Date(new Date().setHours(0, 0, 0, 0));
  }
}

export default async function LogsTab({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: keys } = await supabase.from('api_keys').select('id, prefix, name');

  let q = supabase
    .from('api_requests')
    .select('id, created_at, method, path, status, latency_ms, error_code, api_key_id')
    .gte('created_at', rangeStart(params.range).toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (params.key)    q = q.eq('api_key_id', params.key);
  if (params.status === '2xx') q = q.gte('status', 200).lt('status', 300);
  if (params.status === '4xx') q = q.gte('status', 400).lt('status', 500);
  if (params.status === '5xx') q = q.gte('status', 500).lt('status', 600);
  if (params.before) q = q.lt('created_at', params.before);

  const { data: rows } = await q;

  const keyById = new Map((keys ?? []).map((k) => [k.id, k]));

  return (
    <div className="space-y-6">
      <LogsFilters keys={keys ?? []} value={params} />

      {!rows || rows.length === 0 ? (
        <p className="text-sm text-gray-600">No requests in the selected range. Try Quick test on the Keys tab.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left">
              <tr>
                <th className="py-2">Time</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Key</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const k = r.api_key_id ? keyById.get(r.api_key_id) : null;
                const statusClass =
                  r.status >= 500 ? 'text-red-700' :
                  r.status >= 400 ? 'text-amber-700' : 'text-green-700';
                return (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="font-mono text-xs">{r.method}</td>
                    <td className="font-mono text-xs">{r.path}</td>
                    <td className={`font-mono text-xs ${statusClass}`}>{r.status}</td>
                    <td className="text-gray-600">{r.latency_ms} ms</td>
                    <td className="font-mono text-xs text-gray-600">{k ? `${k.prefix}…` : '—'}</td>
                    <td className="text-gray-600">{r.error_code ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 100 && (
            <div className="text-right">
              <Link
                href={{
                  pathname: '/dashboard/developers/logs',
                  query: { ...params, before: rows[rows.length - 1].created_at },
                }}
                className="text-sm text-gray-700 underline hover:text-gray-900"
              >
                Load older →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
