import type { TraderState } from '../types';

interface PnLWidgetProps {
  state: TraderState | null;
}

export function PnLWidget({ state }: PnLWidgetProps) {
  if (!state) return null;

  const pnl = state.sessionPnL;
  const isPositive = pnl > 0;
  const isNegative = pnl < 0;
  const totalTrades = state.wins + state.losses;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Session P&amp;L</h3>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
          state.armed
            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40'
            : 'bg-dark-600 text-dark-300 border border-dark-500'
        }`}>
          {state.armed ? 'ARMED' : state.enabled ? 'Disarmed' : 'Disabled'}
        </div>
      </div>

      {/* P&L display */}
      <div className="text-center mb-4">
        <div className={`text-3xl font-bold font-mono ${isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-dark-200'}`}>
          {isPositive ? '+' : ''}{pnl.toFixed(2)}
        </div>
        <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-0.5">
          {state.account
            ? `${state.account.currency} · ${state.account.isVirtual ? 'DEMO' : 'REAL'}`
            : 'Not authorized'}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center px-2 py-2 rounded-lg bg-dark-700/50 border border-dark-500">
          <div className="text-lg font-bold font-mono text-emerald-400">{state.wins}</div>
          <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-0.5">Wins</div>
        </div>
        <div className="text-center px-2 py-2 rounded-lg bg-dark-700/50 border border-dark-500">
          <div className="text-lg font-bold font-mono text-red-400">{state.losses}</div>
          <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-0.5">Losses</div>
        </div>
        <div className="text-center px-2 py-2 rounded-lg bg-dark-700/50 border border-dark-500">
          <div className="text-lg font-bold font-mono text-dark-200">
            {totalTrades > 0 ? ((state.wins / totalTrades) * 100).toFixed(0) : '—'}
          </div>
          <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-0.5">Win %</div>
        </div>
      </div>

      {/* Martingale & stake info */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-dark-700/30">
          <span className="text-[10px] text-dark-300">Stake</span>
          <span className="text-[11px] font-mono font-bold text-dark-200">${state.currentStake.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-dark-700/30">
          <span className="text-[10px] text-dark-300">Martingale</span>
          <span className="text-[11px] font-mono font-bold text-dark-200">
            {state.martingaleStep > 0
              ? `Step ${state.martingaleStep}`
              : '—'}
          </span>
        </div>
      </div>

      {state.lastDisarmReason && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-900/20 border border-amber-600/30">
          <p className="text-[10px] text-amber-300">
            <span className="font-semibold">Disarmed:</span> {state.lastDisarmReason}
          </p>
        </div>
      )}
    </div>
  );
}
