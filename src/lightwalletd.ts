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
