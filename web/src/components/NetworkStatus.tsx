import { useEffect, useState } from 'react';
import { api, type Health } from '../lib/api';

const POLL_MS = 10000;
const TICK_MS = 1000;

function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function NetworkStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error,  setError]  = useState(false);
  const [now,    setNow]    = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function fetchHealth() {
      try {
        const h = await api.getHealth();
        if (cancelled) return;
        setHealth(h);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    fetchHealth();
    const t = setInterval(fetchHealth, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Tick the displayed age every second so it counts up between polls.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  if (!health && !error) {
    return (
      <div className="text-[11px] text-zbucks-mute font-mono">
        connecting…
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span className="text-rose-700">disconnected</span>
      </div>
    );
  }

  const observedMs = new Date(health.observedAt).getTime();
  const age        = formatAge(now - observedMs);
  const blockStr   = health.latestBlock.toLocaleString();

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono leading-tight">
      <span className="relative inline-flex">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="absolute inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-75 animate-ping" />
      </span>
      <span className="text-zbucks-brown">
        <span className="uppercase tracking-wider text-zbucks-green font-bold">{health.network}</span>
        <span className="mx-1.5 text-zbucks-mute">·</span>
        <span>block {blockStr}</span>
        <span className="mx-1.5 text-zbucks-mute">·</span>
        <span className="text-zbucks-mute">{age}</span>
      </span>
    </div>
  );
}
