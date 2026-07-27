import WebSocket from 'ws';

const DERIV_APP_ID = process.env.DERIV_APP_ID || '1089';
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
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

  // Optional auth token — enables authenticated calls (trading) in future.
  // Re-read from process.env at connect time so the token can be updated at runtime
  // via the /api/auth/token endpoint without restarting the server.
  private authToken: string | null = process.env.DERIV_API_TOKEN ?? null;

  // Populated after a successful authorize; null when not authenticated.
  private account: { loginid: string; isVirtual: boolean; currency: string; balance: number } | null = null;

  /** Set/update the auth token. Used by the /api/auth/token endpoint. */
  setToken(token: string | null): void {
    this.authToken = token;
  }

  /** Clear the auth token locally. */
  clearAuth(): void {
    this.authToken = null;
    this.account = null;
  }

  // contract_id → handler awaiting that contract's proposal_open_contract updates
  private contractHandlers: Map<number, (parsed: any) => void> = new Map();

  isAuthorized(): boolean {
    return this.account !== null;
  }

  getAccount() {
    return this.account;
  }

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

        // Re-read token from env at connect time for runtime updates
        this.authToken = process.env.DERIV_API_TOKEN ?? this.authToken;

        // Authorize first if a token is configured (no-op for read-only use).
        if (this.authToken) {
          try {
            await this.authorize();
          } catch (e: any) {
            console.error('[DerivWS] Authorize failed:', e?.message ?? e);
          }
        }

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

          // Dispatch contract settlement updates to any waiter.
          if (parsed.msg_type === 'proposal_open_contract' && parsed.proposal_open_contract) {
            const cid = parsed.proposal_open_contract.contract_id;
            const h = this.contractHandlers.get(cid);
            if (h) h(parsed);
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
      this.send({ ticks: symbol, subscribe: 1 }).catch((err) =>
        console.error(`[DerivWS] Re-subscribe ${symbol} failed:`, err.message),
      );
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
      this.send({ ticks: symbol, subscribe: 1 }).catch((err) => {
        console.error(`[DerivWS] Failed to subscribe to ${symbol}:`, err.message);
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
      // subscriptions have been torn down (e.g. signals expired).
      if (this.feedDegraded) {
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

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return { connected: this.isConnected, feedDegraded: this.feedDegraded };
  }

  private emitStatus() {
    const status = this.getStatus();
    this.statusHandlers.forEach((h) => h(status));
  }

  // ── Trading / auth ───────────────────────────────────────────────────────────

  /** Authorize with the configured token and record account type/balance. */
  async authorize(): Promise<void> {
    if (!this.authToken) throw new Error('No DERIV_API_TOKEN configured');
    const res = await this.send({ authorize: this.authToken });
    const a = res?.authorize;
    if (!a) throw new Error('Authorize returned no account');
    this.account = {
      loginid: a.loginid,
      isVirtual: a.is_virtual === 1,
      currency: a.currency,
      balance: a.balance,
    };
    console.log(
      `[DerivWS] Authorized ${a.loginid} (${this.account.isVirtual ? 'DEMO' : 'REAL'}) ` +
      `balance ${a.balance} ${a.currency}`,
    );
  }

  /**
   * Buy a digit contract. `proposalRequest` is a Deriv `parameters` object.
   * Uses buy with `price` as the max stake. Returns the buy response
   * (contains contract_id) or throws on error.
   */
  async buyContract(params: {
    symbol: string;
    contractType: string;
    barrier: string;
    durationTicks: number;
    stake: number;
    currency: string;
  }): Promise<{ contractId: number; buyPrice: number; payout: number }> {
    if (!this.isAuthorized()) throw new Error('Not authorized — cannot buy');

    const res = await this.send({
      buy: 1,
      price: params.stake, // max price willing to pay = stake
      parameters: {
        amount: params.stake,
        basis: 'stake',
        contract_type: params.contractType,
        currency: params.currency,
        duration: params.durationTicks,
        duration_unit: 't',
        symbol: params.symbol,
        barrier: params.barrier,
      },
    });

    if (res?.error) throw new Error(res.error.message || res.error.code);
    const buy = res?.buy;
    if (!buy?.contract_id) throw new Error('Buy returned no contract_id');
    return { contractId: buy.contract_id, buyPrice: buy.buy_price, payout: buy.payout };
  }

  /**
   * Wait for a contract to settle and report profit. Subscribes to
   * proposal_open_contract and resolves once `is_sold` is true.
   */
  async waitForSettlement(contractId: number, timeoutMs = 120_000): Promise<{ profit: number; won: boolean }> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.contractHandlers.delete(contractId);
          reject(new Error(`Contract ${contractId} settlement timed out`));
        }
      }, timeoutMs);

      // Dedicated handler keyed off contract id via the generic message stream.
      const handler = (parsed: any) => {
        const poc = parsed?.proposal_open_contract;
        if (!poc || poc.contract_id !== contractId) return;
        if (poc.is_sold) {
          settled = true;
          clearTimeout(timer);
          this.contractHandlers.delete(contractId);
          const profit = Number(poc.profit);
          resolve({ profit, won: profit >= 0 });
        }
      };
      this.contractHandlers.set(contractId, handler);

      this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }).catch((e) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.contractHandlers.delete(contractId);
          reject(e);
        }
      });
    });
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
