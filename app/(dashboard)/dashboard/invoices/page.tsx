import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { zatoshisToZecString } from '@/lib/zip321';

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from('merchants').select('verified, payout_address, archived_at').eq('id', user!.id).single();
  if (!merchant!.verified || !merchant!.payout_address || merchant!.archived_at) redirect('/dashboard');

  const { data: rows } = await supabase
    .from('invoices')
    .select('id, amount_zatoshis, status, reference, description, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="px-8 py-10 max-w-5xl">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      {(!rows || rows.length === 0) ? (
        <p className="mt-6 text-sm text-gray-600">
          No invoices yet. Create one via the API: <code className="rounded bg-gray-100 px-1.5 py-0.5">POST /api/v1/invoices</code>.
        </p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead className="border-b border-gray-200 text-left">
            <tr>
              <th className="py-2">ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="py-2"><Link href={`/dashboard/invoices/${r.id}`} className="font-mono text-xs underline">{r.id}</Link></td>
                <td>{zatoshisToZecString(BigInt(r.amount_zatoshis))} ZEC</td>
                <td>{r.status}</td>
                <td className="text-gray-600">{r.reference ?? '—'}</td>
                <td className="text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
