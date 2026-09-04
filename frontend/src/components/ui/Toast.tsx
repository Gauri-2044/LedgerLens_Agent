// ============================================================
// LedgerLens AI — Toast Component
// ============================================================
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { ToastMessage } from '../../types';

const icons: Record<ToastMessage['type'], React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
  error:   <XCircle    size={18} className="text-red-500 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
  info:    <Info       size={18} className="text-blue-500 shrink-0" />,
};

const borderColors: Record<ToastMessage['type'], string> = {
  success: 'border-l-emerald-500',
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const { removeToast } = useToast();
  return (
    <div
      className={`flex items-start gap-3 bg-white rounded-xl border border-slate-200 border-l-4 ${borderColors[toast.type]} shadow-card-lg p-4 min-w-[300px] max-w-[400px] animate-fade-in`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Toast() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
