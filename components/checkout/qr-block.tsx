'use client';

import { useState } from 'react';

export function QrBlock({ qrDataUrl, address, memo, zip321Uri }: {
  qrDataUrl: string; address: string; memo: string; zip321Uri: string;
}) {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  async function copy(text: string, setFlag: (b: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 1500);
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col items-center">
        <img src={qrDataUrl} alt="Pay via QR" className="h-56 w-56" />
      </div>
      {memo && (
        <div className="mt-4 text-sm">
          <div className="text-gray-500">Memo</div>
          <div className="font-mono break-all">{memo}</div>
        </div>
      )}
      <div className="mt-4 text-sm">
        <div className="text-gray-500">Pay to</div>
        <div className="font-mono break-all">{address.slice(0, 32)}…{address.slice(-8)}</div>
      </div>
      <div className="mt-3 flex gap-2 text-xs">
        <button onClick={() => copy(address, setCopiedAddr)}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100">
          {copiedAddr ? 'Copied ✓' : 'Copy address'}
        </button>
        <button onClick={() => copy(zip321Uri, setCopiedUri)}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100">
          {copiedUri ? 'Copied ✓' : 'Copy URI'}
        </button>
      </div>
    </div>
  );
}
