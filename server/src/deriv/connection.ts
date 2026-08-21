import WebSocket from 'ws';

const DERIV_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const RECONNECT_DELAY = 3000;
const REQUEST_TIMEOUT = 15000;
/** If no tick arrives on any active subscription within this window, flag degraded. */
const STALE_FEED_MS = 20000;

type MessageHandler = (data: any) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export interface ConnectionStatus {
  connected: boolean;
  /** True when we have subscriptions but ticks have stopped flowing. */
  feedDegraded: boolean;
  /** True when Deriv refuses the whole `ticks` stream (ticks_history still works). */
  liveStreamBlocked: boolean;
}

class DerivConnection {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function; timer: NodeJS.Timeout }> = new Map();
  // symbol → set of tick handlers
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  // symbol → Deriv subscription id (needed to `forget` correctly)
  private subscriptionIds: Map<string, string> = new Map();
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;
  private connectPromise: Promise<void> | null = null;

  // Feed-health tracking
  private lastTickAt = 0;
  private feedDegraded = false;
  private statusHandlers = new Set<StatusHandler>();

  // Live-stream availability. Deriv refuses the `ticks` stream outright in some
  // environments (InvalidSymbol for EVERY symbol — even forex — while
  // ticks_history still works). Track that so we surface it once, honestly,
  // instead of one misleading per-symbol error per scan.
  private liveStreamBlocked = false;
  private liveStreamBlockLogged = false;

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      this.intentionalClose = false;
      console.log('[DerivWS] Connecting...');

      this.ws = new WebSocket(DERIV_WS_URL);

      this.ws.on('open', async () => {
        console.log('[DerivWS] Connected');
        this.isConnected = true;
        this.connectPromise = null;
        this.emitStatus();

        // Re-subscribe everything after a (re)connect so live monitoring
        // resumes instead of going permanently silent.
        this.resubscribeAll();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString());
          const id = parsed.req_id;

          // Capture subscription ids so we can forget() them correctly.
          if (parsed.subscription?.id && parsed.echo_req?.ticks) {
            this.subscriptionIds.set(parsed.echo_req.ticks, parsed.subscription.id);
          }

          // Resolve one-off request/response pairs.
          if (id && this.pendingRequests.has(id)) {
            const pending = this.pendingRequests.get(id)!;
            clearTimeout(pending.timer);
            this.pendingRequests.delete(id);
            if (parsed.error) {
              pending.reject(new Error(parsed.error.message || parsed.error.code));
            } else {
              pending.resolve(parsed);
            }
          }

          // Dispatch live ticks to subscribers.
          if (parsed.msg_type === 'tick' && parsed.tick) {
            const symbol = parsed.tick.symbol;
            if (symbol) {
              this.markTick();
              const handlers = this.subscriptions.get(symbol);
              if (handlers) handlers.forEach((h) => h(parsed.tick));
            }
          }
        } catch (e) {
          console.error('[DerivWS] Failed to parse message:', e);
        }
      });

      this.ws.on('close', () => {
        console.log('[DerivWS] Disconnected');
        this.isConnected = false;
        this.connectPromise = null;
        this.subscriptionIds.clear(); // ids are invalid across connections
        this.emitStatus();

        this.pendingRequests.forEach((pending) => {
          clearTimeout(pending.timer);
          pending.reject(new Error('WebSocket connection closed'));
        });
        this.pendingRequests.clear();

        if (!this.intentionalClose) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[DerivWS] Error:', err.message);
        if (!this.isConnected) {
          this.connectPromise = null;
          reject(err);
        }
      });

      setTimeout(() => {
        if (!this.isConnected && this.connectPromise) {
          this.connectPromise = null;
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });

    return this.connectPromise;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    console.log(`[DerivWS] Reconnecting in ${RECONNECT_DELAY}ms...`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // The close handler will schedule another attempt.
      }
    }, RECONNECT_DELAY);
  }

  /** Re-send `ticks` subscribe for every symbol we still have handlers for. */
  private resubscribeAll() {
    for (const symbol of this.subscriptions.keys()) {
      this.send({ ticks: symbol, subscribe: 1 })
        .then(() => this.markStreamAvailable())
        .catch((err) => this.handleSubscribeError(symbol, err));
    }
  }

  async send(request: Record<string, any>): Promise<any> {
    if (!this.ws || !this.isConnected) {
      await this.connect();
    }

    const id = ++this.requestId;
    const payload = { ...request, req_id: id };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} (${request.ticks_history || request.ticks || Object.keys(request)[0]}) timed out`));
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        this.ws!.send(JSON.stringify(payload));
      } catch (e) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(e);
      }
    });
  }

  subscribe(symbol: string, handler: MessageHandler): () => void {
    const isNew = !this.subscriptions.has(symbol);
    if (isNew) this.subscriptions.set(symbol, new Set());
    this.subscriptions.get(symbol)!.add(handler);

    // Only send the subscribe request once per symbol.
    if (isNew) {
      this.send({ ticks: symbol, subscribe: 1 })
        .then(() => this.markStreamAvailable())
        .catch((err) => {
          this.handleSubscribeError(symbol, err);
          // Clean up the failed subscription so it can be retried on the next scan.
          // The handler was added above; remove it and delete the symbol from the
          // map so checkFeedHealth doesn't falsely flag the feed as degraded while
          // waiting on a subscription that will never deliver ticks.
          const handlers = this.subscriptions.get(symbol);
          if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
              this.subscriptions.delete(symbol);
            }
          }
        });
    }

    return () => {
      const handlers = this.subscriptions.get(symbol);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(symbol);
        const subId = this.subscriptionIds.get(symbol);
        this.subscriptionIds.delete(symbol);
        // Forget by subscription id (Deriv requires the id, not the symbol).
        if (subId) this.send({ forget: subId }).catch(() => {});
      }
    };
  }

  // ── Subscribe failure / stream availability ─────────────────────────────────

  /**
   * Surface a subscribe failure. When Deriv reports "InvalidSymbol" here, it is
   * NOT a bad symbol: the scanner only subscribes to markets whose ticks_history
   * already returned data, and in some environments Deriv refuses the whole
   * `ticks` stream (every symbol, even forex, comes back InvalidSymbol). Treating
   * it as a bad symbol would wrongly prune valid markets, so we log it ONCE and
   * flag the feed as genuinely degraded — the scanner keeps working on historical
   * data and recovers automatically if the stream becomes available. Genuine
   * per-request failures (timeouts, network errors) still log as errors.
   */
  private handleSubscribeError(symbol: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/invalid/i.test(msg)) {
      if (!this.liveStreamBlockLogged) {
        this.liveStreamBlocked = true;
        this.liveStreamBlockLogged = true;
        this.feedDegraded = true;
        this.emitStatus();
        console.warn(
          `[DerivWS] Live ticks stream refused for ${symbol} (${msg}). This connection ` +
          `can fetch historical data but not live ticks — signals keep scanning and ` +
          `ranking, but live entry monitoring stays off until the stream is ` +
          `available again.`,
        );
      }
      return;
    }
    console.error(`[DerivWS] Failed to subscribe to ${symbol}:`, msg);
  }

  /** Called when a live ticks subscribe succeeds — the stream is usable again. */
  private markStreamAvailable() {
    if (!this.liveStreamBlocked) return;
    this.liveStreamBlocked = false;
    this.liveStreamBlockLogged = false;
    if (this.feedDegraded) {
      this.feedDegraded = false;
      this.emitStatus();
    }
    console.log('[DerivWS] Live ticks stream available — resuming live monitoring');
  }

  // ── Feed health ────────────────────────────────────────────────────────────

  private markTick() {
    this.lastTickAt = Date.now();
    if (this.feedDegraded) {
      this.feedDegraded = false;
      this.emitStatus();
    }
  }

  /** Call periodically to detect a silently stalled feed. */
  checkFeedHealth() {
    if (this.subscriptions.size === 0) {
      // No active subscriptions = nothing to monitor. Clear any stale degraded
      // flag so the UI doesn't show a misleading "Feed Stalled" after all
      // subscriptions have been torn down (e.g. signals expired) — UNLESS the
      // live stream itself is refused, in which case the stall is real.
      if (this.feedDegraded && !this.liveStreamBlocked) {
        this.feedDegraded = false;
        this.emitStatus();
      }
      return;
    }
    const stale = Date.now() - this.lastTickAt > STALE_FEED_MS;
    if (stale && !this.feedDegraded) {
      this.feedDegraded = true;
      console.warn('[DerivWS] Feed appears stalled (no ticks) — flagging degraded');
      this.emitStatus();
    } else if (!stale && this.feedDegraded) {
      // Ticks started flowing again after a degraded episode — recover.
      this.feedDegraded = false;
      this.emitStatus();
    }
  }

  /** True when Deriv is refusing the whole `ticks` stream (history still works). */
  isLiveStreamBlocked(): boolean {
    return this.liveStreamBlocked;
  }

  /** True when we hold an active live `ticks` subscription for this symbol. */
  isSymbolSubscribed(symbol: string): boolean {
    return this.subscriptions.has(symbol);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return {
      connected: this.isConnected,
      feedDegraded: this.feedDegraded,
      liveStreamBlocked: this.liveStreamBlocked,
    };
  }

  private emitStatus() {
    const status = this.getStatus();
    this.statusHandlers.forEach((h) => h(status));
  }

  async disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Best-effort: forget everything server-side before closing.
    try {
      await this.send({ forget_all: 'ticks' });
    } catch {
      // ignore — we're tearing down anyway
    }
    this.subscriptions.clear();
    this.subscriptionIds.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.connectPromise = null;
  }
}

export const derivConnection = new DerivConnection();
