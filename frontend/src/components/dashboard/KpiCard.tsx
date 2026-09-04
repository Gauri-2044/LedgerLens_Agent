// ============================================================
// LedgerLens AI — KpiCard Component
// ============================================================
import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg?: string;
  trend?: number;        // positive = up, negative = down
  supportText?: string;
  valueColor?: string;
}

export default function KpiCard({
  label,
  value,
  icon,
  iconBg = 'bg-primary-50',
  trend,
  supportText,
  valueColor = 'text-slate-900',
}: KpiCardProps) {
  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;
  const trendNeutral  = trend !== undefined && trend === 0;

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-card-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end justify-between">
        <span className={`text-3xl font-bold leading-none ${valueColor}`}>{value}</span>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1 ${
            trendPositive ? 'text-emerald-700 bg-emerald-50' :
            trendNegative ? 'text-red-700 bg-red-50' :
            'text-slate-500 bg-slate-100'
          }`}>
            {trendPositive && <TrendingUp size={12} />}
            {trendNegative && <TrendingDown size={12} />}
            {trendNeutral  && <Minus size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Support text */}
      {supportText && (
        <p className="text-xs text-slate-500">{supportText}</p>
      )}
    </div>
  );
}
