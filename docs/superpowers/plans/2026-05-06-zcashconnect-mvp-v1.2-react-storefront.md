# ZcashConnect MVP v1.2 Implementation Plan — Zbucks Coffee React Storefront

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the developer-tool demo page with a polished React + Vite + Tailwind merchant storefront ("Zbucks Coffee") that demonstrates ZcashConnect as a real product.

**Architecture:** New `web/` directory contains a standalone Vite + React + Tailwind app that builds to `web/dist/`. Express server (unchanged in structure) serves the built frontend as static files in production; in development, Vite dev server runs on port 5173 with API proxy to Express on port 3000. Single root `package.json`, no workspaces.

**Tech Stack:** React 18 · Vite 5 · TypeScript 5 · Tailwind 3 · Express 4 · existing Zcash modules (zip316, zip321, lightwalletd, invoices) untouched.

**Commit author for this plan:** All commits authored as `Sanjay Subedi <thesanjay43@gmail.com>`. No `Co-Authored-By: Claude` footer.

---

## File structure (target end state)

```
zcash-sdk/
├── src/                                # Backend — modified only by Task 2
│   ├── server.ts                       # MODIFIED: serve web/dist, /merchant, SPA fallback
│   ├── zip316.ts, zip321.ts            # unchanged
│   ├── lightwalletd.ts, invoices.ts    # unchanged
│   └── *.test.ts                       # unchanged
├── web/                                # NEW directory tree
│   ├── src/
│   │   ├── main.tsx                    # ReactDOM mount
│   │   ├── App.tsx                     # view switcher
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── Storefront.tsx
│   │   │   ├── Checkout.tsx
│   │   │   └── DevTools.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                  # typed fetch wrappers
│   │   │   └── catalog.ts              # Product type + CATALOG
│   │   └── styles.css                  # Tailwind directives + custom CSS
│   ├── index.html                      # Vite entry HTML
│   ├── vite.config.ts                  # build + dev proxy
│   ├── tailwind.config.js              # Zbucks palette
│   ├── postcss.config.js
│   └── tsconfig.json                   # frontend-specific (jsx, dom)
├── public/                             # REMOVED in Task 2
├── package.json                        # MODIFIED: + react/vite/tailwind scripts
├── tsconfig.json                       # MODIFIED: exclude web/
├── .gitignore                          # MODIFIED: + web/dist
├── vitest.config.ts                    # unchanged
└── README.md                           # MODIFIED: drop no-React claims
```

Component sizes: Header ~25 lines, Footer ~30, ProductCard ~40, Storefront ~30, Checkout ~140, DevTools ~120, App ~80, lib/api.ts ~60, lib/catalog.ts ~25. Total ~550 LoC of TypeScript-React.

---

## Task 1: Scaffold Vite + React + Tailwind project

**Files:**
- Create: `web/package-changes.txt` (intermediate; deleted at end)
- Create: `web/vite.config.ts`
- Create: `web/tailwind.config.js`
- Create: `web/postcss.config.js`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx` (placeholder)
- Create: `web/src/styles.css`
- Modify: `package.json` (add deps + scripts)
- Modify: `tsconfig.json` (exclude web/)
- Modify: `.gitignore` (add web/dist)

- [ ] **Step 1: Install new deps**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm install react@^18.3.0 react-dom@^18.3.0
npm install -D vite@^5.4.0 @vitejs/plugin-react@^4.3.0 \
  @types/react@^18.3.0 @types/react-dom@^18.3.0 \
  tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0 \
  concurrently@^8.2.0
```

Expected: clean install, exit 0. There may be peer-dep warnings — ignore them as long as `npm ls` doesn't show errors.

- [ ] **Step 2: Add scripts to root `package.json`**

Open `package.json`. Replace the `"scripts"` block with:

```json
  "scripts": {
    "dev":         "concurrently -k -n server,web -c green,cyan \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server":  "ts-node src/server.ts",
    "dev:web":     "vite --config web/vite.config.ts",
    "build":       "tsc && vite build --config web/vite.config.ts",
    "start":       "node dist/server.js",
    "test":        "vitest run",
    "test:watch":  "vitest"
  },
```

The previous `dev` was `ts-node src/server.ts`; this is now `dev:server`. Old call sites (`npm run dev`) get the combined behavior.

- [ ] **Step 3: Update root `tsconfig.json` to exclude `web/`**

Find the `"exclude"` field. Currently:
```json
"exclude": ["node_modules", "dist", "src/**/*.test.ts"]
```

Replace with:
```json
"exclude": ["node_modules", "dist", "src/**/*.test.ts", "web", "web/**/*"]
```

- [ ] **Step 4: Update `.gitignore`**

Append:
```
web/dist/
```

(Other patterns — `node_modules`, `.env`, etc. — already present.)

- [ ] **Step 5: Create `web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/invoices': 'http://localhost:3000',
      '/health':   'http://localhost:3000',
      '/uris':     'http://localhost:3000',
      '/address':  'http://localhost:3000',
      '/merchant': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 6: Create `web/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'zbucks-green':      '#0D6E56',
        'zbucks-green-dark': '#0a5a47',
        'zbucks-cream':      '#FAF6F0',
        'zbucks-brown':      '#3E2C1C',
        'zbucks-gold':       '#E8B547',
        'zbucks-mute':       '#888888',
      },
    },
  },
  plugins: [],
  // Tailwind 3 purge guard: keep these dynamic status pill colors
  safelist: [
    'bg-amber-100',  'text-amber-800',
    'bg-sky-100',    'text-sky-800',
    'bg-green-100',  'text-green-800',
    'bg-rose-100',   'text-rose-800',
  ],
};
```

- [ ] **Step 7: Create `web/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 8: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target":            "ES2022",
    "module":            "ESNext",
    "moduleResolution":  "bundler",
    "lib":               ["ES2022", "DOM", "DOM.Iterable"],
    "jsx":               "react-jsx",
    "strict":            true,
    "esModuleInterop":   true,
    "skipLibCheck":      true,
    "noEmit":            true,
    "allowImportingTsExtensions": false,
    "isolatedModules":   true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 9: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zbucks Coffee — Pay with Zcash</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `web/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #FAF6F0;
  color: #3E2C1C;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 11: Create `web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 12: Create `web/src/App.tsx` (placeholder)**

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-black text-zbucks-green tracking-tight">
          Zbucks <span className="text-zbucks-brown">Coffee</span>
        </h1>
        <p className="text-zbucks-mute mt-2">Scaffold check — replace with real app.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 13: Verify Vite dev server starts**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx vite --config web/vite.config.ts > /tmp/vite-test.log 2>&1 &
VITE_PID=$!
sleep 4
curl -s http://localhost:5173 | grep -c "Zbucks Coffee" || echo "FAIL: Zbucks not in response"
kill $VITE_PID 2>/dev/null
```

Expected: grep prints `1` (the title appears in the served HTML).

- [ ] **Step 14: Verify backend tests still pass**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm test 2>&1 | tail -3
```

Expected: 49 cases pass (no test changes; backend untouched).

- [ ] **Step 15: Commit**

```bash
git add web/ package.json package-lock.json tsconfig.json .gitignore
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(web): scaffold Vite + React + Tailwind project

- Add web/ directory with Vite config, Tailwind theme (Zbucks palette),
  PostCSS, TypeScript config (jsx + DOM lib).
- Root package.json: split 'dev' into 'dev:server' + 'dev:web' (run
  concurrently); 'build' runs tsc + vite build.
- Root tsconfig excludes web/; .gitignore excludes web/dist/."
```

---

## Task 2: Express integration — serve web/dist, /merchant, SPA fallback

**Files:**
- Modify: `src/server.ts`
- Delete: `public/` directory (after the new web tree is wired)

- [ ] **Step 1: Modify `src/server.ts` — change static path and add SPA fallback + /merchant**

Open `src/server.ts`. Find the existing `app.use(express.static(path.join(__dirname, '../public')))` line and REPLACE with:

```ts
const WEB_DIST = path.join(__dirname, '../web/dist');
app.use(express.static(WEB_DIST));
```

Find the existing startup-validation block (the one that throws if `MERCHANT_ADDRESS` is invalid). It already creates `merchantAddressDetails`. Make sure that variable name is preserved — we reference it in the `/merchant` route.

After the existing `app.get('/health', ...)` route AND the `app.get('/address/:addr/details', ...)` route, add the new `/merchant` route:

```ts
app.get('/merchant', (_req, res) => {
  return res.json({
    address:         MERCHANT_ADDRESS,
    network:         NETWORK,
    receiverDetails: merchantAddressDetails,
  });
});
```

At the END of the route registration block (AFTER all `/invoices`, `/health`, `/uris/parse`, `/address/:addr/details`, `/merchant` routes — but BEFORE the `runScanner` function and `app.listen` call), add the SPA fallback:

```ts
// SPA fallback: any non-API GET that doesn't match a static file falls through here
// and gets served the React app's index.html. The negative lookahead avoids
// catching the API routes above.
app.get(/^\/(?!invoices|health|uris|address|merchant).*/, (_req, res) => {
  const indexPath = path.join(WEB_DIST, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(500).send(
        '<h1>Frontend not built</h1>' +
        '<p>Run <code>npm run build</code> to build the React app, ' +
        'or <code>npm run dev</code> to start the Vite dev server on port 5173.</p>'
      );
    }
  });
});
```

If TypeScript complains about the regex argument type (some Express type definitions may want `RegExp | string`), cast: `app.get(/.../ as unknown as string, ...)` — but try without cast first; modern `@types/express` accepts RegExp.

- [ ] **Step 2: Delete `public/` directory**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
git rm -r public/
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0. If the regex causes an error like "Argument of type 'RegExp' is not assignable to parameter of type 'string'", change the regex line to:

```ts
app.get(/^\/(?!invoices|health|uris|address|merchant).*/ as unknown as string, (_req, res) => { ... });
```

- [ ] **Step 4: Build the frontend so we can smoke-test the integration**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx vite build --config web/vite.config.ts 2>&1 | tail -10
```

Expected: a "✓ built" line. The `web/dist/` directory now exists with `index.html`, JS, CSS bundles.

- [ ] **Step 5: Smoke-test the integration**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm run dev:server > /tmp/zc-server.log 2>&1 &
SERVER_PID=$!
sleep 7
echo "=== boot log ==="
cat /tmp/zc-server.log
echo ""
echo "=== Static GET / ==="
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/
echo ""
echo "=== Static body contains Zbucks Coffee ==="
curl -s http://localhost:3000/ | grep -c 'Zbucks Coffee'
echo ""
echo "=== Deep link /checkout/something falls back to index.html ==="
curl -s http://localhost:3000/checkout/anything | grep -c 'Zbucks Coffee'
echo ""
echo "=== /merchant ==="
curl -s http://localhost:3000/merchant | python3 -m json.tool
echo ""
echo "=== /health (still works) ==="
curl -s http://localhost:3000/health | python3 -m json.tool

kill $SERVER_PID 2>/dev/null
```

Expected:
- Boot log shows "Connected to Zcash network. Latest block: <number>".
- `GET /` → 200, body contains "Zbucks Coffee".
- Deep link `/checkout/anything` → 200, also contains "Zbucks Coffee" (SPA fallback).
- `/merchant` → JSON with `address`, `network`, `receiverDetails: { isOrchardCapable: true, ... }`.
- `/health` → JSON with `status: "ok"`.

- [ ] **Step 6: Commit**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
git add src/server.ts
# git rm public/ from Step 2 staged the deletions automatically
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(server): serve web/dist, add /merchant route, SPA fallback

- Static-file path moves from public/ to web/dist/. The old public/
  directory is deleted; index.html now belongs to the React app.
- New GET /merchant returns { address, network, receiverDetails }.
  Retires the v1.1 fake-invoice-probe approach for fetching the
  merchant address from the UI.
- SPA fallback: any non-API path that doesn't match a static file
  serves index.html so React Router-style deep links work."
```

---

## Task 3: Tailwind theme + Header + Footer + App skeleton

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/components/Header.tsx`
- Create: `web/src/components/Footer.tsx`

- [ ] **Step 1: Create `web/src/components/Header.tsx`**

```tsx
export default function Header() {
  return (
    <header className="bg-zbucks-cream border-b border-zbucks-brown/10 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zbucks-green">
            Zbucks<span className="text-zbucks-brown">Coffee</span>
          </h1>
          <p className="text-xs text-zbucks-mute mt-0.5">
            Shielded coffee. Paid in ZEC.
          </p>
        </div>
        <a
          href="https://github.com/thesanjaysubedi/zcash-connect"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zbucks-mute hover:text-zbucks-green transition-colors"
        >
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `web/src/components/Footer.tsx`**

```tsx
type FooterProps = {
  onToggleDevTools?: () => void;
  devToolsOpen?:     boolean;
};

export default function Footer({ onToggleDevTools, devToolsOpen }: FooterProps) {
  return (
    <footer className="border-t border-zbucks-brown/10 mt-16">
      <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <p className="text-xs text-zbucks-mute">
          Powered by <span className="font-semibold text-zbucks-green">ZcashConnect</span>
          <span className="mx-2">·</span>
          ZIP-321 · ZIP-316 · lightwalletd
        </p>
        {onToggleDevTools && (
          <button
            onClick={onToggleDevTools}
            className="text-xs text-zbucks-mute hover:text-zbucks-green transition-colors"
          >
            {devToolsOpen ? 'Hide developer tools ▴' : 'Developer tools ▸'}
          </button>
        )}
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Replace `web/src/App.tsx` with the real skeleton**

```tsx
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
```

- [ ] **Step 4: Smoke-test in dev mode**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx vite --config web/vite.config.ts > /tmp/vite-test.log 2>&1 &
VITE_PID=$!
sleep 4
echo "=== Header rendered ==="
curl -s http://localhost:5173 | grep -c "Zbucks"
echo "=== Footer rendered (after JS — check JS bundle exists) ==="
curl -s http://localhost:5173 | grep -c 'main.tsx'

kill $VITE_PID 2>/dev/null
```

Expected: both greps print at least 1.

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(web): Header + Footer + App skeleton with view router

- Header: Zbucks logo (green Z + brown 'Coffee'), tagline, GitHub link.
- Footer: 'Powered by ZcashConnect' attribution, dev-tools toggle.
- App: useState-based view switcher between store and checkout
  with a preview button for early manual testing."
```

---

## Task 4: API wrapper + Catalog

**Files:**
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/catalog.ts`

- [ ] **Step 1: Create `web/src/lib/api.ts`**

```ts
// Typed fetch wrappers for the ZcashConnect server API.
// All errors throw with the server's `error` field as the message
// when the response status is non-2xx.

export type Receiver = {
  type:   'orchard' | 'sapling' | 'p2pkh' | 'p2sh' | 'unknown';
  typeId: number;
  length: number;
};

export type Merchant = {
  address: string;
  network: string;
  receiverDetails: {
    network:   string;
    receivers: Receiver[];
    isOrchardCapable: boolean;
  };
};

export type InvoiceStatus = 'CREATED' | 'DETECTING' | 'CONFIRMED' | 'EXPIRED';

export type Invoice = {
  invoiceId:      string;
  address:        string;
  amountZec:      string;
  paymentUri:     string;
  qrCode:         string;
  status:         InvoiceStatus;
  createdAt:      string;
  expiresAtBlock: number;
  currentBlock:   number;
  network:        string;
  kind:           'single' | 'multi';
  payments?:      Array<{ amountZec: string; label?: string }>;
};

export type ParsedSingle = { kind: 'single'; payment: { address: string; amount: string; memo?: string; label?: string; message?: string } };
export type ParsedMulti  = { kind: 'multi';  payments: Array<{ address: string; amount: string; memo?: string; label?: string; message?: string }> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  async getMerchant(): Promise<Merchant> {
    return request<Merchant>('/merchant');
  },

  async createInvoiceSingle(amountZec: string, orderId?: string): Promise<Invoice> {
    return request<Invoice>('/invoices', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amountZec, orderId }),
    });
  },

  async createInvoiceMulti(payments: Array<{ amountZec: string; label?: string }>): Promise<Invoice> {
    return request<Invoice>('/invoices', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payments }),
    });
  },

  async getInvoice(id: string): Promise<Invoice> {
    return request<Invoice>(`/invoices/${encodeURIComponent(id)}`);
  },

  async parseUri(uri: string): Promise<ParsedSingle | ParsedMulti> {
    return request<ParsedSingle | ParsedMulti>('/uris/parse', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ uri }),
    });
  },
};
```

- [ ] **Step 2: Create `web/src/lib/catalog.ts`**

```ts
// Hardcoded product catalog for the Zbucks Coffee demo storefront.
// In a real merchant integration this would come from a database.

export type Product = {
  id:          string;
  emoji:       string;
  name:        string;
  description: string;
  amountZec:   string;       // total amount, displayed
} & (
  | { kind: 'single' }
  | { kind: 'multi'; payments: Array<{ amountZec: string; label: string }> }
);

export const CATALOG: Product[] = [
  {
    id:          'espresso',
    emoji:       '☕',
    name:        'Espresso',
    description: 'Single shot, served warm.',
    amountZec:   '0.01',
    kind:        'single',
  },
  {
    id:          'coldbrew',
    emoji:       '🧊',
    name:        'Cold Brew',
    description: 'Slow-steeped 18 hours.',
    amountZec:   '0.02',
    kind:        'single',
  },
  {
    id:          'beanbag',
    emoji:       '🛍️',
    name:        'Bean Bag (250g)',
    description: 'Whole bean, single origin.',
    amountZec:   '0.05',
    kind:        'single',
  },
  {
    id:          'coffeetip',
    emoji:       '💚',
    name:        'Coffee + Tip',
    description: 'Espresso plus a thank-you for the barista.',
    amountZec:   '0.015',
    kind:        'multi',
    payments: [
      { amountZec: '0.01',  label: 'Coffee' },
      { amountZec: '0.005', label: 'Tip' },
    ],
  },
];

export function findProduct(id: string): Product | undefined {
  return CATALOG.find(p => p.id === id);
}
```

- [ ] **Step 3: Type-check (web)**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx tsc -p web/tsconfig.json --noEmit
```

Expected: exit 0. (If TS complains about JSX in App.tsx that uses these libs — wait until they're actually consumed in Task 5+; this step type-checks them in isolation.)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(web): API wrappers + product catalog

- lib/api.ts: typed fetch wrappers around /merchant, /invoices,
  /invoices/:id, /uris/parse. Throws Error with server's error field
  on non-2xx, returns typed JSON on success.
- lib/catalog.ts: 4-product CATALOG (Espresso, Cold Brew, Bean Bag,
  Coffee + Tip). Coffee + Tip has kind 'multi' with two sub-payments
  to demonstrate ZIP-321 multi-recipient encoding."
```

---

## Task 5: Storefront + ProductCard

**Files:**
- Create: `web/src/components/ProductCard.tsx`
- Create: `web/src/components/Storefront.tsx`
- Modify: `web/src/App.tsx` (use Storefront)

- [ ] **Step 1: Create `web/src/components/ProductCard.tsx`**

```tsx
import type { Product } from '../lib/catalog';

type Props = {
  product:  Product;
  onSelect: (id: string) => void;
};

export default function ProductCard({ product, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(product.id)}
      className="text-left bg-white rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 p-6 border border-zbucks-brown/5"
    >
      <div className="text-5xl mb-3">{product.emoji}</div>
      <h3 className="text-lg font-bold text-zbucks-brown">{product.name}</h3>
      <p className="text-sm text-zbucks-mute mt-1 leading-snug">{product.description}</p>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xl font-black text-zbucks-green">{product.amountZec} ZEC</span>
        {product.kind === 'multi' && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-zbucks-gold bg-zbucks-gold/10 px-2 py-0.5 rounded-full">
            Multi-recipient
          </span>
        )}
      </div>
      <div className="mt-4 inline-block text-sm font-bold text-zbucks-green group-hover:underline">
        Pay with Zcash →
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create `web/src/components/Storefront.tsx`**

```tsx
import { CATALOG } from '../lib/catalog';
import ProductCard from './ProductCard';

type Props = {
  onSelect: (id: string) => void;
};

export default function Storefront({ onSelect }: Props) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-black text-zbucks-brown">Today's menu</h2>
        <p className="text-zbucks-mute text-sm mt-1">
          Pay shielded with Zcash. Scan a QR with any ZIP-321-compatible wallet.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATALOG.map((product) => (
          <ProductCard key={product.id} product={product} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify `web/src/App.tsx` to use Storefront**

Replace the current `App.tsx` with:

```tsx
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
```

- [ ] **Step 4: Smoke-test in dev mode**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx vite --config web/vite.config.ts > /tmp/vite-test.log 2>&1 &
VITE_PID=$!
sleep 4

# Vite dev server serves a development index.html with HMR script;
# the actual rendered components come from JS bundle. Verify the JS
# bundle compiles cleanly.
echo "=== Build the production bundle to type-check across all files ==="
npx vite build --config web/vite.config.ts 2>&1 | tail -5

kill $VITE_PID 2>/dev/null
```

Expected: vite build succeeds with "✓ built" line. No type errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ProductCard.tsx web/src/components/Storefront.tsx web/src/App.tsx
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(web): Storefront + ProductCard with 2x2 grid

- Storefront: 'Today's menu' header + responsive 2-column product grid.
- ProductCard: emoji as product imagery, name, description, price,
  'Pay with Zcash →' CTA. Multi-recipient products get a gold badge.
- App: store view delegates to Storefront; checkout still placeholder
  pending Task 6."
```

---

## Task 6: Checkout component (QR, polling, status)

**Files:**
- Create: `web/src/components/Checkout.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/components/Checkout.tsx`**

```tsx
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
```

- [ ] **Step 2: Wire Checkout into `web/src/App.tsx`**

Replace `App.tsx` again:

```tsx
import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Storefront from './components/Storefront';
import Checkout from './components/Checkout';

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
      </main>
      <Footer
        onToggleDevTools={() => setDevToolsOpen((o) => !o)}
        devToolsOpen={devToolsOpen}
      />
    </div>
  );
}
```

- [ ] **Step 3: Smoke-test the full flow in dev mode**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm run dev > /tmp/zc-dev.log 2>&1 &
DEV_PID=$!
sleep 8
echo "=== boot log (first 20 lines) ==="
head -30 /tmp/zc-dev.log
echo ""
echo "=== Vite serves the storefront ==="
curl -s http://localhost:5173 | grep -c 'Zbucks Coffee'
echo ""
echo "=== Vite proxy: /merchant via :5173 hits Express :3000 ==="
curl -s http://localhost:5173/merchant | python3 -m json.tool
echo ""
echo "=== Vite proxy: POST /invoices via :5173 ==="
curl -s -X POST http://localhost:5173/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.01","orderId":"espresso"}' \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('kind:', d.get('kind')); print('status:', d.get('status')); print('uri prefix:', d['paymentUri'][:50])"

kill $DEV_PID 2>/dev/null
sleep 2
ps -p $DEV_PID > /dev/null 2>&1 && kill -9 $DEV_PID 2>/dev/null
echo "Stopped"
```

Expected: server boots, Vite serves the storefront, proxy correctly forwards `/merchant` and `/invoices` to Express.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Checkout.tsx web/src/App.tsx
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(web): Checkout with QR, polling, multi-recipient support

- Checkout creates invoice on mount (single or multi based on product),
  renders QR + status pill + collapsible URI display.
- Polling: 10s interval while CREATED/DETECTING; cleans up on
  CONFIRMED/EXPIRED or unmount. 404 from server restart stops polling.
- Wires into App as the second view; back link returns to Storefront."
```

---

## Task 7: DevTools panel

**Files:**
- Create: `web/src/components/DevTools.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/components/DevTools.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { api, type Merchant } from '../lib/api';

const RECEIVER_TAG_CLASS: Record<string, string> = {
  orchard:  'bg-green-100 text-green-800',
  sapling:  'bg-sky-100   text-sky-800',
  p2pkh:    'bg-amber-100 text-amber-800',
  p2sh:     'bg-amber-100 text-amber-800',
  unknown:  'bg-rose-100  text-rose-800',
};

export default function DevTools() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  const [parseInput, setParseInput] = useState('');
  const [parseOutput, setParseOutput] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.getMerchant();
        if (!cancelled) setMerchant(m);
      } catch (e) {
        if (!cancelled) setMerchantError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleParse() {
    const uri = parseInput.trim();
    if (!uri) return;
    setParseOutput('Parsing...');
    try {
      const result = await api.parseUri(uri);
      setParseOutput(JSON.stringify(result, null, 2));
    } catch (e) {
      setParseOutput('Error: ' + (e as Error).message);
    }
  }

  return (
    <div className="mt-12 max-w-4xl mx-auto px-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-zbucks-brown/10">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zbucks-green">
            Developer tools
          </h3>
          <p className="text-xs italic text-zbucks-mute">
            Not part of the merchant flow
          </p>
        </div>

        {/* Merchant address details */}
        <section className="mb-6">
          <h4 className="text-sm font-bold text-zbucks-brown mb-2">Merchant address</h4>
          {merchantError && (
            <p className="text-sm text-rose-700">{merchantError}</p>
          )}
          {merchant && (
            <div className="text-sm">
              <p className="text-zbucks-mute mb-1">
                <span className="font-semibold text-zbucks-brown">Network:</span> {merchant.network}
                <span className="mx-2">·</span>
                <span className="font-semibold text-zbucks-brown">Receivers:</span> {merchant.receiverDetails.receivers.length}
                <span className="mx-2">·</span>
                <span className="font-semibold text-zbucks-brown">Orchard capable:</span> {merchant.receiverDetails.isOrchardCapable ? 'yes' : 'no'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {merchant.receiverDetails.receivers.map((r, i) => (
                  <span
                    key={i}
                    className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full ${RECEIVER_TAG_CLASS[r.type] ?? RECEIVER_TAG_CLASS.unknown}`}
                  >
                    {r.type} (typeId={r.typeId}, {r.length} bytes)
                  </span>
                ))}
              </div>
              <p className="text-[10px] font-mono text-zbucks-mute break-all mt-2">
                {merchant.address}
              </p>
            </div>
          )}
        </section>

        {/* URI parser */}
        <section>
          <h4 className="text-sm font-bold text-zbucks-brown mb-2">Parse a ZIP-321 URI</h4>
          <textarea
            value={parseInput}
            onChange={(e) => setParseInput(e.target.value)}
            placeholder="zcash:u1...?amount=0.01"
            className="w-full min-h-[60px] p-3 border border-zbucks-brown/20 rounded-lg font-mono text-xs"
          />
          <button
            onClick={handleParse}
            className="mt-2 bg-zbucks-green text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-zbucks-green-dark transition-colors"
          >
            Parse
          </button>
          {parseOutput && (
            <pre className="mt-3 bg-zbucks-cream rounded-lg p-3 text-[10px] font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-auto">
              {parseOutput}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire DevTools into `web/src/App.tsx`**

Replace App.tsx:

```tsx
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
```

- [ ] **Step 3: Build and smoke-test**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx vite build --config web/vite.config.ts 2>&1 | tail -5
echo "Build exit: $?"
```

Expected: "✓ built" line, exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/DevTools.tsx web/src/App.tsx
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(web): DevTools panel (collapsed, storefront-only)

- Auto-loads /merchant on mount; renders network, receiver count,
  Orchard capability, per-receiver type tags, full address.
- Parse URI section: textarea + Parse button calling /uris/parse,
  renders the response as formatted JSON.
- Visible at the bottom of the storefront view only when toggled open
  via the footer link; never shown on the checkout view to keep the
  merchant flow uninterrupted."
```

---

## Task 8: README v1.2 update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README**

```bash
cat /Users/sanjayasubedi/Desktop/work/zcash-sdk/README.md
```

(Read it through so the upcoming edits land in the right places.)

- [ ] **Step 2: Update the `## What this is` section**

Find the bullet list under `## What this is` (which currently lists ZIP-321 build+parse, ZIP-316, gRPC, invoice lifecycle, browser demo). Replace the LAST bullet about "browser demo" with:

```markdown
- **Polished merchant storefront** built with React + Vite + Tailwind
  ("Zbucks Coffee" demo) showing how a merchant uses the SDK
```

Keep all other bullets.

- [ ] **Step 3: Update the `## Quick start` section**

REPLACE the entire section between `## Quick start` and the next `##` heading with:

````markdown
## Quick start

```bash
git clone https://github.com/thesanjaysubedi/zcash-connect
cd zcash-connect
npm install

mkdir -p proto
```

The lightwalletd proto files are committed in `proto/` for convenience — a
fresh clone has them already and `npm run dev` will work without any download
step. The script below is provided for users who want to refresh them from
upstream. Note: the proto files are stored as symlinks in the
`zcash/lightwalletd` GitHub repo, so a plain `curl` against the
`raw.githubusercontent.com` URL returns a 47-byte symlink target string
instead of the actual proto. Use the GitHub Contents API instead:

```bash
fetch_proto() {
  local name=$1
  curl -fsSL \
    -H 'Accept: application/vnd.github.v3+json' \
    "https://api.github.com/repos/zcash/lightwalletd/contents/walletrpc/$name" \
    | python3 -c "import sys, json, base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())" \
    > "proto/$name"
}
fetch_proto service.proto
fetch_proto compact_formats.proto
```

Configure the environment:

```bash
cp .env.example .env
# Edit .env: set MERCHANT_ADDRESS to your Orchard unified address (u1...)
```

### Development (HMR + auto-reload)

```bash
npm run dev
```

This starts two processes via `concurrently`:
- Express API on `http://localhost:3000`
- Vite dev server on `http://localhost:5173` with hot module reload

Open `http://localhost:5173` in a browser. Vite proxies all API calls
(`/invoices`, `/health`, `/merchant`, `/uris/parse`, `/address/:addr/details`)
to Express on port 3000.

### Production (single process, prebuilt assets)

```bash
npm run build   # tsc compiles backend; vite builds frontend to web/dist/
npm start       # Express serves the React app + API on port 3000
```

Open `http://localhost:3000`.
````

- [ ] **Step 4: Update the `## API` table**

Find the `## API` table. Replace the row order and ADD the `/merchant` row:

```markdown
| Method | Path                       | Description |
|---|---|---|
| GET  | /merchant                    | Returns the configured merchant address with decoded receiver details |
| POST | /invoices                    | Create a payment invoice. Body: `{ amountZec, ... }` (single) or `{ payments: [...] }` (multi-recipient) |
| GET  | /invoices/:id                | Get invoice status |
| GET  | /invoices                    | List all invoices |
| GET  | /health                      | Verify server and Zcash network connection |
| POST | /uris/parse                  | Parse a `zcash:` URI back to structured fields. Body: `{ uri }` |
| GET  | /address/:addr/details       | Decode a Zcash unified address: receivers, network, Orchard capability |
```

- [ ] **Step 5: Update the `## Tech stack` section**

Replace the existing tech stack paragraph with:

```markdown
## Tech stack

**Backend:** Node 20 LTS, TypeScript 5 (strict), Express 4, `@grpc/grpc-js`, `qrcode`, Vitest.
**Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3.
**Zcash protocol primitives:** `bech32` (envelope only), `blakejs` (BLAKE2b for F4Jumble); ZIP-316 + ZIP-321 implemented locally.
**Zcash network:** `zec.rocks:443` (public lightwalletd, no auth required).
```

- [ ] **Step 6: Verify integrity**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk

# Code fences should be balanced (even count)
echo "Code fences: $(grep -c '```' README.md)"

# New mentions added
grep -c "React" README.md
grep -c "Vite" README.md
grep -c "Tailwind" README.md
grep -c "/merchant" README.md
grep -c "Zbucks" README.md
```

Expected: code fences even count; React/Vite/Tailwind/merchant/Zbucks counts ≥ 1.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "docs: README v1.2 — React storefront, /merchant route, dev/prod commands"
```

---

## Task 9: Final smoke test

No commits. Verify the entire system end-to-end before push.

- [ ] **Step 1: Clean install + type-check + tests**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npx tsc --noEmit; echo "tsc=$?"
npx tsc -p web/tsconfig.json --noEmit; echo "tsc:web=$?"
npm test 2>&1 | tail -3
```

Expected: both tsc exit 0; 49 backend tests pass.

- [ ] **Step 2: Production build**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
rm -rf dist web/dist
npm run build 2>&1 | tail -10
ls -la web/dist/ | head -10
```

Expected: build succeeds; `web/dist/` contains `index.html` and an `assets/` dir with bundled JS+CSS.

- [ ] **Step 3: Production server smoke test**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm start > /tmp/zc-prod.log 2>&1 &
SERVER_PID=$!
sleep 7
echo "=== boot log ==="
cat /tmp/zc-prod.log
echo ""
echo "=== Storefront serves ==="
curl -s -o /dev/null -w 'GET / → HTTP %{http_code}\n' http://localhost:3000/
echo ""
echo "=== /merchant ==="
curl -s http://localhost:3000/merchant | python3 -m json.tool
echo ""
echo "=== /health ==="
curl -s http://localhost:3000/health | python3 -m json.tool
echo ""
echo "=== POST /invoices (single, espresso) ==="
curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.01","orderId":"espresso"}' \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('kind:', d.get('kind')); print('amountZec:', d['amountZec']); print('status:', d['status'])"
echo ""
echo "=== POST /invoices (multi, coffee+tip) ==="
curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"payments":[{"amountZec":"0.01","label":"Coffee"},{"amountZec":"0.005","label":"Tip"}]}' \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('kind:', d.get('kind')); print('total:', d['amountZec']); print('payments:', len(d.get('payments', [])))"
echo ""
echo "=== Deep link /checkout/anything serves index.html ==="
curl -s http://localhost:3000/checkout/anything | grep -c '<div id="root">'
echo ""
echo "=== /address/<MERCHANT>/details ==="
ADDR=$(grep '^MERCHANT_ADDRESS=' .env | cut -d= -f2)
curl -s "http://localhost:3000/address/$ADDR/details" | python3 -c "import sys, json; d = json.load(sys.stdin); print('network:', d['network']); print('receivers:', len(d['receivers'])); print('orchard:', d['isOrchardCapable'])"
echo ""
echo "=== /uris/parse round-trip ==="
URI=$(curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.7"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['paymentUri'])")
echo "Built: ${URI:0:60}..."
curl -s -X POST http://localhost:3000/uris/parse \
  -H 'Content-Type: application/json' \
  --data-raw "{\"uri\":\"$URI\"}" | python3 -c "import sys, json; d = json.load(sys.stdin); print('kind:', d.get('kind')); print('parsed amount:', d.get('payment', {}).get('amount'))"

kill $SERVER_PID 2>/dev/null
sleep 2
ps -p $SERVER_PID > /dev/null 2>&1 && kill -9 $SERVER_PID 2>/dev/null
echo "Server stopped"
```

Expected (each line):
- Boot log shows "Connected to Zcash network. Latest block: <number>"
- `GET /` → 200
- `/merchant` → JSON with `address`, `network: "main"`, `receiverDetails: { isOrchardCapable: true, receivers: [3 entries] }`
- `/health` → JSON with `status: "ok"`
- Single invoice: `kind: single`, `amountZec: 0.01`, `status: CREATED`
- Multi invoice: `kind: multi`, `total: 0.015`, `payments: 2`
- Deep link grep prints `1` (SPA fallback works)
- Address details: `network: main`, `receivers: 3`, `orchard: True`
- URI round-trip: `kind: single`, `parsed amount: 0.7`

- [ ] **Step 4: Dev mode quick test**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
npm run dev > /tmp/zc-dev.log 2>&1 &
DEV_PID=$!
sleep 8
echo "=== Dev mode: Vite + Express both up? ==="
echo -n "Express :3000  → "; curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/health
echo -n "Vite    :5173  → "; curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:5173/
echo -n "Proxy: /merchant via Vite → "; curl -s http://localhost:5173/merchant | python3 -c "import sys, json; d = json.load(sys.stdin); print('network:', d['network'])"

kill $DEV_PID 2>/dev/null
sleep 2
ps -p $DEV_PID > /dev/null 2>&1 && kill -9 $DEV_PID 2>/dev/null
echo "Dev stopped"
```

Expected: both ports respond 200; Vite proxies `/merchant` to Express and returns the same `network: "main"`.

- [ ] **Step 5: Browser check (manual — controller responsibility)**

Run `npm run dev` and open `http://localhost:5173` in a browser. Verify:
1. Header renders: green "Zbucks" + brown "Coffee" logo + tagline.
2. Storefront shows 4 product cards (Espresso, Cold Brew, Bean Bag, Coffee + Tip).
3. Coffee + Tip has a gold "Multi-recipient" badge.
4. Click Espresso → checkout view shows ☕ Espresso · 0.01 ZEC · QR · `CREATED` pill · "Scan with Zashi, ZODL, or Ywallet".
5. Click "Show payment URI" → reveals the `zcash:u1...?amount=0.01...` URI.
6. Click "Back to Zbucks" → returns to storefront.
7. Click Coffee + Tip → checkout shows "This payment splits across 2 recipients" helper text. The shown URI starts with `zcash:?` (multi form).
8. Click "Developer tools ▸" in footer → DevTools panel appears with merchant address details (3 receivers) and a Parse URI textarea.
9. Click "Hide developer tools ▴" → panel collapses.

This step is manual and the controller (you) does the eyeball verification.

- [ ] **Step 6: Final state confirmation**

```bash
cd /Users/sanjayasubedi/Desktop/work/zcash-sdk
echo "=== Recent commits ==="
git log --oneline | head -25
echo ""
echo "=== Author check ==="
git log --format='%an <%ae>' | sort -u
echo ""
echo "=== Searching for any 'Claude' co-author lines ==="
git log --grep='Claude' --all || echo "(none found)"
echo ""
echo "=== git status ==="
git status
```

Expected: all v1.2 commits authored as `Sanjay Subedi <thesanjay43@gmail.com>`; no Claude footers; clean working tree.

---

## Self-review

**Spec coverage:**
- §1 Goal — Tasks 5+6 (storefront + checkout) deliver the merchant-facing flow. ✓
- §2 Non-goals — Plan does not introduce SSR, react-router, shadcn, real photos, mobile-specific layouts, cart, multi-merchant-address. ✓
- §3 Architecture — Task 1 (Vite scaffold) + Task 2 (Express integration) build the Express + Vite + dev proxy + production static serve. ✓
- §4 File structure — Each file in §4 is created or modified by a specific task. ✓
- §5 Scripts — Task 1 step 2 sets the four new scripts. ✓
- §6 Server changes — Task 2 covers static path swap, SPA fallback, `/merchant` route. ✓
- §7 React app shape — Task 1 (skeleton), Task 3 (header/footer/App), Tasks 5/6/7 (Storefront/Checkout/DevTools). View routing is `useState` per spec. ✓
- §8 Visual design — Tailwind config (Task 1) defines the palette; component classes (Tasks 3/5/6/7) apply it. ✓
- §9 Catalog — Task 4 creates `web/src/lib/catalog.ts` with the 4 products specified. ✓
- §10 DevTools — Task 7 implements collapsed panel with merchant address + parse URI. ✓
- §11 New `/merchant` route — Task 2. ✓
- §12 Dependencies — Task 1 step 1 installs the full list. ✓
- §13 README — Task 8 covers all four required updates. ✓
- §14 Verification — Task 9 implements all 10 verification points. ✓
- §15 Risks — Vite proxy explicitly listed; SPA fallback regex precise; `web/dist` missing gives clear error. ✓
- §16 Out-of-scope — Plan does not introduce push to GitHub, Railway updates, real photos, a11y review, i18n. ✓

**Placeholder scan:** No TBD, TODO, "implement later", or vague "add validation" instructions. Every step has executable code or commands.

**Type consistency:**
- `Invoice`, `Merchant`, `Receiver`, `InvoiceStatus`, `ParsedSingle`, `ParsedMulti` defined in Task 4 `lib/api.ts`; consumed in Tasks 6 (Checkout) and 7 (DevTools).
- `Product` defined in Task 4 `lib/catalog.ts`; consumed in Tasks 5 (ProductCard, Storefront) and 6 (Checkout).
- `View` discriminated union defined in Task 1 App.tsx; consumed (and re-defined identically) in Tasks 5/6/7 App.tsx replacements. Names match across rewrites.
- `merchantAddressDetails` referenced in Task 2 `/merchant` route — already created at startup by v1.1 server.ts (verified by reading the existing file).

No issues found.
