import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Storefront from './components/Storefront';
import Checkout from './components/Checkout';
import DevTools from './components/DevTools';

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
            <Checkout
              productId={view.productId}
              onBack={() => setView({ kind: 'store' })}
            />
          )}
        </div>
        {/* DevTools only on the storefront view, when toggled open */}
        {view.kind === 'store' && devToolsOpen && <DevTools />}
      </main>
      <Footer
        onToggleDevTools={() => setDevToolsOpen((o) => !o)}
        devToolsOpen={devToolsOpen}
      />
    </div>
  );
}
