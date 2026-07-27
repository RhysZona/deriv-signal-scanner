import type { AnalyticsEngineOutput } from '../types';

interface AnalyticsEngineProps {
  analytics: AnalyticsEngineOutput | null;
  loading?: boolean;
}

const MODULE_NAMES: Record<string, { label: string; color: string; icon: string }> = {
  entropy: { label: 'Shannon Entropy', color: 'text-blue-400', icon: 'H' },
  runsTest: { label: 'Runs Test', color: 'text-purple-400', icon: 'R' },
  chiSquare: { label: 'Chi-Square', color: 'text-emerald-400', icon: 'χ²' },
  spoiler: { label: 'Digit Anomaly', color: 'text-amber-400', icon: '!' },
};

export function AnalyticsEnginePanel({ analytics, loading }: AnalyticsEngineProps) {
  if (loading) {
    return (
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
          Pattern Analytics
        </h3>
        <p className="text-[10px] text-dark-400 text-center py-4">
          Waiting for tick data to compute analytics...
        </p>
      </div>
    );
  }

  const modules = [
    { key: 'entropy', data: analytics.shannonEntropy },
    { key: 'runsTest', data: analytics.runsTest },
    { key: 'chiSquare', data: analytics.chiSquare },
    { key: 'spoiler', data: analytics.spoiler },
  ] as const;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">
          Pattern Analytics
        </h3>
        <div className="flex items-center gap-2">
          {analytics.qualityScore > 0 && (
            <span className={`text-[10px] font-bold ${
              analytics.qualityScore > 60 ? 'text-emerald-400' :
              analytics.qualityScore > 30 ? 'text-amber-400' :
              'text-dark-400'
            }`}>
              Q: {analytics.qualityScore}/100
            </span>
          )}
          <span className="text-[9px] text-dark-500">α=0.0125</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {modules.map(({ key, data }) => {
          const meta = MODULE_NAMES[key];
          return (
            <div
              key={key}
              className={`px-3 py-2.5 rounded-xl border transition-all ${
                data.isSignificant
                  ? 'bg-dark-700/80 border-emerald-700/40 shadow-sm shadow-emerald-500/5'
                  : 'bg-dark-700/30 border-dark-500'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-[9px] font-bold ${meta.color}`}>{meta.icon}</span>
                <span className="text-[9px] font-medium text-dark-300">{meta.label}</span>
              </div>
              <div className="text-sm font-bold font-mono text-white">
                {key === 'entropy'
                  ? `${data.metricValue.toFixed(2)}`
                  : key === 'runsTest'
                    ? (data as any).zScore?.toFixed(2) ?? data.metricValue.toFixed(2)
                    : data.metricValue.toFixed(2)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {data.isSignificant ? (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-900/20 px-1 py-0.5 rounded">
                    ✓ Significant
                  </span>
                ) : (
                  <span className="text-[8px] text-dark-400">p={data.pValue.toFixed(3)}</span>
                )}
                <span className="text-[8px] text-dark-500">
                  [{data.confidenceInterval[0].toFixed(2)}, {data.confidenceInterval[1].toFixed(2)}]
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="mt-3 flex items-center gap-3 text-[9px] text-dark-400">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${
            analytics.dominantParity === 'EVEN' ? 'bg-blue-400' :
            analytics.dominantParity === 'ODD' ? 'bg-amber-400' : 'bg-dark-400'
          }`} />
          {analytics.dominantParity} ({analytics.evenRatio}% / {analytics.oddRatio}%)
        </span>
        {analytics.significantModules.length === 0 && (
          <span className="text-dark-500 font-semibold">— NO SIGNAL —</span>
        )}
        {analytics.significantModules.length > 0 && (
          <span className="text-emerald-500/70">
            {analytics.significantModules.length} module{analytics.significantModules.length > 1 ? 's' : ''} flagged
          </span>
        )}
      </div>
    </div>
  );
}
