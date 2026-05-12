'use client';

import { useState } from 'react';
import { createApiKey } from '@/app/(dashboard)/dashboard/api-keys/actions';

export function CreateApiKeyForm() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ fullKey: string; prefix: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const r = await createApiKey({ name });
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    setShown({ fullKey: r.fullKey, prefix: r.prefix });
    setName('');
  }

  if (shown) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
        <h2 className="font-medium text-amber-900">Save this key now</h2>
        <p className="mt-1 text-sm text-amber-900">
          You won&apos;t see the full key again. Store it somewhere safe.
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-xs">{shown.fullKey}</pre>
        <button onClick={() => setShown(null)} className="mt-3 rounded border border-amber-700 px-3 py-1.5 text-sm">
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-3 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium">Key name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Production"
               className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
      </div>
      <button type="submit" disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50">
        {loading ? 'Creating…' : 'Create key'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
