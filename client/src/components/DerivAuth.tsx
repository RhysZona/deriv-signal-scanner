import { useState, useCallback } from 'react';
import type { DerivAccountInfo, ConnectionStatus } from '../types';

interface DerivAuthProps {
  connectionStatus: ConnectionStatus;
  onTokenSubmit: (token: string) => void;
  onDisconnect: () => void;
}

export function DerivAuth({ connectionStatus, onTokenSubmit, onDisconnect }: DerivAuthProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      onTokenSubmit(tokenInput.trim());
    }
  }, [tokenInput, onTokenSubmit]);

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-600">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">
            Deriv API
          </h3>
          <div className="flex items-center gap-2">
            {connectionStatus.authorized && connectionStatus.account && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                connectionStatus.account.isVirtual
                  ? 'bg-blue-900/30 text-blue-400 border border-blue-700/40'
                  : 'bg-amber-900/30 text-amber-400 border border-amber-700/40'
              }`}>
                {connectionStatus.account.isVirtual ? 'DEMO' : 'REAL'}
              </span>
            )}
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus.connected
                ? connectionStatus.authorized
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : 'bg-amber-500 animate-pulse'
                : 'bg-red-500'
            }`} />
          </div>
        </div>
      </div>

      {!connectionStatus.authorized ? (
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-dark-300 block mb-1.5">
              API Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Paste your Deriv API token..."
                className={`w-full px-3 py-2.5 rounded-xl bg-dark-700 border text-xs font-mono text-dark-100 placeholder:text-dark-400 outline-none transition-all ${
                  focused
                    ? 'border-emerald-700/50 shadow-sm shadow-emerald-500/10'
                    : 'border-dark-500 hover:border-dark-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-dark-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {showToken ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  )}
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-dark-400 mt-1.5">
              Generate at{' '}
              <a
                href="https://app.deriv.com/account/api-token"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:text-emerald-400 underline"
              >
                app.deriv.com/account/api-token
              </a>
            </p>
          </div>

          <button
            type="submit"
            disabled={!tokenInput.trim()}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
              tokenInput.trim()
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-dark-600 text-dark-400 cursor-not-allowed'
            }`}
          >
            Authorize
          </button>
        </form>
      ) : (
        <div className="p-5 space-y-3">
          {/* Account Info */}
          {connectionStatus.account && (
            <div className="space-y-2 px-3 py-2.5 rounded-xl bg-dark-700/50 border border-dark-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-dark-400">Account</span>
                <span className="text-[11px] font-mono font-bold text-dark-200">
                  {connectionStatus.account.loginid}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-dark-400">Balance</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  {connectionStatus.account.balance.toFixed(2)} {connectionStatus.account.currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-dark-400">Mode</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  connectionStatus.account.isVirtual
                    ? 'text-blue-400 bg-blue-900/20'
                    : 'text-amber-400 bg-amber-900/20'
                }`}>
                  {connectionStatus.account.isVirtual ? 'DEMO' : 'REAL'}
                </span>
              </div>
            </div>
          )}

          {/* Scope info if available */}
          {connectionStatus.tokenScope && (
            <div className="text-[9px] text-dark-400">
              Scope: <span className="text-dark-300 font-mono">{connectionStatus.tokenScope}</span>
            </div>
          )}

          {/* Disconnect */}
          <button
            onClick={onDisconnect}
            className="w-full px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-700/40"
          >
            Revoke & Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
