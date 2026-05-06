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
