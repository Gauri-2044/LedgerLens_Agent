// ============================================================
// LedgerLens AI — Exceptions Page
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, AlertTriangle, TrendingDown, ExternalLink } from 'lucide-react';
import { StatusBadge, SeverityBadge, ExceptionTypeBadge } from '../components/ui/StatusBadge';
import { TableSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { getExceptions } from '../services/api';
import type { Exception, FilterState, ExceptionSeverity, ExceptionType } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

const SEVERITY_OPTIONS: { label: string; value: ExceptionSeverity | '' }[] = [
  { label: 'All Severities', value: '' },
  { label: 'Low',      value: 'LOW' },
  { label: 'Medium',   value: 'MEDIUM' },
  { label: 'High',     value: 'HIGH' },
  { label: 'Critical', value: 'CRITICAL' },
];

const EXCEPTION_TYPE_OPTIONS: { label: string; value: ExceptionType | '' }[] = [
  { label: 'All Types',           value: '' },
  { label: 'Amount Mismatch',     value: 'AMOUNT_MISMATCH' },
  { label: 'Vendor Mismatch',     value: 'VENDOR_MISMATCH' },
  { label: 'Missing Payment',     value: 'MISSING_PAYMENT' },
  { label: 'Duplicate Invoice',   value: 'DUPLICATE_INVOICE' },
  { label: 'Missing PO',          value: 'MISSING_PO' },
  { label: 'Multiple Candidates', value: 'MULTIPLE_CANDIDATES' },
];

export default function Exceptions() {
  const navigate = useNavigate();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Partial<FilterState>>({
    search: '',
    severity: '',
    exceptionType: '',
    status: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getExceptions(filters);
      if (res.success) setExceptions(res.data);
    } catch {
      setError('Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

  // Summary stats
  const total    = exceptions.length;
  const review   = exceptions.filter(e => e.status === 'NEEDS_REVIEW').length;
  const unresolved = exceptions.filter(e => e.status === 'UNRESOLVED').length;
  const low      = exceptions.filter(e => e.severity === 'LOW').length;

  if (error) return (
    <div className="page-container">
      <ErrorState description={error} onRetry={fetchData} />
    </div>
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exception Center</h1>
          <p className="text-sm text-slate-500 mt-1">Review and resolve flagged reconciliation issues.</p>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Exceptions', value: total, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Needs Review',     value: review, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Unresolved',       value: unresolved, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Low Severity',     value: low, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map(tile => (
          <div key={tile.label} className={`card p-4 ${tile.bg}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{tile.label}</p>
            <p className={`text-2xl font-bold mt-1 ${tile.color}`}>{tile.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px] focus-within:border-primary-400 transition-all">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by Case ID or Vendor..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filters.severity}
            onChange={e => setFilters(f => ({ ...f, severity: e.target.value as ExceptionSeverity | '' }))}
            className="select text-xs py-1.5 pr-7 w-36"
          >
            {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <select
          value={filters.exceptionType}
          onChange={e => setFilters(f => ({ ...f, exceptionType: e.target.value as ExceptionType | '' }))}
          className="select text-xs py-1.5 pr-7 w-44"
        >
          {EXCEPTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}
          className="select text-xs py-1.5 pr-7 w-36"
        >
          <option value="">All Statuses</option>
          <option value="NEEDS_REVIEW">Needs Review</option>
          <option value="UNRESOLVED">Unresolved</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton cols={7} rows={5} />
        ) : exceptions.length === 0 ? (
          <EmptyState
            title="No exceptions found"
            description="No exception records match your filters."
            action={{ label: 'Clear Filters', onClick: () => setFilters({ search: '', severity: '', exceptionType: '', status: '' }) }}
            icon={<AlertTriangle size={20} className="text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Exception Type</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Severity</th>
                  <th>Detected</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map(ex => (
                  <tr key={ex.id} onClick={() => navigate(`/investigation/${ex.caseId}`)}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        {ex.caseId}
                      </span>
                    </td>
                    <td><ExceptionTypeBadge type={ex.type} /></td>
                    <td className="max-w-[160px]">
                      <p className="truncate text-slate-800 font-medium text-xs">{ex.vendorName}</p>
                      {ex.description && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{ex.description}</p>
                      )}
                    </td>
                    <td className="font-semibold text-slate-800">{formatCurrency(ex.amount)}</td>
                    <td><SeverityBadge severity={ex.severity} /></td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(ex.detectedAt)}</td>
                    <td><StatusBadge status={ex.status} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/investigation/${ex.caseId}`)}
                        className="btn-secondary btn-sm flex items-center gap-1"
                      >
                        <ExternalLink size={11} />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Variance Summary at bottom */}
      {!loading && exceptions.some(e => e.variance) && (
        <div className="mt-4 card p-4 flex items-center gap-3 bg-amber-50 border-amber-200">
          <TrendingDown size={16} className="text-amber-600 shrink-0" />
          <div className="text-xs text-amber-800">
            <strong>Total variance across all exceptions: </strong>
            {formatCurrency(exceptions.reduce((sum, e) => sum + (e.variance ?? 0), 0))}
          </div>
        </div>
      )}
    </div>
  );
}
