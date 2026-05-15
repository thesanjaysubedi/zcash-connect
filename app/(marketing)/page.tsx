import Link from 'next/link';
import { WaitlistForm } from '@/components/marketing/waitlist-form';
import { TryDemoButton } from '@/components/marketing/try-demo-button';

export const dynamic = 'force-static';

const FEATURES = [
  { title: 'ZIP-321 native',            body: 'Standard Zcash payment URIs with memo support — every wallet knows what to do.' },
  { title: 'No custody',                body: 'Customers pay your unified address directly. We never hold funds.' },
  { title: 'Real-time chain watcher',   body: 'Shielded payments confirmed via trial decryption on lightwalletd.' },
  { title: 'Open-source',               body: 'MIT-licensed. Self-host or use the hosted API. Your call.' },
  { title: 'API keys with rotation',    body: 'Grace-window key rotation so you never take downtime.' },
  { title: 'Hosted checkout included',  body: 'A polished payment page out of the box. Bring your own UI if you prefer.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">ZcashConnect</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login"  className="text-gray-700 hover:text-gray-900">Sign in</Link>
            <Link href="/signup" className="rounded-md border border-gray-900 px-3 py-1.5 hover:bg-gray-50">
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Shielded Zcash payments for your store.
          <br />
          <span className="text-gray-500">No custody. No middlemen.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-gray-700">
          ZcashConnect generates ZIP-321 QR codes, watches the chain, and confirms when a shielded
          ZEC payment lands. Integrate in minutes with a single API.
        </p>
        <div className="mt-8 flex flex-wrap items-start gap-6">
          <TryDemoButton />
          <div id="waitlist" className="flex-1 min-w-[20rem]">
            <WaitlistForm source="landing-hero" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <li className="rounded-md border border-gray-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Step 1</p>
              <h3 className="mt-1 font-medium">Create an invoice</h3>
              <p className="mt-2 text-sm text-gray-700">
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">POST /api/v1/invoices</code>{' '}
                with an amount in ZEC and an optional memo.
              </p>
            </li>
            <li className="rounded-md border border-gray-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Step 2</p>
              <h3 className="mt-1 font-medium">Show the QR code</h3>
              <p className="mt-2 text-sm text-gray-700">
                We generate the ZIP-321 payment URI and a hosted checkout page.
                Embed it or redirect.
              </p>
            </li>
            <li className="rounded-md border border-gray-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">Step 3</p>
              <h3 className="mt-1 font-medium">Get paid in shielded ZEC</h3>
              <p className="mt-2 text-sm text-gray-700">
                Payment lands at your unified address. We confirm on-chain and notify
                your webhook (coming soon).
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold">Built for merchants</h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-md border border-gray-200 p-5">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">Ready to ship?</h2>
          <p className="mt-2 text-gray-700">
            Try the demo without an account, or join the waitlist for production access.
          </p>
          <div className="mt-6 flex flex-wrap items-start justify-center gap-6">
            <TryDemoButton />
            <div className="w-full max-w-sm">
              <WaitlistForm source="landing-bottom" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-sm text-gray-600">
          <p>© {new Date().getFullYear()} ZcashConnect</p>
          <nav className="flex gap-4">
            <a href="https://github.com/thesanjaysubedi/zcash-connect" className="hover:text-gray-900">GitHub</a>
            <Link href="/login" className="hover:text-gray-900">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
