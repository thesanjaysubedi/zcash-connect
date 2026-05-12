import Link from 'next/link';
import { DEMO_PRODUCTS } from '@/lib/demo-products';

export default function DemoStore() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Demo Shop</h1>
      <p className="mt-1 text-gray-600">
        A reference store that uses the ZcashConnect public API. Source: <code>app/demo/</code>.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {DEMO_PRODUCTS.map((p) => (
          <Link key={p.id} href={`/demo/product/${p.id}`} className="rounded-lg border border-gray-200 p-4 hover:border-gray-400">
            <h2 className="font-medium">{p.name}</h2>
            <p className="mt-1 text-sm text-gray-600">{p.description}</p>
            <p className="mt-3 font-medium">{p.price_zec} ZEC</p>
          </Link>
        ))}
      </div>
      <p className="mt-12 text-xs text-gray-500">
        v1: merchant manually confirms payment in the dashboard. Auto-detection arrives in Milestone 2 (WebZJS trial decryption).
      </p>
    </main>
  );
}
