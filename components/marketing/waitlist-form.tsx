'use client';

import { useState, useTransition } from 'react';

export function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      try {
        const r = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, source }),
        });
        if (r.ok) { setDone(true); return; }
        const body = await r.json().catch(() => ({}));
        setError(body.error?.message ?? 'Could not submit. Try again.');
      } catch {
        setError('Network error. Try again.');
      }
    });
  }

  if (done) {
    return (
      <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-900">
        Thanks — we&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourstore.com"
        className="flex-1 min-w-[14rem] rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending || !email}
        className="rounded-md border border-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? 'Submitting…' : 'Join the waitlist'}
      </button>
      {error && <p className="basis-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
