import { notFound } from 'next/navigation';
import Link from 'next/link';
import { findProduct } from '@/lib/demo-products';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = findProduct(id);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link href="/demo" className="text-sm underline">← Back to store</Link>
      <h1 className="mt-4 text-2xl font-semibold">{product.name}</h1>
      <p className="mt-1 text-gray-600">{product.description}</p>
      <p className="mt-4 text-3xl font-bold">{product.price_zec} ZEC</p>

      <form action="/demo/checkout" method="POST" className="mt-8">
        <input type="hidden" name="product_id" value={product.id} />
        <button type="submit"
          className="w-full rounded bg-gray-900 px-4 py-3 text-white hover:bg-gray-700">
          Pay with ZcashConnect
        </button>
      </form>
    </main>
  );
}
