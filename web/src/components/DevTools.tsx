import { useEffect, useState } from 'react';
import { api, type Merchant } from '../lib/api';

const RECEIVER_TAG_CLASS: Record<string, string> = {
  orchard:  'bg-green-100 text-green-800',
  sapling:  'bg-sky-100   text-sky-800',
  p2pkh:    'bg-amber-100 text-amber-800',
  p2sh:     'bg-amber-100 text-amber-800',
  unknown:  'bg-rose-100  text-rose-800',
};

export default function DevTools() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  const [parseInput, setParseInput] = useState('');
  const [parseOutput, setParseOutput] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.getMerchant();
        if (!cancelled) setMerchant(m);
      } catch (e) {
        if (!cancelled) setMerchantError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleParse() {
    const uri = parseInput.trim();
    if (!uri) return;
    setParseOutput('Parsing...');
    try {
      const result = await api.parseUri(uri);
      setParseOutput(JSON.stringify(result, null, 2));
    } catch (e) {
      setParseOutput('Error: ' + (e as Error).message);
    }
  }

  return (
    <div className="mt-12 max-w-4xl mx-auto px-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-zbucks-brown/10">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zbucks-green">
            Developer tools
          </h3>
          <p className="text-xs italic text-zbucks-mute">
            Not part of the merchant flow
          </p>
        </div>

        {/* Merchant address details */}
        <section className="mb-6">
          <h4 className="text-sm font-bold text-zbucks-brown mb-2">Merchant address</h4>
          {merchantError && (
            <p className="text-sm text-rose-700">{merchantError}</p>
          )}
          {merchant && (
            <div className="text-sm">
              <p className="text-zbucks-mute mb-1">
                <span className="font-semibold text-zbucks-brown">Network:</span> {merchant.network}
                <span className="mx-2">·</span>
                <span className="font-semibold text-zbucks-brown">Receivers:</span> {merchant.receiverDetails.receivers.length}
                <span className="mx-2">·</span>
                <span className="font-semibold text-zbucks-brown">Orchard capable:</span> {merchant.receiverDetails.isOrchardCapable ? 'yes' : 'no'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {merchant.receiverDetails.receivers.map((r, i) => (
                  <span
                    key={i}
                    className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full ${RECEIVER_TAG_CLASS[r.type] ?? RECEIVER_TAG_CLASS.unknown}`}
                  >
                    {r.type} (typeId={r.typeId}, {r.length} bytes)
                  </span>
                ))}
              </div>
              <p className="text-[10px] font-mono text-zbucks-mute break-all mt-2">
                {merchant.address}
              </p>
            </div>
          )}
        </section>

        {/* URI parser */}
        <section>
          <h4 className="text-sm font-bold text-zbucks-brown mb-2">Parse a ZIP-321 URI</h4>
          <textarea
            value={parseInput}
            onChange={(e) => setParseInput(e.target.value)}
            placeholder="zcash:u1...?amount=0.01"
            className="w-full min-h-[60px] p-3 border border-zbucks-brown/20 rounded-lg font-mono text-xs"
          />
          <button
            onClick={handleParse}
            className="mt-2 bg-zbucks-green text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-zbucks-green-dark transition-colors"
          >
            Parse
          </button>
          {parseOutput && (
            <pre className="mt-3 bg-zbucks-cream rounded-lg p-3 text-[10px] font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-auto">
              {parseOutput}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
