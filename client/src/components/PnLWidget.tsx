import { useState, useCallback } from 'react';
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
        <StakeEditor currentStake={state.currentStake} />
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

function StakeEditor({ currentStake }: { currentStake: number }) {
  const [editing, setEditing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [saving, setSaving] = useState(false);

  const commit = useCallback(async () => {
    const n = parseFloat(inputText);
    if (isNaN(n) || n < 0.1) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await fetch('/api/trading/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseStake: Math.min(n, 100) }),
      });
    } catch {
      // silently fail — next refresh will correct the display
    }
    setSaving(false);
    setEditing(false);
  }, [inputText]);

  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-dark-700/30">
      <span className="text-[10px] text-dark-300">Stake</span>
      {editing ? (
        <input
          type="number"
          autoFocus
          step={0.1}
          min={0.1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-16 px-1 py-0.5 rounded bg-dark-700 border border-dark-500 text-[11px] font-mono font-bold text-dark-200 text-right focus:outline-none focus:border-emerald-700/40"
        />
      ) : (
        <button
          onClick={() => {
            setInputText(String(currentStake));
            setEditing(true);
          }}
          className="text-[11px] font-mono font-bold text-dark-200 hover:text-emerald-400 transition-colors cursor-text"
          disabled={saving}
        >
          {saving ? (
            <span className="inline-block w-3 h-3 border-2 border-dark-400 border-t-emerald-400 rounded-full animate-spin" />
          ) : (
            `$${currentStake.toFixed(2)}`
          )}
        </button>
      )}
    </div>
  );
}
