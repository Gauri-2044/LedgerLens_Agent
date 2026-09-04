// ============================================================
// LedgerLens AI — Reconciliation Page
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Play, ChevronLeft, ChevronRight, ArrowUpDown, ExternalLink } from 'lucide-react';
import { StatusBadge, ConfidencePill, ExceptionTypeBadge } from '../components/ui/StatusBadge';
import { TableSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { getReconciliationCases, runReconciliation } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { ReconciliationCase, ReconciliationStatus, FilterState, PaginationState } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

type SortField = 'id' | 'vendorName' | 'invoiceAmount' | 'matchScore' | 'lastUpdated';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS: { label: string; value: ReconciliationStatus | '' }[] = [
  { label: 'All Statuses', value: '' },
  { label: 'Matched',      value: 'MATCHED' },
  { label: 'Needs Review', value: 'NEEDS_REVIEW' },
  { label: 'Unresolved',   value: 'UNRESOLVED' },
];

export default function Reconciliation() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [cases, setCases] = useState<ReconciliationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [filters, setFilters] = useState<Partial<FilterState>>({ search: '', status: '' });
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 10, total: 0 });
  const [sortField, setSortField] = useState<SortField>('lastUpdated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getReconciliationCases(filters, pagination);
      if (res.success) {
        setCases(res.data);
        if (res.pagination) setPagination(p => ({ ...p, total: res.pagination!.total }));
      }
    } catch {
      setError('Failed to load reconciliation cases');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize]);

  useEffect(() => { fetchCases(); }, [filters, pagination.page]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleRunReconciliation = async () => {
    try {
      setRunning(true);
      const res = await runReconciliation();
      if (res.success) {
        addToast({ type: 'success', title: 'Reconciliation Started', message: res.data.message });
        setTimeout(fetchCases, 1500);
      }
    } catch {
      addToast({ type: 'error', title: 'Error', message: 'Failed to start reconciliation' });
    } finally {
      setRunning(false);
    }
  };

  const sortedCases = [...cases].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortField === 'id')           { av = a.id;            bv = b.id; }
    if (sortField === 'vendorName')   { av = a.vendorName;    bv = b.vendorName; }
    if (sortField === 'invoiceAmount'){ av = a.invoiceAmount; bv = b.invoiceAmount; }
    if (sortField === 'matchScore')   { av = a.matchScore ?? 0; bv = b.matchScore ?? 0; }
    if (sortField === 'lastUpdated')  { av = a.lastUpdated;   bv = b.lastUpdated; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-300 inline ml-1" />;
    return (
      <ArrowUpDown size={12} className={`inline ml-1 ${sortDir === 'asc' ? 'text-primary-500' : 'text-primary-700'}`} />
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  if (error) return (
    <div className="page-container">
      <ErrorState description={error} onRetry={fetchCases} />
    </div>
  );

  return (
    <div className="page-container">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage financial record matching.</p>
        </div>
        <button
          onClick={handleRunReconciliation}
          disabled={running}
          className="btn-primary"
        >
          <Play size={15} className={running ? 'animate-spin' : ''} />
          {running ? 'Running...' : 'Run Reconciliation'}
        </button>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="card px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px] focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by Case ID, Invoice, Vendor..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value as ReconciliationStatus | '' }))}
            className="select text-xs py-1.5 pr-7 w-36"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <select className="select text-xs py-1.5 pr-7 w-36">
          <option>All Sources</option>
          <option>CSV Import</option>
          <option>XLSX Import</option>
          <option>RazorpayX</option>
          <option>JSON Import</option>
        </select>

        <input type="date" className="input text-xs py-1.5 w-36" />

        <div className="text-xs text-slate-500 ml-auto hidden sm:block">
          {pagination.total} records
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton cols={9} rows={8} />
        ) : sortedCases.length === 0 ? (
          <EmptyState
            title="No cases found"
            description="No reconciliation cases match your current filters."
            action={{ label: 'Clear Filters', onClick: () => setFilters({ search: '', status: '' }) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('id')} className="cursor-pointer select-none hover:text-slate-700">
                    Case ID <SortIcon field="id" />
                  </th>
                  <th>Invoice</th>
                  <th onClick={() => handleSort('vendorName')} className="cursor-pointer select-none hover:text-slate-700">
                    Vendor <SortIcon field="vendorName" />
                  </th>
                  <th>PO</th>
                  <th onClick={() => handleSort('invoiceAmount')} className="cursor-pointer select-none hover:text-slate-700">
                    Inv. Amount <SortIcon field="invoiceAmount" />
                  </th>
                  <th>Pay. Amount</th>
                  <th onClick={() => handleSort('matchScore')} className="cursor-pointer select-none hover:text-slate-700">
                    Score <SortIcon field="matchScore" />
                  </th>
                  <th>Status</th>
                  <th onClick={() => handleSort('lastUpdated')} className="cursor-pointer select-none hover:text-slate-700">
                    Updated <SortIcon field="lastUpdated" />
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedCases.map(c => (
                  <tr key={c.id} onClick={() => navigate(`/investigation/${c.id}`)}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        {c.id}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{c.invoiceNumber}</td>
                    <td className="max-w-[160px]">
                      <p className="truncate font-medium text-slate-800 text-xs">{c.vendorName}</p>
                      {c.exceptionType && (
                        <div className="mt-0.5">
                          <ExceptionTypeBadge type={c.exceptionType} />
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-xs text-slate-500">{c.poNumber ?? '—'}</td>
                    <td className="font-semibold text-slate-800 text-sm">{formatCurrency(c.invoiceAmount)}</td>
                    <td className="text-slate-700">
                      {c.paymentAmount !== undefined
                        ? formatCurrency(c.paymentAmount)
                        : <span className="text-slate-400 text-xs">—</span>
                      }
                    </td>
                    <td>
                      {c.matchScore !== undefined
                        ? <ConfidencePill value={c.matchScore} />
                        : <span className="text-slate-400 text-xs">—</span>
                      }
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(c.lastUpdated)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/investigation/${c.id}`)}
                        className="btn-secondary btn-sm flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && sortedCases.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-secondary btn-sm"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPagination(p => ({ ...p, page: i + 1 }))}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    pagination.page === i + 1
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="btn-secondary btn-sm"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
