import type { AnalyticsEngineOutput } from '../types';

interface PatternReadProps {
  analytics: AnalyticsEngineOutput | null;
  totalSignals: number;
}

export function PatternRead({ analytics, totalSignals }: PatternReadProps) {
  if (!analytics) return null;

  const hasSignal = analytics.qualityScore > 0;
  const modulesActive = analytics.significantModules.length;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
        Comprehensive Pattern Read
      </h3>

      <div className="space-y-3">
        {/* Quality Score */}
        <div className="text-center">
          <div className={`text-4xl font-bold font-mono ${
            analytics.qualityScore > 60 ? 'text-emerald-400' :
            analytics.qualityScore > 30 ? 'text-amber-400' :
            'text-dark-400'
          }`}>
            {hasSignal ? analytics.qualityScore : '—'}
          </div>
          <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-1">
            {hasSignal ? 'Quality Score' : 'NO SIGNAL'}
          </div>
        </div>

        {/* Dominant Parity */}
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2 rounded-lg bg-dark-700/30 border border-dark-500 text-center">
            <div className={`text-lg font-bold font-mono ${
              analytics.dominantParity === 'EVEN' ? 'text-blue-400' :
              analytics.dominantParity === 'ODD' ? 'text-amber-400' :
              'text-dark-400'
            }`}>
              {analytics.dominantParity}
            </div>
            <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-0.5">
              Dominant Parity
            </div>
            <div className="flex items-center justify-center gap-2 mt-1 text-[9px] text-dark-300">
              <span>E: {analytics.evenRatio}%</span>
              <span>O: {analytics.oddRatio}%</span>
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-dark-700/30 border border-dark-500 text-center">
            <div className={`text-lg font-bold font-mono ${
              modulesActive > 2 ? 'text-emerald-400' :
              modulesActive > 0 ? 'text-amber-400' :
              'text-dark-400'
            }`}>
              {modulesActive}/{totalSignals > 0 ? '4' : '—'}
            </div>
            <div className="text-[9px] text-dark-400 uppercase tracking-wider mt-0.5">
              Modules Active
            </div>
            <div className="text-[9px] text-dark-500 mt-1">
              {modulesActive === 0 ? 'All tests passed H₀' : `${modulesActive} module${modulesActive > 1 ? 's' : ''} flagged`}
            </div>
          </div>
        </div>

        {/* Signal badges */}
        {analytics.significantModules.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {analytics.significantModules.includes('entropy') && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-900/30 text-blue-400 border border-blue-700/40">
                ⚡ STRUCTURE SHIFT
              </span>
            )}
            {analytics.significantModules.includes('runsTest') && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-purple-900/30 text-purple-400 border border-purple-700/40">
                ⚡ STREAK DETECTED
              </span>
            )}
            {analytics.significantModules.includes('chiSquare') && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-900/30 text-emerald-400 border border-emerald-700/40">
                ⚡ IMBALANCE
              </span>
            )}
            {analytics.significantModules.includes('spoiler') && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-900/30 text-amber-400 border border-amber-700/40">
                ⚠ SPOILER WARNING d{analytics.spoiler.spoilerDigit}
              </span>
            )}
          </div>
        )}

        {/* No signal */}
        {analytics.significantModules.length === 0 && (
          <div className="px-3 py-2 rounded-lg bg-dark-700/20 border border-dark-500">
            <p className="text-[10px] text-dark-400 text-center">
              No modules flag significant deviation at Bonferroni-corrected threshold (α=0.0125). Pattern appears consistent with random noise.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
