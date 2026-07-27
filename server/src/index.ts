import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanner } from './scanner/scanner.ts';
import { derivConnection } from './deriv/connection.ts';
import { getMarkets } from './deriv/symbols.ts';
import { ScanResult, TradeSetup } from './strategy/types.ts';
import { getConfig, updateConfig, StrategyConfig } from './strategy/config.ts';
import { getTradingConfig, updateTradingConfig, TradingConfig } from './strategy/tradingConfig.ts';
import { trader } from './trader/trader.ts';

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
  // Forward trade events (placed/won/lost/dry-run) and trader state.
  sendSSE('trade_state', trader.getState());
  const unsubscribeTrade = trader.onTrade((record, state) =>
    sendSSE('trade', { record, state }),
  );

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
    unsubscribeTrade();
  });
});

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
    'confirmWithinTicks', 'scanIntervalMs', 'confirmedCooldownMs', 'marketRefreshMs',
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

// ── Trading (arm / disarm / status / config) ─────────────────────────────────

app.get('/api/trading/status', (_req, res) => {
  res.json({ status: 'ok', state: trader.getState(), recentTrades: trader.getRecentTrades() });
});

app.post('/api/trading/arm', (_req, res) => {
  const state = trader.arm();
  res.json({ status: state.armed ? 'ok' : 'refused', state });
});

app.post('/api/trading/disarm', (_req, res) => {
  const state = trader.disarm('manual (API)');
  res.json({ status: 'ok', state });
});

app.post('/api/trading/reset', (_req, res) => {
  res.json({ status: 'ok', state: trader.resetSession() });
});

app.get('/api/trading/config', (_req, res) => {
  res.json({ status: 'ok', config: getTradingConfig() });
});

app.put('/api/trading/config', (req, res) => {
  const body = req.body ?? {};
  const patch: Partial<TradingConfig> = {};
  const numeric: (keyof TradingConfig)[] = [
    'baseStake', 'martingaleMultiplier', 'maxMartingaleSteps', 'stopLoss', 'maxConcurrent',
  ];
  for (const key of numeric) {
    if (typeof body[key] === 'number' && Number.isFinite(body[key])) {
      (patch as any)[key] = body[key];
    }
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  // allowReal can only be enabled here; turning it on is deliberate and logged.
  if (typeof body.allowReal === 'boolean') patch.allowReal = body.allowReal;
  if (typeof body.currency === 'string') patch.currency = body.currency;
  if (body.takeProfit === null || (typeof body.takeProfit === 'number' && Number.isFinite(body.takeProfit))) {
    patch.takeProfit = body.takeProfit;
  }
  if (body.durationTicks && typeof body.durationTicks === 'object') {
    patch.durationTicks = body.durationTicks;
  }
  const next = updateTradingConfig(patch);
  if (patch.allowReal === true) console.warn('[Server] allowReal ENABLED via API — real-money trades permitted');
  res.json({ status: 'ok', config: next, applied: Object.keys(patch) });
});

// ── Auth: set Deriv API token (Section 3) ───────────────────────────────────
app.post('/api/auth/token', async (req, res) => {
  const { token } = req.body ?? {};
  if (!token || typeof token !== 'string') {
    return res.json({ status: 'error', error: 'No token provided' });
  }
  try {
    // Set the token and authorize
    process.env.DERIV_API_TOKEN = token;
    // Reconnect with the new token
    await derivConnection.disconnect();
    await derivConnection.connect();
    const account = derivConnection.getAccount();
    if (account) {
      console.log('[Auth] Token authorized:', account.loginid, account.isVirtual ? 'DEMO' : 'REAL');
      res.json({ status: 'ok', account });
    } else {
      res.json({ status: 'error', error: 'Authorize failed — check token' });
    }
  } catch (e: any) {
    console.error('[Auth] Error:', e?.message ?? e);
    res.json({ status: 'error', error: e?.message ?? 'Auth failed' });
  }
});

// ── Revoke token / disconnect (Section 3.3) ─────────────────────────────────
app.post('/api/auth/disconnect', async (_req, res) => {
  delete process.env.DERIV_API_TOKEN;
  derivConnection.clearAuth();
  await derivConnection.disconnect();
  res.json({ status: 'ok' });
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
