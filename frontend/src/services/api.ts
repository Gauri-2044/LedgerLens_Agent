// ============================================================
// LedgerLens AI — API Service Layer
// Real API implementation — calls FastAPI backend
// Backend: http://localhost:8000
// ============================================================

import type {
  DashboardMetrics,
  ReconciliationCase,
  ReconciliationStatus,
  Exception,
  AuditLog,
  SettingsConfig,
  UploadedFile,
  FilterState,
  PaginationState,
} from '../types';

// ─── Base Config ─────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ─── Response Wrapper ────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: PaginationState;
}

// ─── Internal fetch helper ───────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null as T, success: false, message: err.detail ?? `HTTP ${res.status}` };
    }
    const json = await res.json();
    // The backend wraps data in { data, success, pagination } already
    if ('success' in json) return json as ApiResponse<T>;
    // Or it just returns the raw object (metrics, audit)
    return { data: json as T, success: true };
  } catch (err) {
    return { data: null as T, success: false, message: String(err) };
  }
}

// ─── Dashboard ───────────────────────────────────────────────
/**
 * GET /dashboard/metrics
 */
export async function getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
  return apiFetch<DashboardMetrics>('/dashboard/metrics');
}

// ─── Reconciliation Cases ────────────────────────────────────
/**
 * GET /dashboard/cases
 */
export async function getReconciliationCases(
  filters?: Partial<FilterState>,
  pagination?: Partial<PaginationState>
): Promise<ApiResponse<ReconciliationCase[]>> {
  const params = new URLSearchParams();
  if (filters?.search)  params.set('search', filters.search);
  if (filters?.status)  params.set('status', filters.status);
  if (pagination?.page)     params.set('page', String(pagination.page));
  if (pagination?.pageSize) params.set('pageSize', String(pagination.pageSize));
  const qs = params.toString();
  return apiFetch<ReconciliationCase[]>(`/dashboard/cases${qs ? '?' + qs : ''}`);
}

/**
 * GET /dashboard/cases/:caseId
 */
export async function getInvestigation(caseId: string): Promise<ApiResponse<ReconciliationCase>> {
  return apiFetch<ReconciliationCase>(`/dashboard/cases/${caseId}`);
}

/**
 * PATCH /dashboard/cases/:caseId/status
 */
export async function updateCaseStatus(
  caseId: string,
  newStatus: ReconciliationStatus,
  actor: string = 'Finance Controller',
  reason: string = ''
): Promise<ApiResponse<{ caseId: string; status: ReconciliationStatus; auditLog: AuditLog }>> {
  return apiFetch(`/dashboard/cases/${caseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus, actor, reason }),
  });
}

// ─── Exceptions ──────────────────────────────────────────────
/**
 * GET /dashboard/exceptions
 */
export async function getExceptions(
  filters?: Partial<FilterState>
): Promise<ApiResponse<Exception[]>> {
  const params = new URLSearchParams();
  if (filters?.search)        params.set('search', filters.search);
  if (filters?.severity)      params.set('severity', filters.severity);
  if (filters?.exceptionType) params.set('exceptionType', filters.exceptionType);
  if (filters?.status)        params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch<Exception[]>(`/dashboard/exceptions${qs ? '?' + qs : ''}`);
}

// ─── Audit Trail ─────────────────────────────────────────────
/**
 * GET /dashboard/audit
 */
export async function getAuditLogs(
  filters?: Partial<FilterState>,
  pagination?: Partial<PaginationState>
): Promise<ApiResponse<AuditLog[]>> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.stage)  params.set('stage', filters.stage);
  if (filters?.actor)  params.set('actor', filters.actor);
  if (pagination?.page)     params.set('page', String(pagination.page));
  if (pagination?.pageSize) params.set('pageSize', String(pagination.pageSize));
  const qs = params.toString();
  return apiFetch<AuditLog[]>(`/dashboard/audit${qs ? '?' + qs : ''}`);
}

// ─── Upload ──────────────────────────────────────────────────
const CATEGORY_ROUTE: Record<UploadedFile['category'], string> = {
  PURCHASE_ORDER: 'purchase-orders',
  INVOICE:        'invoices',
  PAYMENT:        'payments',
  RECEIPT:        'receipts',
};

/**
 * POST /upload/{category}
 * Streams progress updates via onProgress callback.
 */
export async function uploadRecords(
  file: File,
  category: UploadedFile['category'],
  onProgress: (status: UploadedFile['status'], progress: number) => void
): Promise<ApiResponse<UploadedFile>> {
  onProgress('UPLOADING', 20);

  const form = new FormData();
  // The backend expects the file under a specific field name per category
  const fieldNames: Record<UploadedFile['category'], string> = {
    PURCHASE_ORDER: 'file',
    INVOICE:        'file',
    PAYMENT:        'file',
    RECEIPT:        'file',
  };
  form.append(fieldNames[category], file);

  onProgress('PARSING', 45);

  try {
    const routeSegment = CATEGORY_ROUTE[category];
    const res = await fetch(`${API_BASE}/upload/${routeSegment}`, {
      method: 'POST',
      body: form,
    });

    onProgress('NORMALIZING', 65);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      onProgress('ERROR' as UploadedFile['status'], 0);
      return { data: null as any, success: false, message: err.detail ?? `Upload failed: HTTP ${res.status}` };
    }

    const json = await res.json();
    onProgress('VALIDATING', 85);
    onProgress('READY', 100);

    const uploadedFile: UploadedFile = {
      id:             `file-${Date.now()}`,
      name:           file.name,
      size:           file.size,
      type:           file.type,
      category,
      status:         'READY',
      progress:       100,
      recordCount:    json.total_records ?? 0,
      validRecords:   json.total_records ?? 0,
      warningRecords: json.warning_count ?? 0,
      errorRecords:   json.error_count   ?? 0,
      uploadedAt:     new Date().toISOString(),
      warnings:       json.warnings ?? [],
    };

    return { data: uploadedFile, success: true, message: 'File processed successfully' };
  } catch (err) {
    onProgress('ERROR' as UploadedFile['status'], 0);
    return { data: null as any, success: false, message: String(err) };
  }
}

// ─── Reconciliation Run ──────────────────────────────────────
/**
 * POST /reconcile/investigate  — full 10-stage pipeline
 *
 * Accepts all 4 CSV files at once. Returns the full result immediately
 * (no polling needed — pipeline is synchronous on the backend).
 */
export async function runReconciliation(
  files?: {
    purchaseOrders: File;
    invoices:       File;
    payments:       File;
    receipts:       File;
  }
): Promise<ApiResponse<{ jobId: string; message: string; cases?: any[]; summary?: any }>> {
  if (!files) {
    // Fallback: just trigger without files (no-op in the real backend)
    return { data: { jobId: `job-${Date.now()}`, message: 'No files provided.' }, success: false };
  }

  const form = new FormData();
  form.append('purchase_orders_file', files.purchaseOrders);
  form.append('invoices_file',        files.invoices);
  form.append('payments_file',        files.payments);
  form.append('receipts_file',        files.receipts);

  try {
    const res = await fetch(`${API_BASE}/reconcile/investigate`, {
      method: 'POST',
      body:   form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: { jobId: '', message: err.detail ?? `HTTP ${res.status}` }, success: false };
    }
    const json = await res.json();
    return {
      data: {
        jobId:   json.run_id ?? `job-${Date.now()}`,
        message: 'Reconciliation complete.',
        cases:   json.cases,
        summary: json.summary,
      },
      success: true,
    };
  } catch (err) {
    return { data: { jobId: '', message: String(err) }, success: false, message: String(err) };
  }
}

// ─── Settings ────────────────────────────────────────────────

// Default settings (no DB yet — serve locally)
const DEFAULT_SETTINGS: SettingsConfig = {
  organization: {
    name: 'Acme Technologies Pvt Ltd',
    gstin: '29AABCT1332L1ZV',
    financialYear: '2026-27',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  },
  reconciliation: {
    automaticMatchThreshold: 90,
    aiInvestigationThreshold: 50,
    amountTolerance: 2,
    vendorSimilarityThreshold: 80,
    enableFuzzyMatching: true,
    enableGSTValidation: false,
  },
  confidence: {
    highConfidenceThreshold: 90,
    mediumConfidenceThreshold: 50,
    lowConfidenceThreshold: 30,
  },
  dataSources: {
    razorpayx:      false,
    bankStatement:  true,
    erpIntegration: false,
    gstr2b:         false,
  },
  ai: {
    model:                  'gemini-2.5-flash',
    maxInvestigationDepth:  5,
    enableExplainability:   true,
    enableGuardrails:       true,
    humanReviewRequired:    true,
  },
  notifications: {
    emailAlerts:       false,
    slackIntegration:  false,
    webhookUrl:        '',
    alertOnException:  true,
    dailyDigest:       false,
  },
};

let _settings = { ...DEFAULT_SETTINGS };

export async function getSettings(): Promise<ApiResponse<SettingsConfig>> {
  return { data: _settings, success: true };
}

export async function updateSettings(
  settings: Partial<SettingsConfig>
): Promise<ApiResponse<SettingsConfig>> {
  _settings = { ..._settings, ...settings };
  return { data: _settings, success: true, message: 'Settings saved successfully' };
}
