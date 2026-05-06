import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';

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
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <h2 className="text-xl font-bold text-zbucks-brown">Storefront placeholder</h2>
              <p className="text-zbucks-mute text-sm mt-2">
                Tasks 5+ will fill this with the product grid.
              </p>
              <button
                onClick={() => setView({ kind: 'checkout', productId: 'preview' })}
                className="mt-4 bg-zbucks-green text-white rounded-xl px-5 py-3 font-bold hover:bg-zbucks-green-dark transition-colors"
              >
                Preview checkout view
              </button>
            </div>
          )}
          {view.kind === 'checkout' && (
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <h2 className="text-xl font-bold text-zbucks-brown">Checkout placeholder</h2>
              <p className="text-zbucks-mute text-sm mt-2">Product: {view.productId}</p>
              <button
                onClick={() => setView({ kind: 'store' })}
                className="mt-4 text-zbucks-mute hover:text-zbucks-green text-sm"
              >
                ← Back to store
              </button>
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
