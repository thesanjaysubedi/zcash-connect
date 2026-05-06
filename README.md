# ZcashConnect MVP

> A shielded payment lifecycle demo for Zcash, built as part of the
> ZcashConnect ZCG grant proposal.

## What this is

ZcashConnect is a developer SDK for accepting shielded ZEC payments.
This repository is the MVP prototype that demonstrates:

- ZIP-321 payment request URI generation (build + parse, single + multi-recipient)
- ZIP-316 Unified Address parsing — bech32m, F4Jumble, TLV receiver decoding,
  implemented from scratch and tested against ZIP-316
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

Verify the files are real proto content (not 47-byte stubs):

```bash
wc -c proto/*.proto       # should show ~15K and ~6K, not 47
grep -c 'service CompactTxStreamer' proto/service.proto    # should print 1
```

Configure the environment and start the server:

```bash
cp .env.example .env
# Edit .env: set MERCHANT_ADDRESS to your Orchard unified address (u1...)

npm run dev
```

Open http://localhost:3000.

## API

| Method | Path                       | Description |
|---|---|---|
| POST | /invoices                    | Create a payment invoice. Body: `{ amountZec, ... }` (single) or `{ payments: [...] }` (multi-recipient) |
| GET  | /invoices/:id                | Get invoice status |
| GET  | /invoices                    | List all invoices |
| GET  | /health                      | Verify server and Zcash network connection |
| POST | /uris/parse                  | Parse a `zcash:` URI back to structured fields. Body: `{ uri }` |
| GET  | /address/:addr/details       | Decode a Zcash unified address: receivers, network, Orchard capability |

## Sample generated URI

```
zcash:u1abc...xyz?amount=0.01&memo=WkMx...&label=ZcashConnect%20Payment
```

This URI is valid ZIP-321 and scannable by ZODL, Zashi, and Ywallet.

## Known limitations

In addition to the M2/M3 scope deferrals above, this MVP defers a number of
production concerns that a real merchant deployment would need to address:

- **In-memory state** — invoice records live in a `Map` for the lifetime of
  the process; a restart loses everything. Production should use Postgres
  or similar.
- **No authentication** — the `POST /invoices` endpoint is unauthenticated.
  Any HTTP client can create invoices against the merchant's address.
  Production should require a per-merchant API key or signed request.
- **No rate limiting** — a misbehaving client could create unbounded invoices
  and exhaust memory.
- **Internal error messages leak via `String(err)`** — the 500 and 503 error
  responses surface raw error strings (which for gRPC failures can include
  host names and connection details). Production should sanitise to a
  generic error code and log the detail server-side.
- **No graceful shutdown** — there is no `SIGTERM` handler, so a redeploy
  hard-kills in-flight requests. Production should drain the request queue
  before exiting.

These are intentional MVP simplifications, not oversights — they keep the
demo readable and isolate the three core capabilities the grant proposal
needs to demonstrate.

## Tests

```bash
npm test
```

Covers ZIP-321 URI generation (with the 512-byte memo cap, exact-boundary
assertions, and `%20`-vs-`+` URL encoding) and the invoice state machine
(create/get/list, status transitions, expiry-by-block-height). Network
integration is verified by `GET /health` against `zec.rocks:443`.

## Zcash spec coverage

This MVP implements the following Zcash specifications from scratch:

### ZIP-321 (Payment Request URIs) — full

- Builder: single-recipient (`zcash:<addr>?amount=...`) and multi-recipient
  (`zcash:?address=...&address.1=...`).
- Parser: round-trip property tested against the builder. Handles both URI
  forms (path-component address vs `address=` query param). Rejects the
  forbidden `zcash://` form, percent-encoded scheme/parameter names, and
  `address.0` (paramindex must not have a leading zero).
- Memo encoding: base64url with no padding, 512-byte cap on the encoded
  memo. RFC 3986 percent-encoding for spaces in `label` / `message` (not
  the `+` form-encoded variant).

### ZIP-316 (Unified Addresses) — decoder

- Bech32m envelope decode (using the `bech32` npm package for the envelope
  only — all Zcash-specific logic is implemented locally).
- F4Jumble: the 4-round Feistel network defined in ZIP-316 §Jumbling,
  using personalized BLAKE2b (`UA_F4Jumble_H` and `UA_F4Jumble_G`).
  Implemented from scratch in `src/zip316.ts`. Round-trip property tested
  at lengths 48, 64, 100, and 248 bytes.
- HRP padding strip (16-byte zero-padded HRP appended to the TLV).
- Variable-length integer (Bitcoin/Zcash `compactSize`) codec.
- TLV receiver decoder for typecodes 0 (P2PKH), 1 (P2SH), 2 (Sapling),
  3 (Orchard); unknown typecodes pass through as `unknown` rather than
  causing parse failure (per the ZIP-316 forward-compatibility intent).

### Out of scope (still M2/M3)

- Trial decryption with viewing keys.
- Building UAs from receivers (requires Orchard / Sapling key material).
- Validating that a receiver's bytes form a valid public key on its curve.
- Memo decryption / payment matching against incoming transactions.

## Tech stack

Node 20 LTS, TypeScript 5 (strict), Express 4, `@grpc/grpc-js`, `qrcode`, Vitest.
Zcash network: `zec.rocks:443` (public lightwalletd, no auth required).

## License

MIT
