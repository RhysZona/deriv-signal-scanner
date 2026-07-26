import { useState, useEffect, useCallback } from 'react';
import { SliderField } from './SliderField';
import { useToast } from './Toast';

interface StrategyConfig {
  quietThreshold: number;
  excludeDigits: number[];
  lookbackTicks: number;
  confirmWithinTicks: number;
  scanIntervalMs: number;
  confirmedCooldownMs: number;
  marketRefreshMs: number;
}

const STORAGE_KEY = 'scanner_strategy_config';

function loadSaved(): StrategyConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(cfg: StrategyConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

export function StrategySettings() {
  const [config, setConfig] = useState<StrategyConfig | null>(loadSaved);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
      saveToStorage(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const update = <K extends keyof StrategyConfig>(key: K, value: StrategyConfig[K]) => {
    if (!config) return;
    const next = { ...config, [key]: value };
    setConfig(next);
    saveToStorage(next);
    setDirty(true);
  };

  const save = async () => {
    if (!config || !dirty) return;
    try {
      setSaving(true);
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quietThreshold: config.quietThreshold,
          excludeDigits: config.excludeDigits,
          lookbackTicks: config.lookbackTicks,
          confirmWithinTicks: config.confirmWithinTicks,
          scanIntervalMs: config.scanIntervalMs,
          confirmedCooldownMs: config.confirmedCooldownMs,
          marketRefreshMs: config.marketRefreshMs,
        }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setConfig(data.config);
        saveToStorage(data.config);
        setDirty(false);
        setError(null);
        toast.success('Strategy settings saved');
      } else {
        setError('Save failed');
        toast.error('Save failed');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
      toast.error('Save failed — network error');
    } finally {
      setSaving(false);
    }
  };

  const togglePanel = () => {
    setOpen(!open);
    if (open) setDirty(false);
  };

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 overflow-hidden">
      <button
        onClick={togglePanel}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-dark-700/50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Strategy Settings</h3>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
          <svg
            className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-dark-600 pt-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-900/20 border border-red-600/30">
              <p className="text-[10px] text-red-300">{error}</p>
            </div>
          )}

          {config && !loading && (
            <div className="space-y-3">
              <SliderField
                label="Quiet Threshold"
                value={config.quietThreshold}
                min={1}
                max={15}
                step={0.1}
                suffix="%"
                onChange={(v) => update('quietThreshold', v)}
              />
              <SliderField
                label="Lookback Ticks"
                value={config.lookbackTicks}
                min={100}
                max={5000}
                step={100}
                onChange={(v) => update('lookbackTicks', v)}
              />
              <SliderField
                label="Confirm Within"
                value={config.confirmWithinTicks}
                min={1}
                max={10}
                step={1}
                suffix=" ticks"
                onChange={(v) => update('confirmWithinTicks', v)}
              />
              <SliderField
                label="Scan Interval"
                value={config.scanIntervalMs}
                min={5000}
                max={120000}
                step={5000}
                suffix="ms"
                onChange={(v) => update('scanIntervalMs', v)}
              />
              <SliderField
                label="Cooldown"
                value={config.confirmedCooldownMs}
                min={2000}
                max={60000}
                step={1000}
                suffix="ms"
                onChange={(v) => update('confirmedCooldownMs', v)}
              />
              <SliderField
                label="Market Refresh"
                value={config.marketRefreshMs}
                min={60000}
                max={86400000}
                step={60000}
                suffix="ms"
                onChange={(v) => update('marketRefreshMs', v)}
              />

              {/* Exclude digits */}
              <div>
                <span className="text-[10px] font-semibold text-dark-300 block mb-1.5">Exclude Digits</span>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        const next = config.excludeDigits.includes(d)
                          ? config.excludeDigits.filter((x) => x !== d)
                          : [...config.excludeDigits, d].sort();
                        update('excludeDigits', next);
                      }}
                      className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors ${
                        config.excludeDigits.includes(d)
                          ? 'bg-red-900/40 text-red-400 border border-red-700/40'
                          : 'bg-dark-700 text-dark-300 border border-dark-500 hover:border-dark-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={save}
                disabled={!dirty || saving}
                className={`w-full mt-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                  dirty
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                    : 'bg-dark-600 text-dark-400 cursor-not-allowed'
                } ${saving ? 'opacity-70' : ''}`}
              >
                {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


