// ============================================================
// LedgerLens AI — StatusBadge Component
// ============================================================
import type { ReconciliationStatus, ExceptionSeverity, ExceptionType } from '../../types';

interface StatusBadgeProps {
  status: ReconciliationStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const base = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  const map: Record<ReconciliationStatus, { label: string; cls: string }> = {
    MATCHED:      { label: 'Matched',      cls: 'badge-matched' },
    NEEDS_REVIEW: { label: 'Needs Review', cls: 'badge-review' },
    UNRESOLVED:   { label: 'Unresolved',   cls: 'badge-unresolved' },
  };

  const { label, cls } = map[status];
  return (
    <span className={`badge ${base} ${cls} font-semibold`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${
        status === 'MATCHED' ? 'bg-emerald-500' :
        status === 'NEEDS_REVIEW' ? 'bg-amber-500' : 'bg-red-500'
      }`} />
      {label}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: ExceptionSeverity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const map: Record<ExceptionSeverity, { label: string; cls: string }> = {
    LOW:      { label: 'Low',      cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    MEDIUM:   { label: 'Medium',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    HIGH:     { label: 'High',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    CRITICAL: { label: 'Critical', cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const { label, cls } = map[severity];
  return (
    <span className={`badge border text-xs font-semibold ${cls}`}>{label}</span>
  );
}

interface ExceptionTypeBadgeProps {
  type: ExceptionType;
}

export function ExceptionTypeBadge({ type }: ExceptionTypeBadgeProps) {
  const labels: Record<ExceptionType, string> = {
    AMOUNT_MISMATCH:     'Amount Mismatch',
    VENDOR_MISMATCH:     'Vendor Mismatch',
    MISSING_PAYMENT:     'Missing Payment',
    DUPLICATE_INVOICE:   'Duplicate Invoice',
    MISSING_PO:          'Missing PO',
    MULTIPLE_CANDIDATES: 'Multiple Candidates',
    DUPLICATE_LINK:      'Duplicate Link',
    MISSING_RECEIPT:     'Missing Receipt',
    DATE_GAP:            'Date Gap',
    INSUFFICIENT_EVIDENCE: 'Insufficient Evidence',
  };
  return (
    <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium">
      {labels[type]}
    </span>
  );
}

interface ConfidencePillProps {
  value: number;
}

export function ConfidencePill({ value }: ConfidencePillProps) {
  const cls =
    value >= 95 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    value >= 80 ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`badge border text-xs font-semibold ${cls}`}>{value}%</span>
  );
}
