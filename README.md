# Deriv Signal Scanner

A real-time trading signal scanner for Deriv's **Volatility Indices** and **Jump Indices**. It applies a custom **digit-frequency momentum strategy** to scan every market, rank the best setups, and stream live confirmation signals — so you only trade the highest-probability markets.

---

## Table of Contents

1. [The Trading Strategy](#the-trading-strategy)
   - [Core Concept](#core-concept)
   - [Trade Types & Payout Tiers](#trade-types--payout-tiers)
   - [The 3-Step Process (Filter → Entry → Confirm)](#the-3-step-process-filter--entry--confirm)
   - [Priority Ranking](#priority-ranking)
   - [Scenario Walkthroughs](#scenario-walkthroughs)
2. [Project Architecture](#project-architecture)
3. [Server Modules](#server-modules)
   - [strategy/config.ts](#strategyconfigts)
   - [strategy/types.ts](#strategytypests)
   - [strategy/analyzer.ts](#strategyanalyzerts)
   - [scanner/scanner.ts](#scannerscannerts)
   - [deriv/connection.ts](#derivconnectionts)
   - [deriv/symbols.ts](#derivsymbolsts)
   - [deriv/marketDiscovery.ts](#derivmarketdiscoveryts)
   - [index.ts (Express API + SSE)](#indexts-express-api--sse)
   - [debug/diagnose.ts](#debugdiagnosets)
4. [Client Modules](#client-modules)
5. [Configuration Reference](#configuration-reference)
6. [Running the Project](#running-the-project)
7. [Conventions for AI Agents](#conventions-for-ai-agents)

---

## The Trading Strategy

### Core Concept

You trade **digit frequency** on Deriv's synthetic indices. The strategy identifies digits that have been appearing *less often* than expected ("quiet" — occurring ≤9.7% over the last 1,000 ticks), then waits for a **momentum confirmation** before generating a signal. The bet is that quiet digits will keep under-appearing relative to the active (frequent) ones over the short-term contract duration.

Each Digit Options contract settles on the **last digit** of the price quote at the contract's expiry. The precision (number of decimals) varies per market — the scanner derives this automatically from the `pip` value returned by Deriv's `active_symbols` API.

### Trade Types & Payout Tiers

| Tier | Trade Type | Quiet Digits (≤9.7%) | Bet | Typical Payout |
|:---|:---|---:|:---|:---:|
| 🥇 **High** | **Over 3** | 0, 1, 2, 3 | Next digit > 3 | ~$18.20 / $10 |
| 🥇 **High** | **Under 6** | 6, 7, 8, 9 | Next digit < 6 | ~$18.20 / $10 |
| 🥈 **Medium** | **Over 2** | 0, 1, 2 | Next digit > 2 | ~$14.80 / $10 |
| 🥈 **Medium** | **Under 7** | 7, 8, 9 | Next digit < 7 | ~$14.80 / $10 |

### CRITICAL: Digits 0 and 9 — Strategy Exclusion Rules

Digits `0` and `9` are part of this strategy in specific ways:

| Stage | Can 0 or 9 be used? |
|:---|---:|
| **Step 1 — Filter (frequency analysis)** | ✅ **Required** — 0 and 9 ARE always included in the full digit frequency analysis (digits 0-9, sum = 100%). They ARE also required quiet digits for certain trade types (e.g., Over 3 requires 0, 1, 2, 3 all quiet; Under 6 requires 6, 7, 8, 9 all quiet) |
| **Step 2 — Entry digit selection** | ❌ **Strategy rule** — 0 and 9 are never used as entry digits. If the least frequent quiet digit is 0 or 9, skip to the next least frequent. |
| **Step 3 — Confirmation digit** | ❌ **Strategy rule** — 0 and 9 cannot confirm a trade. They DO count as normal ticks toward the 2-tick confirmation window. If 0 or 9 appear within the window, they advance the tick counter, and if the window expires without a valid confirmation digit, the scanner **resets**. |
| **Execution signal** | ❌ **Never** — the dashboard will only ever show a signal for a confirmation digit that is NOT 0 or 9 |

**Important:** 0 and 9 ARE tradable digits on Deriv — the exclusion from entry and confirmation in this strategy is a **personal trading rule**, not a Deriv limitation. They are always part of the frequency analysis data.

### The 3-Step Process (Filter → Entry → Confirm)

#### Step 1: Filter (1,000-tick scan)

For each market, fetch the last 1,000 ticks and calculate the frequency of each digit (0–9). For a given trade type, every "losing" digit must be at or below the **quiet threshold** (default: 9.7%):

| Trade Type | Digits that must be ≤ 9.7% |
|:---|---:|
| Over 3 | 0, 1, 2, 3 |
| Under 6 | 6, 7, 8, 9 |
| Over 2 | 0, 1, 2 |
| Under 7 | 7, 8, 9 |

If all required digits pass the threshold, the market "passes the filter" for that trade type.

#### Step 2: Select Entry Digit

From the quiet digits that passed the filter, pick the **least frequent** one. This is your **entry digit** — the digit you're waiting for before preparing to trade.

**Rules:**
- Digits `0` and `9` are **exempt from entry** — they can never be entry digits.
- If the least frequent digit is 0 or 9, skip to the next least frequent.
- If all quiet digits are 0 and 9 (impossible in practice, but handled), the signal stays in `pending` status.

#### Step 3: Live Confirmation & Execution

The scanner subscribes to **live ticks** for markets that pass the filter. Once live, it follows this finite state machine:

**Phase A — Watching for Entry (`status: watching_entry`)**

Live ticks arrive one by one from the Deriv WebSocket. For each tick:
- If the tick's last digit does **not** match the entry digit → do nothing, keep watching
- If the tick's last digit **equals** the entry digit → transition to Phase B

**Phase B — Watching for Confirmation (`status: watching_confirmation`)**

Once the entry digit lands, a **2-tick confirmation window** opens. **Every** tick that arrives counts toward these 2 ticks — there are no exemptions:
- **Valid confirmation digit arrives** → ✅ **TRADE CONFIRMED!** The signal status becomes `confirmed`. The dashboard shows a green CONFIRMED badge and the confirming digit.
- **Non-confirming digit arrives** (including 0 or 9) → The tick counter advances by 1. If this was the 1st tick, there's still 1 more chance. If this was the 2nd tick and still no confirmation → ❌ **RESET**.

**Phase C — RESET**

After a reset, the scanner goes back to Phase A (`watching_entry`). It must wait for the entry digit to land again before opening a new confirmation window. The 2-tick window starts **fresh** each time. Note that if both ticks in the window are 0 and/or 9, neither can be a valid confirmation digit, so the confirmation fails and the scanner resets.

**Confirmation Digits by Trade Type:**

| Trade Type | Valid Confirmation Digits | Excluded from confirmation |
|:---|---:|:---|
| **Over 3** | `{4, 5, 6, 7, 8}` | 0, 9, and anything ≤ 3 |
| **Under 6** | `{1, 2, 3, 4, 5}` | 0, 9, and anything ≥ 6 |
| **Over 2** | `{3, 4, 5, 6, 7, 8}` | 9, and anything ≤ 2 |
| **Under 7** | `{1, 2, 3, 4, 5, 6}` | 0, 9, and anything ≥ 7 |

**Visual summary of the live lifecycle:**

```
              ┌──────────────────────────────────────────────────────┐
              │                                                      │
              ▼                                                      │
    ┌────────────────────┐    entry digit hits!     ┌────────────────────────────┐
    │  ⏳ Watching Entry  │ ───────────────────────▶  │  🔍 Watching Confirmation  │
    │  (waiting for the   │                          │  (2-tick window open)      │
    │   quiet digit)       │                          │  Every tick counts, no     │
    └────────────────────┘                          │  exceptions including 0/9  │
              ▲                                     └───────────┬────────────────┘
              │                                                  │
              │                           ┌──────────────────────┼──────────────────────┐
              │                           │                      │                      │
              │                    valid confirm?        non-confirm digit     2 ticks expired
              │                    (✅ SIGNAL!)          (tick#1: wait)         no confirm?
              │                           │                      │              (❌ RESET)
              │                           ▼                      ▼                      │
              │                   ┌──────────────┐              │                       │
              │                   │  ✅ TRADED   │              │                       │
              │                   │  (confirmed) │              │                       │
              │                   └──────┬───────┘              │                       │
              │                          │                      │                       │
              └──────────────────────────┼──────────────────────┘───────────────────────┘
                                         │
                                  (after cooldown → back to watching_entry)
```

### Priority Ranking

The scanner ranks passing signals for the dashboard:

1. **High payout tier first** (Over 3, Under 6) before medium tier (Over 2, Under 7)
2. **Within same tier, quieter = better** — signals are ranked by **quiet score** (descending), which is the average distance below the quiet threshold across all required quiet digits. E.g., a market where quiet digits average 7% below threshold beats one averaging 2% below.

### Scenario Walkthroughs

#### Scenario A: Strong Over 3 Setup (Top Signal)

**Market:** Volatility 100 (R_100) — decimals=2

| Digit | Frequency | % |
|:---|---:|---:|
| **0** | 60 | **6.0%** ✅ quiet |
| **1** | 72 | **7.2%** ✅ quiet |
| **2** | 88 | **8.8%** ✅ quiet |
| **3** | 95 | **9.5%** ✅ quiet |
| 4 | 105 | 10.5% |
| 5 | 103 | 10.3% |
| 6 | 112 | 11.2% |
| 7 | 115 | 11.5% |
| 8 | 108 | 10.8% |
| 9 | 142 | 14.2% |

**Result:**
- **Filter** — All four digits (0, 1, 2, 3) ≤ 9.7% → ✅ PASS
- **Entry digit** — Quiet digits sorted by %: 0(6.0%), 1(7.2%), 2(8.8%), 3(9.5%). 0 is exempt → **entry = 1**
- **Quiet score** — avg(9.7 - 6.0, 9.7 - 7.2, 9.7 - 8.8, 9.7 - 9.5) / 4 = **1.825°**
- **Valid confirmation digits** — {4, 5, 6, 7, 8}
- **Live ticks:** `1 → 7` → ✅ CONFIRMED! Execute immediately when digit 7 lands
- **Live ticks:** `1 → 9 → 5` → 9 is exempt (skipped), 5 confirms → ✅ Execute at 5
- **Live ticks:** `1 → 0 → 2` → 0 exempt, 2 not > 3 → ❌ no confirmation. Reset, wait for 1 again

#### Scenario B: Moderate Under 7 Setup (Medium Tier)

| Digit | % |
|:---|---:|
| 7 | **9.0%** ✅ quiet |
| 8 | **9.3%** ✅ quiet |
| 9 | **9.5%** ✅ quiet |
| (other digits) | > 9.7% |

**Result:**
- **Filter** — 7(9.0%), 8(9.3%), 9(9.5%) all ≤ 9.7% → ✅ PASS (Under 7)
- **Entry digit** — Quiet digits sorted: 7(9.0%), 8(9.3%), 9(9.5%). 9 is exempt → **entry = 7** (least of remaining)
- **Quiet score** — avg(9.7 - 9.0, 9.7 - 9.3, 9.7 - 9.5) / 3 = **0.43°** (weak — barely quiet)
- **Valid confirmation digits** — {1, 2, 3, 4, 5, 6}
- **Live ticks:** `7 → 3` → ✅ CONFIRMED!
- This would rank **below** Scenario A due to medium payout tier + lower quiet score

#### Scenario C: Failed Filter (No Signal)

| Digit | % |
|:---|---:|
| 0 | **8.1%** ✅ quiet |
| 1 | **9.5%** ✅ quiet |
| 2 | **10.2%** ❌ over threshold |
| 3 | **11.5%** ❌ |

**Result:**
- **Over 3 filter** — Digit 2 is 10.2% > 9.7% → ❌ FAIL
- **Under 6 filter** — Not checked here, but 6, 7, 8, 9 might pass separately
- No Over 3 signal generated. Scanner stays in `pending` state.

#### Scenario D: Full Live Lifecycle Walkthroughs

**Setup:** Over 3 on Volatility 100, entry digit = 1, valid confirmation digits = {4, 5, 6, 7, 8}

**Case D1 — Confirmed on first tick after entry:**
```
Tick: 7    → not entry digit, stay watching_entry
Tick: 4    → not entry digit, stay watching_entry
Tick: 1    → ★ ENTRY! Status = watching_confirmation, ticksSinceEntry = 0
Tick: 7    → 7 is > 3 and not 0/9 → ✅ CONFIRMED! Status = confirmed
              (Execute trade immediately at this tick!)
```

**Case D2 — Confirmed on second tick (first tick was 0, which counts as tick #1):**
```
Tick: 1    → ★ ENTRY! Status = watching_confirmation, ticksSinceEntry = 0
Tick: 0    → 0 can't confirm, ticksSinceEntry = 1 (still 1 tick left)
Tick: 5    → 5 is > 3 → ✅ CONFIRMED! ticksSinceEntry = 2
              (Tick 0 consumed slot #1, tick 5 confirms on slot #2)
```

**Case D3 — Both ticks are 0 and 9 (no confirmation → RESET):**
```
Tick: 1    → ★ ENTRY! Status = watching_confirmation, ticksSinceEntry = 0
Tick: 0    → 0 can't confirm, ticksSinceEntry = 1
Tick: 9    → 9 can't confirm, ticksSinceEntry = 2 → ❌ RESET!
              (Both ticks of the window were consumed by 0 and 9.
               Neither is a valid confirmation digit, so the trade is cancelled.
               Reset back to watching_entry, wait for entry digit 1 again.)
```

**Case D4 — Reset: no confirmation within 2 ticks:**
```
Tick: 1    → ★ ENTRY! Status = watching_confirmation, ticksSinceEntry = 0
Tick: 2    → 2 is not > 3, ticksSinceEntry = 1 (wait, cannot confirm)
Tick: 3    → 3 is not > 3, ticksSinceEntry = 2 → ❌ RESET!
              (2 ticks expired without a confirming digit. Window closed.)
```
After reset: back to `watching_entry`. The scanner will wait for entry digit 1 to hit again. When it does, a **fresh** 2-tick confirmation window opens.

**Case D5 — Multiple entry attempts before success:**
```
Tick: 1    → ★ ENTRY! opens confirmation window
Tick: 2    → ticksSinceEntry = 1, not a confirm
Tick: 3    → ticksSinceEntry = 2, not a confirm → ❌ RESET (back to watching_entry)

Tick: 7    → not entry digit
Tick: 4    → not entry digit
Tick: 1    → ★ ENTRY again! Fresh confirmation window opens
Tick: 6    → 6 > 3 → ✅ CONFIRMED!
```

#### Scenario E: Very Strong vs. Marginal Signals

**Market A** (Over 3): digits at 5.0%, 5.5%, 6.0%, 6.5% — quiet score = **4.0°** (strong)
**Market B** (Over 3): digits at 9.0%, 9.5%, 9.6%, 9.7% — quiet score = **0.3°** (weak)

→ Market A ranked first. Both are high tier, but Market A is far quieter.

**Market C** (Under 6): quiet score = 3.5°
**Market D** (Over 2): quiet score = 4.5°

→ Market C (high tier) ranked before Market D (medium tier), even though D is quieter.

---

## Project Architecture

```
deriv-signal-scanner/
├── server/                          # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── deriv/
│   │   │   ├── connection.ts        # WebSocket manager (connect, subscribe, auto-reconnect)
│   │   │   ├── symbols.ts           # Market symbol definitions + fallback list
│   │   │   └── marketDiscovery.ts   # Dynamic market discovery from Deriv's active_symbols
│   │   ├── strategy/
│   │   │   ├── types.ts             # Shared types (TradeSetup, ScanResult, DigitStats, etc.)
│   │   │   ├── config.ts            # Tunable strategy parameters (thresholds, intervals, etc.)
│   │   │   └── analyzer.ts          # ★ Core strategy engine (filter, entry, confirmation, ranking)
│   │   ├── scanner/
│   │   │   └── scanner.ts           # Scan orchestrator + live monitoring FSM
│   │   ├── debug/
│   │   │   └── diagnose.ts          # Diagnostic tool to verify API connectivity and precision
│   │   └── index.ts                 # Express server: REST API + SSE streaming
│   ├── package.json
│   └── tsconfig.json
├── client/                          # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx           # Top bar with connection status + signal count
│   │   │   ├── Dashboard.tsx        # Main layout (signals grid + sidebar panels)
│   │   │   ├── SignalCard.tsx       # Individual signal card with entry/confirm UI
│   │   │   ├── DigitDistribution.tsx # Bar chart showing all 10 digit percentages
│   │   │   ├── LiveMonitor.tsx      # Real-time tick watcher for active signals
│   │   │   └── ScannerStatus.tsx    # Connection + feed health panel
│   │   ├── hooks/
│   │   │   ├── useSignals.ts        # SSE consumer hook (auto-reconnect)
│   │   │   └── useStrategyConfig.ts # Polls /api/config for live strategy settings
│   │   ├── types/index.ts           # Client-side type definitions (mirrors server types)
│   │   ├── App.tsx                  # Root component
│   │   └── main.tsx                 # Entry point
│   └── package.json
└── README.md
```

---

## Server Modules

### `strategy/config.ts`

Central configuration for every tunable parameter. All values have environment variable overrides.

**Key fields:**
- `quietThreshold` (default `9.7`) — percentage at or below which a digit is "quiet"
- `excludeDigits` (default `[0, 9]`) — digits never used as entry or confirmation
- `lookbackTicks` (default `1000`) — number of historical ticks per analysis
- `confirmWithinTicks` (default `2`) — confirmation window size after entry digit hits
- `scanIntervalMs` (default `30_000`) — full scan interval (ms)
- `confirmedCooldownMs` (default `10_000`) — auto-reset "confirmed" status after this long (ms)
- `marketRefreshMs` (default `3_600_000`) — how often to refresh the market list from Deriv (ms)
- `configPollMs` (default `15_000`) — how often the client re-polls `/api/config` (ms); served to the UI so the config sync cadence is tunable at runtime

**Env vars:** All fields are overridable via `STRAT_QUIET_THRESHOLD`, `STRAT_EXCLUDE_DIGITS` (comma-separated), `STRAT_LOOKBACK_TICKS`, etc.

### `strategy/types.ts`

Defines the core data models:

```typescript
type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7';

type TradeStatus =
  | 'pending'               // Initial state before analysis
  | 'watching_entry'        // Filter passed, waiting for entry digit on live ticks
  | 'watching_confirmation' // Entry digit hit, waiting for confirmation within N ticks
  | 'confirmed'             // Trade confirmed
  | 'reset';                // (Not actively used — scanner goes back to watching_entry)

interface DigitStats {
  digit: number;       // 0-9
  count: number;       // Raw occurrence count
  percentage: number;  // Percentage of total ticks (e.g., 7.5)
}

interface TradeSetup {
  tradeType: TradeType;
  marketSymbol: string;      // e.g., "R_100"
  marketDisplayName: string; // e.g., "Volatility 100"
  market: string;            // "Volatility" or "Jump"
  passesFilter: boolean;     // Did Step 1 pass?
  allDigits: DigitStats[];   // Full 0-9 digit distribution
  quietDigits: DigitStats[];  // Only the digits that passed ≤threshold
  entryDigit: number | null; // Selected entry digit (null if all quiet digits are 0/9)
  quietScore: number;          // Avg distance below threshold (higher = quieter)
  validConfirmationDigits: number[]; // Digits that would confirm this trade
  confirmationDigit: number | null;  // Actual confirming digit (set on confirmation)
  status: TradeStatus;       // Current FSM state
  entryTriggered: boolean;   // Has entry digit been seen?
  ticksSinceEntry: number;   // Ticks elapsed since entry digit
  confirmed: boolean;        // Is trade confirmed?
  confirmedAt: number | null;// Epoch ms when confirmed (for auto-reset)
}

interface ScanResult {
  timestamp: number;
  markets: TradeSetup[];       // All markets analyzed (passing + failing)
  rankedSignals: TradeSetup[]; // Only passing signals, ranked
}
```

### `strategy/analyzer.ts`

**The core strategy engine.** All strategy logic lives here — one file, no magic numbers (those are in `config.ts`).

**Key exports:**

| Export | Purpose |
|:---|---|
| `getLastDigit(price, decimals)` | Extract the last digit (0-9) from a price. Uses `toFixed(decimals)` to preserve trailing zeros (critical for markets quoting at 2-5 decimals). |
| `observedDecimals(price)` | Count the decimal places actually present in a raw price value. |
| `analyzeFrequencies(prices, decimals)` | Compute DigitStats[10] for an array of prices at the given precision. |
| `TRADE_CONFIGS` | Array of 4 TradeTypeConfig objects defining quiet digits, confirmation condition, and payout tier. |
| `analyzeMarket(symbol, displayName, market, prices, decimals)` | Run the full 3-step strategy on one market. Returns TradeSetup[4] (one per trade type). |
| `checkConfirmation(setup, tickDigit)` | Finite state machine that transitions a TradeSetup through `watching_entry` → `watching_confirmation` → `confirmed` (or back to `watching_entry`). |
| `rankSignals(results)` | Sort passing signals by payout tier (high first) then quiet score (descending). |

**`getLastDigit` — Critical Precision Handling:**

```typescript
export function getLastDigit(price: number, decimals: number): number {
  const str = price.toFixed(decimals);
  return str.charCodeAt(str.length - 1) - 48;
}
```

This uses `toFixed(decimals)` rather than `toString()` because JavaScript's `toString()` drops trailing zeros (`1234.50` → `"1234.5"` → last digit = 5, WRONG). With `toFixed(2)` → `"1234.50"` → last digit = 0, CORRECT.

The decimals value comes from the Deriv API's `pip` field (via `pipToDecimals` in marketDiscovery.ts), with a runtime self-correction that uses the maximum observed decimal places in the actual price data.

**`checkConfirmation` — The FSM:**

```
                   new tick != entry digit
                  ┌───────────────────────┐
                  │                       │
                  ▼                       │
         ┌────────────────┐      ┌──────────────────┐
         │ watching_entry │──────│watching_confirm. │
         └────────────────┘      └──────────────────┘
                  │                       │
                  │ tick == entry digit    │ tick is valid confirmation
                  └───────────────────────┘           │
                                                      ▼
                                               ┌───────────┐
                                               │ confirmed │
                                               └───────────┘
                  (ticks_since >= N and no confirmation → reset to watching_entry)
```

### `scanner/scanner.ts`

Orchestrates the scanning lifecycle:

1. **On start:** Connects to Deriv WebSocket, discovers markets, runs initial scan
2. **Periodic scan** (every 30s by default): Fetches `ticks_history` for every market in parallel using `Promise.allSettled`, runs `analyzeMarket` on each, then `rankSignals`
3. **Live monitoring:** After each scan, subscribes to real-time ticks for symbols that have active signals. Merges new scan results with in-progress live state (preserving FSM state across rescans when the parameters haven't changed)
4. **Auto-unsubscribe:** When a symbol no longer has a signal, unsubscribes from its tick stream
5. **Feed health:** Periodically checks that ticks are still flowing to detect a stalled feed

**Key design decisions:**
- Uses `onResult(callback)` pattern for SSE clients to register
- Merges live FSM state across rescans to avoid resetting confirmation state unnecessarily
- All markets fetched in parallel (not sequential)

### `deriv/connection.ts`

WebSocket connection manager for Deriv's API (`wss://ws.derivws.com/websockets/v3?app_id=1089`).

**Capabilities:**
- **Auto-reconnect** with 3s delay on unexpected disconnect
- **Request/response matching** via `req_id` — each `send()` returns a Promise that resolves when the matching response arrives
- **Subscription management** — `subscribe(symbol, handler)` returns an unsubscribe function. Uses Deriv's `subscription.id` for correct `forget` calls
- **Feed health monitoring** — flags as "degraded" if no tick arrives on any subscription within 20s
- **Re-subscribe on reconnect** — automatically re-sends `ticks` subscribe for all active subscriptions when the WebSocket reconnects

**Key methods:**
- `connect()` — open WebSocket
- `send(request)` — send JSON, await response by req_id (15s timeout)
- `subscribe(symbol, handler)` — subscribe to live ticks, returns unsubscribe fn
- `disconnect()` — clean teardown with `forget_all`

### `deriv/symbols.ts`

Market symbol definitions. Has two sources:

1. **`FALLBACK_MARKETS`** — the exact 15 markets the operator trades, verified live via `ticks_history`. Covers 5 Volatility (plain: R_10/25/50/75/100), 5 Volatility (1s: 1HZ10/25/50/75/100 V), and 5 Jump (JD10/25/50/75/100) indices. Discovery is filtered against the same `ALLOWED_SYMBOLS` set so no other market can slip in. Symbols not offered in the account's region are auto-pruned on the first scan when Deriv reports them invalid.
2. **Dynamic discovery** — `marketDiscovery.ts` queries Deriv's `active_symbols` and merges results over the fallback.

**Important:** The previous Jump codes (`1HZ10J`, etc.) were INVALID and returned no data. The correct codes verified live are `JD10`, `JD25`, `JD50`, `JD75`, `JD100`.

Functions: `getMarkets()`, `setMarkets()`, `setSymbolDecimals()`, `getSymbolDecimals()`, `removeSymbol(symbol)` (used to auto-prune region-unavailable symbols when Deriv reports them invalid).

### `deriv/marketDiscovery.ts`

Queries Deriv's `active_symbols` (full) and selects every tradable Volatility and Jump index.

- **`pipToDecimals(pip)`** — converts a Deriv `pip` value (e.g., `0.001`) to decimal places (e.g., `3`)
- **`classify(symbol)`** — classifies a symbol as `'Volatility'` or `'Jump'` (or null to skip)
- **`selectMarkets(active)`** — filters and sorts the API response
- **`mergeWithFallback(discovered)`** — unions discovered entries over the verified fallback so an empty/partial API response never shrinks coverage
- **`discoverMarkets()`** — main entry point, called at startup and periodically

### `index.ts` (Express API + SSE)

Express server on port 3001 (or `PORT` env var).

**Endpoints:**

| Method | Path | Description |
|:---|---|---|
| `GET` | `/api/signals/stream` | **SSE** — streams `scan_result`, `live_update`, and `status` events |
| `GET` | `/api/signals/latest` | Latest scan result as JSON |
| `GET` | `/api/markets` | Current market list |
| `GET` | `/api/health` | Health check (uptime, connection status, feed health) |
| `GET` | `/api/config` | Current strategy configuration |
| `PUT` | `/api/config` | Update strategy config at runtime |

**SSE Events:**
- `event: scan_result` — full scan result with `{ scanResult, liveUpdates }`
- `event: live_update` — live tick updates with `{ scanResult, liveUpdates }`
- `event: status` — connection status `{ connected, feedDegraded }`
- `: heartbeat` — keepalive every 15s

**Client config consumption:** The frontend polls `GET /api/config` (via `useStrategyConfig.ts`) at the cadence reported by `configPollMs` (default 15s, clamped to 2s–10min) and renders the digit chart's quiet-threshold marker from the live `quietThreshold` — so `PUT /api/config` retunes are reflected in the UI without a reload. The client adopts a changed `configPollMs` on the next poll, so the cadence itself is tunable at runtime too.

### `debug/diagnose.ts`

Standalone diagnostic tool. Connects to Deriv API, fetches the active symbols list, shows every matched Volatility/Jump symbol with pip and calculated decimals, runs the actual discovery/fallback pipeline, and then prints digit frequency analysis for the first market (with a visual bar chart). Run with:

```bash
cd server && npx tsx src/debug/diagnose.ts
```

---

## Client Modules

All client components are in `client/src/components/` and use Tailwind CSS utility classes.

**Important Tailwind note:** Dynamic class construction like `` `bg-${variable}` `` will NOT work because Tailwind scans source files for complete class names at build time. Always use conditional static class patterns:

```tsx
// ✅ CORRECT: static class names in conditional
const barColor = isEntry ? 'bg-emerald-500' : isQuiet ? 'bg-emerald-700/60' : 'bg-dark-400';

// ❌ WRONG: dynamic class name construction (will be purged)
<div className={`bg-${color}-500`} />
```

**Component hierarchy:**
- `App.tsx` — Root, renders `Header` + `Dashboard`
- `Dashboard.tsx` — Main layout: empty state when no signals, grid layout when signals exist. Left column: ranked signal cards. Right column: ScannerStatus, LiveMonitor, MarketOverview
- `SignalCard.tsx` — Card with header (rank, trade type, payout badge, status badge), market info, entry/confirmation display, and DigitDistribution. Only renders when `signal.passesFilter` is true
- `DigitDistribution.tsx` — Horizontal bar chart showing all 10 digits. Color-coded: emerald for entry/quiet, red for active (above threshold), blue for confirmation digits. The red threshold marker is positioned from the **live `quietThreshold`** served by `GET /api/config` (polled via `useStrategyConfig` at the server-provided `configPollMs`), so server-side retunes move the line without a page reload — falling back to the 9.7% default only while the config is loading or unreachable
- `LiveMonitor.tsx` — Shows signals currently in `watching_entry` or `watching_confirmation` state with real-time status
- `ScannerStatus.tsx` — Connection status and feed health indicator
- `Header.tsx` — Sticky top bar with logo, scan time, and signal count

**SSE Connection (`useSignals.ts`):** Uses native `EventSource` to consume the SSE stream. Connects on mount, auto-reconnects on error with 3s delay. Parses `scan_result` and `live_update` events.

**Strategy Config (`useStrategyConfig.ts`):** Polls `GET /api/config` at the cadence the server reports via `configPollMs` (default 15s, overridable with `STRAT_CONFIG_POLL_MS` or `PUT /api/config`) and shares the result through a module-level cache, so all signal cards trigger a single request per tick regardless of how many are mounted. `DigitDistribution` reads `quietThreshold` from it to position the threshold marker. Each successful poll refreshes the "last sync" time; requests are aborted after a timeout (derived from the cadence) so a hung fetch can't stall polling.

---

## Configuration Reference

All configurable via environment variables (server-side):

| Env Var | Default | Description |
|:---|---|---|
| `STRAT_QUIET_THRESHOLD` | `9.7` | Quiet digit threshold (%) |
| `STRAT_EXCLUDE_DIGITS` | `0,9` | Digits excluded from entry/confirmation |
| `STRAT_LOOKBACK_TICKS` | `1000` | Historical ticks per analysis |
| `STRAT_CONFIRM_WITHIN_TICKS` | `2` | Confirmation window size |
| `STRAT_SCAN_INTERVAL_MS` | `30000` | Full scan interval (ms) |
| `STRAT_CONFIRMED_COOLDOWN_MS` | `10000` | Auto-reset confirmed status after (ms) |
| `STRAT_MARKET_REFRESH_MS` | `3600000` | Market list refresh interval (ms) |
| `STRAT_CONFIG_POLL_MS` | `15000` | Client `/api/config` poll interval (ms) |
| `PORT` | `3001` | Server port |
| `DERIV_APP_ID` | `1089` | Your Deriv application ID (register at app.deriv.com) |

---

## Running the Project

### Prerequisites
- Node.js ≥ 18
- npm

### Setup

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Development (two terminals)

**Terminal 1 — Backend:**
```bash
cd server
npm run dev   # runs tsx watch, auto-restarts on changes
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev   # runs Vite dev server on port 5173
```

Then open `http://localhost:5173` (note: the client proxies `/api/*` to `localhost:3001` via Vite config).

### Production Build

```bash
cd server && npm run build
cd ../client && npm run build
```

### Diagnostics

```bash
cd server && npx tsx src/debug/diagnose.ts
```

This connects to Deriv's API, prints all available Volatility and Jump markets with their decimal precision, and shows digit frequency distribution for the first market.

---

## Conventions for AI Agents

### Strategy Logic

- **ALL strategy logic lives in `server/src/strategy/analyzer.ts`.** If a new trade type needs to be added, add it to `TRADE_CONFIGS` array. If the entry or confirmation rules change, modify the functions there.
- **All "magic numbers" live in `server/src/strategy/config.ts`.** Never hardcode thresholds, intervals, or counts in business logic.
- **`getLastDigit` MUST use `toFixed(decimals)`** — never `toString()`, which drops trailing zeros.

### TypeScript

- Server uses `NodeNext` module resolution with `.ts` extensions in imports (e.g., `import { foo } from './bar.ts'`).
- `tsconfig.json` has `allowImportingTsExtensions: true` and `noEmit: true` — the server runs via `tsx`, not compiled JS.
- Client uses `bundler` module resolution (Vite handles it) — no `.ts` extension in imports.

### Data Flow

```
Deriv WS API
    │
    ▼
connection.ts (WebSocket) ────▶ scanner.ts (orchestrator)
                                       │
                                       ▼
                              analyzer.ts (strategy engine)
                                       │
                                       ▼
                              index.ts (Express + SSE)
                                       │
                                       ▼
                              useSignals.ts (EventSource)
                                       │
                                       ▼
                              React components (Dashboard, SignalCard, etc.)
```

### SSE Protocol

The server sends structured SSE events. All event data is JSON:

```
event: scan_result
data: { "scanResult": ScanResult, "liveUpdates": TradeSetup[] | null }

event: live_update
data: { "scanResult": ScanResult, "liveUpdates": TradeSetup[] }

event: status
data: { "connected": boolean, "feedDegraded": boolean }
```

### Live Monitoring State Merging

The scanner preserves live confirmation state across consecutive scans. When a new scan finishes for a market that's already being monitored, the scanner merges new results with existing state by comparing `entryDigit` and `validConfirmationDigits`. If they match, the FSM status (watching_entry, watching_confirmation, confirmed) is preserved. If they differ (the strategy analysis changed), the state resets.

### Market List

- **Always use the `FALLBACK_MARKETS` list as the authoritative baseline.** The dynamic discovery from `active_symbols` is merged over it.
- Jump index symbols are `JD10`, `JD25`, `JD50`, `JD75`, `JD100` — NOT `1HZ10J` etc.
- Decimal precision per market is derived from the `pip` field in Deriv's API, not assumed.

### Precision Handling

Different synthetic indices quote at different decimal precision:
- `R_100`: 2 decimals
- `R_50`: 4 decimals
- `1HZ250V`: 5 decimals
- Jump indices: 2 decimals

The scanner self-corrects precision at runtime by checking the maximum decimal places observed in the actual price data. If the data has more decimals than the configured value, it uses the higher value (since `toFixed(decimals)` with fewer decimals loses information).

### Frontend Conventions

- All styling uses Tailwind CSS utility classes with a custom `dark-*` color palette.
- Dynamic classes use conditional static strings, not template interpolation (see Tailwind note above).
- SSE event names use snake_case (`scan_result`, `live_update`) to match Deriv conventions.
- The `EventSource` URL is relative (`/api/signals/stream`) — the Vite dev server proxies `/api` to the Express backend.
- `useStrategyConfig` is the single `/api/config` fetcher on the client (polled at the server-provided `configPollMs`, shared module-level cache). Don't add a second fetcher — reuse the hook.

### Important Gotchas

1. **`getLastDigit` precision** — If modifying the digit extraction logic, always use `price.toFixed(decimals)` to preserve trailing zeros. This is the most common source of bugs.
2. **`checkConfirmation` FSM** — The FSM has **no special handling** for 0 or 9 ticks during confirmation. Every tick in `watching_confirmation` increments `ticksSinceEntry` equally. 0 and 9 simply aren't in `validConfirmationDigits` (excluded by strategy rule, defined in `config.ts`). If 0/9 appear within the 2-tick window, they consume a slot and the window shrinks normally — leading to a reset if the window expires without a valid confirmation. Do NOT add special-case skip logic for 0/9.
3. **`rankSignals` order** — High payout (Over 3, Under 6) always beats medium payout (Over 2, Under 7), regardless of quiet score. Quiet score is a tiebreaker within the same tier.
4. **`entryDigit = null` edge case** — If all quiet digits are 0 and 9 (both exempt), `entryDigit` is null and the signal stays in `pending` status even though `passesFilter` is true. The frontend handles this gracefully.
5. **SSE reconnection** — The frontend auto-reconnects SSE on error with a 3s delay. The server re-subscribes all tick streams on WebSocket reconnect.
6. **Market discovery fallback** — If Deriv's `active_symbols` endpoint is unreachable (geo-restricted in some environments), the scanner falls back to the static `FALLBACK_MARKETS` list, which covers the essential set.
