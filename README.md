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
```

The lightwalletd proto files are stored as symlinks in the `zcash/lightwalletd`
GitHub repo, so a plain `curl` against the `raw.githubusercontent.com` URL
returns a 47-byte symlink target string instead of the actual proto. Use the
GitHub Contents API to fetch the resolved file content:

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

| Method | Path | Description |
|---|---|---|
| POST | /invoices     | Create a payment invoice |
| GET  | /invoices/:id | Get invoice status |
| GET  | /invoices     | List all invoices |
| GET  | /health       | Verify server and Zcash network connection |

## Sample generated URI

```
zcash:u1abc...xyz?amount=0.01&memo=WkMx...&label=ZcashConnect%20Payment
```

This URI is valid ZIP-321 and scannable by ZODL, Zashi, and Ywallet.

## Tests

```bash
npm test
```

Covers ZIP-321 URI generation (with the 512-byte memo cap, exact-boundary
assertions, and `%20`-vs-`+` URL encoding) and the invoice state machine
(create/get/list, status transitions, expiry-by-block-height). Network
integration is verified by `GET /health` against `zec.rocks:443`.

## Tech stack

Node 20 LTS, TypeScript 5 (strict), Express 4, `@grpc/grpc-js`, `qrcode`, Vitest.
Zcash network: `zec.rocks:443` (public lightwalletd, no auth required).

## License

MIT
