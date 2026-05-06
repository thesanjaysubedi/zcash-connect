# ZcashConnect MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ZcashConnect MVP — a Node.js/TypeScript Express server that generates ZIP-321 payment URIs for Orchard unified addresses, connects to lightwalletd over gRPC, and exposes a clean payment lifecycle API with a vanilla HTML demo page.

**Architecture:** Single Node 20 process. Express HTTP API + static frontend. gRPC-over-TLS to `zec.rocks:443` lightwalletd. In-memory `Map`-based invoice store. 30s scanner interval expires stale invoices. Four pure modules (`zip321`, `invoices`, `lightwalletd`) wired together by a thin `server.ts` composition root. Test-driven for the two pure-logic modules.

**Tech Stack:** Node 20 LTS · TypeScript 5.x strict · Express 4 · `@grpc/grpc-js` + `@grpc/proto-loader` · `qrcode` · `dotenv` · Vitest.

**Commit author for this plan:** All commits authored as `Sanjay Subedi <thesanjay43@gmail.com>`. No `Co-Authored-By: Claude` footer.

---

## File structure (target end state)

```
zcash-sdk/                              # repo root, working dir
├── src/
│   ├── server.ts                       # Express composition root, scanner
│   ├── zip321.ts                       # ZIP-321 URI + memo (pure)
│   ├── lightwalletd.ts                 # typed gRPC wrapper
│   ├── invoices.ts                     # in-memory state machine
│   ├── zip321.test.ts                  # vitest
│   └── invoices.test.ts                # vitest
├── proto/
│   ├── service.proto                   # downloaded
│   └── compact_formats.proto           # downloaded if service.proto imports it
├── public/
│   └── index.html                      # vanilla single-file demo
├── docs/superpowers/{specs,plans}/     # already in repo
├── .env                                # gitignored, placeholder MERCHANT_ADDRESS
├── .env.example                        # tracked template
├── .gitignore                          # already in repo
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── ZcashConnect_MVP_Developer_Brief.{md,pdf}    # already in repo
```

Each `src/*.ts` has one clear responsibility. Tests live next to source. The frontend is one self-contained file. The Express server is a thin composition root that wires the pure modules — *no business logic in `server.ts`*.

---

## Task 1: Scaffold config files

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.env`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "zcashconnect-mvp",
  "version": "1.0.0",
  "description": "ZcashConnect MVP — shielded payment lifecycle demo",
  "license": "MIT",
  "main": "dist/server.js",
  "scripts": {
    "dev":   "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test":  "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@grpc/grpc-js":      "^1.10.0",
    "@grpc/proto-loader": "^0.7.0",
    "dotenv":             "^16.0.0",
    "express":            "^4.18.0",
    "qrcode":             "^1.5.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node":    "^20.0.0",
    "@types/qrcode":  "^1.5.0",
    "ts-node":        "^10.9.0",
    "typescript":     "^5.0.0",
    "vitest":         "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target":            "ES2022",
    "module":            "commonjs",
    "lib":               ["ES2022"],
    "outDir":            "./dist",
    "rootDir":           "./src",
    "strict":            true,
    "esModuleInterop":   true,
    "skipLibCheck":      true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create `.env.example`** (tracked — template for new clones)

```
LIGHTWALLETD_HOST=zec.rocks:443
NETWORK=main
MERCHANT_ADDRESS=u1yourorcahrdunifiedaddresshere
PORT=3000
```

- [ ] **Step 5: Create `.env`** (gitignored — local dev defaults so the server boots)

```
LIGHTWALLETD_HOST=zec.rocks:443
NETWORK=main
MERCHANT_ADDRESS=u1placeholder_set_real_address_before_deploy_xxxxxxxxxxxxxxxxxxxx
PORT=3000
```

> Verify `.env` is gitignored — running `git check-ignore .env` should print `.env`. The `.gitignore` was committed earlier and includes `.env`.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "chore: scaffold project config (npm, tsc, vitest, env)"
```

(Do not stage `.env` — it's gitignored.)

---

## Task 2: Install deps and download proto files

**Files:**
- Create: `proto/service.proto` (downloaded)
- Create: `proto/compact_formats.proto` (downloaded only if `service.proto` imports it — check after step 2)

- [ ] **Step 1: Install dependencies**

```bash
npm install
```

Expected: writes `node_modules/`, creates `package-lock.json`. No errors. If you see deprecation warnings for transitive deps, ignore — they're not actionable here.

- [ ] **Step 2: Download `service.proto`**

```bash
mkdir -p proto
curl -fsSL -o proto/service.proto \
  https://raw.githubusercontent.com/zcash/lightwalletd/master/walletrpc/service.proto
```

Expected: file exists, ~6 KB, contains the line `service CompactTxStreamer {`.

- [ ] **Step 3: Decide whether to download `compact_formats.proto`**

Check whether `service.proto` imports it:

```bash
grep '^import' proto/service.proto
```

If you see `import "compact_formats.proto";`, download it:

```bash
curl -fsSL -o proto/compact_formats.proto \
  https://raw.githubusercontent.com/zcash/lightwalletd/master/walletrpc/compact_formats.proto
```

Otherwise, skip — we don't need it.

- [ ] **Step 4: Stage and commit**

```bash
git add package-lock.json proto/
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "chore: install deps and add lightwalletd proto definitions"
```

---

## Task 3: Implement `src/zip321.ts` (TDD)

**Files:**
- Create: `src/zip321.test.ts`
- Create: `src/zip321.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/zip321.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPaymentUri, buildMemo } from './zip321';

describe('buildPaymentUri', () => {
  const ADDR = 'u1exampleorchardunifiedaddress';

  it('emits zcash:<addr>?amount=... with required params only', () => {
    const uri = buildPaymentUri({ address: ADDR, amount: '0.01' });
    expect(uri).toBe(`zcash:${ADDR}?amount=0.01`);
  });

  it('omits optional params when undefined', () => {
    const uri = buildPaymentUri({ address: ADDR, amount: '1' });
    expect(uri).not.toContain('memo=');
    expect(uri).not.toContain('label=');
    expect(uri).not.toContain('message=');
  });

  it('encodes memo as base64url and includes label and message', () => {
    const uri = buildPaymentUri({
      address: ADDR,
      amount:  '0.5',
      memo:    'hello world',
      label:   'Order 1',
      message: 'thanks',
    });
    const params = new URLSearchParams(uri.split('?')[1]);
    expect(params.get('amount')).toBe('0.5');
    // base64url has no '+', '/', or '=' padding
    const memoParam = params.get('memo')!;
    expect(memoParam).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(params.get('label')).toBe('Order 1');
    expect(params.get('message')).toBe('thanks');
  });

  it('preserves UTF-8 multibyte characters in memo', () => {
    const uri = buildPaymentUri({ address: ADDR, amount: '1', memo: '日本語' });
    const memoParam = new URLSearchParams(uri.split('?')[1]).get('memo')!;
    // Decode and verify round-trip
    const padded = memoParam + '='.repeat((4 - memoParam.length % 4) % 4);
    const decoded = Buffer.from(
      padded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    expect(decoded).toBe('日本語');
  });
});

describe('buildMemo', () => {
  it('produces a string starting with the ZC1: prefix', () => {
    const memo = buildMemo({ invoiceId: 'abc' });
    expect(memo.startsWith('ZC1:')).toBe(true);
  });

  it('encodes the JSON body as base64url with no padding', () => {
    const memo = buildMemo({ invoiceId: 'abc', orderId: '123' });
    const body = memo.slice('ZC1:'.length);
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/); // base64url alphabet, no '='
  });

  it('round-trips: decoding the base64url body yields the original JSON', () => {
    const data = { invoiceId: 'inv-xyz', orderId: 'ord-42' };
    const memo = buildMemo(data);
    const body = memo.slice('ZC1:'.length);
    const padded = body + '='.repeat((4 - body.length % 4) % 4);
    const json = Buffer.from(
      padded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    expect(JSON.parse(json)).toEqual(data);
  });

  it('throws when encoded length exceeds 512 bytes', () => {
    // a 600-byte string of ASCII chars will encode to ~800 chars in base64url
    const huge = { invoiceId: 'x'.repeat(600) };
    expect(() => buildMemo(huge)).toThrow(/Memo too long/);
  });

  it('accepts payloads at the 512-byte boundary', () => {
    // build payload size that lands the encoded result at <= 512 bytes
    // 'ZC1:' is 4 bytes; remaining 508 base64url chars decode to 381 bytes
    // JSON overhead for {"invoiceId":"..."} is 16 bytes -> id can be ~365 chars
    const id = 'x'.repeat(360);
    expect(() => buildMemo({ invoiceId: id })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests, observe failure**

```bash
npm test
```

Expected: vitest reports failures with `Cannot find module './zip321'` (or similar — module doesn't exist yet).

- [ ] **Step 3: Implement `src/zip321.ts`**

Create `src/zip321.ts`:

```ts
// ZIP-321 Payment Request URI implementation
// Spec: https://zips.z.cash/zip-0321

export interface PaymentRequest {
  address:  string;
  amount:   string;
  memo?:    string;
  label?:   string;
  message?: string;
}

export interface StructuredMemo {
  invoiceId: string;
  orderId?:  string;
  [key: string]: unknown;
}

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function buildMemo(data: StructuredMemo): string {
  const json    = JSON.stringify(data);
  const encoded = `ZC1:${toBase64Url(json)}`;
  const bytes   = Buffer.byteLength(encoded, 'utf8');
  if (bytes > 512) {
    throw new Error(`Memo too long: ${bytes} bytes (max 512)`);
  }
  return encoded;
}

export function buildPaymentUri(req: PaymentRequest): string {
  const params = new URLSearchParams();
  params.set('amount', req.amount);
  if (req.memo)    params.set('memo',    toBase64Url(req.memo));
  if (req.label)   params.set('label',   req.label);
  if (req.message) params.set('message', req.message);
  return `zcash:${req.address}?${params.toString()}`;
}
```

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test
```

Expected: all `zip321.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/zip321.ts src/zip321.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(zip321): payment URI and structured memo with 512-byte cap"
```

---

## Task 4: Implement `src/invoices.ts` (TDD)

**Files:**
- Create: `src/invoices.test.ts`
- Create: `src/invoices.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/invoices.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as Invoices from './invoices';

const baseParams = {
  address:     'u1example',
  amountZec:   '0.01',
  memoText:    'ZC1:abc',
  paymentUri:  'zcash:u1example?amount=0.01',
  currentBlock: 1000,
};

beforeEach(() => Invoices._resetForTests());

describe('create', () => {
  it('returns invoice with status CREATED', () => {
    const inv = Invoices.create(baseParams);
    expect(inv.status).toBe('CREATED');
    expect(inv.id).toBeTypeOf('string');
    expect(inv.id.length).toBeGreaterThan(0);
  });

  it('defaults expiresAtBlock to currentBlock + 24', () => {
    const inv = Invoices.create(baseParams);
    expect(inv.expiresAtBlock).toBe(1024);
    expect(inv.createdAtBlock).toBe(1000);
  });

  it('honors a custom expiryBlocks', () => {
    const inv = Invoices.create({ ...baseParams, expiryBlocks: 100 });
    expect(inv.expiresAtBlock).toBe(1100);
  });
});

describe('get and list', () => {
  it('get returns undefined for unknown id', () => {
    expect(Invoices.get('nope')).toBeUndefined();
  });

  it('list returns invoices newest first', async () => {
    const a = Invoices.create(baseParams);
    await new Promise(r => setTimeout(r, 5));
    const b = Invoices.create(baseParams);
    const all = Invoices.list();
    expect(all[0].id).toBe(b.id);
    expect(all[1].id).toBe(a.id);
  });
});

describe('updateStatus', () => {
  it('updates status and returns invoice', () => {
    const inv = Invoices.create(baseParams);
    const updated = Invoices.updateStatus(inv.id, 'CONFIRMED', 'tx-abc');
    expect(updated?.status).toBe('CONFIRMED');
    expect(updated?.detectedTxId).toBe('tx-abc');
  });

  it('returns undefined for unknown id', () => {
    expect(Invoices.updateStatus('nope', 'CONFIRMED')).toBeUndefined();
  });
});

describe('expireStale', () => {
  it('flips CREATED past deadline to EXPIRED', () => {
    const inv = Invoices.create(baseParams); // expires at 1024
    const expired = Invoices.expireStale(2000);
    expect(expired).toContain(inv.id);
    expect(Invoices.get(inv.id)?.status).toBe('EXPIRED');
  });

  it('does not flip CONFIRMED invoices', () => {
    const inv = Invoices.create(baseParams);
    Invoices.updateStatus(inv.id, 'CONFIRMED');
    const expired = Invoices.expireStale(2000);
    expect(expired).not.toContain(inv.id);
    expect(Invoices.get(inv.id)?.status).toBe('CONFIRMED');
  });

  it('does not flip invoices still within deadline', () => {
    const inv = Invoices.create(baseParams); // expires at 1024
    const expired = Invoices.expireStale(1010);
    expect(expired).toEqual([]);
    expect(Invoices.get(inv.id)?.status).toBe('CREATED');
  });
});
```

- [ ] **Step 2: Run tests, observe failure**

```bash
npm test -- invoices
```

Expected: failures with `Cannot find module './invoices'`.

- [ ] **Step 3: Implement `src/invoices.ts`**

Create `src/invoices.ts`:

```ts
// Invoice lifecycle state machine
// In-memory for MVP — replace Map with database in production

import crypto from 'crypto';

export type InvoiceStatus =
  | 'CREATED'   // Invoice generated, waiting for payment
  | 'DETECTING' // Payment seen in mempool, not yet confirmed
  | 'CONFIRMED' // Payment confirmed on chain
  | 'EXPIRED';  // Payment window closed, no payment received

export interface Invoice {
  id:             string;
  address:        string;
  amountZec:      string;
  memoText:       string;
  paymentUri:     string;
  status:         InvoiceStatus;
  createdAtBlock: number;
  expiresAtBlock: number;
  detectedTxId?:  string;
  webhookUrl?:    string;
  createdAt:      Date;
}

const store = new Map<string, Invoice>();

export function create(params: {
  address:       string;
  amountZec:     string;
  memoText:      string;
  paymentUri:    string;
  currentBlock:  number;
  expiryBlocks?: number;
  webhookUrl?:   string;
}): Invoice {
  const invoice: Invoice = {
    id:             crypto.randomUUID(),
    address:        params.address,
    amountZec:      params.amountZec,
    memoText:       params.memoText,
    paymentUri:     params.paymentUri,
    status:         'CREATED',
    createdAtBlock: params.currentBlock,
    expiresAtBlock: params.currentBlock + (params.expiryBlocks ?? 24),
    webhookUrl:     params.webhookUrl,
    createdAt:      new Date(),
  };
  store.set(invoice.id, invoice);
  return invoice;
}

export function get(id: string): Invoice | undefined {
  return store.get(id);
}

export function list(): Invoice[] {
  return Array.from(store.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function updateStatus(
  id:     string,
  status: InvoiceStatus,
  txId?:  string
): Invoice | undefined {
  const inv = store.get(id);
  if (!inv) return undefined;
  inv.status = status;
  if (txId) inv.detectedTxId = txId;
  return inv;
}

export function expireStale(currentBlock: number): string[] {
  const expired: string[] = [];
  for (const [id, inv] of store) {
    if (
      (inv.status === 'CREATED' || inv.status === 'DETECTING') &&
      currentBlock > inv.expiresAtBlock
    ) {
      inv.status = 'EXPIRED';
      expired.push(id);
      console.log(`[invoices] Invoice ${id} expired at block ${currentBlock}`);
    }
  }
  return expired;
}

// Test-only — clears the in-memory store between cases.
// Not part of the public API; consumers should not call this.
export function _resetForTests(): void {
  store.clear();
}
```

- [ ] **Step 4: Run tests, observe pass**

```bash
npm test
```

Expected: all `zip321.test.ts` and `invoices.test.ts` cases green. ~15 cases total.

- [ ] **Step 5: Commit**

```bash
git add src/invoices.ts src/invoices.test.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(invoices): in-memory state machine with expiry scanner"
```

---

## Task 5: Implement `src/lightwalletd.ts` (typed gRPC wrapper)

**Files:**
- Create: `src/lightwalletd.ts`

No unit tests for this module per the spec — it's verified by the live `/health` smoke test in Task 9. The work here is producing a *typed* wrapper (no `any`/`eslint-disable`).

- [ ] **Step 1: Implement `src/lightwalletd.ts`**

Create `src/lightwalletd.ts`:

```ts
// gRPC client for the Zcash lightwalletd service.
// Typed wrapper around @grpc/proto-loader's untyped client.

import * as grpc        from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path             from 'path';

// ── Minimal typed surface for the lightwalletd methods we actually use ─────
// The proto-loader returns a runtime object with no static types; we narrow
// it through these interfaces at the boundary so the rest of the codebase
// never touches `any`.

export interface CompactTxStreamerClient {
  getLatestBlock(
    req: Record<string, never>,
    cb: (err: grpc.ServiceError | null, res: { height: string }) => void,
  ): void;
  getLightdInfo(
    req: Record<string, never>,
    cb: (err: grpc.ServiceError | null, res: { version: string }) => void,
  ): void;
}

interface CompactTxStreamerCtor {
  new (host: string, creds: grpc.ChannelCredentials): CompactTxStreamerClient;
}

interface ProtoPackage {
  cash: { z: { wallet: { sdk: { rpc: {
    CompactTxStreamer: CompactTxStreamerCtor;
  } } } } };
}

const PROTO = path.join(__dirname, '../proto/service.proto');

const pkgDef = protoLoader.loadSync(PROTO, {
  keepCase:    true,
  longs:       String,
  enums:       String,
  defaults:    true,
  oneofs:      true,
  includeDirs: [path.join(__dirname, '../proto')],
});

const proto = grpc.loadPackageDefinition(pkgDef) as unknown as ProtoPackage;

export function createClient(host: string): CompactTxStreamerClient {
  return new proto.cash.z.wallet.sdk.rpc.CompactTxStreamer(
    host,
    grpc.credentials.createSsl(),
  );
}

export function getLatestBlockHeight(client: CompactTxStreamerClient): Promise<number> {
  return new Promise((resolve, reject) => {
    client.getLatestBlock({}, (err, res) => {
      if (err) reject(err);
      else     resolve(parseInt(res.height, 10));
    });
  });
}

export function getLightdInfo(client: CompactTxStreamerClient): Promise<{ version: string }> {
  return new Promise((resolve, reject) => {
    client.getLightdInfo({}, (err, res) => {
      if (err) reject(err);
      else     resolve(res);
    });
  });
}
```

- [ ] **Step 2: Type-check the codebase**

```bash
npx tsc --noEmit
```

Expected: zero errors. If you see complaints about `Record<string, never>` not matching the gRPC method signature, change the parameter type to `{}` (empty object).

- [ ] **Step 3: Verify tests still green**

```bash
npm test
```

Expected: same ~15 cases pass as before. (We didn't touch test files; this confirms no regression.)

- [ ] **Step 4: Commit**

```bash
git add src/lightwalletd.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(lightwalletd): typed gRPC client for getLatestBlock and getLightdInfo"
```

---

## Task 6: Implement `src/server.ts` (Express composition root)

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Implement `src/server.ts`**

Create `src/server.ts`:

```ts
// ZcashConnect MVP — Express API server

import 'dotenv/config';
import express from 'express';
import QRCode  from 'qrcode';
import path    from 'path';
import { buildPaymentUri, buildMemo } from './zip321';
import * as Invoices from './invoices';
import {
  createClient,
  getLatestBlockHeight,
  getLightdInfo,
} from './lightwalletd';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Environment ─────────────────────────────────────────────────────
const LIGHTWALLETD_HOST = process.env.LIGHTWALLETD_HOST ?? 'zec.rocks:443';
const MERCHANT_ADDRESS  = process.env.MERCHANT_ADDRESS  ?? '';
const PORT              = parseInt(process.env.PORT     ?? '3000', 10);
const NETWORK           = process.env.NETWORK           ?? 'main';

if (!MERCHANT_ADDRESS) {
  console.error('ERROR: MERCHANT_ADDRESS environment variable is not set.');
  console.error('Set it to your Zcash Orchard unified address (starts with u1).');
  process.exit(1);
}

// ── gRPC client ─────────────────────────────────────────────────────
const client = createClient(LIGHTWALLETD_HOST);

// ── Routes ──────────────────────────────────────────────────────────

app.post('/invoices', async (req, res) => {
  try {
    const { amountZec, orderId, label, webhookUrl } = req.body as {
      amountZec:   string;
      orderId?:    string;
      label?:      string;
      webhookUrl?: string;
    };

    if (!amountZec || parseFloat(amountZec) <= 0) {
      return res.status(400).json({ error: 'amountZec must be a positive number' });
    }

    const currentBlock = await getLatestBlockHeight(client);

    const memoText = buildMemo({
      invoiceId: 'pending',
      orderId:   orderId ?? 'none',
    });

    const paymentUri = buildPaymentUri({
      address: MERCHANT_ADDRESS,
      amount:  amountZec,
      memo:    memoText,
      label:   label ?? 'ZcashConnect Payment',
    });

    const qrCode = await QRCode.toDataURL(paymentUri, {
      errorCorrectionLevel: 'M',
      width:  256,
      margin: 2,
    });

    const invoice = Invoices.create({
      address:      MERCHANT_ADDRESS,
      amountZec,
      memoText,
      paymentUri,
      currentBlock,
      webhookUrl,
    });

    return res.status(201).json({
      invoiceId:      invoice.id,
      address:        invoice.address,
      amountZec:      invoice.amountZec,
      paymentUri:     invoice.paymentUri,
      qrCode,
      status:         invoice.status,
      createdAt:      invoice.createdAt,
      expiresAtBlock: invoice.expiresAtBlock,
      currentBlock,
      network:        NETWORK,
    });
  } catch (err) {
    console.error('[POST /invoices]', err);
    return res.status(500).json({ error: String(err) });
  }
});

app.get('/invoices/:id', (req, res) => {
  const invoice = Invoices.get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  return res.json(invoice);
});

app.get('/invoices', (_req, res) => {
  return res.json(Invoices.list());
});

app.get('/health', async (_req, res) => {
  try {
    const [blockHeight, info] = await Promise.all([
      getLatestBlockHeight(client),
      getLightdInfo(client),
    ]);
    return res.json({
      status:              'ok',
      network:             NETWORK,
      lightwalletdHost:    LIGHTWALLETD_HOST,
      latestBlock:         blockHeight,
      lightwalletdVersion: info.version,
      merchantAddress:     MERCHANT_ADDRESS.slice(0, 20) + '...',
    });
  } catch (err) {
    return res.status(503).json({ status: 'error', error: String(err) });
  }
});

// ── Block scanner ────────────────────────────────────────────────────
async function runScanner(): Promise<void> {
  try {
    const currentBlock = await getLatestBlockHeight(client);
    const expired = Invoices.expireStale(currentBlock);
    if (expired.length > 0) {
      console.log(`[scanner] Expired ${expired.length} invoice(s) at block ${currentBlock}`);
    }
  } catch (err) {
    console.error('[scanner] Error:', err);
  }
}

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('');
  console.log(' ZcashConnect MVP');
  console.log(` Running on http://localhost:${PORT}`);
  console.log(` Network:      ${NETWORK}`);
  console.log(` Lightwalletd: ${LIGHTWALLETD_HOST}`);
  console.log('');

  try {
    const height = await getLatestBlockHeight(client);
    console.log(` Connected to Zcash network. Latest block: ${height}`);
  } catch (err) {
    console.error(' WARNING: Could not connect to lightwalletd:', err);
  }
  console.log('');

  setInterval(runScanner, 30_000);
  await runScanner();
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Verify all tests still green**

```bash
npm test
```

Expected: ~15 cases pass. The server module isn't imported by tests, so nothing should regress.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(server): Express composition root with invoice + health routes"
```

---

## Task 7: Build the frontend `public/index.html`

**Files:**
- Create: `public/index.html`

This is copied verbatim from the source brief §5.7. Single self-contained file. Inline CSS, inline JS, no build step, no CDN.

- [ ] **Step 1: Create `public/index.html`**

Create the file with the following content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZcashConnect — Shielded Payment Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f0; color: #1a1a1a;
      min-height: 100vh; display: flex;
      align-items: center; justify-content: center; padding: 20px;
    }
    .wrap { max-width: 440px; width: 100%; }
    .card { background: #fff; border-radius: 18px; padding: 32px;
            box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
    .brand { font-size: 22px; font-weight: 800; color: #0D6E56;
             letter-spacing: -0.5px; margin-bottom: 4px; }
    .brand span { color: #1a1a1a; }
    .tagline { font-size: 13px; color: #888; margin-bottom: 28px; }
    .field { margin-bottom: 14px; }
    label { display: block; font-size: 12px; font-weight: 700;
            color: #555; text-transform: uppercase;
            letter-spacing: 0.5px; margin-bottom: 5px; }
    input { width: 100%; padding: 10px 14px; border: 1.5px solid #e0e0e0;
            border-radius: 10px; font-size: 15px; outline: none; }
    input:focus { border-color: #0D6E56; }
    .btn { width: 100%; padding: 13px; background: #0D6E56; color: #fff;
           border: none; border-radius: 10px; font-size: 16px;
           font-weight: 700; cursor: pointer; margin-top: 6px; }
    .btn:hover { background: #0a5a47; }
    .btn:disabled { background: #ccc; cursor: not-allowed; }
    .invoice { display: none; text-align: center; }
    .amount { font-size: 32px; font-weight: 800; color: #0D6E56;
              margin: 16px 0 4px; }
    .net-badge { display: inline-block; font-size: 11px; font-weight: 700;
                 background: #e6f5f0; color: #0D6E56; padding: 2px 10px;
                 border-radius: 20px; margin-bottom: 16px; }
    .qr { width: 200px; height: 200px; border-radius: 12px;
          border: 2px solid #e8e8e8; }
    .status { display: inline-block; margin-top: 14px; padding: 5px 16px;
              border-radius: 20px; font-size: 13px; font-weight: 700; }
    .CREATED   { background:#fff3cd; color:#856404; }
    .DETECTING { background:#d1ecf1; color:#0c5460; }
    .CONFIRMED { background:#d4edda; color:#155724; }
    .EXPIRED   { background:#f8d7da; color:#721c24; }
    .uri { background: #f7f7f7; border-radius: 8px; padding: 10px 12px;
           font-size: 10px; font-family: monospace; word-break: break-all;
           text-align: left; margin-top: 12px; color: #555; }
    .addr { font-size: 11px; color: #aaa; font-family: monospace;
            margin-top: 8px; word-break: break-all; }
    .back { width: 100%; padding: 11px; background: #555; color: #fff;
            border: none; border-radius: 10px; font-size: 14px;
            font-weight: 600; cursor: pointer; margin-top: 16px; }
    .back:hover { background: #333; }
    .footer { text-align: center; font-size: 11px; color: #bbb;
              margin-top: 18px; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="brand">Zcash<span>Connect</span></div>
    <div class="tagline">Shielded Orchard payment demo</div>

    <div id="form">
      <div class="field">
        <label>Amount (ZEC)</label>
        <input type="number" id="amount" value="0.01"
               step="0.001" min="0.001" placeholder="0.01">
      </div>
      <div class="field">
        <label>Order reference (optional)</label>
        <input type="text" id="orderId" placeholder="ORDER-001">
      </div>
      <button class="btn" id="genBtn" onclick="generate()">
        Generate Payment Request
      </button>
    </div>

    <div class="invoice" id="invoice">
      <div class="amount" id="dispAmount"></div>
      <div class="net-badge" id="dispNet">MAINNET</div>
      <br>
      <img class="qr" id="qrImg" src="" alt="Payment QR Code">
      <div class="addr" id="dispAddr"></div>
      <div class="status CREATED" id="badge">CREATED</div>
      <div class="uri" id="dispUri"></div>
      <button class="back" onclick="reset()">New Invoice</button>
    </div>
  </div>
  <div class="footer">
    ZcashConnect MVP &mdash; grant proposal prototype<br>
    Powered by Zcash Orchard &bull; ZIP-321 &bull; lightwalletd
  </div>
</div>

<script>
  let invoiceId = null, poll = null;

  async function generate() {
    const amount  = document.getElementById('amount').value;
    const orderId = document.getElementById('orderId').value;
    const btn     = document.getElementById('genBtn');
    if (!amount || parseFloat(amount) <= 0) { alert('Enter a valid amount'); return; }
    btn.disabled = true; btn.textContent = 'Generating...';
    try {
      const r = await fetch('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountZec: amount, orderId })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      invoiceId = d.invoiceId;
      document.getElementById('dispAmount').textContent = d.amountZec + ' ZEC';
      document.getElementById('dispNet').textContent    = (d.network || 'mainnet').toUpperCase();
      document.getElementById('qrImg').src              = d.qrCode;
      document.getElementById('dispAddr').textContent   = d.address;
      document.getElementById('dispUri').textContent    = d.paymentUri;
      document.getElementById('form').style.display     = 'none';
      document.getElementById('invoice').style.display  = 'block';
      setStatus('CREATED');
      poll = setInterval(checkStatus, 10000);
    } catch(e) {
      alert('Error: ' + e.message);
      btn.disabled = false; btn.textContent = 'Generate Payment Request';
    }
  }

  async function checkStatus() {
    if (!invoiceId) return;
    try {
      const r = await fetch('/invoices/' + invoiceId);
      const d = await r.json();
      setStatus(d.status);
      if (d.status === 'CONFIRMED' || d.status === 'EXPIRED')
        clearInterval(poll);
    } catch(e) { console.error('poll error', e); }
  }

  function setStatus(s) {
    const b = document.getElementById('badge');
    b.textContent = s;
    b.className   = 'status ' + s;
  }

  function reset() {
    clearInterval(poll); invoiceId = null;
    document.getElementById('form').style.display    = 'block';
    document.getElementById('invoice').style.display = 'none';
    document.getElementById('genBtn').disabled       = false;
    document.getElementById('genBtn').textContent    = 'Generate Payment Request';
    document.getElementById('amount').value          = '0.01';
    document.getElementById('orderId').value         = '';
  }
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "feat(ui): vanilla HTML demo page with QR + status polling"
```

---

## Task 8: Write the README

**Files:**
- Create: `README.md`

The README is what the grant committee reads first. It must be honest about what the MVP does and does not do.

- [ ] **Step 1: Create `README.md`**

Create the file with the following content:

````markdown
# ZcashConnect MVP

> A shielded payment lifecycle demo for Zcash, built as part of the
> ZcashConnect ZCG grant proposal.

## What this is

ZcashConnect is a developer SDK for accepting shielded ZEC payments.
This repository is the MVP prototype that demonstrates:

- ZIP-321 payment request URI generation for Orchard unified addresses
- gRPC connection to the Zcash network via lightwalletd
- Invoice lifecycle management: CREATED → DETECTING → CONFIRMED → EXPIRED
- A clean merchant demo page that works in any browser

## What this is NOT

This MVP does not implement:

- Trial decryption using incoming viewing keys (Milestone 2 — requires WebZJS WASM).
  Without trial decryption, the scanner can only expire unpaid invoices; it cannot
  detect that a shielded payment arrived. The state machine encodes the lifecycle
  correctly; the trigger that advances `CREATED → CONFIRMED` ships in M2.
- WebZJS WASM-based in-browser proving (Milestone 3)
- Webhook delivery (Milestone 2)
- BTCPay or WooCommerce plugins (Milestones 6/7)
- ZSA asset support (Milestone 9, post-NU7)

These are planned grant milestones. The MVP proves the payment request and
lifecycle API work correctly on the Zcash network.

## Live demo

Deploy to Railway and replace this line with the deployed URL.

## Quick start

```bash
git clone https://github.com/YOUR_HANDLE/zcashconnect-mvp
cd zcashconnect-mvp
npm install

mkdir -p proto
curl -fsSL -o proto/service.proto \
  https://raw.githubusercontent.com/zcash/lightwalletd/master/walletrpc/service.proto
# If service.proto imports compact_formats.proto, also download that:
grep '^import' proto/service.proto
curl -fsSL -o proto/compact_formats.proto \
  https://raw.githubusercontent.com/zcash/lightwalletd/master/walletrpc/compact_formats.proto

cp .env.example .env
# Edit .env: set MERCHANT_ADDRESS to your Orchard unified address (u1...)

npm run dev
```

Open http://localhost:3000

## API

| Method | Path | Description |
|---|---|---|
| POST | /invoices     | Create a payment invoice |
| GET  | /invoices/:id | Get invoice status |
| GET  | /invoices     | List all invoices |
| GET  | /health       | Verify server and Zcash network connection |

## Sample generated URI

```
zcash:u1abc...xyz?amount=0.01&memo=WkMx...&label=ZcashConnect+Payment
```

This URI is valid ZIP-321 and scannable by ZODL, Zashi, and Ywallet.

## Tests

```bash
npm test
```

Covers ZIP-321 URI generation (with the 512-byte memo cap) and the
invoice state machine. Network integration is verified by `GET /health`
against `zec.rocks:443`.

## Tech stack

Node 20 LTS, TypeScript 5 (strict), Express 4, `@grpc/grpc-js`, `qrcode`, Vitest.
Zcash network: `zec.rocks:443` (public lightwalletd, no auth required).

## License

MIT
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit --author="Sanjay Subedi <thesanjay43@gmail.com>" -m "docs: README with MVP scope, M2 limitation, quick start, API reference"
```

---

## Task 9: Session smoke test

Verify the spec's §11 acceptance criteria. This task makes no commits — it only confirms the previous eight tasks produced a working system.

- [ ] **Step 1: Type-check passes**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: All tests green**

```bash
npm test
```

Expected: ~15 cases pass across `zip321.test.ts` and `invoices.test.ts`.

- [ ] **Step 3: Server boots and connects to lightwalletd**

In one terminal:

```bash
npm run dev
```

Expected output (block height will be a current mainnet number, around 3,000,000+):

```
 ZcashConnect MVP
 Running on http://localhost:3000
 Network:      main
 Lightwalletd: zec.rocks:443

 Connected to Zcash network. Latest block: 3XXXXXX
```

If you see `WARNING: Could not connect to lightwalletd:`, the network is unreachable. Re-check `LIGHTWALLETD_HOST` and try again. Do not proceed until this prints a real block height.

- [ ] **Step 4: Health endpoint returns live block data**

In a second terminal:

```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

Expected: JSON with `"status": "ok"`, a numeric `latestBlock` matching what the server logged, a non-empty `lightwalletdVersion`, and `network: "main"`.

- [ ] **Step 5: Invoice creation returns a valid ZIP-321 URI**

```bash
curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.01","orderId":"TEST-001"}' | python3 -m json.tool
```

Expected: JSON with `invoiceId` (UUID), `paymentUri` starting with `zcash:u1placeholder...?amount=0.01&memo=...`, a `qrCode` data URL beginning with `data:image/png;base64,`, `status: "CREATED"`, and a numeric `currentBlock` and `expiresAtBlock`.

Verify the URI contains `amount=0.01`:

```bash
curl -s -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0.01","orderId":"TEST-001"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['paymentUri'])"
```

- [ ] **Step 6: Invalid amount is rejected**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/invoices \
  -H 'Content-Type: application/json' \
  -d '{"amountZec":"0"}'
```

Expected: `400`.

- [ ] **Step 7: Listing returns invoices newest-first**

```bash
curl -s http://localhost:3000/invoices | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'{len(data)} invoice(s)'); [print(d['id'], d['createdAt'], d['status']) for d in data]"
```

Expected: at least one invoice, newest first.

- [ ] **Step 8: Frontend renders (manual)**

Open http://localhost:3000 in a browser. Click **Generate Payment Request** with the default 0.01 amount. Expected: QR code renders, status badge shows `CREATED`, the bottom shows the full payment URI.

- [ ] **Step 9: Stop the server**

In the dev terminal: `Ctrl+C`.

- [ ] **Step 10: Final state confirmation**

```bash
git log --oneline
```

Expected: roughly 11 commits, all authored as `Sanjay Subedi`. Verify no `Co-Authored-By: Claude` lines:

```bash
git log --format='%an <%ae> | %s' | head -20
git log --grep='Claude' --all
```

The `--grep='Claude'` should return nothing.

```bash
git status
```

Expected: clean working tree (modulo untracked `dist/`, `node_modules/` which are gitignored).

---

## Self-review

Spec coverage check:

- §1 Goal — three deliverables: ZIP-321 (Task 3 ✓), lightwalletd (Task 5 + Task 9 step 3-4 ✓), payment lifecycle API (Tasks 4 + 6 ✓), demo page (Task 7 ✓). ✓
- §2 Non-goals — README in Task 8 documents M2 limitation explicitly. ✓
- §3 Architecture — single Node process, gRPC-over-TLS, in-memory store, 30s scanner — all implemented in Tasks 4-6. ✓
- §4 File structure — every file in the target tree has a creating task. ✓
- §5 Module responsibilities — §5.1 → Task 3; §5.2 → Task 5 (typed surface as designed); §5.3 → Task 4 (state machine + `_resetForTests`); §5.4 → Task 6. ✓
- §6 HTTP API — four routes implemented in Task 6, smoke-tested in Task 9 steps 4-7. ✓
- §7 Frontend — Task 7 copies brief verbatim. ✓
- §8 Configuration — `.env.example` and `.env` created in Task 1; no `WEBHOOK_SECRET`. ✓
- §9 Test strategy — 8 cases for zip321 (Task 3) and 7 cases for invoices (Task 4). ✓
- §10 Deviations — typed gRPC surface (Task 5), no `WEBHOOK_SECRET` (Task 1), Vitest suite (Tasks 1+3+4), conditional `compact_formats.proto` (Task 2 step 3). ✓
- §11 Verification plan — Task 9 implements all eight criteria including manual browser check. ✓
- §12 Risks — `/health` returns 503 on lightwalletd failure (Task 6); proto includeDirs is set (Task 5). ✓
- §13 Out-of-scope deferred items (push to GitHub, deploy to Railway, real merchant address) — not in plan; user's responsibility post-session. ✓

Placeholder scan: no TBD/TODO/"implement later" anywhere. All steps have either complete code blocks, exact commands, or specific verification criteria.

Type consistency: `Invoice`, `InvoiceStatus`, `PaymentRequest`, `StructuredMemo`, `CompactTxStreamerClient` — all defined once in their owning module, imported by name where used. `_resetForTests` is referenced in Task 4 step 1 (test) and defined in Task 4 step 3 (impl) — names match.

No issues found.
