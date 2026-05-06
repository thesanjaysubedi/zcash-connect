# ZcashConnect MVP — Design Spec

**Date:** 2026-05-06
**Status:** Approved (in brainstorming session)
**Source brief:** [`ZcashConnect_MVP_Developer_Brief.md`](../../../ZcashConnect_MVP_Developer_Brief.md)

---

## 1. Goal

Deliver the three things the source brief commits to proving for the Zcash Community Grants committee:

1. Generate a valid ZIP-321 payment request URI for an Orchard unified address.
2. Connect to the Zcash network via lightwalletd over gRPC and read live block data.
3. Expose a clean payment lifecycle API (invoice creation, QR code, status polling) that a developer unfamiliar with Zcash can run in under 30 minutes.

Plus: a single-file vanilla HTML demo page, a deployable Node.js server, and a public GitHub repo under MIT license. Deployment to Railway is the user's responsibility (requires their login + real `MERCHANT_ADDRESS`); this design takes the project up to the point where it boots cleanly against `zec.rocks:443` and is ready to push.

## 2. Non-goals

These are explicitly *out* of MVP scope (and the README must say so):

- Trial decryption with incoming viewing keys (Milestone 2 — requires WebZJS WASM).
- Real `CREATED → CONFIRMED` state transition. Without trial decryption, the scanner can only *expire* unpaid invoices; it cannot detect that a shielded payment arrived. The state machine encodes the lifecycle correctly; the trigger ships in M2.
- Webhook delivery (`WEBHOOK_SECRET` env var is dropped — the brief declares it but never uses it).
- BTCPay, WooCommerce, ZSA support (later milestones).
- Persistent storage (in-memory `Map` is acceptable for MVP).

## 3. Architecture

Single Node 20 process running TypeScript via `ts-node` in dev, compiled to `dist/` for production.

```
┌─────────────────┐      HTTP       ┌──────────────────┐    gRPC/TLS    ┌─────────────────┐
│  Browser        │  ────────────▶  │  Express server  │ ────────────▶  │  zec.rocks:443  │
│  public/        │  ◀────────────  │  src/server.ts   │ ◀────────────  │  (lightwalletd) │
│  index.html     │   JSON + QR     │                  │   block data   │                 │
└─────────────────┘                 └────────┬─────────┘                └─────────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                       ┌──────────┐  ┌──────────────┐  ┌─────────────┐
                       │ zip321   │  │  invoices    │  │ lightwalletd│
                       │ (pure)   │  │  (in-mem)    │  │ (gRPC wrap) │
                       └──────────┘  └──────────────┘  └─────────────┘
```

**Why single process, no DB:** the MVP is a credibility demo. Reviewers must be able to clone, install, run in <30 min. Persistent state and a job queue would obscure the three things the MVP is actually proving.

**Why gRPC-over-TLS direct (not gRPC-web):** server-side Node, not browser. The brief is explicit about not using the ChainSafe gRPC-web proxy. `zec.rocks:443` accepts direct gRPC without an API key for read-only queries.

## 4. File structure

```
zcash-sdk/                              # working dir, repo root
├── src/
│   ├── server.ts                       # Express composition root
│   ├── zip321.ts                       # ZIP-321 URI + memo
│   ├── lightwalletd.ts                 # gRPC client wrapper
│   ├── invoices.ts                     # state machine
│   ├── zip321.test.ts                  # vitest
│   └── invoices.test.ts                # vitest
├── proto/
│   ├── service.proto                   # downloaded from zcash/lightwalletd
│   └── compact_formats.proto           # only if service.proto imports it
├── public/
│   └── index.html                      # vanilla, single file
├── docs/
│   └── superpowers/specs/              # this file lives here
├── .env                                # MERCHANT_ADDRESS placeholder for local dev
├── .env.example                        # template
├── .gitignore                          # node_modules, dist, .env
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md                           # MUST mention M2 limitation
```

The MVP brief is preserved in place at the repo root so the design intent stays auditable.

## 5. Module responsibilities

### 5.1 `src/zip321.ts` — pure functions
- `buildPaymentUri(req: PaymentRequest): string` — emits `zcash:<addr>?amount=<n>&memo=<b64u>&label=<s>&message=<s>`. Optional params omitted when undefined.
- `buildMemo(data: StructuredMemo): string` — emits `ZC1:<base64url(JSON)>`. Throws if encoded length > 512 bytes (Orchard memo limit).
- `toBase64Url(text: string): string` — internal, used by both.

No I/O. No grpc imports. Keeps the unit testable without mocking.

### 5.2 `src/lightwalletd.ts` — gRPC wrapper
- `createClient(host: string): CompactTxStreamerClient` — TLS-enabled.
- `getLatestBlockHeight(client): Promise<number>` — wraps `getLatestBlock` callback in a Promise.
- `getLightdInfo(client): Promise<{ version: string }>` — wraps `getLightdInfo`.

**Type strategy (deviation from brief):** the brief uses `as any` plus three `eslint-disable` comments. We replace this with a minimal typed interface declared at the top of the file describing only the methods we actually call. Same runtime behavior — `protoLoader.loadSync` still produces the JS object — but the TS surface is clean. No `any` in the public exports.

### 5.3 `src/invoices.ts` — state machine
- `InvoiceStatus = 'CREATED' | 'DETECTING' | 'CONFIRMED' | 'EXPIRED'`.
- `create(params): Invoice` — assigns UUID, captures `createdAtBlock` and `expiresAtBlock = currentBlock + (expiryBlocks ?? 24)`.
- `get(id)`, `list()` — `list()` sorted by `createdAt` descending.
- `updateStatus(id, status, txId?)` — returns updated invoice or `undefined` if id missing.
- `expireStale(currentBlock): string[]` — flips `CREATED|DETECTING` past deadline to `EXPIRED`, returns expired ids.

In-memory `Map<string, Invoice>` module-private. No DB. Process restart loses state — acceptable for MVP demo.

### 5.4 `src/server.ts` — composition root
Wires Express. Loads `.env`. Validates `MERCHANT_ADDRESS` is set (refuses to start otherwise). Constructs the gRPC client. Defines four routes per §6. Starts a `setInterval(runScanner, 30_000)` plus a leading `runScanner()` so expiry runs at boot.

## 6. HTTP API

| Method | Path           | Body / Params                              | Response                                                                    |
|--------|----------------|--------------------------------------------|-----------------------------------------------------------------------------|
| POST   | /invoices      | `{ amountZec, orderId?, label?, webhookUrl? }` | `201 { invoiceId, address, amountZec, paymentUri, qrCode (data URL), status, createdAt, expiresAtBlock, currentBlock, network }` |
| GET    | /invoices/:id  | —                                          | `200 Invoice` or `404 { error }`                                            |
| GET    | /invoices      | —                                          | `200 Invoice[]`                                                              |
| GET    | /health        | —                                          | `200 { status, network, lightwalletdHost, latestBlock, lightwalletdVersion, merchantAddress (truncated) }` or `503 { status: 'error', error }` |

Validation: `amountZec` must parse as `> 0`. Returns `400 { error }` otherwise.

The `webhookUrl` parameter is accepted and stored on the invoice but never fired — webhook delivery is M2. Storing it now keeps the API shape forward-compatible.

## 7. Frontend (`public/index.html`)

Single file copied from §5.7 of the source brief. No build step, no framework, no external CDN. Inline CSS (~80 lines), inline JS (~50 lines). Behavior: form to enter amount + optional order ref → POST `/invoices` → display QR + status badge → poll `GET /invoices/:id` every 10s → stop polling on `CONFIRMED` or `EXPIRED`.

The brief says "Copy it exactly" for the HTML. We do.

## 8. Configuration

`.env.example` (committed):

```
LIGHTWALLETD_HOST=zec.rocks:443
NETWORK=main
MERCHANT_ADDRESS=u1yourorcahrdunifiedaddresshere
PORT=3000
```

`.env` (gitignored, created locally for this session):

```
LIGHTWALLETD_HOST=zec.rocks:443
NETWORK=main
MERCHANT_ADDRESS=u1placeholder_set_real_address_before_deploy_xxxxxxxxxxxxxxxxxxxx
PORT=3000
```

`WEBHOOK_SECRET` is *not* present in either file (YAGNI; brief never wires it). When M2 adds webhook delivery, the env var comes back.

## 9. Test strategy

Vitest. Tests live alongside source: `src/*.test.ts`. `npm test` runs the full suite.

### `zip321.test.ts` — ~8 cases
- Builds a URI with all four optional params; asserts `URLSearchParams` parse round-trips.
- Builds with no optional params; asserts only `amount=` is in query string.
- `buildMemo({ invoiceId: 'x' })` produces `ZC1:` prefix + valid base64url (no `+`, no `/`, no `=`).
- `buildMemo` throws when JSON payload pushes encoded length over 512 bytes.
- Boundary: encoded length exactly 512 succeeds.
- `toBase64Url` of empty string returns empty string.
- Memo containing UTF-8 multibyte chars encodes correctly.
- URI emitted is parseable with `new URL(...)` (validates URL syntax conformance — the `zcash:` scheme is opaque so we test the substring after `?`).

### `invoices.test.ts` — ~7 cases
- `create` returns invoice with status `CREATED` and the correct `expiresAtBlock`.
- `create` with custom `expiryBlocks` honors it.
- `get` returns undefined for missing id.
- `list` returns invoices newest-first.
- `updateStatus` updates and returns; ignores unknown id by returning undefined.
- `expireStale` flips `CREATED` past deadline to `EXPIRED`, returns its id.
- `expireStale` does NOT flip `CONFIRMED` invoices.

No tests for `lightwalletd.ts` — mocking gRPC is high effort, low value for an MVP. The live `/health` smoke test in §11 is the integration test.

No tests for `server.ts` — Express wiring is verified by the smoke test, not unit tests.

## 10. Deviations from the source brief — explicit list

| # | Brief says                                              | We do                                                          | Rationale                                                                       |
|---|---------------------------------------------------------|----------------------------------------------------------------|---------------------------------------------------------------------------------|
| 1 | `as any` + `eslint-disable` in `lightwalletd.ts`        | Minimal typed interface for the gRPC client surface we use     | Reviewers told to be "technically sophisticated"; clean TS strengthens grant case |
| 2 | `WEBHOOK_SECRET` env var                                | Dropped from `.env.example` and code                           | Never used in brief; YAGNI; will reappear in M2 with real webhook delivery       |
| 3 | No tests                                                | Vitest suite for `zip321` + `invoices`                         | Pure-logic tests are cheap and prove ZIP-321 conformance + state machine correctness |
| 4 | Always download `compact_formats.proto`                 | Download only if `service.proto` imports it                    | Avoid carrying unused files; check import graph during scaffolding                |

All deviations preserve the brief's external API and dependency list.

## 11. Session verification plan

This session is complete when all of the following pass:

1. `npm install` — exits 0.
2. `npx tsc --noEmit` — zero errors.
3. `npm test` — all green.
4. `npm run dev` — boots, prints `Connected to Zcash network. Latest block: <number>` where `<number>` is the live mainnet height.
5. `curl http://localhost:3000/health` — returns `200` with a real `latestBlock` integer and a real `lightwalletdVersion` string.
6. `curl -X POST http://localhost:3000/invoices -H 'Content-Type: application/json' -d '{"amountZec":"0.01","orderId":"TEST-001"}'` — returns `201` with a `paymentUri` whose `address` segment matches `MERCHANT_ADDRESS` and whose `amount=0.01` is present.
7. Browser opens `http://localhost:3000`, click Generate Payment Request, QR renders, status badge reads `CREATED`. (Manual check.)
8. Git commit, authored as Sanjay Subedi <thesanjay43@gmail.com>, no Claude co-author footer.

Step 7 is manual; the user runs it.

## 12. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| `zec.rocks:443` is down or rate-limited | `/health` 503 surfaces the error clearly; brief says no auth required, so retry is sufficient |
| `service.proto` import path differs from what `protoLoader` expects | `includeDirs: [proto/]` is set; if `compact_formats.proto` is required by transitive import, downloading both as the brief instructs is safe |
| `MERCHANT_ADDRESS` placeholder fails an unforeseen ZIP-321 validity check in a real wallet | Out of scope for session — a wallet scanning the QR will reject; real-address replacement happens before deploy. README documents this. |
| Vitest version compatibility with TS 5.x | Pin to a known-good Vitest 1.x release at scaffolding time |

## 13. Out of scope for this session (deferred to user)

- Pushing to GitHub (requires `gh auth` / repo creation under user's handle).
- Railway deployment (requires `railway login`).
- Real `MERCHANT_ADDRESS` (user supplies later from ZODL/Zashi).
- Forum post for Zcash Community Grants.
