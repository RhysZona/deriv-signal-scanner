import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanner } from './scanner/scanner.ts';
import { derivConnection } from './deriv/connection.ts';
import { getMarkets } from './deriv/symbols.ts';
import { ScanResult, TradeSetup } from './strategy/types.ts';
import { getConfig, updateConfig, StrategyConfig } from './strategy/config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// ── Serve built frontend in production ───────────────────────────────────────
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// ── Store for latest data ──────────────────────────────────────────────────

let latestResult: ScanResult | null = null;
let latestLiveUpdates: TradeSetup[] | null = null;

// Keep the store fresh even when no client is connected.
scanner.onResult((result, liveUpdates) => {
  latestResult = result;
  latestLiveUpdates = liveUpdates ?? latestLiveUpdates;
});

// ── SSE Stream ─────────────────────────────────────────────────────────────

app.get('/api/signals/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendSSE = (event: string, data: unknown) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  // Send the latest snapshot immediately on connect.
  if (latestResult) {
    sendSSE('scan_result', { scanResult: latestResult, liveUpdates: latestLiveUpdates });
  }
  sendSSE('status', derivConnection.getStatus());

  // Register a per-connection listener and clean it up on close.
  const unsubscribe = scanner.onResult((result: ScanResult, liveUpdates?: TradeSetup[]) => {
    if (liveUpdates) {
      sendSSE('live_update', { scanResult: result, liveUpdates });
    } else {
      sendSSE('scan_result', { scanResult: result, liveUpdates: null });
    }
  });
  // Forward connection/feed-health changes so the UI can warn on a stalled feed.
  const unsubscribeStatus = derivConnection.onStatus((status) => sendSSE('status', status));
  // Forward scanner rate-limit state changes so the UI can show retry countdown.
  sendSSE('scanner_status', scanner.getRateLimitInfo());
  const unsubscribeScannerStatus = scanner.onScannerStatus((info) => sendSSE('scanner_status', info));

  const hb = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // ignore
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(hb);
    unsubscribe();
    unsubscribeStatus();
    unsubscribeScannerStatus();
  });
});

// ── Health-check ping (keeps free-tier alive) ────────────────────────────────
app.get('/ping', (_req, res) => res.status(200).send('pong'));

// ── REST snapshot ──────────────────────────────────────────────────────────

app.get('/api/signals/latest', (_req, res) => {
  if (!latestResult) {
    return res.json({ status: 'pending', message: 'Scanner has not completed a scan yet' });
  }
  res.json({
    status: 'ok',
    timestamp: latestResult.timestamp,
    totalSignals: latestResult.rankedSignals.length,
    rankedSignals: latestResult.rankedSignals,
  });
});

app.get('/api/markets', (_req, res) => {
  res.json({ status: 'ok', markets: getMarkets() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ...derivConnection.getStatus() });
});

// ── Strategy config (read + live tune) ───────────────────────────────────────

app.get('/api/config', (_req, res) => {
  res.json(getConfig());
});

app.put('/api/config', (req, res) => {
  const body = req.body ?? {};
  const allowed: (keyof StrategyConfig)[] = [
    'quietThreshold', 'excludeDigits', 'lookbackTicks',
    'scanIntervalMs', 'marketRefreshMs',
    'configPollMs', 'livePollIntervalMs', 'livePollCount',
  ];
  const patch: Partial<StrategyConfig> = {};
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    if (key === 'excludeDigits') {
      if (Array.isArray(body[key]) && body[key].every((n: unknown) => Number.isInteger(n))) {
        patch.excludeDigits = body[key];
      }
    } else if (typeof body[key] === 'number' && Number.isFinite(body[key])) {
      (patch as any)[key] = body[key];
    }
  }
  const next = updateConfig(patch);
  res.json({ status: 'ok', config: next });
});

// ── Catch-all for SPA routes ────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────

async function start() {
  try {
    await scanner.start();
    console.log('[Server] Scanner started');
  } catch (err) {
    console.error('[Server] Scanner failed:', err);
  }

  app.listen(PORT, () => {
    console.log(`[Server] API → http://localhost:${PORT}`);
    console.log(`[Server] SSE → http://localhost:${PORT}/api/signals/stream`);
  });
}

start();
