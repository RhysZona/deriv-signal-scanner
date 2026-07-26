import { useState, useCallback, useEffect } from 'react';
import type { TraderState } from '../types';
import { SliderField } from './SliderField';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';

interface TradingControlsProps {
  state: TraderState | null;
}

interface TradingConfig {
  enabled: boolean;
  allowReal: boolean;
  baseStake: number;
  currency: string;
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  stopLoss: number;
  takeProfit: number | null;
  maxConcurrent: number;
  durationTicks: { Volatility: number; Jump: number };
}

const STORAGE_KEY = 'trading_controls_config';

function loadSaved(): TradingConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(cfg: TradingConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

const DEFAULTS: TradingConfig = {
  enabled: true,
  allowReal: false,
  baseStake: 1,
  currency: 'USD',
  martingaleMultiplier: 1.3,
  maxMartingaleSteps: 10,
  stopLoss: 2000,
  takeProfit: 1,
  maxConcurrent: 1,
  durationTicks: { Volatility: 1, Jump: 2 },
};

export function TradingControls({ state }: TradingControlsProps) {
  const [loadingArm, setLoadingArm] = useState(false);
  const [loadingDisarm, setLoadingDisarm] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Trading config editing ────────────────────────────────────────────────
  const [config, setConfig] = useState<TradingConfig | null>(loadSaved);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [showConfirmReal, setShowConfirmReal] = useState(false);
  const toast = useToast();

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const res = await fetch('/api/trading/config');
      const data = await res.json();
      if (data.status === 'ok') {
        setConfig(data.config);
        saveToStorage(data.config);
      } else setConfigError('Failed to load config');
    } catch (e: any) {
      setConfigError(e?.message ?? 'Failed to load config');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (configOpen) fetchConfig();
  }, [configOpen, fetchConfig]);

  const updateConfigField = <K extends keyof TradingConfig>(key: K, value: TradingConfig[K]) => {
    if (!config) return;
    const next = { ...config, [key]: value };
    setConfig(next);
    saveToStorage(next);
    setConfigDirty(true);
  };

  const saveConfig = async () => {
    if (!config || !configDirty) return;
    setConfigSaving(true);
    setConfigError(null);
    try {
      const res = await fetch('/api/trading/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseStake: config.baseStake,
          martingaleMultiplier: config.martingaleMultiplier,
          maxMartingaleSteps: config.maxMartingaleSteps,
          stopLoss: config.stopLoss,
          takeProfit: config.takeProfit,
          maxConcurrent: config.maxConcurrent,
          allowReal: config.allowReal,
          currency: config.currency,
          durationTicks: config.durationTicks,
        }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setConfig(data.config);
        saveToStorage(data.config);
        setConfigDirty(false);
        toast.success('Trade settings saved');
      } else {
        setConfigError('Save failed');
        toast.error('Save failed');
      }
    } catch (e: any) {
      setConfigError(e?.message ?? 'Save failed');
      toast.error('Save failed — network error');
    } finally {
      setConfigSaving(false);
    }
  };

  // ── Arm / disarm / reset ──────────────────────────────────────────────────
  const apiCall = useCallback(async (url: string, setLoading: (v: boolean) => void) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.status !== 'ok') {
        setError(data.state?.lastDisarmReason || data.status);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  if (!state) return null;

  const canArm = state.enabled && !state.armed;
  const canDisarm = state.armed;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 overflow-hidden">
      {/* Header + arm/disarm/reset */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Trading</h3>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
            state.armed
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40'
              : state.enabled
                ? 'bg-dark-600 text-dark-300 border border-dark-500'
                : 'bg-red-900/30 text-red-400 border border-red-700/40'
          }`}>
            {state.armed ? 'Armed' : state.enabled ? 'Disarmed' : 'Disabled'}
          </div>
        </div>

        {/* Account info */}
        <div className="mb-3 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-dark-400">Account</span>
            <span className="font-medium text-dark-200">
              {state.account
                ? `${state.account.loginid} (${state.account.isVirtual ? 'DEMO' : 'REAL'})`
                : 'Not connected'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] mt-1">
            <span className="text-dark-400">Auth</span>
            <span className={`font-medium ${state.authorized ? 'text-emerald-400' : 'text-red-400'}`}>
              {state.authorized ? 'Authorized' : 'Not authorized'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-900/20 border border-red-600/30">
            <p className="text-[10px] text-red-300">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => apiCall('/api/trading/arm', setLoadingArm)}
            disabled={!canArm || loadingArm}
            className={`px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all ${
              canArm
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-dark-600 text-dark-400 cursor-not-allowed'
            } ${loadingArm ? 'opacity-70' : ''}`}
          >
            {loadingArm ? (
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Arm'
            )}
          </button>
          <button
            onClick={() => apiCall('/api/trading/disarm', setLoadingDisarm)}
            disabled={!canDisarm || loadingDisarm}
            className={`px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all ${
              canDisarm
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'
                : 'bg-dark-600 text-dark-400 cursor-not-allowed'
            } ${loadingDisarm ? 'opacity-70' : ''}`}
          >
            {loadingDisarm ? (
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Disarm'
            )}
          </button>
          <button
            onClick={() => apiCall('/api/trading/reset', setLoadingReset)}
            disabled={loadingReset}
            className={`px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all ${
              loadingReset
                ? 'bg-dark-600 text-dark-400'
                : 'bg-dark-600 hover:bg-dark-500 text-dark-200 border border-dark-500 hover:border-dark-400'
            }`}
          >
            {loadingReset ? (
              <span className="inline-block w-3 h-3 border-2 border-dark-400 border-t-dark-200 rounded-full animate-spin" />
            ) : (
              'Reset'
            )}
          </button>
        </div>
      </div>

      {/* ── Config collapsible ─────────────────────────────────────────────── */}
      <div className="border-t border-dark-600">
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-dark-700/50 transition-colors"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">
            Trade Settings
          </span>
          <div className="flex items-center gap-2">
            {configDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
            <svg
              className={`w-3.5 h-3.5 text-dark-400 transition-transform duration-200 ${configOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {configOpen && (
          <div className="px-5 pb-5">
            {configLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            )}

            {configError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-900/20 border border-red-600/30">
                <p className="text-[10px] text-red-300">{configError}</p>
              </div>
            )}

            {config && !configLoading && (
              <div className="space-y-3">
                <SliderField
                  label="Base Stake"
                  value={config.baseStake}
                  min={0.1}
                  max={100}
                  step={0.1}
                  prefix="$"
                  onChange={(v) => updateConfigField('baseStake', v)}
                />
                <SliderField
                  label="Martingale"
                  value={config.martingaleMultiplier}
                  min={0.5}
                  max={5}
                  step={0.1}
                  suffix="×"
                  onChange={(v) => updateConfigField('martingaleMultiplier', v)}
                />
                <SliderField
                  label="Max Martingale Steps"
                  value={config.maxMartingaleSteps}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(v) => updateConfigField('maxMartingaleSteps', v)}
                />
                <SliderField
                  label="Stop Loss"
                  value={config.stopLoss}
                  min={1}
                  max={100_000}
                  step={10}
                  prefix="$"
                  onChange={(v) => updateConfigField('stopLoss', v)}
                />

                {/* Take Profit — special case: nullable */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-dark-300">Take Profit</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-dark-200">
                        {config.takeProfit !== null ? `${config.takeProfit.toFixed(0)}` : '—'}
                      </span>
                      <button
                        onClick={() =>
                          updateConfigField('takeProfit', config.takeProfit === null ? config.baseStake * 2 : null)
                        }
                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider transition-colors ${
                          config.takeProfit === null
                            ? 'bg-dark-600 text-dark-300 border border-dark-500 hover:border-dark-400'
                            : 'bg-amber-900/30 text-amber-400 border border-amber-700/40'
                        }`}
                      >
                        {config.takeProfit === null ? 'Disabled' : 'Enabled'}
                      </button>
                    </div>
                  </div>
                  {config.takeProfit !== null && (
                    <SliderField
                      label=""
                      value={config.takeProfit}
                      min={1}
                      max={Math.max(config.stopLoss * 2, 100)}
                      step={1}
                      prefix="$"
                      onChange={(v) => updateConfigField('takeProfit', v)}
                    />
                  )}
                </div>

                {/* ── Allow Real toggle ────────────────────────────── */}
                <div className="px-3 py-2 rounded-lg bg-red-900/10 border border-red-700/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-red-300">Allow Real</span>
                      <p className="text-[8px] text-red-400/60 mt-0.5">Permits real-money trades</p>
                    </div>
                    <button
                      onClick={() => {
                        if (config.allowReal) {
                          // Turning off — no confirmation needed
                          updateConfigField('allowReal', false);
                        } else {
                          // Turning on — require confirmation
                          setShowConfirmReal(true);
                        }
                      }}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        config.allowReal ? 'bg-red-500' : 'bg-dark-500'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          config.allowReal ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {config.allowReal && (
                    <div className="mt-1.5 px-2 py-1 rounded bg-red-900/30">
                      <p className="text-[9px] font-semibold text-red-300">⚠ REAL-MONEY TRADING ENABLED</p>
                    </div>
                  )}
                </div>

                <ConfirmDialog
                  open={showConfirmReal}
                  title="Enable Real-Money Trading?"
                  message="This will allow the bot to place real-money trades on your Deriv account. Ensure you have set appropriate stop-loss and stake limits before proceeding."
                  confirmLabel="Enable Real Trading"
                  cancelLabel="Cancel"
                  variant="danger"
                  onConfirm={() => {
                    updateConfigField('allowReal', true);
                    setShowConfirmReal(false);
                  }}
                  onCancel={() => setShowConfirmReal(false)}
                />

                {/* ── Currency selector ─────────────────────────────── */}
                <div>
                  <span className="text-[10px] font-semibold text-dark-300 block mb-1.5">Currency</span>
                  <div className="flex items-center gap-1">
                    {['USD', 'EUR', 'GBP', 'AUD', 'BTC', 'ETH'].map((ccy) => (
                      <button
                        key={ccy}
                        onClick={() => updateConfigField('currency', ccy)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                          config.currency === ccy
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
                            : 'bg-dark-700 text-dark-300 border border-dark-500 hover:border-dark-400'
                        }`}
                      >
                        {ccy}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Duration Ticks per market family ──────────────────── */}
                <div className="px-3 py-2 rounded-lg bg-dark-700/30 border border-dark-500">
                  <span className="text-[10px] font-semibold text-dark-300 block mb-2">Duration (ticks)</span>
                  <div className="space-y-2">
                    {(['Volatility', 'Jump'] as const).map((family) => (
                      <div key={family} className="flex items-center justify-between">
                        <span className="text-[10px] text-dark-400">{family}</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 5, 10].map((n) => (
                            <button
                              key={n}
                              onClick={() => {
                                if (!config) return;
                                const next = {
                                  ...config,
                                  durationTicks: { ...config.durationTicks, [family]: n },
                                };
                                setConfig(next);
                                saveToStorage(next);
                                setConfigDirty(true);
                              }}
                              className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors ${
                                config.durationTicks[family] === n
                                  ? 'bg-blue-900/40 text-blue-400 border border-blue-700/40'
                                  : 'bg-dark-700 text-dark-300 border border-dark-500 hover:border-dark-400'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Read-only row for 1s Volatility indices */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-dark-600">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-dark-400">Volatility 1s</span>
                        <svg className="w-3 h-3 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-dark-500 bg-dark-600/50 px-2 py-0.5 rounded">
                        2 (hardcoded)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-dark-300">Max Concurrent</span>
                    <span className="text-[11px] font-mono font-bold text-dark-200">{config.maxConcurrent}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => updateConfigField('maxConcurrent', n)}
                        className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors ${
                          config.maxConcurrent === n
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
                            : 'bg-dark-700 text-dark-300 border border-dark-500 hover:border-dark-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setConfig(DEFAULTS);
                      saveToStorage(DEFAULTS);
                      setConfigDirty(true);
                    }}
                    className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-colors bg-dark-700 text-dark-300 border border-dark-500 hover:bg-dark-600 hover:border-dark-400`}
                  >
                    Reset Defaults
                  </button>
                  <button
                    onClick={saveConfig}
                    disabled={!configDirty || configSaving}
                    className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all ${
                      configDirty
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                        : 'bg-dark-600 text-dark-400 cursor-not-allowed'
                    } ${configSaving ? 'opacity-70' : ''}`}
                  >
                    {configSaving ? 'Saving...' : configDirty ? 'Save Changes' : 'Saved'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


