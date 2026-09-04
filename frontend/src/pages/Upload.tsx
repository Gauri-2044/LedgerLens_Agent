// ============================================================
// LedgerLens AI — Upload & Ingestion Page
// ============================================================
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, CreditCard, Building2, Receipt,
  CheckCircle2, AlertTriangle, Loader2, ArrowRight,
  X, File, Info,
} from 'lucide-react';
import { uploadRecords } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { UploadedFile } from '../types';
import { formatFileSize } from '../utils/format';

type Category = UploadedFile['category'];

interface UploadZoneProps {
  category: Category;
  label: string;
  icon: React.ReactNode;
  color: string;
  file: UploadedFile | null;
  onFile: (file: File, category: Category) => void;
}

const STAGE_LABELS: Record<UploadedFile['status'], string> = {
  UPLOADING:   'Uploading...',
  PARSING:     'Parsing records...',
  NORMALIZING: 'Normalizing data...',
  VALIDATING:  'Validating fields...',
  READY:       'Ready',
  ERROR:       'Error',
};

const STAGE_ORDER: UploadedFile['status'][] = ['UPLOADING', 'PARSING', 'NORMALIZING', 'VALIDATING', 'READY'];

function StageProgress({ current }: { current: UploadedFile['status'] }) {
  const idx = STAGE_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-1 mt-3">
      {STAGE_ORDER.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i < idx  ? 'bg-emerald-500' :
            i === idx && stage !== 'READY' ? 'bg-primary-500 animate-pulse' :
            stage === 'READY' && current === 'READY' ? 'bg-emerald-500' :
            'bg-slate-200'
          }`} />
          {i < STAGE_ORDER.length - 1 && (
            <div className={`h-px w-6 transition-all duration-300 ${i < idx || (i === idx && current === 'READY') ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
      <span className="text-xs text-slate-500 ml-2">{STAGE_LABELS[current]}</span>
    </div>
  );
}

function UploadZone({ category, label, icon, color, file, onFile }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f, category);
  }, [category, onFile]);

  const ACCEPTED = '.csv,.xlsx,.xls,.json';

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${color}`}>
        <div className="w-8 h-8 bg-white/80 rounded-lg flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-[10px] text-slate-500">CSV, XLSX, JSON • PDF coming soon</p>
        </div>
      </div>

      {/* Drop Area */}
      <div className="p-4">
        {!file ? (
          <div
            className={`dropzone ${dragging ? 'active' : ''}`}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Drop file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Accepted: {ACCEPTED.toUpperCase()}</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onFile(f, category);
              }}
            />
          </div>
        ) : (
          <div>
            {/* File info */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <File size={20} className="text-primary-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                <StageProgress current={file.status} />
              </div>
            </div>

            {/* Results */}
            {file.status === 'READY' && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 size={13} />
                  <span>Parsed successfully</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 size={13} />
                  <span>Required fields detected</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 size={13} />
                  <span><strong>{file.validRecords}</strong> valid records</span>
                </div>
                {(file.warningRecords ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    <AlertTriangle size={13} />
                    <span><strong>{file.warningRecords}</strong> records require attention</span>
                  </div>
                )}
                {file.warnings && file.warnings.length > 0 && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    {file.warnings.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-700 flex items-start gap-1">
                        <Info size={11} className="mt-0.5 shrink-0" />{w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {file.status !== 'READY' && file.status !== 'ERROR' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={12} className="animate-spin" />
                Processing...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ZONES: { category: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { category: 'PURCHASE_ORDER', label: 'Purchase Orders', icon: <Building2 size={16} className="text-primary-600" />, color: 'bg-primary-50/60' },
  { category: 'INVOICE',        label: 'Invoices',        icon: <FileText   size={16} className="text-indigo-600"  />, color: 'bg-indigo-50/60' },
  { category: 'PAYMENT',        label: 'Payments',        icon: <CreditCard size={16} className="text-emerald-600"/>, color: 'bg-emerald-50/60' },
  { category: 'RECEIPT',        label: 'Receipts',        icon: <Receipt    size={16} className="text-amber-600"  />, color: 'bg-amber-50/60' },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<Record<Category, UploadedFile | null>>({
    PURCHASE_ORDER: null,
    INVOICE: null,
    PAYMENT: null,
    RECEIPT: null,
  });

  const handleFile = async (file: File, category: Category) => {
    // Initialize file entry
    setUploadedFiles(prev => ({
      ...prev,
      [category]: {
        id: `tmp-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        category,
        status: 'UPLOADING',
        progress: 0,
        uploadedAt: new Date().toISOString(),
      } as UploadedFile,
    }));

    try {
      await uploadRecords(file, category, (status, progress) => {
        setUploadedFiles(prev => ({
          ...prev,
          [category]: prev[category] ? { ...prev[category]!, status, progress } : null,
        }));
      });

      // Fetch final result
      const result = await uploadRecords(file, category, () => {});
      setUploadedFiles(prev => ({
        ...prev,
        [category]: result.data,
      }));

      addToast({ type: 'success', title: 'File Ready', message: `${file.name} processed successfully.` });
    } catch {
      addToast({ type: 'error', title: 'Upload Failed', message: `Failed to process ${file.name}` });
      setUploadedFiles(prev => ({
        ...prev,
        [category]: prev[category] ? { ...prev[category]!, status: 'ERROR' } : null,
      }));
    }
  };

  const readyFiles = Object.values(uploadedFiles).filter(f => f?.status === 'READY');
  const anyReady = readyFiles.length > 0;

  return (
    <div className="page-container max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload Financial Records</h1>
        <p className="text-sm text-slate-500 mt-1">Import the data LedgerLens needs to reconcile your books.</p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
        <Info size={16} className="text-primary-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary-800">Ingestion Pipeline</p>
          <p className="text-xs text-primary-700 mt-0.5">
            Files are processed through: Upload → Parsing → Normalization → Validation.
            LedgerLens AI will automatically match records across sources.
          </p>
        </div>
      </div>

      {/* Upload Zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {ZONES.map(zone => (
          <UploadZone
            key={zone.category}
            {...zone}
            file={uploadedFiles[zone.category]}
            onFile={handleFile}
          />
        ))}
      </div>

      {/* Summary & CTA */}
      {anyReady && (
        <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">Ready to Reconcile</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {readyFiles.length} source{readyFiles.length > 1 ? 's' : ''} processed.
              Total records: {readyFiles.reduce((sum, f) => sum + (f?.recordCount ?? 0), 0)}.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                addToast({ type: 'info', title: 'Clearing Files', message: 'Upload area reset.' });
                setUploadedFiles({ PURCHASE_ORDER: null, INVOICE: null, PAYMENT: null, RECEIPT: null });
              }}
              className="btn-secondary"
            >
              <X size={14} />
              Clear All
            </button>
            <button
              onClick={() => navigate('/reconciliation')}
              className="btn-primary"
            >
              Start Reconciliation
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Pipeline Explainer */}
      <div className="mt-6 card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">How LedgerLens processes your data</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            'Data Ingestion',
            'Parsing',
            'Normalization',
            'Deterministic Matching',
            'Fuzzy Candidate Generation',
            'AI Investigation',
            'Validation & Guardrails',
            'Final Decision',
            'Audit Trail',
          ].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-xs font-semibold text-primary-600">{i + 1}</span>
                <span className="text-xs text-slate-700">{step}</span>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight size={12} className="text-slate-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
