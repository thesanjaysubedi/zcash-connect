import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Storefront from './components/Storefront';

type View =
  | { kind: 'store' }
  | { kind: 'checkout'; productId: string };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'store' });
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-10">
          {view.kind === 'store' && (
            <Storefront onSelect={(id) => setView({ kind: 'checkout', productId: id })} />
          )}
          {view.kind === 'checkout' && (
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <button
                onClick={() => setView({ kind: 'store' })}
                className="text-zbucks-mute hover:text-zbucks-green text-sm mb-4"
              >
                ← Back to Zbucks
              </button>
              <h2 className="text-xl font-bold text-zbucks-brown">Checkout placeholder</h2>
              <p className="text-zbucks-mute text-sm mt-2">Product: {view.productId}</p>
              <p className="text-zbucks-mute text-sm mt-1">(Task 6 will replace this with the real checkout.)</p>
            </div>
          )}
        </div>
      </main>
      <Footer
        onToggleDevTools={() => setDevToolsOpen((o) => !o)}
        devToolsOpen={devToolsOpen}
      />
    </div>
  );
}
