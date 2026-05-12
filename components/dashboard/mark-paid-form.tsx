'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markPaid } from '@/app/(dashboard)/dashboard/invoices/[id]/mark-paid';

export function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [txid, setTxid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const r = await markPaid({ invoice_id: invoiceId, paid_txid: txid || undefined });
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex gap-2 items-end">
      <div className="flex-1">
        <label className="block text-xs text-blue-900">Tx ID (optional)</label>
        <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="(optional)"
               className="mt-1 w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm font-mono" />
      </div>
      <button type="submit" disabled={loading}
        className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50">
        {loading ? 'Saving…' : 'Mark as paid'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
