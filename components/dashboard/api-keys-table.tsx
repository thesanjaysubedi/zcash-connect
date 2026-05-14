'use client';

import { useState, useTransition } from 'react';
import { revokeApiKey, renameApiKey } from '@/app/(dashboard)/dashboard/api-keys/actions';
import { RotateKeyButton } from '@/components/dashboard/developers/rotate-key-button';

export interface ApiKeyRow {
  id: string; name: string; prefix: string;
  last_used_at: string | null; revoked_at: string | null; created_at: string;
  // Task 11 will use these for rotate UI; declared optional here so the
  // developers/keys page can pass them without a type error.
  expires_at?: string | null;
  rotated_to?: string | null;
}

function statusBadge(k: ApiKeyRow): React.ReactNode {
  if (k.revoked_at) return <span className="text-red-600">revoked</span>;
  if (k.expires_at && new Date(k.expires_at) < new Date()) return <span className="text-red-600">expired</span>;
  if (k.expires_at) {
    const ms = new Date(k.expires_at).getTime() - Date.now();
    const hours = Math.round(ms / 3600_000);
    const label = hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
    return <span className="text-amber-700">rotating · expires in {label}</span>;
  }
  return <span>active</span>;
}

export function ApiKeysTable({ keys }: { keys: ApiKeyRow[] }) {
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (keys.length === 0) return <p className="text-sm text-gray-600">No API keys yet.</p>;

  function beginEdit(k: ApiKeyRow) {
    setEditingId(k.id);
    setEditValue(k.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
    setError(null);
  }

  function saveEdit(id: string) {
    const next = editValue.trim();
    if (!next) { setError('Name cannot be empty'); return; }
    setError(null);
    start(async () => {
      const r = await renameApiKey({ id, name: next });
      if (!r.ok) { setError(r.error ?? 'Failed to rename'); return; }
      setEditingId(null);
      setEditValue('');
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 text-left">
          <tr><th className="py-2">Name</th><th>Prefix</th><th>Last used</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} className="border-b border-gray-100">
              <td className="py-2">
                {editingId === k.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(k.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    disabled={pending}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                ) : (
                  k.name
                )}
              </td>
              <td className="font-mono text-xs">{k.prefix}…</td>
              <td className="text-gray-600">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</td>
              <td>{statusBadge(k)}</td>
              <td className="text-right">
                {editingId === k.id ? (
                  <span className="space-x-3">
                    <button onClick={() => saveEdit(k.id)} disabled={pending}
                            className="text-sm text-gray-900 hover:underline disabled:opacity-50">
                      Save
                    </button>
                    <button onClick={cancelEdit} disabled={pending}
                            className="text-sm text-gray-600 hover:underline disabled:opacity-50">
                      Cancel
                    </button>
                  </span>
                ) : !k.revoked_at ? (
                  <span className="space-x-3">
                    {!k.expires_at && (
                      <RotateKeyButton keyId={k.id} keyName={k.name} />
                    )}
                    <button onClick={() => beginEdit(k)} disabled={pending}
                            className="text-sm text-gray-700 hover:underline disabled:opacity-50">
                      Rename
                    </button>
                    <button onClick={() => start(async () => { await revokeApiKey(k.id); })}
                            disabled={pending}
                            className="text-sm text-red-700 hover:underline disabled:opacity-50">
                      Revoke
                    </button>
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
