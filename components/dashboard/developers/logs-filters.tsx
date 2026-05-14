'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function LogsFilters({
  keys, value,
}: {
  keys: Array<{ id: string; prefix: string; name: string }>;
  value: { key?: string; status?: string; range?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(name: string, val: string) {
    const next = new URLSearchParams(params);
    if (val) next.set(name, val); else next.delete(name);
    next.delete('before'); // reset pagination on filter change
    router.replace(`/dashboard/developers/logs?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1">
        <span className="text-gray-600">Key</span>
        <select value={value.key ?? ''} onChange={(e) => setParam('key', e.target.value)}
                className="rounded border border-gray-300 px-2 py-1">
          <option value="">All</option>
          {keys.map((k) => <option key={k.id} value={k.id}>{k.prefix}… ({k.name})</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="text-gray-600">Status</span>
        <select value={value.status ?? ''} onChange={(e) => setParam('status', e.target.value)}
                className="rounded border border-gray-300 px-2 py-1">
          <option value="">All</option>
          <option value="2xx">2xx</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="text-gray-600">Range</span>
        <select value={value.range ?? 'today'} onChange={(e) => setParam('range', e.target.value)}
                className="rounded border border-gray-300 px-2 py-1">
          <option value="today">Today</option>
          <option value="last24h">Last 24h</option>
          <option value="last7d">Last 7 days</option>
          <option value="last30d">Last 30 days</option>
        </select>
      </label>
    </div>
  );
}
