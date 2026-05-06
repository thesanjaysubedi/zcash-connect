# ZcashConnect MVP v1.1 — ZIP-316 + ZIP-321 Spec Coverage

**Date:** 2026-05-06
**Status:** Approved (in brainstorming session)
**Builds on:** [`2026-05-06-zcashconnect-mvp-design.md`](./2026-05-06-zcashconnect-mvp-design.md)
**Source brief:** the original `ZcashConnect_MVP_Developer_Brief.md` (no longer in the public repo)

---

## 1. Goal

Add three Zcash-protocol-level capabilities to the v1.0 MVP that demonstrate real spec implementation, not just RPC plumbing:

1. **ZIP-316 Unified Address parsing** — bech32m envelope + F4Jumble + TLV receiver decoding, implemented from scratch and tested against the official ZIP-316 test vectors.
2. **ZIP-321 round-trip parser** — decode any `zcash:` URI back to structured fields, with build/parse round-trip property tests.
3. **ZIP-321 multi-recipient URIs** — support split-payment URIs (`zcash:?address=...&amount=...&address.1=...`).

Combined effect: the MVP demonstrates *full coverage* of the two ZIPs that govern shielded payment requests, not just the URI-builder half. A grant reviewer reading the code can see real protocol implementation, not surface plumbing.

## 2. Non-goals

- Building UAs from receivers (that requires Orchard / Sapling / transparent key material — wallet territory, M2/M3).
- Validating that the cryptographic content of a receiver is a *valid* public key on its respective curve. We validate the envelope, parse the TLV, identify receiver types, and checksum-verify. We don't run group-element validity checks.
- Encrypting / decrypting memos against viewing keys (still M2 trial-decryption territory).
- Querying the chain to verify the address has ever been used (still M2).

## 3. Architecture

The new code lives in two pure modules + small extensions to existing files:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  zip316.ts   │     │  zip321.ts   │     │  invoices.ts │
│  (NEW pure)  │     │  (extended)  │     │  (unchanged) │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────┬───────┴────────────────────┘
                    │
              ┌─────▼──────┐
              │ server.ts  │  (new routes, startup validation)
              │ (extended) │
              └─────┬──────┘
                    │
              ┌─────▼─────────┐
              │ index.html    │  (new panels)
              │ (extended)    │
              └───────────────┘
```

Pure modules stay pure. Server stays a composition root. The UI gains two new panels and a multi-recipient toggle.

## 4. Module: `src/zip316.ts`

### Public surface

```ts
export type Network = 'main' | 'test' | 'regtest';

export type ReceiverType = 'orchard' | 'sapling' | 'p2pkh' | 'p2sh' | 'unknown';

export interface Receiver {
  type:   ReceiverType;
  typeId: number;     // raw TLV type byte (e.g., 3 for Orchard)
  length: number;     // raw TLV length
}

export interface UnifiedAddress {
  network:   Network;
  receivers: Receiver[];
  isOrchardCapable: boolean;
}

export function parseUnifiedAddress(addr: string): UnifiedAddress;
export function f4Jumble(data: Uint8Array): Uint8Array;
export function f4Unjumble(data: Uint8Array): Uint8Array;
```

### Internal pipeline (top-down)

1. **Bech32m envelope.** Use `bech32` npm package (^2.0.0) — `bech32m.decode` returns `{ prefix, words }`.
2. **HRP → network.** `u` → main, `utest` → test, `uregtest` → regtest. Reject anything else.
3. **5-bit → 8-bit conversion.** Reuse `bech32m.fromWords`.
4. **F4Unjumble.** Implemented inline. See section 4.1.
5. **TLV scan.** Walk the unjumbled bytes. At each position read 1 byte type, 1 byte length, then `length` data bytes. Map type IDs:
   - `0x00` → `p2pkh` (transparent P2PKH, length 20)
   - `0x01` → `p2sh` (transparent P2SH, length 20)
   - `0x02` → `sapling` (length 43)
   - `0x03` → `orchard` (length 43)
   - any other → `unknown` (preserve length)
6. **Reject** if any TLV claims a length that exceeds remaining bytes, or if zero receivers result.

### 4.1 F4Jumble specifics

ZIP-316's F4Jumble is a length-preserving 4-round Feistel network over a variable-length input split in half. Each round mixes via personalized BLAKE2b. Personalization strings: `b"UA_F4Jumble_G"` for G-rounds and `b"UA_F4Jumble_H"` for H-rounds, with a one-byte counter appended.

Reference: https://zips.z.cash/zip-0316#f4jumble

We implement both `f4Jumble` and `f4Unjumble` as separate functions and prove correctness with two pinned test vectors from the ZIP-316 spec page (one short input, one full UA-shaped input). The unit test asserts `f4Unjumble(f4Jumble(x)) === x` for random inputs at boundary lengths (48, 64, 100, 248 bytes).

`blakejs` (^1.2.0, MIT, pure JS) provides personalized BLAKE2b. Node's built-in `crypto.createHash('blake2b512')` doesn't expose the personalization parameter.

## 5. Module: `src/zip321.ts` extensions

### New public surface (existing surface unchanged)

```ts
// Single-recipient parser — inverse of buildPaymentUri
export function parsePaymentUri(uri: string): PaymentRequest;

// Multi-recipient build — emits zcash:?address=...&address.1=...
export function buildMultiPaymentUri(payments: PaymentRequest[]): string;

// Multi-recipient parse — returns ordered array
export function parseMultiPaymentUri(uri: string): PaymentRequest[];
```

### Parsing rules
- URI must start with `zcash:`. Reject otherwise.
- If the segment between `zcash:` and `?` is non-empty, it's the address (single-recipient mode).
- If the segment between `zcash:` and `?` is empty, it's multi-recipient mode (the address comes from the `address` query param).
- Memo: base64url-decode the value. If the result starts with `ZC1:`, also decode the JSON body and expose it; otherwise expose the raw decoded text.
- Multi-recipient: `address`, `address.1`, `address.2`, … must all be present; matching `amount.N` (and optional `memo.N`, `label.N`, `message.N`) attach to the corresponding recipient. Indices must be contiguous starting from 0 (where the unindexed `address` is index 0).

### Round-trip invariant
For every `PaymentRequest` `p` (or array of payments), `parsePaymentUri(buildPaymentUri(p))` deep-equals `p` (modulo memo encoding: built memos go through `toBase64Url`, parsed memos come back as the decoded text). This is enforced as a property test.

## 6. Server changes (`src/server.ts`)

### Startup validation
Before `app.listen`, call `parseUnifiedAddress(MERCHANT_ADDRESS)`. Behavior:
- Throws → log specific error (`Invalid bech32m`, `Unknown HRP`, `F4Unjumble failed`, etc.) and `process.exit(1)`.
- Returns successfully but `isOrchardCapable === false` → log a warning, continue. (Testnet addresses without Orchard receivers are valid use cases.)

### New routes
- **`POST /uris/parse`** — body `{ uri: string }`. Returns:
  - 200 single-recipient: `{ kind: 'single', payment: PaymentRequest }`
  - 200 multi-recipient: `{ kind: 'multi', payments: PaymentRequest[] }`
  - 400 with `error` message on parse failure.
- **`GET /address/:addr/details`** — returns `UnifiedAddress` shape. 400 on invalid input.

### Updated env defaults
`.env` and `.env.example` switch from the dummy `u1placeholder...` string to a public ZIP-316 test vector address. The test vector is from the spec itself, not from any real user — it's safe to commit and demonstrates that the server's startup validation actually works against a known-valid input.

## 7. UI changes (`public/index.html`)

Three additions, each in its own panel below the existing `.card`:

### Address details panel (auto-loads on page open)
Fetches `/address/<MERCHANT_ADDRESS>/details`. Renders:
```
Merchant address
  ✓ valid bech32m  ·  network: mainnet
  receivers: Orchard, Sapling
```
Implementation: ~30 lines of inline JS, called once after `DOMContentLoaded`.

### Parse URI panel
Textarea + "Parse" button. Submits to `POST /uris/parse`. Renders the response below the input — formatted JSON for inspection. Shows whether the URI is single- or multi-recipient.

### Multi-recipient toggle
On the existing create-invoice form, add a "+ add recipient" button. Each click appends an amount + (optional) order-ref row. POST body becomes `{ payments: [...] }` when there's more than one row; the server detects this and routes to `buildMultiPaymentUri`. Single-recipient flow is preserved unchanged.

## 8. Testing strategy

### `src/zip316.test.ts` (~12 cases)
- F4Jumble pinned test vector: known input bytes → known jumbled bytes (from ZIP-316 spec).
- F4Jumble round-trip property: `f4Unjumble(f4Jumble(x)) === x` for inputs at 48/64/100/248 bytes.
- Parse the official ZIP-316 test vector address — assert network, receivers list, and `isOrchardCapable`.
- Reject empty input.
- Reject invalid bech32m checksum.
- Reject unknown HRP (`u2...`, `xx1...`).
- Tolerate unknown receiver types (TLV type 0xFF) — count them as `unknown`, don't reject the whole address.
- Reject TLV with length exceeding remaining bytes.

### `src/zip321.test.ts` extensions (~8 cases)
- `parsePaymentUri` round-trips for a single-recipient URI built by `buildPaymentUri`.
- Memo with `ZC1:` prefix → parser exposes both raw decoded text and parsed JSON.
- `parsePaymentUri` rejects non-`zcash:` schemes.
- `buildMultiPaymentUri` emits indexed query params in correct order.
- `parseMultiPaymentUri` preserves recipient order.
- Round-trip on multi-recipient: build → parse → equal.
- Reject multi-recipient with mismatched amount indices.
- Reject zero-recipient input.

### Skipped (per scope)
- No tests for `lightwalletd.ts` (unchanged, integration-tested via `/health`).
- No tests for `server.ts` Express wiring (still verified by smoke test).

## 9. Verification (session done when)

1. `npx tsc --noEmit` zero errors.
2. `npm test` — all cases pass. Existing 22 + new ~20 = ~42 total.
3. F4Jumble passes the pinned ZIP-316 test vector exactly.
4. Server boots cleanly with the new test-vector default address; `/address/<addr>/details` returns `{ network: 'main', receivers: [...], isOrchardCapable: true }`.
5. `POST /uris/parse` returns the inverse of `POST /invoices`'s `paymentUri` field.
6. Browser shows the address-details panel populated, the parse-URI panel works, and the multi-recipient toggle adds rows.
7. Commits authored as Sanjay Subedi, no Claude footer.

## 10. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| F4Jumble implementation has a subtle bug (off-by-one in personalization counter, wrong endianness) | Pin against the exact test vectors from ZIP-316 spec page; round-trip property tests at multiple lengths |
| `bech32` package version 2.x has a different API than expected | Check the API signature at install time; if needed, pin to a specific version that matches the docs |
| `blakejs` may have personalization API quirks | Test BLAKE2b output against a known vector before integrating into F4Jumble |
| Multi-recipient query indexing differs from ZIP-321 spec | Cross-check against the spec's examples (https://zips.z.cash/zip-0321) |
| New startup validation breaks the local dev flow that was working | Use a real ZIP-316 test vector as the new placeholder; document the change in README |

## 11. Out of scope (deferred to user)

- Pushing the v1.1 commits to GitHub
- Updating the `Live demo` URL in README after Railway redeploy
- Adding a feature branch — for atomicity we commit directly to main (15 atomic commits already pushed; new ones will continue the pattern)
