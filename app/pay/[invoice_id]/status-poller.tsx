'use client';

import { useEffect, useState } from 'react';

type Status = 'open' | 'paid' | 'expired' | 'void';

export function StatusPoller(props: {
  invoiceId: string;
  initialStatus: Status;
  initialPaidAt: string | null;
  expiresAt: string;
}) {
  const [status, setStatus] = useState<Status>(props.initialStatus);
  const [paidAt, setPaidAt] = useState<string | null>(props.initialPaidAt);
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(props.expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (status !== 'open') return;
    const t = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'open') return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/public/invoices/${props.invoiceId}/status`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j.status !== status) {
        setStatus(j.status);
        setPaidAt(j.paid_at);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [status, props.invoiceId]);

  if (status === 'paid') {
    return (
      <div className="mt-6 rounded-md bg-green-50 p-4 text-center text-green-900">
        <p className="text-lg font-semibold">✅ Payment received</p>
        <p className="text-sm">Thanks! You can close this page.</p>
        {paidAt && <p className="mt-1 text-xs">Confirmed at {new Date(paidAt).toLocaleString()}</p>}
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div className="mt-6 rounded-md bg-gray-100 p-4 text-center">
        <p className="text-lg font-semibold">⌛ This invoice has expired</p>
        <p className="text-sm text-gray-700">Contact the store to get a new one.</p>
      </div>
    );
  }

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <div className="mt-6 text-center text-sm">
      <p className="text-gray-600">⏱ Expires in {m}:{s.toString().padStart(2, '0')}</p>
      <p className="mt-1">⏳ Waiting for payment</p>
    </div>
  );
}
