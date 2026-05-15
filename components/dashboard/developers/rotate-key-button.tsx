'use client';

import { useState, useTransition } from 'react';
import { rotateKeyAction } from '@/app/(dashboard)/dashboard/developers/keys/rotate-action';

const GRACE_OPTIONS = [
  { value: 24,  label: '24 hours (default)' },
  { value: 168, label: '7 days'              },
  { value: 720, label: '30 days'             },
];

export function RotateKeyButton({ keyId, keyName }: { keyId: string; keyName: string }) {
  const [open, setOpen] = useState(false);
  const [grace, setGrace] = useState(24);
  const [pending, start] = useTransition();
  const [reveal, setReveal] = useState<{ fullKey: string; prefix: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    start(async () => {
      setError(null);
      const r = await rotateKeyAction({ apiKeyId: keyId, graceHours: grace });
      if (!r.ok) setError(r.error);
      else setReveal({ fullKey: r.fullKey, prefix: r.prefix });
    });
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setReveal(null); setError(null); setGrace(24); }}
              className="text-sm text-gray-700 hover:underline">
        Rotate
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[28rem] rounded-md bg-white p-6 shadow-xl">
            {!reveal ? (
              <>
                <h3 className="text-lg font-semibold">Rotate {keyName}</h3>
                <p className="mt-2 text-sm text-gray-600">
                  A new API key will be issued. Your current key keeps working until the grace period ends,
                  then it stops. Update your code to use the new key before that happens.
                </p>
                <fieldset className="mt-4 space-y-2 text-sm">
                  {GRACE_OPTIONS.map((g) => (
                    <label key={g.value} className="flex items-center gap-2">
                      <input type="radio" name="grace" value={g.value}
                             checked={grace === g.value}
                             onChange={() => setGrace(g.value)} />
                      <span>{g.label}</span>
                    </label>
                  ))}
                </fieldset>
                {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} disabled={pending}
                          className="rounded px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
                  <button onClick={submit} disabled={pending}
                          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50">
                    {pending ? 'Rotating…' : 'Rotate key'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">New API key</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Copy this now. You won&apos;t be able to see it again.
                </p>
                <pre className="mt-3 select-all overflow-x-auto rounded bg-gray-50 p-3 text-xs font-mono">
                  {reveal.fullKey}
                </pre>
                <p className="mt-3 text-xs text-gray-500">Prefix: <code>{reveal.prefix}</code></p>
                <div className="mt-5 flex justify-end">
                  <button onClick={() => setOpen(false)}
                          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
