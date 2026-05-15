import { createAdminClient } from '@/lib/supabase/admin';
import { VerifyButton } from '@/components/admin/verify-button';

export const dynamic = 'force-dynamic';

interface PendingRow {
  id: string;
  store_name: string;
  payout_address: string | null;
  contact_email: string | null;
  created_at: string;
}

interface VerifiedRow {
  id: string;
  store_name: string;
  verified_at: string | null;
  archived_at: string | null;
}

export default async function AdminPage() {
  const supabase = createAdminClient();

  const { data: pending } = await supabase
    .from('merchants')
    .select('id, store_name, payout_address, contact_email, created_at')
    .eq('verified', false)
    .is('archived_at', null)
    .eq('is_demo', false)
    .order('created_at', { ascending: true })
    .returns<PendingRow[]>();

  const { data: verified } = await supabase
    .from('merchants')
    .select('id, store_name, verified_at, archived_at')
    .eq('verified', true)
    .eq('is_demo', false)
    .order('verified_at', { ascending: false })
    .limit(25)
    .returns<VerifiedRow[]>();

  return (
    <div className="px-8 py-10 max-w-4xl">
      <h1 className="text-2xl font-semibold">Merchants</h1>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-900">
          Pending verification ({pending?.length ?? 0})
        </h2>
        {!pending || pending.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No merchants pending.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-gray-200 text-left">
              <tr>
                <th className="py-2">Store</th>
                <th>Contact</th>
                <th>Payout</th>
                <th>Signed up</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="py-2">{m.store_name}</td>
                  <td className="text-gray-600">{m.contact_email ?? '—'}</td>
                  <td className="font-mono text-xs">
                    {m.payout_address
                      ? m.payout_address.slice(0, 12) + '…'
                      : <span className="text-gray-400">not set</span>}
                  </td>
                  <td className="text-gray-600">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="text-right"><VerifyButton merchantId={m.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold text-gray-900">Recently verified</h2>
        {!verified || verified.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No verified merchants yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-gray-200 text-left">
              <tr><th className="py-2">Store</th><th>Verified at</th><th>Status</th></tr>
            </thead>
            <tbody>
              {verified.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="py-2">{m.store_name}</td>
                  <td className="text-gray-600">
                    {m.verified_at ? new Date(m.verified_at).toLocaleString() : '—'}
                  </td>
                  <td>{m.archived_at
                        ? <span className="text-red-600">archived</span>
                        : 'active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
