// ============================================================
// LedgerLens AI — Dashboard Page
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie,
} from 'recharts';
import {
  FileText, CheckCircle2, Bot, Clock, AlertCircle,
  Percent, Upload, RefreshCw, TrendingUp,
} from 'lucide-react';
import KpiCard from '../components/dashboard/KpiCard';
import { StatusBadge, ConfidencePill } from '../components/ui/StatusBadge';
import { TableSkeleton, ErrorState } from '../components/ui/States';
import { getDashboardMetrics } from '../services/api';
import type { DashboardMetrics } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

const EXCEPTION_COLORS = ['#3b62f9', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#e0e7ff'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDashboardMetrics();
      if (res.success) {
        setMetrics(res.data);
        setLastUpdated('Just now');
      }
    } catch {
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening';

  if (error) return <ErrorState description={error} onRetry={fetchData} />;

  return (
    <div className="page-container">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, Finance Controller</h1>
          <p className="text-sm text-slate-500 mt-1">Here's the latest reconciliation overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <RefreshCw size={12} />
            Last updated: {lastUpdated}
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary"
          >
            <Upload size={15} />
            Upload Records
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 h-32 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <KpiCard
            label="Total Records"
            value={metrics.totalRecords}
            icon={<FileText size={16} className="text-primary-600" />}
            iconBg="bg-primary-50"
            trend={metrics.trends.totalRecords}
            supportText="This batch"
          />
          <KpiCard
            label="Auto Matched"
            value={metrics.automaticallyMatched}
            icon={<CheckCircle2 size={16} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            trend={metrics.trends.automaticallyMatched}
            supportText="No AI needed"
          />
          <KpiCard
            label="AI-Assisted"
            value={metrics.aiAssisted}
            icon={<Bot size={16} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
            trend={metrics.trends.aiAssisted}
            supportText="Investigated"
          />
          <KpiCard
            label="Needs Review"
            value={metrics.needsReview}
            icon={<Clock size={16} className="text-amber-600" />}
            iconBg="bg-amber-50"
            trend={metrics.trends.needsReview}
            supportText="Awaiting action"
            valueColor="text-amber-700"
          />
          <KpiCard
            label="Unresolved"
            value={metrics.unresolved}
            icon={<AlertCircle size={16} className="text-red-600" />}
            iconBg="bg-red-50"
            trend={metrics.trends.unresolved}
            supportText="Requires attention"
            valueColor="text-red-700"
          />
          <KpiCard
            label="Match Rate"
            value={`${metrics.matchRate}%`}
            icon={<Percent size={16} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            trend={metrics.trends.matchRate}
            supportText="↑ vs last batch"
            valueColor="text-emerald-700"
          />
        </div>
      )}

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

        {/* Reconciliation Overview Chart */}
        <div className="card xl:col-span-2 p-5">
          <div className="section-header">
            <div>
              <h2 className="section-title">Reconciliation Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">Records processed over the last 8 days</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-semibold">
              <TrendingUp size={12} />
              +{metrics?.trends.matchRate ?? 2.3}% vs last week
            </div>
          </div>

          {loading ? (
            <div className="h-56 bg-slate-50 rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metrics?.reconciliationOverview} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b62f9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b62f9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMatched" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  cursor={{ stroke: '#e2e8f0' }}
                />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Area type="monotone" dataKey="processed" name="Processed" stroke="#3b62f9" fill="url(#colorProcessed)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="matched"   name="Matched"   stroke="#10b981" fill="url(#colorMatched)"   strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="needsReview" name="Needs Review" stroke="#f59e0b" fill="url(#colorReview)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Exception Breakdown */}
        <div className="card p-5">
          <div className="section-header">
            <div>
              <h2 className="section-title">Exception Breakdown</h2>
              <p className="text-xs text-slate-500 mt-0.5">By category</p>
            </div>
          </div>

          {loading ? (
            <div className="h-56 bg-slate-50 rounded-lg animate-pulse" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={metrics?.exceptionBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="count"
                    nameKey="type"
                    paddingAngle={2}
                  >
                    {metrics?.exceptionBreakdown.map((_, i) => (
                      <Cell key={i} fill={EXCEPTION_COLORS[i % EXCEPTION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-1">
                {metrics?.exceptionBreakdown.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EXCEPTION_COLORS[i] }} />
                      <span className="text-xs text-slate-600 truncate max-w-[130px]">{item.type}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Recent Investigations ───────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="section-title">Recent Investigations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest cases processed by LedgerLens AI</p>
          </div>
          <button
            onClick={() => navigate('/reconciliation')}
            className="btn-secondary btn-sm"
          >
            View All
          </button>
        </div>

        {loading ? (
          <TableSkeleton cols={7} rows={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.recentInvestigations.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/investigation/${c.id}`)}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        {c.id}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{c.invoiceNumber}</td>
                    <td className="max-w-[180px] truncate text-slate-700 font-medium">{c.vendorName}</td>
                    <td className="font-semibold text-slate-800">{formatCurrency(c.invoiceAmount)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      {c.matchScore !== undefined
                        ? <ConfidencePill value={c.matchScore} />
                        : <span className="text-slate-400 text-xs">—</span>
                      }
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(c.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
