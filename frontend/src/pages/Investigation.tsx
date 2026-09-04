// ============================================================
// LedgerLens AI — Investigation Page
// ============================================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Info,
  Building2, FileText, CreditCard, Receipt, Bot, Clock,
  ShieldCheck, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { StatusBadge, ConfidencePill, SeverityBadge, ExceptionTypeBadge } from '../components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../components/ui/States';
import { getInvestigation, updateCaseStatus } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { ReconciliationCase, Evidence } from '../types';
import { formatCurrency, formatTime } from '../utils/format';

// ── Evidence Icon ────────────────────────────────────────────
function EvidenceIcon({ status }: { status: Evidence['status'] }) {
  if (status === 'CONFIRMED') return <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />;
  if (status === 'WARNING')   return <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />;
  if (status === 'FAILED')    return <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />;
  return <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />;
}

// ── Source Card ──────────────────────────────────────────────
function SourceCard({
  title,
  icon,
  color,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  rows: { label: string; value: string; mono?: boolean; highlight?: boolean }[];
}) {
  return (
    <div className="card p-4 flex-1 min-w-[200px]">
      <div className={`flex items-center gap-2 mb-3 pb-3 border-b border-slate-100`}>
        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs font-semibold text-slate-700">{title}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i}>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{row.label}</p>
            <p className={`text-sm mt-0.5 ${row.mono ? 'font-mono' : ''} ${row.highlight ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Investigation() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [caseData, setCaseData] = useState<ReconciliationCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<ReconciliationCase['status'] | null>(null);

  const fetchCase = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getInvestigation(caseId);
      if (res.success) {
        setCaseData(res.data);
        setLocalStatus(res.data.status);
      } else {
        setError(res.message ?? 'Case not found');
      }
    } catch {
      setError('Failed to load investigation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCase(); }, [caseId]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!caseData) return;
    try {
      setActionLoading(true);
      const newStatus = action === 'approve' ? 'MATCHED' : 'UNRESOLVED';
      const res = await updateCaseStatus(caseData.id, newStatus);
      if (res.success) {
        setLocalStatus(newStatus);
        addToast({
          type: action === 'approve' ? 'success' : 'warning',
          title: action === 'approve' ? 'Match Approved' : 'Match Rejected',
          message: action === 'approve'
            ? `Case ${caseData.id} has been approved and marked as Matched.`
            : `Case ${caseData.id} has been rejected and marked as Unresolved.`,
        });
        addToast({
          type: 'info',
          title: 'Audit Event Created',
          message: `Audit log entry added for ${caseData.id}`,
          duration: 5000,
        });
      }
    } catch {
      addToast({ type: 'error', title: 'Action Failed', message: 'Could not update case status.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="page-container">
      <LoadingState message="Loading investigation data..." rows={8} />
    </div>
  );

  if (error || !caseData) return (
    <div className="page-container">
      <ErrorState description={error ?? 'Case not found'} onRetry={fetchCase} />
    </div>
  );

  const inv = caseData.investigation;
  const status = localStatus ?? caseData.status;
  const actionDone = localStatus === 'MATCHED' || localStatus === 'UNRESOLVED';

  return (
    <div className="page-container max-w-[1200px]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => navigate('/reconciliation')}
          className="btn-ghost btn-sm mt-1 shrink-0"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Investigation Case {caseData.id}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-slate-500">{caseData.vendorName} · {caseData.invoiceNumber}</p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-slate-500 font-medium">Confidence</span>
          {inv && <ConfidencePill value={inv.confidence} />}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left Column ─────────────────────────────────── */}
        <div className="xl:col-span-2 flex flex-col gap-6">

          {/* Source Document Cards */}
          <div>
            <h2 className="section-title mb-3">Record Comparison</h2>
            <div className="flex flex-wrap gap-3">
              <SourceCard
                title="Purchase Order"
                icon={<Building2 size={14} className="text-primary-600" />}
                color="bg-primary-50"
                rows={[
                  { label: 'PO Number', value: caseData.poNumber ?? '—', mono: true },
                  { label: 'Vendor', value: caseData.purchaseOrder?.vendorName ?? caseData.vendorName },
                  { label: 'Amount', value: formatCurrency(caseData.purchaseOrder?.amount ?? caseData.invoiceAmount), highlight: true },
                ]}
              />
              <SourceCard
                title="Invoice"
                icon={<FileText size={14} className="text-indigo-600" />}
                color="bg-indigo-50"
                rows={[
                  { label: 'Invoice No', value: caseData.invoiceNumber, mono: true },
                  { label: 'Vendor', value: caseData.invoice?.vendorName ?? caseData.vendorName },
                  { label: 'Amount', value: formatCurrency(caseData.invoiceAmount), highlight: true },
                ]}
              />
              <SourceCard
                title="Payment"
                icon={<CreditCard size={14} className="text-emerald-600" />}
                color="bg-emerald-50"
                rows={[
                  { label: 'Source', value: caseData.payment?.source ?? 'RazorpayX', mono: true },
                  { label: 'Amount', value: caseData.paymentAmount !== undefined ? formatCurrency(caseData.paymentAmount) : '—', highlight: true },
                  { label: 'Status', value: caseData.payment?.status ?? 'Processed' },
                ]}
              />
              <SourceCard
                title="Receipt"
                icon={<Receipt size={14} className="text-amber-600" />}
                color="bg-amber-50"
                rows={[
                  { label: 'Service Received', value: caseData.receipt?.serviceReceived ? 'Yes ✓' : 'Not confirmed' },
                  { label: 'Received Date', value: caseData.receipt?.receivedDate ?? '—' },
                  { label: 'Confirmed By', value: caseData.receipt?.confirmedBy ?? '—' },
                ]}
              />
            </div>
          </div>

          {/* AI Investigation Panel */}
          {inv && (
            <div className="card overflow-hidden border-primary-200">
              {/* Panel Header */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Bot size={16} className="text-primary-200" />
                  <span className="text-xs font-semibold text-primary-200 uppercase tracking-widest">LedgerLens AI Investigation</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white text-sm font-semibold">Decision:</span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                      status === 'MATCHED' ? 'bg-emerald-400 text-white' :
                      status === 'NEEDS_REVIEW' ? 'bg-amber-400 text-white' :
                      'bg-red-400 text-white'
                    }`}>
                      {status === 'MATCHED' ? 'MATCHED' :
                       status === 'NEEDS_REVIEW' ? 'NEEDS REVIEW' : 'UNRESOLVED'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-primary-200">Confidence</p>
                    <p className="text-lg font-bold text-white">{inv.confidence}%</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Reasoning */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Reasoning</h3>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-200">
                    {inv.reasoning}
                  </p>
                </div>

                {/* Evidence */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidence Summary</h3>
                  <div className="space-y-2">
                    {inv.evidence.map(e => (
                      <div
                        key={e.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                          e.status === 'CONFIRMED' ? 'bg-emerald-50 border-emerald-200' :
                          e.status === 'WARNING'   ? 'bg-amber-50 border-amber-200' :
                          e.status === 'FAILED'    ? 'bg-red-50 border-red-200' :
                          'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <EvidenceIcon status={e.status} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            e.status === 'CONFIRMED' ? 'text-emerald-800' :
                            e.status === 'WARNING'   ? 'text-amber-800' :
                            e.status === 'FAILED'    ? 'text-red-800' :
                            'text-slate-700'
                          }`}>{e.label}</p>
                          {e.detail && <p className="text-xs text-slate-500 mt-0.5">{e.detail}</p>}
                        </div>
                        {e.confidence !== undefined && (
                          <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5 shrink-0">
                            {e.confidence}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exception */}
                {inv.exceptionType && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Exception Details</h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Type</p>
                        <div className="mt-1"><ExceptionTypeBadge type={inv.exceptionType} /></div>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Expected</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatCurrency(inv.expectedValue ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Actual</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatCurrency(inv.actualValue ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Variance</p>
                        <p className="text-sm font-bold text-amber-700 mt-0.5">₹{inv.variance}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-4 flex items-center gap-2 pt-1 border-t border-amber-200 mt-1">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">Severity:</span>
                        {inv.severity && <SeverityBadge severity={inv.severity} />}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommended Action & Buttons */}
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <ShieldCheck size={16} className="text-primary-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary-800">Recommended Action</p>
                      <p className="text-sm text-primary-700 mt-0.5">{inv.recommendedAction}</p>
                    </div>
                  </div>

                  {actionDone ? (
                    <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                      localStatus === 'MATCHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {localStatus === 'MATCHED'
                        ? <><CheckCircle2 size={15} /> Case approved — marked as Matched</>
                        : <><XCircle size={15} /> Case rejected — marked as Unresolved</>
                      }
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAction('approve')}
                        disabled={actionLoading}
                        className="btn-success flex-1"
                      >
                        <ThumbsUp size={14} />
                        Approve Match
                      </button>
                      <button
                        onClick={() => handleAction('reject')}
                        disabled={actionLoading}
                        className="btn-danger flex-1"
                      >
                        <ThumbsDown size={14} />
                        Reject Match
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column — Audit Timeline ─────────────────── */}
        <div className="xl:col-span-1">
          <div className="card p-5 sticky top-24">
            <h2 className="section-title mb-4">
              <Clock size={16} className="inline mr-2 text-slate-400" />
              Audit Timeline
            </h2>
            <div className="space-y-0">
              {(caseData.auditLogs ?? []).map((log, i) => (
                <div key={log.id} className={`relative pl-7 ${i < (caseData.auditLogs?.length ?? 0) - 1 ? 'pb-4' : ''}`}>
                  {/* Connector line */}
                  {i < (caseData.auditLogs?.length ?? 0) - 1 && (
                    <div className="absolute left-[10px] top-5 bottom-0 w-px bg-slate-200" />
                  )}
                  {/* Dot */}
                  <div className={`absolute left-0 top-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                    log.actor === 'LedgerLens AI' ? 'bg-primary-500' :
                    log.actor === 'Finance Controller' ? 'bg-emerald-500' :
                    'bg-slate-400'
                  }`}>
                    {log.actor === 'LedgerLens AI' ? <Bot size={9} className="text-white" /> :
                     log.actor === 'Finance Controller' ? <CheckCircle2 size={9} className="text-white" /> :
                     <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-800">{log.action}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatTime(log.timestamp)}</p>
                    {log.result && log.result !== 'SUCCESS' && log.result !== 'STARTED' && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]" title={log.result}>
                        {log.result}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
