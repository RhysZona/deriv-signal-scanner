interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

export function SliderField({ label, value, min, max, step, prefix, suffix, onChange }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-dark-300">{label}</span>
          <span className="text-[11px] font-mono font-bold text-dark-200">
            {prefix ?? ''}{value}{suffix ?? ''}
          </span>
        </div>
      )}
      <div className="relative h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 appearance-none rounded-full bg-dark-600 outline-none
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-emerald-500/30
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-400
            [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #34d399 ${pct}%, #2a2a38 ${pct}%)`,
          }}
        />
      </div>
    </div>
  );
}
