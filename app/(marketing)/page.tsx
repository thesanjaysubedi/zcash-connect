import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">ZcashConnect</h1>
      <p className="mt-4 text-lg text-gray-600">
        Accept shielded ZEC payments on your store with one API call.
      </p>
      <div className="mt-8 flex gap-4">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link href={'/signup' as any} className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
          Sign up
        </Link>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link href={'/login' as any} className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50">
          Log in
        </Link>
        {/* /demo does not exist yet (Plan B); using <a> to avoid typedRoutes error */}
        <a href="/demo" className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50">
          Demo store
        </a>
      </div>
    </main>
  );
}
