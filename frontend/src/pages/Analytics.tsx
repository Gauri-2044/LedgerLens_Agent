// ============================================================
// LedgerLens AI — Analytics Page
// ============================================================
import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Zap, Bot, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { ErrorState } from '../components/ui/States';
import { mockMatchRateOverTime, mockProcessingVolume, mockExceptionBreakdown } from '../data/mockData';
import { formatPercent } from '../utils/format';

const PALETTE = ['#3b62f9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function MetricTile({
  label, value, unit, trend, icon, color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        {unit && <span className="text-sm text-slate-400 mb-0.5">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold mt-2 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          <TrendingUp size={11} />
          {trend >= 0 ? '+' : ''}{trend}% vs last month
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-5 h-28 animate-pulse bg-slate-50" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-64 animate-pulse bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Performance metrics and reconciliation insights.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <RefreshCw size={12} />
          Mock data — replace with /api/v1/analytics
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <MetricTile label="Overall Match Rate"       value="90.7" unit="%" trend={2.3}  icon={<TrendingUp size={16} className="text-emerald-600" />} color="bg-emerald-50" />
        <MetricTile label="Auto Match Precision"     value="76.5" unit="%" trend={1.2}  icon={<Zap size={16} className="text-primary-600" />}       color="bg-primary-50" />
        <MetricTile label="AI-Assisted Resolution"   value="16"   unit="%"  trend={0.8}  icon={<Bot size={16} className="text-indigo-600" />}        color="bg-indigo-50" />
        <MetricTile label="Exception Rate"           value="9.3"  unit="%" trend={-1.5} icon={<AlertTriangle size={16} className="text-amber-600" />} color="bg-amber-50" />
        <MetricTile label="Avg Processing Time"      value="2.1"  unit="s"  trend={-12}  icon={<Clock size={16} className="text-teal-600" />}        color="bg-teal-50" />
      </div>

      {/* Charts 2x2 Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Match Rate Over Time */}
        <ChartCard title="Match Rate Over Time" subtitle="6-month trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mockMatchRateOverTime} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => `${v}%`} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="rate"     name="Overall"   stroke="#3b62f9" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="autoRate" name="Automatic" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="aiRate"   name="AI-Assisted" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Exception Categories */}
        <ChartCard title="Exception Categories" subtitle="Distribution by type">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockExceptionBreakdown} layout="vertical" margin={{ top: 4, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                {mockExceptionBreakdown.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Auto vs AI Resolution */}
        <ChartCard title="Auto vs AI-Assisted Resolution" subtitle="Monthly comparison">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockMatchRateOverTime} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => `${v}%`} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="autoRate" name="Automatic" fill="#3b62f9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aiRate"   name="AI-Assisted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Processing Volume */}
        <ChartCard title="Processing Volume" subtitle="Records processed per month">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockProcessingVolume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="records" name="Records" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  );
}
