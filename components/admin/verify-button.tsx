'use client';

import { useTransition, useState } from 'react';
import { verifyMerchant } from '@/app/(admin)/admin/actions';

export function VerifyButton({ merchantId }: { merchantId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      {err && <span className="mr-2 text-xs text-red-600">{err}</span>}
      <button
        onClick={() => start(async () => {
          setErr(null);
          const r = await verifyMerchant({ merchant_id: merchantId });
          if (!r.ok) setErr(r.error ?? 'Failed');
        })}
        disabled={pending}
        className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? 'Verifying…' : 'Verify'}
      </button>
    </span>
  );
}
