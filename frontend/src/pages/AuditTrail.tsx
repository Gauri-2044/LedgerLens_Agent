// ============================================================
// LedgerLens AI — Audit Trail Page
// ============================================================
import { useState, useEffect } from 'react';
import { Search, Filter, Bot, User, Cpu, Clock, Download } from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { getAuditLogs } from '../services/api';
import type { AuditLog, FilterState } from '../types';
import { formatDate, formatTime } from '../utils/format';

const STAGE_OPTIONS = [
  '', 'Ingestion', 'Normalization', 'Matching', 'AI Investigation', 'Validation', 'Review',
];

const ACTOR_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Actors',       value: '' },
  { label: 'System',           value: 'System' },
  { label: 'LedgerLens AI',    value: 'LedgerLens AI' },
  { label: 'Finance Controller', value: 'Finance Controller' },
];

function ActorChip({ actor }: { actor: AuditLog['actor'] }) {
  const map: Record<AuditLog['actor'], { cls: string; icon: React.ReactNode }> = {
    'System': {
      cls: 'bg-slate-100 text-slate-600',
      icon: <Cpu size={11} />,
    },
    'LedgerLens AI': {
      cls: 'bg-primary-50 text-primary-700',
      icon: <Bot size={11} />,
    },
    'Finance Controller': {
      cls: 'bg-emerald-50 text-emerald-700',
      icon: <User size={11} />,
    },
  };
  const { cls, icon } = map[actor];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {icon}{actor}
    </span>
  );
}

function StageChip({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    'Ingestion': 'bg-blue-50 text-blue-700',
    'Normalization': 'bg-indigo-50 text-indigo-700',
    'Matching': 'bg-violet-50 text-violet-700',
    'AI Investigation': 'bg-primary-50 text-primary-700',
    'Validation': 'bg-teal-50 text-teal-700',
    'Review': 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[stage] ?? 'bg-slate-100 text-slate-600'}`}>
      {stage}
    </span>
  );
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Partial<FilterState>>({ search: '', stage: '', actor: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAuditLogs(filters);
      if (res.success) setLogs(res.data);
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

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
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">Every reconciliation decision is traceable.</p>
        </div>
        <button className="btn-secondary">
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Principle Banner */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
        <Clock size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600">
          <strong className="text-slate-800">Immutable audit log.</strong> All actions — automated or human —
          are recorded with timestamps, actors, and outcomes. This log is append-only and cannot be modified.
        </p>
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px] focus-within:border-primary-400 transition-all">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by Case ID, action, stage..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filters.stage}
            onChange={e => setFilters(f => ({ ...f, stage: e.target.value }))}
            className="select text-xs py-1.5 pr-7 w-40"
          >
            {STAGE_OPTIONS.map(s => (
              <option key={s} value={s}>{s || 'All Stages'}</option>
            ))}
          </select>
        </div>

        <select
          value={filters.actor}
          onChange={e => setFilters(f => ({ ...f, actor: e.target.value }))}
          className="select text-xs py-1.5 pr-7 w-44"
        >
          {ACTOR_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input type="date" className="input text-xs py-1.5 w-36" />

        <span className="text-xs text-slate-400 ml-auto hidden sm:block">{logs.length} entries</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton cols={6} rows={8} />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description="No audit log entries match your current filters."
            action={{ label: 'Clear Filters', onClick: () => setFilters({ search: '', stage: '', actor: '' }) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Case ID</th>
                  <th>Stage</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">
                      <p className="font-mono text-xs text-slate-700">{formatTime(log.timestamp)}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(log.timestamp).split(',')[0]}</p>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        {log.caseId}
                      </span>
                    </td>
                    <td><StageChip stage={log.stage} /></td>
                    <td className="text-slate-700 font-medium text-xs max-w-[200px] truncate">
                      {log.action}
                    </td>
                    <td><ActorChip actor={log.actor} /></td>
                    <td className="text-xs text-slate-500 max-w-[200px] truncate" title={String(log.result)}>
                      {String(log.result)}
                    </td>
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
