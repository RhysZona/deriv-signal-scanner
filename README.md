# Deriv Signal Scanner

A real-time trading signal scanner for Deriv's **Volatility Indices** and **Jump Indices**. It applies two complementary strategies — **Over/Under** (digit-range quietness) and **Even/Odd** (parity dominance) — to scan every market, rank the best setups, and stream live entry signals. A tab-based UI lets you switch between strategy views.

---

## Table of Contents

1. [The Trading Strategy](#the-trading-strategy)
   - [Core Concept](#core-concept)
   - [Trade Types & Payout Tiers](#trade-types--payout-tiers)
   - [The 2-Step Process (Filter → Entry)](#the-2-step-process-filter--entry)
   - [Even/Odd Strategy](#evenodd-strategy)
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

You trade **digit frequency** on Deriv's synthetic indices. The strategy identifies digits that have been appearing *less often* than expected ("quiet" — occurring ≤9.8% over the last 1,000 ticks) and picks the quietest one as the **entry digit** — the digit you wait for before opening a trade. The platform is **signal-only**: it presents the entry instruction and never confirms or executes trades; you decide when to act. The bet is that quiet digits will keep under-appearing relative to the active (frequent) ones over the short-term contract duration.

Each Digit Options contract settles on the **last digit** of the price quote at the contract's expiry. The precision (number of decimals) varies per market — the scanner derives this automatically from the `pip` value returned by Deriv's `active_symbols` API.

### Trade Types & Payout Tiers

| Tier | Trade Type | Filter Condition | Bet | Typical Payout |
|:---|:---|---|:---|:---:|
| 🥇 **High** | **Over 3** | Digits 0–3 all ≤ 9.8% | Next digit > 3 | ~$18.20 / $10 |
| 🥇 **High** | **Under 6** | Digits 6–9 all ≤ 9.8% | Next digit < 6 | ~$18.20 / $10 |
| 🥇 **High** | **Even** | All odd ≤ 10.1%, top 2 even ≥ 10.7% | Next digit is even | ~$18.20 / $10 |
| 🥇 **High** | **Odd** | All even ≤ 10.1%, top 2 odd ≥ 10.7% | Next digit is odd | ~$18.20 / $10 |
| 🥈 **Medium** | **Over 2** | Digits 0–2 all ≤ 9.8% | Next digit > 2 | ~$14.80 / $10 |
| 🥈 **Medium** | **Under 7** | Digits 7–9 all ≤ 9.8% | Next digit < 7 | ~$14.80 / $10 |

### CRITICAL: Digits 0 and 9 — Strategy Exclusion Rules

Digits `0` and `9` are part of this strategy in specific ways:

| Stage | Can 0 or 9 be used? |
|:---|---:|
| **Step 1 — Filter (frequency analysis)** | ✅ **Required** — 0 and 9 ARE always included in the full digit frequency analysis (digits 0-9, sum = 100%). They ARE also required quiet digits for certain trade types (e.g., Over 3 requires 0, 1, 2, 3 all quiet; Under 6 requires 6, 7, 8, 9 all quiet) |
| **Step 2 — Entry digit selection** | ❌ **Strategy rule** — 0 and 9 are never used as entry digits. If the least frequent quiet digit is 0 or 9, skip to the next least frequent. |
| **Live monitoring** | ⚪ **No rule** — the platform is signal-only. It just watches for the entry digit on live ticks (flashing a brief "✓ Seen" pulse when it appears) and never confirms or executes. |
| **Execution** | ❌ **Never** — the dashboard only presents the Entry digit and informational Confirm With digits; it does not confirm or trade. |

**Important:** 0 and 9 ARE tradable digits on Deriv — the exclusion from entry in this strategy is a **personal trading rule**, not a Deriv limitation. They are always part of the frequency analysis data.

**Note:** The Even/Odd strategy does **not** exclude 0 or 9 from entry — digits 0 and 9 can be entry digits for Even/Odd signals.

### The 2-Step Process (Filter → Entry)

#### Step 1: Filter (1,000-tick scan)

For each market, fetch the last 1,000 ticks and calculate the frequency of each digit (0–9). For a given trade type, every "losing" digit must be at or below the **quiet threshold** (default: 9.8%):

| Trade Type | Digits that must be ≤ 9.8% |
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

#### Live Monitoring (signal-only)

The scanner subscribes to **live ticks** for markets that pass the filter, but only to *watch* — the platform never confirms or executes trades.

**Watching for Entry (`status: watching_entry`)**

Live ticks arrive one by one (real-time stream, or the `ticks_history` polling fallback when the stream is refused). For each tick:
- If the tick's last digit does **not** match the entry digit → do nothing, keep watching
- If the tick's last digit **equals** the entry digit → the setup records an `entryTriggeredAt` timestamp and the Live Monitor flashes a brief green **"✓ Seen"** pulse (a few seconds), then returns to the plain "Wait for" instruction

The setup **never leaves `watching_entry`** — there is no confirmation phase, no reset, and no `confirmed` state. The entry digit will recur many times while the signal is live, so the "Wait for digit N" instruction stays actionable until the next scan re-evaluates the signal from fresh data.

**Visual summary of the live lifecycle:**

```
        ┌──────────────────────────────┐
        │  watching_entry              │  every live tick: re-check the digit
        │  ("Wait for <entry digit>")   │
        └──────────────┬───────────────┘
                       │  tick digit == entry digit?
                       ▼
        entryTriggered = true, entryTriggeredAt = now
        → Live Monitor flashes "✓ Seen" for a few seconds

        (status never changes — no confirmation, no reset)
```

### Even/Odd Strategy

The Even/Odd strategy is a **parity-dominance** approach: instead of looking for quiet digits in a range, it identifies markets where one parity (even or odd) is clearly dominating the distribution.

#### Filter Conditions

**Trading Even:**

| # | Condition | Threshold |
|:--|:---|:---|
| 1 | All odd digits (1, 3, 5, 7, 9) must be ≤ the opposite threshold | `oppositeThreshold` (default 10.1%) |
| 2 | The **most appearing** and **second-most appearing** digits must both be **even**, each ≥ the dominant threshold | `dominantThreshold` (default 10.7%) |
| 3 | The **least appearing** and **second-least appearing** digits must both be **odd** | — |
| 3b | **Fallback:** If the two least appearing digits span both parities (e.g., one even, one odd), then **3+ even digits** must each be ≥ `dominantThreshold` | — |

**Trading Odd** is the exact reverse:

| # | Condition | Threshold |
|:--|:---|:---|
| 1 | All even digits (0, 2, 4, 6, 8) must be ≤ `oppositeThreshold` | 10.1% |
| 2 | The most and second-most appearing digits must both be **odd**, each ≥ `dominantThreshold` | 10.7% |
| 3 | The least and second-least appearing digits must both be **even** | — |
| 3b | **Fallback:** If the two least appearing digits span both parities, then **3+ odd digits** must each be ≥ `dominantThreshold` | — |

#### Entry Digits

- **Even:** Entry = the **least appearing odd digit** (e.g., if odd digits are 1=8%, 3=7%, 5=9%, 7=6%, 9=8.5%, entry = **7**)
- **Odd:** Entry = the **least appearing even digit**

Unlike Over/Under, digits 0 and 9 are **not excluded** from entry in the Even/Odd strategy.

#### Confirmation (informational — signal-only)

The platform never confirms trades. Confirmation is presented as guidance:

| Trade Type | Confirmation Rule |
|:---|:---|
| **Even** | Any even digit **except** the 2nd-most appearing digit |
| **Odd** | **Two consecutive odd digits** within the next 6 ticks after entry |

#### Scoring

Even/Odd signals are scored by **dominance strength**:

1. **Base score** = average of the top 2 dominant-parity digits' percentages
2. **Bonus** = +0.5 for each additional dominant digit above `dominantThreshold` beyond the first 2

Higher score = stronger parity skew = better signal.

#### Even/Odd Scenario Walkthrough

**Market:** Volatility 100 (R_100) — digits distribution:

| Digit | % | Parity | Note |
|:---|---:|:---|:---|
| 0 | 13.0% | even | dominant |
| 1 | 8.0% | odd | |
| 2 | 13.0% | even | dominant |
| 3 | 8.0% | odd | |
| 4 | 7.0% | even | least appearing even |
| 5 | 10.0% | odd | |
| 6 | 12.0% | even | dominant |
| 7 | 8.0% | odd | |
| 8 | 11.0% | even | dominant |
| 9 | 10.0% | odd | |

**Filter check (Even):**
- All odd ≤ 10.1%? 1(8), 3(8), 5(10), 7(8), 9(10) → ✅
- Top 2 are even ≥ 10.7%? 0(13), 2(13) → ✅
- Bottom 2 both odd? 3(8), 7(8) → ✅
- **PASS**

**Entry digit:** Least appearing odd = **3** or **7** (both 8.0%) — picks **7** (tie-breaks to the lower digit).

**Confirmation:** Any even digit except the 2nd-most appearing (digit 2). So confirm with: 0, 4, 6, 8.

**Score:** (13 + 13) / 2 = 13.0 + bonus (0, 2, 6, 8 all ≥ 10.7% → 4 qualifying, bonus = 2 × 0.5 = 1.0) = **14.0**

### Priority Ranking

The scanner ranks passing signals for the dashboard:

1. **High payout tier first** (Over 3, Under 6, Even, Odd) before medium tier (Over 2, Under 7)
2. **Within same tier, higher score = better** — for Over/Under signals, this is the **quiet score** (average distance below the quiet threshold). For Even/Odd signals, this is the **dominance score** (average of top-2 dominant-parity percentages + bonus). A market with a stronger parity skew ranks higher.

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
- **Filter** — All four digits (0, 1, 2, 3) ≤ 9.8% → ✅ PASS
- **Entry digit** — Quiet digits sorted by %: 0(6.0%), 1(7.2%), 2(8.8%), 3(9.5%). 0 is exempt → **entry = 1**
- **Quiet score** — avg(9.8 - 6.0, 9.8 - 7.2, 9.8 - 8.8, 9.8 - 9.5) / 4 = **1.925°**
- **Live monitoring** — the platform watches live ticks for the entry digit. When digit **1** appears it flashes a brief "✓ Seen" pulse; otherwise the instruction stays "Wait for 1". It never confirms — you decide when to trade

#### Scenario B: Moderate Under 7 Setup (Medium Tier)

| Digit | % |
|:---|---:|
| 7 | **9.0%** ✅ quiet |
| 8 | **9.3%** ✅ quiet |
| 9 | **9.5%** ✅ quiet |
| (other digits) | > 9.8% |

**Result:**
- **Filter** — 7(9.0%), 8(9.3%), 9(9.5%) all ≤ 9.8% → ✅ PASS (Under 7)
- **Entry digit** — Quiet digits sorted: 7(9.0%), 8(9.3%), 9(9.5%). 9 is exempt → **entry = 7** (least of remaining)
- **Quiet score** — avg(9.8 - 9.0, 9.8 - 9.3, 9.8 - 9.5) / 3 = **0.53°** (weak — barely quiet)
- **Live monitoring** — watches for entry digit **7**; flashes a "✓ Seen" pulse when it appears
- This would rank **below** Scenario A due to medium payout tier + lower quiet score

#### Scenario C: Failed Filter (No Signal)

| Digit | % |
|:---|---:|
| 0 | **8.1%** ✅ quiet |
| 1 | **9.5%** ✅ quiet |
| 2 | **10.2%** ❌ over threshold |
| 3 | **11.5%** ❌ |

**Result:**
- **Over 3 filter** — Digit 2 is 10.2% > 9.8% → ❌ FAIL
- **Under 6 filter** — Not checked here, but 6, 7, 8, 9 might pass separately
- No Over 3 signal generated. Scanner stays in `pending` state.

#### Scenario D: Live Monitoring Walkthrough (signal-only)

**Setup:** Over 3 on Volatility 100, entry digit = 1.

```
Tick: 7    → not entry digit → keep waiting ("Wait for 1")
Tick: 4    → not entry digit → keep waiting
Tick: 1    → ★ ENTRY SEEN! "✓ Seen" pulse flashes (~4s), status unchanged
Tick: 7    → pulse expired → back to plain "Wait for 1"
Tick: 1    → ★ ENTRY SEEN again! Pulse re-flashes
Tick: 4    → keep waiting
```

The setup stays in `watching_entry` the entire time. There is no confirmation window, no reset, and no `confirmed` state — the platform presents the entry instruction and the trader decides when to act. The next scan re-evaluates the signal from fresh data; if the entry digit changes, the tracking resets to the new digit.

#### Scenario E: Very Strong vs. Marginal Signals

**Market A** (Over 3): digits at 5.0%, 5.5%, 6.0%, 6.5% — quiet score = **4.0°** (strong)
**Market B** (Over 3): digits at 9.0%, 9.5%, 9.6%, 9.7% — quiet score = **0.35°** (weak)

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
│   │   │   └── analyzer.ts          # ★ Core strategy engine (filter, entry, live tracking, ranking)
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
│   │   │   ├── SignalCard.tsx       # Individual signal card with Entry digit + Confirm With digits
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
- `quietThreshold` (default `9.8`) — percentage at or below which a digit is "quiet" (Over/Under only)
- `excludeDigits` (default `[0, 9]`) — digits never used as entry (Over/Under only)
- `oppositeThreshold` (default `10.1`) — max percentage for opposite-parity digits (Even/Odd only)
- `dominantThreshold` (default `10.7`) — min percentage for dominant-parity digits (Even/Odd only)
- `lookbackTicks` (default `1000`) — number of historical ticks per analysis
- `scanIntervalMs` (default `30_000`) — full scan interval (ms)
- `marketRefreshMs` (default `3_600_000`) — how often to refresh the market list from Deriv (ms)
- `configPollMs` (default `15_000`) — how often the client re-polls `/api/config` (ms); served to the UI so the config sync cadence is tunable at runtime
- `livePollIntervalMs` (default `2_000`) — how often to poll `ticks_history` as a live-feed fallback when Deriv refuses the real-time `ticks` stream (ms)
- `livePollCount` (default `100`) — how many recent ticks to request per fallback `ticks_history` poll

**Env vars:** All fields are overridable via `STRAT_QUIET_THRESHOLD`, `STRAT_EXCLUDE_DIGITS` (comma-separated), `STRAT_OPPOSITE_THRESHOLD`, `STRAT_DOMINANT_THRESHOLD`, `STRAT_LOOKBACK_TICKS`, `STRAT_LIVE_POLL_INTERVAL_MS`, `STRAT_LIVE_POLL_COUNT`, etc.

### `strategy/types.ts`

Defines the core data models:

```typescript
type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7' | 'EVEN' | 'ODD';

type TradeStatus =
  | 'pending'               // Initial state before analysis
  | 'watching_entry';       // Filter passed, waiting for entry digit on live ticks

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
  quietDigits: DigitStats[];  // Only the digits that passed ≤threshold (Over/Under) or all digits (Even/Odd)
  entryDigit: number | null; // Selected entry digit (null if all quiet digits are 0/9)
  validConfirmationDigits: number[]; // Informational — digits that would confirm/win this trade type
  confirmationText: string;  // Informational text for Even/Odd confirmation rules
  quietScore: number;          // Avg distance below threshold (Over/Under) or dominance score (Even/Odd)
  status: TradeStatus;       // Current state (pending | watching_entry)
  entryTriggered: boolean;   // Has the entry digit been seen on live ticks?
  entryTriggeredAt: number | null; // Epoch ms of the last entry-digit sighting (drives the "seen" pulse)
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
| `TRADE_CONFIGS` | Array of 6 TradeTypeConfig objects defining quiet digits, confirm condition (which digits would confirm/win), and payout tier. Covers Over/Under (4) and Even/Odd (2). |
| `analyzeMarket(symbol, displayName, market, prices, decimals)` | Run the full strategy on one market. Returns TradeSetup[6] (one per trade type: OVER_3, UNDER_6, OVER_2, UNDER_7, EVEN, ODD). |
| `trackEntryTick(setup, tickDigit)` | Signal-only entry tracking: marks `entryTriggered`/`entryTriggeredAt` when the entry digit appears; the setup stays in `watching_entry` forever (no confirmation). |
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

**`trackEntryTick` — Signal-only entry tracking:**

```
        ┌──────────────────────────────┐
        │  watching_entry              │  every live tick: re-check the digit
        │  ("Wait for <entry digit>")   │
        └──────────────┬───────────────┘
                       │  tick digit == entry digit?
                       ▼
        entryTriggered = true, entryTriggeredAt = now
        → Live Monitor flashes "✓ Seen" for a few seconds

        (status never changes — no confirmation, no reset)
```

### `scanner/scanner.ts`

Orchestrates the scanning lifecycle:

1. **On start:** Connects to Deriv WebSocket, discovers markets, runs initial scan
2. **Periodic scan** (every 30s by default): Fetches `ticks_history` for every market in parallel using `Promise.allSettled`, runs `analyzeMarket` on each, then `rankSignals`
3. **Live monitoring:** After each scan, subscribes to real-time ticks for symbols that have active signals. Merges new scan results with in-progress live state (preserving the entry "seen" state across rescans when the entry digit hasn't changed)
4. **Rolling-window live percentages:** Each monitored symbol keeps a rolling window of its most recent `lookbackTicks` prices (seeded from the scan's history). Every live tick appends to the window and re-runs the digit analysis, so the digit-distribution percentages crawl in real time *between* scans — not just when a new scan lands. Entry tracking (the "seen" pulse) is driven by the same tick stream
5. **Polling fallback:** When Deriv refuses the real-time `ticks` stream, the scanner automatically falls back to polling `ticks_history` for monitored symbols (every `livePollIntervalMs`, requesting `livePollCount` ticks, deduped by epoch). The same shared per-tick pipeline is used, so percentages still update and entry tracking stays alive on historical polling alone. It probes for stream recovery (throttled to every 30s) and switches back to real-time ticks automatically
6. **Auto-unsubscribe:** When a symbol no longer has a signal, unsubscribes from its tick stream (and stops its poll fallback)
7. **Feed health:** Periodically checks that ticks are still flowing to detect a stalled feed, and reconciles live vs. poll fallback per symbol

**Key design decisions:**
- Uses `onResult(callback)` pattern for SSE clients to register
- Merges live entry state across rescans so the "seen" pulse isn't lost when a scan re-runs
- All markets fetched in parallel (not sequential)
- One shared `processLiveTick` path for both real-time ticks and the polling fallback — identical entry-tracking and percentage behavior regardless of the feed source

### `deriv/connection.ts`

WebSocket connection manager for Deriv's public API (`wss://api.derivws.com/trading/v1/options/ws/public`).

**Capabilities:**
- **Auto-reconnect** with 3s delay on unexpected disconnect
- **Request/response matching** via `req_id` — each `send()` returns a Promise that resolves when the matching response arrives
- **Subscription management** — `subscribe(symbol, handler)` returns an unsubscribe function. Uses Deriv's `subscription.id` for correct `forget` calls
- **Feed health monitoring** — flags as "degraded" if no tick arrives on any subscription within 20s
- **Live-stream refusal handling** — in some environments Deriv refuses the whole `ticks` stream (every symbol — even forex — returns `InvalidSymbol` while `ticks_history` still works). Detected once and logged as a single clear warning, the feed is flagged degraded, and the scanner switches to its `ticks_history` polling fallback (see `scanner.ts`) without pruning valid symbols; it recovers automatically if the stream becomes available again
- **Re-subscribe on reconnect** — automatically re-sends `ticks` subscribe for all active subscriptions when the WebSocket reconnects

**Key methods:**
- `connect()` — open WebSocket
- `send(request)` — send JSON, await response by req_id (15s timeout)
- `subscribe(symbol, handler)` — subscribe to live ticks, returns unsubscribe fn
- `isLiveStreamBlocked()` — whether Deriv is currently refusing the whole `ticks` stream (drives the polling fallback)
- `isSymbolSubscribed(symbol)` — whether a real-time subscription is active for a symbol
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
- `event: status` — connection status `{ connected, feedDegraded, liveStreamBlocked }`
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
- `SignalList.tsx` — Renders the ranked signals as cards, overlaying the freshest live setup (`liveUpdates`) onto each scan snapshot so the digit percentages, quiet score, and status badge update in real time between scans (falling back to the scan snapshot when no live data exists yet)
- `SignalCard.tsx` — Card with header (rank, trade type, payout badge, status badge), market info, the **Entry** digit tile (with the quietest-digit note), the informational **Confirm With** digit chips (which digits would confirm/win this trade type — signal-only, never actually confirmed), and DigitDistribution. Only renders when `signal.passesFilter` is true
- `DigitDistribution.tsx` — Horizontal bar chart showing all 10 digits. Color-coded: emerald for entry/quiet, red for active (above threshold). The red threshold marker is positioned from the **live `quietThreshold`** served by `GET /api/config` (polled via `useStrategyConfig` at the server-provided `configPollMs`), so server-side retunes move the line without a page reload — falling back to the 9.8% default only while the config is loading or unreachable
- `LiveMonitor.tsx` — Shows `watching_entry` signals as "Wait for" rows and flashes a brief green "✓ Seen" pulse when the entry digit appears on live ticks (signal-only — no confirmation)
- `ScannerStatus.tsx` — Connection status and feed health indicator
- `Header.tsx` — Sticky top bar with logo, scan time, and signal count

**SSE Connection (`useSignals.ts`):** Uses native `EventSource` to consume the SSE stream. Connects on mount, auto-reconnects on error with 3s delay. Parses `scan_result` and `live_update` events.

**Strategy Config (`useStrategyConfig.ts`):** Polls `GET /api/config` at the cadence the server reports via `configPollMs` (default 15s, overridable with `STRAT_CONFIG_POLL_MS` or `PUT /api/config`) and shares the result through a module-level cache, so all signal cards trigger a single request per tick regardless of how many are mounted. `DigitDistribution` reads `quietThreshold` from it to position the threshold marker. Each successful poll refreshes the "last sync" time; requests are aborted after a timeout (derived from the cadence) so a hung fetch can't stall polling.

---

## Configuration Reference

All configurable via environment variables (server-side):

| Env Var | Default | Description |
|:---|---|---|
| `STRAT_QUIET_THRESHOLD` | `9.8` | Quiet digit threshold (%) — Over/Under only |
| `STRAT_EXCLUDE_DIGITS` | `0,9` | Digits excluded from entry — Over/Under only |
| `STRAT_OPPOSITE_THRESHOLD` | `10.1` | Max % for opposite-parity digits — Even/Odd only |
| `STRAT_DOMINANT_THRESHOLD` | `10.7` | Min % for dominant-parity digits — Even/Odd only |
| `STRAT_LOOKBACK_TICKS` | `1000` | Historical ticks per analysis |
| `STRAT_SCAN_INTERVAL_MS` | `30000` | Full scan interval (ms) |
| `STRAT_MARKET_REFRESH_MS` | `3600000` | Market list refresh interval (ms) |
| `STRAT_CONFIG_POLL_MS` | `15000` | Client `/api/config` poll interval (ms) |
| `STRAT_LIVE_POLL_INTERVAL_MS` | `2000` | Live-feed fallback: `ticks_history` poll interval when the real-time stream is refused (ms) |
| `STRAT_LIVE_POLL_COUNT` | `100` | Live-feed fallback: recent ticks requested per poll |
| `PORT` | `3001` | Server port |

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

- **ALL strategy logic lives in `server/src/strategy/analyzer.ts`.** Trade types are defined in the `TRADE_CONFIGS` array (currently: OVER_3, UNDER_6, OVER_2, UNDER_7, EVEN, ODD). Over/Under uses `checkFilter`/`selectEntryDigit`/`calculateQuietScore`; Even/Odd uses `checkEvenOddFilter`/`selectEvenOddEntry`/`calculateEvenOddScore`.
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
data: { "connected": boolean, "feedDegraded": boolean, "liveStreamBlocked": boolean }
```

### Live Monitoring State Merging

The scanner preserves live entry state across consecutive scans. When a new scan finishes for a market that's already being monitored, the scanner merges new results with existing state by comparing `entryDigit`. If it matches, the live entry state (`entryTriggered` / `entryTriggeredAt` — the "seen" pulse) is preserved. If it differs (the strategy analysis picked a new entry digit), the state resets.

The same merge (`mergeLiveState`) is applied on **every live tick** against the rolling window's re-analysis: percentages, quiet digits, and quiet score refresh continuously while the entry state is preserved for as long as the entry digit stays unchanged. Live updates are delivered to the client over the `live_update` SSE event, and `SignalList` overlays them onto the ranked cards.

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

1. **Rolling-window baseline** — The live rolling window is re-seeded from each scan's `ticks_history` snapshot, and the polling fallback dedupes by epoch (never re-feeding a tick already in the window). If modifying the live pipeline, keep that invariant: feeding the same tick twice would double-count it in the digit frequencies.
2. **`getLastDigit` precision** — If modifying the digit extraction logic, always use `price.toFixed(decimals)` to preserve trailing zeros. This is the most common source of bugs.
3. **`trackEntryTick` is signal-only** — The platform never confirms: `trackEntryTick` only records `entryTriggered`/`entryTriggeredAt` when the entry digit appears and never changes `status` (setups stay in `watching_entry` until the next scan re-evaluates them). Do NOT re-introduce a confirmation stage or status transitions; the UI's "✓ Seen" pulse is purely a client-side time window over `entryTriggeredAt`.
4. **`rankSignals` order** — High payout (Over 3, Under 6, Even, Odd) always beats medium payout (Over 2, Under 7), regardless of score. Score (quiet score for Over/Under, dominance score for Even/Odd) is a tiebreaker within the same tier.
5. **`entryDigit = null` edge case** — If all quiet digits are 0 and 9 (both exempt), `entryDigit` is null and the signal stays in `pending` status even though `passesFilter` is true. The frontend handles this gracefully.
6. **SSE reconnection** — The frontend auto-reconnects SSE on error with a 3s delay. The server re-subscribes all tick streams on WebSocket reconnect.
7. **Market discovery fallback** — If Deriv's `active_symbols` endpoint is unreachable (geo-restricted in some environments), the scanner falls back to the static `FALLBACK_MARKETS` list, which covers the essential set.
