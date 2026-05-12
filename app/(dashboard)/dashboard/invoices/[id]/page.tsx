import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { zatoshisToZecString } from '@/lib/zip321';
import { MarkPaidForm } from '@/components/dashboard/mark-paid-form';

export default async function InvoiceDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from('merchants').select('verified, payout_address').eq('id', user!.id).single();
  if (!merchant!.verified || !merchant!.payout_address) redirect('/dashboard');

  const { data: invoice } = await supabase
    .from('invoices').select('*').eq('id', id).single();
  if (!invoice) notFound();

  const amount = zatoshisToZecString(BigInt(invoice.amount_zatoshis as unknown as string));
  const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${invoice.id}`;

  return (
    <div className="px-8 py-10 max-w-3xl">
      <Link href="/dashboard/invoices" className="text-sm text-gray-600 underline">← All invoices</Link>
      <h1 className="mt-4 text-2xl font-semibold">Invoice {invoice.id}</h1>
      <dl className="mt-6 grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <dt className="text-gray-500">Amount</dt>
        <dd className="col-span-2 font-medium">{amount} ZEC</dd>
        <dt className="text-gray-500">Status</dt>
        <dd className="col-span-2 font-medium">{invoice.status}</dd>
        <dt className="text-gray-500">Reference</dt>
        <dd className="col-span-2">{invoice.reference ?? '—'}</dd>
        <dt className="text-gray-500">Description</dt>
        <dd className="col-span-2">{invoice.description ?? '—'}</dd>
        <dt className="text-gray-500">Memo</dt>
        <dd className="col-span-2 font-mono break-all">{invoice.memo_text ?? '—'}</dd>
        <dt className="text-gray-500">Checkout URL</dt>
        <dd className="col-span-2 break-all"><a href={checkoutUrl} className="underline">{checkoutUrl}</a></dd>
        <dt className="text-gray-500">Expires</dt>
        <dd className="col-span-2">{new Date(invoice.expires_at).toLocaleString()}</dd>
        {invoice.paid_at && (<>
          <dt className="text-gray-500">Paid at</dt>
          <dd className="col-span-2">{new Date(invoice.paid_at).toLocaleString()}</dd>
        </>)}
        {invoice.paid_txid && (<>
          <dt className="text-gray-500">Tx ID</dt>
          <dd className="col-span-2 font-mono break-all">{invoice.paid_txid}</dd>
        </>)}
      </dl>

      {invoice.status === 'open' && (
        <div className="mt-8 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-medium text-blue-900">Mark as paid</h2>
          <p className="mt-1 text-sm text-blue-900">
            After you&apos;ve confirmed the payment in your own wallet, mark this invoice as paid here.
            Optionally paste the transaction ID for your records.
          </p>
          <MarkPaidForm invoiceId={invoice.id} />
        </div>
      )}
    </div>
  );
}
