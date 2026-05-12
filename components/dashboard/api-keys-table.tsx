'use client';

import { useTransition } from 'react';
import { revokeApiKey } from '@/app/(dashboard)/dashboard/api-keys/actions';

export interface ApiKeyRow {
  id: string; name: string; prefix: string;
  last_used_at: string | null; revoked_at: string | null; created_at: string;
}

export function ApiKeysTable({ keys }: { keys: ApiKeyRow[] }) {
  const [pending, start] = useTransition();
  if (keys.length === 0) return <p className="text-sm text-gray-600">No API keys yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-200 text-left">
        <tr><th className="py-2">Name</th><th>Prefix</th><th>Last used</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k.id} className="border-b border-gray-100">
            <td className="py-2">{k.name}</td>
            <td className="font-mono text-xs">{k.prefix}…</td>
            <td className="text-gray-600">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</td>
            <td>{k.revoked_at ? <span className="text-red-600">revoked</span> : 'active'}</td>
            <td className="text-right">
              {!k.revoked_at && (
                <button onClick={() => start(() => revokeApiKey(k.id))}
                        disabled={pending}
                        className="text-sm text-red-700 hover:underline disabled:opacity-50">
                  Revoke
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
