interface ForwardTelemetryProps {
  tradeCount: number;
  minSample: number;
  calibrationLocked: boolean;
  calibrationReason: string;
  onRecalibrate?: () => void;
}

export function ForwardTelemetry({
  tradeCount,
  minSample,
  calibrationLocked,
  calibrationReason,
  onRecalibrate,
}: ForwardTelemetryProps) {
  const ratio = Math.min(tradeCount / minSample, 1);
  const pct = Math.min((tradeCount / minSample) * 100, 100);

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
        Forward Telemetry & Auto-Optimization
      </h3>

      <div className="space-y-3">
        {/* Sample size gate */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-dark-300">Sample Size Gate</span>
            <span className={`text-[10px] font-mono font-bold ${
              tradeCount >= minSample ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {tradeCount}/{minSample} trades
            </span>
          </div>
          <div className="relative h-2 bg-dark-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                tradeCount >= minSample
                  ? 'bg-emerald-500'
                  : 'bg-amber-500/70'
              }`}
              style={{ width: `${pct}%` }}
            />
            {/* Threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/30"
              style={{ left: '100%' }}
            />
          </div>
          {calibrationLocked ? (
            <p className="text-[9px] text-amber-400/70 mt-1.5">{calibrationReason}</p>
          ) : (
            <p className="text-[9px] text-emerald-400/70 mt-1.5">Sample size met — calibration available</p>
          )}
        </div>

        {/* Confidence interval indicator */}
        <div className="px-3 py-2 rounded-lg bg-dark-700/30 border border-dark-500">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-dark-400">Confidence</span>
            <span className="text-[9px] font-mono text-dark-300">
              {tradeCount >= minSample ? '95% CI' : 'Insufficient data'}
            </span>
          </div>
          {tradeCount >= minSample && (
            <div className="flex items-center gap-1 text-[9px] text-dark-400">
              <span className="text-emerald-400">✓</span> Stable estimates at n={tradeCount}
            </div>
          )}
        </div>

        {/* Auto-calibrate button */}
        <button
          onClick={onRecalibrate}
          disabled={calibrationLocked}
          className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all ${
            calibrationLocked
              ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
          }`}
        >
          ⚡ Auto-Calibrate Engine Weights
        </button>

        {/* Info */}
        <div className="text-[8px] text-dark-500 text-center leading-relaxed">
          Calibration requires {minSample} completed trades for the current market.
          Uses exponential smoothing (α=0.3) to prevent weight whiplash.
        </div>
      </div>
    </div>
  );
}
