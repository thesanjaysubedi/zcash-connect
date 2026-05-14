'use client';

import { useState, useTransition } from 'react';
import { archiveMerchant, unarchiveMerchant } from '@/app/(dashboard)/dashboard/settings/archive';

const CONFIRM_PHRASE = 'ARCHIVE';

export function DangerZone({ archived }: { archived: boolean }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (archived) {
    return (
      <div className="mt-12 rounded-md border border-amber-300 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-900">Account archived</h2>
        <p className="mt-1 text-sm text-amber-900">
          Your account is archived and all API keys are revoked. Restore to start accepting payments again.
        </p>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button
          onClick={() => start(async () => {
            setError(null);
            const r = await unarchiveMerchant();
            if (!r.ok) setError(r.error ?? 'Failed to restore');
          })}
          disabled={pending}
          className="mt-3 rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {pending ? 'Restoring…' : 'Restore account'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-md border border-red-300 bg-red-50 p-5">
      <h2 className="font-semibold text-red-900">Archive account</h2>
      <p className="mt-1 text-sm text-red-900">
        Archiving revokes every active API key and stops new payments. Existing invoices stay in your dashboard for recordkeeping. You can restore the account at any time.
      </p>
      <label className="mt-4 block text-sm font-medium text-red-900">
        Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
      </label>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="mt-1 w-48 rounded border border-red-300 bg-white px-2 py-1 text-sm font-mono"
      />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3">
        <button
          onClick={() => start(async () => {
            setError(null);
            const r = await archiveMerchant();
            if (!r.ok) setError(r.error ?? 'Failed to archive');
            else setConfirm('');
          })}
          disabled={pending || confirm !== CONFIRM_PHRASE}
          className="rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800 disabled:opacity-40"
        >
          {pending ? 'Archiving…' : 'Archive account'}
        </button>
      </div>
    </div>
  );
}
