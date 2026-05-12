'use client';

import { useState } from 'react';
import { saveSettings } from '@/app/(dashboard)/dashboard/settings/save';

export function SettingsForm(props: { initialStoreName: string; initialPayoutAddress: string }) {
  const [storeName, setStoreName] = useState(props.initialStoreName);
  const [payoutAddress, setPayoutAddress] = useState(props.initialPayoutAddress);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaved(false); setLoading(true);
    const r = await saveSettings({ store_name: storeName, payout_address: payoutAddress });
    setLoading(false);
    if (!r.ok) { setError(r.error ?? 'Failed to save'); return; }
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium">Store name</label>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)}
               className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Payout address (Orchard UA, u1…)</label>
        <textarea rows={3} value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      <button type="submit" disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50">
        {loading ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
