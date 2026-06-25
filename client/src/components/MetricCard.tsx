import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  colorClass?: string;
}

export const MetricCard = React.memo(function MetricCard({ title, value, unit, icon, trend, trendLabel, colorClass = "text-accent" }: MetricCardProps) {
  return (
    <div className="glass-card p-5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-400 font-medium text-sm">{title}</h3>
        <div className={`p-2 rounded-lg bg-white/5 ${colorClass}`}>
          {icon}
        </div>
      </div>
      
      <div>
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-semibold text-white">{value}</span>
          {unit && <span className="text-slate-400 font-medium">{unit}</span>}
        </div>
        
        {trend !== undefined && (
          <div className="mt-2 flex items-center space-x-2 text-sm">
            <span className={trend >= 0 ? 'text-success' : 'text-danger'}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            {trendLabel && <span className="text-slate-500">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
});
