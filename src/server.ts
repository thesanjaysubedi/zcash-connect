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
