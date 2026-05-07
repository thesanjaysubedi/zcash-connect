// ZcashConnect MVP — Express API server

import 'dotenv/config';
import express from 'express';
import QRCode  from 'qrcode';
import path    from 'path';
import { buildPaymentUri, buildMemo, buildMultiPaymentUri, parsePaymentUri, parseMultiPaymentUri } from './zip321';
import { parseUnifiedAddress } from './zip316';
import * as Invoices from './invoices';
import {
  createClient,
  getLatestBlockHeight,
  getLightdInfo,
} from './lightwalletd';

const app = express();
app.use(express.json());
const WEB_DIST = path.join(__dirname, '../web/dist');
app.use(express.static(WEB_DIST));

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

let merchantAddressDetails;
try {
  merchantAddressDetails = parseUnifiedAddress(MERCHANT_ADDRESS);
} catch (e) {
  console.error(`ERROR: MERCHANT_ADDRESS is not a valid Zcash unified address: ${(e as Error).message}`);
  process.exit(1);
}

if (!merchantAddressDetails.isOrchardCapable) {
  console.warn(`WARNING: MERCHANT_ADDRESS has no Orchard receiver. Receivers found: ${
    merchantAddressDetails.receivers.map(r => r.type).join(', ')
  }`);
}

// ── gRPC client ─────────────────────────────────────────────────────
const client = createClient(LIGHTWALLETD_HOST);

// ── Routes ──────────────────────────────────────────────────────────

app.post('/invoices', async (req, res) => {
  try {
    const body = req.body as {
      amountZec?:   string;
      orderId?:     string;
      label?:       string;
      webhookUrl?:  string;
      payments?:    Array<{ amountZec: string; orderId?: string; label?: string }>;
    };

    const isMulti = Array.isArray(body.payments) && body.payments.length > 1;

    if (!isMulti) {
      // Single-recipient flow — existing behavior preserved.
      const amountZec = body.payments?.[0]?.amountZec ?? body.amountZec ?? '';
      const orderId   = body.payments?.[0]?.orderId   ?? body.orderId;
      const label     = body.payments?.[0]?.label     ?? body.label;

      const parsedAmount = parseFloat(amountZec);
      if (!amountZec || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'amountZec must be a positive number' });
      }

      const currentBlock = await getLatestBlockHeight(client);

      // MVP scope: the memo carries a placeholder invoice id, not the real one.
      // Threading the real id requires moving Invoices.create earlier in the
      // flow (or pre-generating the UUID); deferred to M2 along with memo-based
      // payment matching, which is the only thing that would actually consume
      // this field. The QR/URI returned to the client is internally consistent
      // because the same memoText is also stored on the invoice record.
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
        address:    MERCHANT_ADDRESS,
        amountZec,
        memoText,
        paymentUri,
        currentBlock,
        webhookUrl: body.webhookUrl,
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
        kind:           'single',
      });
    }

    // ── Multi-recipient flow ───────────────────────────────────────
    const payments = body.payments!;
    for (const p of payments) {
      const v = parseFloat(p.amountZec);
      if (!p.amountZec || Number.isNaN(v) || v <= 0) {
        return res.status(400).json({ error: `each payment.amountZec must be a positive number` });
      }
    }

    const currentBlock = await getLatestBlockHeight(client);
    const totalZec = payments.reduce((s, p) => s + parseFloat(p.amountZec), 0).toString();

    const memoText = buildMemo({
      invoiceId: 'pending',
      orderId:   payments.map(p => p.orderId ?? 'none').join(','),
    });

    const paymentUri = buildMultiPaymentUri(
      payments.map((p, i) => ({
        address: MERCHANT_ADDRESS,
        amount:  p.amountZec,
        // Only attach memo to the first recipient (memo per-recipient is allowed
        // by ZIP-321; we keep MVP simple and put it on index 0 only)
        memo:    i === 0 ? memoText : undefined,
        label:   p.label ?? `ZcashConnect Payment ${i + 1}`,
      })),
    );

    const qrCode = await QRCode.toDataURL(paymentUri, {
      errorCorrectionLevel: 'M',
      width:  256,
      margin: 2,
    });

    const invoice = Invoices.create({
      address:    MERCHANT_ADDRESS,
      amountZec:  totalZec,
      memoText,
      paymentUri,
      currentBlock,
      webhookUrl: body.webhookUrl,
    });

    return res.status(201).json({
      invoiceId:      invoice.id,
      address:        invoice.address,
      amountZec:      totalZec,
      paymentUri:     invoice.paymentUri,
      qrCode,
      status:         invoice.status,
      createdAt:      invoice.createdAt,
      expiresAtBlock: invoice.expiresAtBlock,
      currentBlock,
      network:        NETWORK,
      kind:           'multi',
      payments:       payments.map(p => ({ amountZec: p.amountZec, label: p.label })),
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
      observedAt:          new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({ status: 'error', error: String(err) });
  }
});

app.post('/uris/parse', (req, res) => {
  const { uri } = req.body as { uri?: string };
  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ error: 'uri (string) is required in request body' });
  }
  try {
    // Multi-recipient URIs lack a path-component address (zcash:?...).
    // Detect by checking whether anything precedes the '?' after 'zcash:'.
    const after  = uri.startsWith('zcash:') ? uri.slice('zcash:'.length) : '';
    const isMulti = after.startsWith('?');
    if (isMulti) {
      const payments = parseMultiPaymentUri(uri);
      return res.json({ kind: 'multi', payments });
    }
    const payment = parsePaymentUri(uri);
    return res.json({ kind: 'single', payment });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/address/:addr/details', (req, res) => {
  try {
    const ua = parseUnifiedAddress(req.params.addr);
    return res.json(ua);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/merchant', (_req, res) => {
  return res.json({
    address:         MERCHANT_ADDRESS,
    network:         NETWORK,
    receiverDetails: merchantAddressDetails,
  });
});

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
