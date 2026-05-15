'use client';

import { useState, useTransition } from 'react';

export function TryDemoButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    start(async () => {
      setError(null);
      try {
        const r = await fetch('/api/demo', { method: 'POST' });
        const body = await r.json().catch(() => ({}));
        if (r.ok && body.redirect) {
          window.location.href = body.redirect;
          return;
        }
        setError(body.error?.message ?? 'Could not create demo. Try again in a minute.');
      } catch {
        setError('Network error. Try again.');
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? 'Creating your demo…' : 'Try the demo →'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
