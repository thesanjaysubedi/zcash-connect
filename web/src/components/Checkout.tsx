import { useEffect, useState } from 'react';
import { api, type Invoice } from '../lib/api';
import { findProduct } from '../lib/catalog';

type Props = {
  productId:   string;
  onBack:      () => void;
};

const STATUS_LABEL: Record<Invoice['status'], string> = {
  CREATED:   '⏳ Awaiting payment',
  DETECTING: '🔎 Detecting in mempool',
  CONFIRMED: '✅ Confirmed',
  EXPIRED:   '⏱️ Expired',
};

const STATUS_CLASS: Record<Invoice['status'], string> = {
  CREATED:   'bg-amber-100 text-amber-800',
  DETECTING: 'bg-sky-100   text-sky-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  EXPIRED:   'bg-rose-100  text-rose-800',
};

export default function Checkout({ productId, onBack }: Props) {
  const product = findProduct(productId);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [showUri, setShowUri] = useState(false);

  // Initial invoice creation
  useEffect(() => {
    if (!product) {
      setError('Unknown product');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const inv = product.kind === 'single'
          ? await api.createInvoiceSingle(product.amountZec, product.id)
          : await api.createInvoiceMulti(product.payments);
        if (cancelled) return;
        setInvoice(inv);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [product]);

  // Polling for status updates
  useEffect(() => {
    if (!invoice) return;
    if (invoice.status === 'CONFIRMED' || invoice.status === 'EXPIRED') return;
    const t = setInterval(async () => {
      try {
        const fresh = await api.getInvoice(invoice.invoiceId);
        setInvoice(fresh);
      } catch {
        // 404 (server restart wiped store) — stop polling.
        clearInterval(t);
      }
    }, 10000);
    return () => clearInterval(t);
  }, [invoice?.invoiceId, invoice?.status]);

  if (!product) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <button onClick={onBack} className="text-zbucks-mute hover:text-zbucks-green text-sm mb-4">
          ← Back to Zbucks
        </button>
        <p className="text-zbucks-brown">Unknown product: {productId}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md mx-auto">
      <button onClick={onBack} className="text-zbucks-mute hover:text-zbucks-green text-sm mb-4">
        ← Back to Zbucks
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">{product.emoji}</span>
        <div>
          <h2 className="text-lg font-bold text-zbucks-brown">{product.name}</h2>
          <p className="text-2xl font-black text-zbucks-green">{product.amountZec} ZEC</p>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-zbucks-mute">Generating payment request...</div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-sm">
          {error}
        </div>
      )}

      {invoice && !error && (
        <>
          <div className="flex justify-center my-4">
            <img
              src={invoice.qrCode}
              alt="Payment QR code"
              width={220}
              height={220}
              className="rounded-xl border border-zbucks-brown/10"
            />
          </div>

          <div className="text-center mb-4">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${STATUS_CLASS[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>

          <p className="text-center text-xs text-zbucks-mute mb-4">
            Scan with Zashi, ZODL, or Ywallet to pay.
            {product.kind === 'multi' && (
              <span className="block mt-1">
                This payment splits across {product.payments.length} recipients.
              </span>
            )}
          </p>

          <button
            onClick={() => setShowUri((s) => !s)}
            className="text-xs text-zbucks-mute hover:text-zbucks-green w-full text-center transition-colors"
          >
            {showUri ? 'Hide payment URI ▴' : 'Show payment URI ▸'}
          </button>

          {showUri && (
            <pre className="mt-2 bg-zbucks-cream rounded-lg p-3 text-[10px] font-mono text-zbucks-brown break-all whitespace-pre-wrap">
              {invoice.paymentUri}
            </pre>
          )}

          {(invoice.status === 'CONFIRMED' || invoice.status === 'EXPIRED') && (
            <button
              onClick={onBack}
              className="mt-6 w-full bg-zbucks-green text-white rounded-xl py-3 font-bold hover:bg-zbucks-green-dark transition-colors"
            >
              {invoice.status === 'CONFIRMED' ? 'Order another' : 'Try again'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
