import { useState, useEffect, useRef } from 'react';
import { GlassCard } from './GlassCard';
import type { TradeSetup } from '../types';

const MPESA_NUMBER = '0794016328';
const MPESA_NAME = 'Alex Nyagitari';

interface DonationCardProps {
  liveUpdates?: TradeSetup[] | null;
}

export function DonationCard({ liveUpdates }: DonationCardProps) {
  const [copied, setCopied] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const prevCountRef = useRef(0);

  // Pulse briefly when signal count changes
  useEffect(() => {
    const count = liveUpdates?.length ?? 0;
    if (count > 0 && count !== prevCountRef.current) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 1500);
      prevCountRef.current = count;
      return () => clearTimeout(t);
    }
    prevCountRef.current = count;
  }, [liveUpdates]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MPESA_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  };

  return (
    <GlassCard className={`px-5 py-4 relative transition-shadow duration-500 ${pulsing ? 'shadow-[0_0_20px_rgba(52,211,153,0.15)]' : ''}`} hover={false}>
      {/* Toast */}
      {copied && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-1.5 bg-emerald-500/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/20">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Number copied successfully
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">☕</span>
        <h3 className="text-xs font-bold text-dark-200 uppercase tracking-[0.14em]">
          Support the Project
        </h3>
      </div>

      <p className="text-[13px] text-dark-300 leading-relaxed mb-4">
        Finding these signals useful? Your support keeps this project alive
        and helps cover server costs. Any amount is appreciated.
      </p>

      {/* M-Pesa details */}
      <div className="bg-dark-500/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dark-400 uppercase tracking-wider font-medium">
            M-Pesa Number
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold font-mono tabular-nums text-dark-100 tracking-wide">
            {MPESA_NUMBER}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-dark-400">Name:</span>
          <span className="text-[11px] text-dark-200 font-medium">{MPESA_NAME}</span>
        </div>
      </div>

      <p className="text-[10px] text-dark-500 mt-3 text-center">
        🙏 Thank you for your generosity
      </p>
    </GlassCard>
  );
}
