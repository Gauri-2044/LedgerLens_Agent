// ============================================================
// LedgerLens AI — LoadingState & EmptyState & ErrorState
// ============================================================
import { Loader2, FileSearch, AlertCircle, RefreshCw } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  rows?: number;
}

export function LoadingState({ message = 'Loading...', rows = 5 }: LoadingStateProps) {
  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
        <Loader2 size={16} className="animate-spin text-primary-600" />
        <span>{message}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${40 + (i * 13) % 40}%` }} />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-20" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="overflow-hidden">
      {/* Header skeleton */}
      <div className="flex gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-200 rounded animate-pulse flex-1" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 px-4 py-3.5 border-b border-slate-100">
          {Array.from({ length: cols }).map((_, col) => (
            <div
              key={col}
              className="h-4 bg-slate-100 rounded animate-pulse flex-1"
              style={{ opacity: 1 - row * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No records found',
  description = 'There are no items to display. Try adjusting your filters.',
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
        {icon ?? <FileSearch size={22} className="text-slate-400" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-xs">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary btn-sm mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Failed to load data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
        <AlertCircle size={22} className="text-red-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-xs mb-4">{description}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm flex items-center gap-2">
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  );
}
