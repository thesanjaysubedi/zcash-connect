# ZcashConnect MVP v1.2 — Zbucks Coffee Storefront (React + Vite)

**Date:** 2026-05-06
**Status:** Approved (in brainstorming session)
**Builds on:** [v1.1 spec](./2026-05-06-zcashconnect-mvp-v1.1-spec-coverage-design.md), [v1.0 spec](./2026-05-06-zcashconnect-mvp-design.md)

---

## 1. Goal

Replace the developer-tool-style demo page with a polished merchant-facing checkout experience. The site reads as a real Zcash-accepting coffee shop ("Zbucks Coffee"), built with React + Vite + Tailwind. Reviewers landing on the demo URL see what a merchant deployed using ZcashConnect would look like — not a debug console.

The grant credibility argument shifts from *"simplicity is credibility for an MVP"* (v1.0/v1.1's vanilla single-file approach) to *"this is how the SDK looks when used to build a real merchant site"*. The README's earlier framing of "no React, no build step" is dropped — the build step is now justified by what it produces.

## 2. Non-goals

- Server-side rendering (CSR is sufficient).
- React Router (two views — `useState` switching is enough).
- A component library beyond Tailwind utilities (no shadcn/ui, no MUI).
- Real product photos (emoji stand-ins are intentional, royalty-free, modern).
- Mobile-specific layouts beyond Tailwind responsive utilities.
- Cart/checkout-with-multiple-line-items flow (direct buy from product card).
- Multi-merchant-address split (the "Coffee + Tip" item splits the same `MERCHANT_ADDRESS` with different labels — demonstrates ZIP-321 multi-recipient *encoding* without requiring multiple address configuration).

## 3. Architecture

Backend Express server is unchanged structurally. A new React frontend lives in `web/`, builds to `web/dist/`, and Express serves the built artifacts as static files in production. In dev, Vite dev server runs on port 5173 and proxies API calls to Express on port 3000.

```
                       ┌──────────────────────────────────────┐
                       │  Browser (http://localhost:3000)     │
                       └──────────────┬───────────────────────┘
                                      │ HTTP
                       ┌──────────────▼───────────────────────┐
                       │  Express server (src/server.ts)      │
                       │   - serves web/dist/ as static       │
                       │   - /invoices, /health, /uris/parse, │
                       │     /address/:addr/details, /merchant│
                       └──────────────┬───────────────────────┘
                                      │ gRPC/TLS
                       ┌──────────────▼───────────────────────┐
                       │  zec.rocks:443 (lightwalletd)        │
                       └──────────────────────────────────────┘
```

Dev mode parallel:

```
http://localhost:5173 (Vite)  ──proxy──►  http://localhost:3000 (Express)
        │                                          │
        ▼                                          ▼
   serves React app                          serves API routes
   with HMR                                  (also serves a stale
                                              built dist if present)
```

## 4. File structure

```
zcash-sdk/
├── src/                         # Backend (unchanged module surface)
│   ├── server.ts                # MODIFIED: serve web/dist; new /merchant
│   ├── zip316.ts                # unchanged
│   ├── zip321.ts                # unchanged
│   ├── lightwalletd.ts          # unchanged
│   ├── invoices.ts              # unchanged
│   ├── zip316.test.ts           # unchanged
│   ├── zip321.test.ts           # unchanged
│   └── invoices.test.ts         # unchanged
├── web/                         # NEW: React frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── Storefront.tsx
│   │   │   ├── Checkout.tsx
│   │   │   └── DevTools.tsx
│   │   ├── lib/
│   │   │   ├── api.ts            # fetch wrappers for all endpoints
│   │   │   └── catalog.ts        # hardcoded 4-product catalog
│   │   └── styles.css            # Tailwind directives + custom CSS
│   ├── index.html                # Vite entry point
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json             # frontend-specific (jsx, dom lib)
├── public/                       # REMOVED — replaced by web/dist/ at build
├── package.json                  # MODIFIED: + react/vite/tailwind/concurrently
├── tsconfig.json                 # MODIFIED: exclude web/
├── vitest.config.ts              # unchanged (still tests src/)
├── README.md                     # MODIFIED: build step documented
└── .gitignore                    # MODIFIED: + web/dist
```

Single root `package.json` (no workspaces). All dev/runtime deps in one place; build artifacts go to `web/dist/`.

## 5. New scripts in `package.json`

```json
{
  "scripts": {
    "dev":         "concurrently -k -n server,web -c green,cyan \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server":  "ts-node src/server.ts",
    "dev:web":     "vite --config web/vite.config.ts",
    "build":       "tsc && vite build --config web/vite.config.ts",
    "start":       "node dist/server.js",
    "test":        "vitest run",
    "test:watch":  "vitest"
  }
}
```

`tsc` builds the backend to `dist/`; `vite build` builds the frontend to `web/dist/`. Production: run `npm run build && npm start`. Express serves the built React app from `web/dist/`.

## 6. Express server changes

### 6.1 Static-file path
Change `app.use(express.static(path.join(__dirname, '../public')))` to:

```ts
const WEB_DIST = path.join(__dirname, '../web/dist');
app.use(express.static(WEB_DIST));
```

Add a fallback handler that returns a clear "build the frontend first" message if `web/dist/index.html` doesn't exist (so a fresh clone that runs `npm start` without `npm run build` first gets a clear error instead of a 404).

### 6.2 SPA fallback
Express must return `index.html` for any non-API GET that doesn't match a static file (so deep links like `/checkout` work even though the React app is single-page). Add at the end of the route registration:

```ts
app.get(/^\/(?!invoices|health|uris|address|merchant).*/, (_req, res) => {
  res.sendFile(path.join(WEB_DIST, 'index.html'));
});
```

### 6.3 New `/merchant` route
Replaces the v1.1 "fake invoice probe" approach (which was flagged as a design smell in the v1.1 final review). Returns the configured merchant address — no side effects.

```ts
app.get('/merchant', (_req, res) => {
  return res.json({
    address: MERCHANT_ADDRESS,
    network: NETWORK,
    receiverDetails: merchantAddressDetails,  // { network, receivers, isOrchardCapable }
  });
});
```

`merchantAddressDetails` is already computed at startup (added in v1.1).

## 7. React app shape

### 7.1 Routing
Local state in `App.tsx`:

```tsx
type View =
  | { kind: 'store' }
  | { kind: 'checkout'; productId: string };

const [view, setView] = useState<View>({ kind: 'store' });
```

History-aware via `pushState` / `popstate` so browser back works. Two routes only — overkill to import react-router.

### 7.2 Components

| File | Purpose | ~LoC |
|---|---|---|
| `main.tsx` | ReactDOM root mount, imports `styles.css` | 10 |
| `App.tsx` | Top-level view switcher, holds view + active-invoice state | ~80 |
| `components/Header.tsx` | Zbucks logo + tagline (visible on both views) | ~25 |
| `components/Footer.tsx` | "Powered by ZcashConnect" + dev tools toggle | ~30 |
| `components/ProductCard.tsx` | Single product tile with Buy button | ~40 |
| `components/Storefront.tsx` | Header + 2x2 grid of ProductCards | ~30 |
| `components/Checkout.tsx` | Big QR, amount, status pill, polling logic, back link | ~140 |
| `components/DevTools.tsx` | Collapsible address details + parse URI | ~120 |
| `lib/api.ts` | Typed fetch wrappers for all endpoints | ~60 |
| `lib/catalog.ts` | Hardcoded 4-product array | ~25 |

Total ≈ 560 lines of TypeScript-React, plus ~50 lines of Tailwind config and ~20 lines of styles.css.

### 7.3 Polling logic in Checkout

```tsx
useEffect(() => {
  if (!invoice) return;
  if (invoice.status === 'CONFIRMED' || invoice.status === 'EXPIRED') return;
  const t = setInterval(async () => {
    const fresh = await api.getInvoice(invoice.invoiceId);
    if (!fresh) {
      clearInterval(t);
      return;
    }
    setInvoice(fresh);
  }, 10000);
  return () => clearInterval(t);
}, [invoice?.invoiceId, invoice?.status]);
```

Uses dependency-array correctness — re-runs when status changes (so the cleanup on CONFIRMED/EXPIRED happens predictably). Same 10-second cadence as v1.1.

## 8. Visual design

### 8.1 Tailwind palette (`tailwind.config.js`)

```js
module.exports = {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'zbucks-green':  '#0D6E56',  // primary CTA, Zcash green
        'zbucks-green-dark': '#0a5a47',
        'zbucks-cream':  '#FAF6F0',  // page background
        'zbucks-brown':  '#3E2C1C',  // headings, copy
        'zbucks-gold':   '#E8B547',  // Z accent
        'zbucks-mute':   '#888888',  // secondary text
      },
      fontFamily: {
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

### 8.2 Component visual rules

- **Cards:** `bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6`
- **Buttons (primary):** `bg-zbucks-green text-white rounded-xl px-5 py-3 font-bold hover:bg-zbucks-green-dark transition-colors`
- **Buttons (secondary):** `bg-zbucks-brown/10 text-zbucks-brown rounded-xl px-4 py-2 font-medium hover:bg-zbucks-brown/20`
- **Status pill:** colored background per status (`bg-amber-100 text-amber-800` for CREATED, etc.) — same color logic as v1.1 but rendered with Tailwind classes
- **Logo:** `font-black tracking-tight text-2xl text-zbucks-green` — "Z" in green, "bucks" in brown

### 8.3 Page layout

```
┌─────────────────────────────────────────────┐
│  Header (zbucks-cream bg, sticky)           │
│  ☕ Zbucks   |   Shielded coffee. Paid in ZEC│
├─────────────────────────────────────────────┤
│                                             │
│  Storefront view:                           │
│  ┌─────────┐ ┌─────────┐                    │
│  │ ☕ Esp.  │ │ 🧊 Cold │                    │
│  │ 0.01ZEC │ │ 0.02ZEC │                    │
│  └─────────┘ └─────────┘                    │
│  ┌─────────┐ ┌─────────┐                    │
│  │ 🛍️ Bean │ │ 💚 C+T  │                    │
│  │ 0.05ZEC │ │ 0.015   │                    │
│  └─────────┘ └─────────┘                    │
│                                             │
├─────────────────────────────────────────────┤
│  Footer:                                    │
│  Powered by ZcashConnect · Dev tools ▸     │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  ← Back to Zbucks                           │
│                                             │
│  Checkout view:                             │
│  ☕ Espresso · 0.01 ZEC                     │
│                                             │
│        ┌──────────────────┐                 │
│        │     QR CODE      │                 │
│        │   (220x220 px)   │                 │
│        └──────────────────┘                 │
│                                             │
│       Status: ⏳ Awaiting payment           │
│                                             │
│  Scan with Zashi, ZODL, or Ywallet to pay   │
│                                             │
│  Show payment URI ▸                         │
└─────────────────────────────────────────────┘
```

## 9. Product catalog (`web/src/lib/catalog.ts`)

```ts
export type Product = {
  id:         string;
  emoji:      string;
  name:       string;
  description: string;
  amountZec:  string;       // total amount, displayed
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
```

## 10. Dev Tools panel

Collapsed `<details>`-style React component (uses `useState<boolean>` for expanded state — no need for native `<details>` for a11y here). Rendered at the bottom of the storefront view only — not on the checkout view, where the merchant flow should be uninterrupted.

Contents (each as a sub-card):
1. **Merchant Address** — fetched once via `GET /merchant`. Renders network, receiver tags (orchard/sapling/p2pkh tags styled per type), Orchard capability.
2. **Parse a ZIP-321 URI** — textarea + button → `POST /uris/parse`, renders JSON response.
3. **Manual invoice (multi-recipient)** — admits a recipients-array input for testing; existing v1.1 multi-recipient toggle, ported to React.

Header text: *"Developer / debug tools — not part of the merchant flow"* in `zbucks-mute` color, italic, small.

## 11. New API surface

| Method | Path | Status | Notes |
|---|---|---|---|
| GET | `/merchant` | NEW | `{ address, network, receiverDetails }` |
| All other v1.1 routes | unchanged | | |

The `/merchant` route is a small fix that retires the v1.1 "fake invoice probe" pattern flagged in the final review.

## 12. Dependencies

### New runtime deps
- `react ^18.3.0`
- `react-dom ^18.3.0`

### New dev deps
- `vite ^5.4.0`
- `@vitejs/plugin-react ^4.3.0`
- `@types/react ^18.3.0`
- `@types/react-dom ^18.3.0`
- `tailwindcss ^3.4.0`
- `postcss ^8.4.0`
- `autoprefixer ^10.4.0`
- `concurrently ^8.2.0`

Total weight added: ~140 KB gzipped client (React + ReactDOM); ~80 MB extra in `node_modules` from Vite + Tailwind. Acceptable for an MVP demo.

## 13. README updates

Sections to revise:
- **What this is:** drop "single self-contained file" claim; add "polished merchant storefront built with React + Vite + Tailwind".
- **Quick start:** new commands include `npm run build` (production) AND `npm run dev` (development).
- **Dev workflow:** explain Vite dev server (port 5173) + Express (port 3000) + proxy.
- **Architecture:** small diagram showing backend + frontend split.
- **Out-of-scope:** drop "no React, no build step" sentences from the v1.0 era; keep all M2/M3 deferrals (trial decryption, etc.).

The "Zcash spec coverage" section from v1.1 is preserved verbatim.

## 14. Verification plan

1. `npm install` clean.
2. `npx tsc --noEmit` exit 0 (backend types).
3. `npm test` — all 49 backend tests still pass (no test changes; v1.2 is frontend-only + a tiny server endpoint).
4. `npm run dev` — both Express (3000) and Vite (5173) start. `http://localhost:5173` shows the Zbucks storefront.
5. Click each of 4 products, confirm:
   - Espresso → checkout shows "Espresso · 0.01 ZEC", QR renders, status `CREATED`.
   - Cold Brew, Bean Bag — same shape, different amount.
   - Coffee + Tip — checkout shows total 0.015, the URI starts with `zcash:?` (multi-recipient form), parsing the URI returns `kind: multi` with 2 payments.
6. `npm run build && npm start` — Express serves the built React app at `:3000`. Same flow works without Vite.
7. `GET /merchant` returns `{ address, network: 'main', receiverDetails: { isOrchardCapable: true, receivers: [3 entries] } }`.
8. Dev Tools panel — opens on click, shows merchant address, parses a sample URI correctly.
9. README documents the build step, no "no React" claims remain.
10. All commits authored as `Sanjay Subedi <thesanjay43@gmail.com>`, no Claude footers.

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vite + Express path conflicts in dev | Vite proxies `/invoices`, `/health`, `/uris`, `/address`, `/merchant` to `:3000`; everything else goes to Vite |
| `web/dist/` missing in production | Express serves a clear error page if the built artifacts aren't present |
| Frontend build breaks Railway deploy | Update Railway buildCommand to `npm run build`; documented in README |
| `concurrently` + ts-node + Vite all running together is slow | Acceptable for dev; production runs single Node process serving prebuilt static |
| Tailwind purge misses dynamic classes (e.g., status pill colors) | Use safelist in `tailwind.config.js` for the small set of dynamic class names, or use static class lookup map in TS |
| React 18 Strict Mode double-renders cause polling weirdness | Polling is keyed off `invoice.status` in deps; double-render is idempotent |

## 16. Out of scope (deferred to user post-implementation)

- Pushing v1.2 to GitHub
- Updating Railway build command via dashboard
- Replacing emoji with real product images (if desired later)
- A11y review beyond Tailwind defaults
- Internationalization
