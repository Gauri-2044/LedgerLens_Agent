// ============================================================
// LedgerLens AI — Sources Page (Stub)
// ============================================================
import { Database, Plus, CheckCircle2, Clock, XCircle } from 'lucide-react';

const sources = [
  { name: 'RazorpayX Payouts',  type: 'API',    status: 'CONNECTED', lastSync: '2m ago',    records: 48 },
  { name: 'CSV File Upload',     type: 'File',   status: 'ACTIVE',    lastSync: '18:31 today', records: 150 },
  { name: 'XLSX File Upload',    type: 'File',   status: 'ACTIVE',    lastSync: '18:25 today', records: 62 },
  { name: 'GSTR-2B Portal',      type: 'API',    status: 'PENDING',   lastSync: 'Never',     records: 0 },
  { name: 'ERP Integration',     type: 'API',    status: 'ERROR',     lastSync: '—',         records: 0 },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'CONNECTED' || status === 'ACTIVE')
    return <CheckCircle2 size={15} className="text-emerald-500" />;
  if (status === 'PENDING')
    return <Clock size={15} className="text-amber-500" />;
  return <XCircle size={15} className="text-red-500" />;
}

export default function Sources() {
  return (
    <div className="page-container max-w-[900px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
          <p className="text-sm text-slate-500 mt-1">Connected financial data integrations.</p>
        </div>
        <button className="btn-primary">
          <Plus size={14} />
          Add Source
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Sync</th>
              <th>Records</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.name}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Database size={13} className="text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-800">{s.name}</span>
                  </div>
                </td>
                <td>
                  <span className="badge bg-slate-100 text-slate-600 border border-slate-200 text-xs">{s.type}</span>
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={s.status} />
                    <span className={`text-xs font-medium ${
                      s.status === 'CONNECTED' || s.status === 'ACTIVE' ? 'text-emerald-700' :
                      s.status === 'PENDING' ? 'text-amber-700' : 'text-red-700'
                    }`}>{s.status}</span>
                  </div>
                </td>
                <td className="text-xs text-slate-500">{s.lastSync}</td>
                <td className="font-semibold text-slate-700">{s.records > 0 ? s.records.toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
