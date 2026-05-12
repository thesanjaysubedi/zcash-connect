import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildZip321Uri, zatoshisToZecString } from '@/lib/zip321';
import { qrDataUrl } from '@/lib/qr';
import { QrBlock } from '@/components/checkout/qr-block';
import { StatusPoller } from './status-poller';

export default async function CheckoutPage(
  { params }: { params: Promise<{ invoice_id: string }> },
) {
  const { invoice_id } = await params;
  const supabase = createAdminClient();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, merchant_id, amount_zatoshis, payout_address, memo_text, description, status, expires_at, paid_at')
    .eq('id', invoice_id)
    .single();
  if (error || !invoice) notFound();

  const { data: merchant } = await supabase
    .from('merchants').select('store_name').eq('id', invoice.merchant_id).single();
  const storeName = merchant?.store_name ?? 'Store';

  const zatoshis = BigInt(invoice.amount_zatoshis as unknown as string);
  const amountZec = zatoshisToZecString(zatoshis);
  const uri = buildZip321Uri({
    address: invoice.payout_address as string,
    amount_zatoshis: zatoshis,
    memo_text: invoice.memo_text ?? undefined,
    label: storeName,
  });
  const qr = await qrDataUrl(uri);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <header className="text-center">
        <h1 className="text-xl font-semibold">{storeName}</h1>
        {invoice.description && (
          <p className="mt-1 text-sm text-gray-600">{invoice.description}</p>
        )}
        <p className="mt-4 text-3xl font-bold">Pay {amountZec} ZEC</p>
      </header>

      <QrBlock qrDataUrl={qr} address={invoice.payout_address as string}
               memo={invoice.memo_text ?? ''} zip321Uri={uri} />

      <a href={uri} className="mt-6 block w-full rounded bg-gray-900 px-4 py-3 text-center text-white hover:bg-gray-700">
        Open in Zcash wallet
      </a>

      <StatusPoller
        invoiceId={invoice.id}
        initialStatus={invoice.status as 'open' | 'paid' | 'expired' | 'void'}
        initialPaidAt={invoice.paid_at as string | null}
        expiresAt={invoice.expires_at as string}
      />

      <p className="mt-12 text-center text-xs text-gray-500">Powered by ZcashConnect</p>
    </main>
  );
}
