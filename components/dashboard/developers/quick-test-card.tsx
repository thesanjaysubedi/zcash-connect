'use client';

import { useState, useTransition } from 'react';

interface PingOk { ok: true; merchant_id: string; store_name: string; server_time: string }
interface PingErr { ok: false; status: number; code: string; message: string; latency: number }
type Result = (PingOk & { latency: number }) | PingErr;

export function QuickTestCard({ activePrefix }: { activePrefix: string | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [fullKey, setFullKey] = useState('');

  const disabled = !fullKey;

  function run() {
    start(async () => {
      setResult(null);
      const t = Date.now();
      try {
        const r = await fetch('/api/v1/ping', { headers: { authorization: `Bearer ${fullKey}` } });
        const latency = Date.now() - t;
        if (r.ok) {
          const body = await r.json();
          setResult({ ...body, latency });
        } else {
          const body = await r.json().catch(() => ({}));
          setResult({ ok: false, status: r.status, code: body.error?.code ?? 'error',
                      message: body.error?.message ?? r.statusText, latency });
        }
      } catch (e) {
        setResult({ ok: false, status: 0, code: 'network_error',
                    message: (e as Error).message, latency: Date.now() - t });
      }
    });
  }

  const curl = `curl -sS https://YOUR_HOST/api/v1/ping \\
  -H "Authorization: Bearer ${revealed ? fullKey || 'YOUR_KEY_HERE' : 'YOUR_KEY_HERE'}"`;

  return (
    <section className="rounded-md border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Quick test</h2>
      <p className="mt-1 text-sm text-gray-600">
        Paste an API key (shown once at create time) to verify it works without leaving the dashboard.
        {activePrefix && <> Your most recent active key starts with <code className="font-mono">{activePrefix}</code>.</>}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type={revealed ? 'text' : 'password'}
          placeholder="zk_live_…"
          value={fullKey}
          onChange={(e) => setFullKey(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
        />
        <button type="button" onClick={() => setRevealed((v) => !v)}
                className="rounded border border-gray-300 px-2 text-sm hover:bg-gray-50">
          {revealed ? 'Hide' : 'Show'}
        </button>
        <button type="button" onClick={run} disabled={disabled || pending}
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-40">
          {pending ? 'Running…' : 'Run ping'}
        </button>
      </div>

      {result && (
        result.ok ? (
          <div className="mt-3 rounded bg-green-50 px-3 py-2 text-sm text-green-900">
            ✓ 200 OK · {result.latency} ms · server time {result.server_time}
          </div>
        ) : (
          <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-900">
            ✗ {result.status} {result.code} · {result.message} · {result.latency} ms
          </div>
        )
      )}

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">curl equivalent</p>
        <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-3 text-xs font-mono">{curl}</pre>
      </div>
    </section>
  );
}
