// ============================================================
// LedgerLens AI — API Service Layer
// Mock implementation — replace functions with real API calls
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

import {
  mockDashboardMetrics,
  mockReconciliationCases,
  mockExceptions,
  mockAuditLogs,
  mockSettings,
} from '../data/mockData';

// ─── Utility ────────────────────────────────────────────────
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Response Wrapper ───────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: PaginationState;
}

// ─── Dashboard ──────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/metrics
 * Returns key performance indicators and overview data.
 */
export async function getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
  await delay(400);
  return {
    data: mockDashboardMetrics,
    success: true,
  };
}

// ─── Reconciliation ─────────────────────────────────────────
/**
 * GET /api/v1/reconciliation/cases
 * Returns paginated list of reconciliation cases with optional filters.
 */
export async function getReconciliationCases(
  filters?: Partial<FilterState>,
  pagination?: Partial<PaginationState>
): Promise<ApiResponse<ReconciliationCase[]>> {
  await delay(350);

  let cases = [...mockReconciliationCases];

  // Apply filters
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    cases = cases.filter(
      c =>
        c.id.toLowerCase().includes(q) ||
        c.invoiceNumber.toLowerCase().includes(q) ||
        c.vendorName.toLowerCase().includes(q) ||
        (c.poNumber?.toLowerCase().includes(q) ?? false)
    );
  }

  if (filters?.status) {
    cases = cases.filter(c => c.status === filters.status);
  }

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const total = cases.length;
  const start = (page - 1) * pageSize;
  const paginatedCases = cases.slice(start, start + pageSize);

  return {
    data: paginatedCases,
    success: true,
    pagination: { page, pageSize, total },
  };
}

/**
 * GET /api/v1/reconciliation/cases/:caseId
 * Returns full detail for a single case including investigation, evidence, and audit trail.
 */
export async function getInvestigation(caseId: string): Promise<ApiResponse<ReconciliationCase>> {
  await delay(300);
  const found = mockReconciliationCases.find(c => c.id === caseId);
  if (!found) {
    return { data: {} as ReconciliationCase, success: false, message: 'Case not found' };
  }
  return { data: found, success: true };
}

/**
 * PATCH /api/v1/reconciliation/cases/:caseId/status
 * Updates the status of a reconciliation case (approve/reject).
 */
export async function updateCaseStatus(
  caseId: string,
  newStatus: ReconciliationStatus,
  _actor: string = 'Finance Controller'
): Promise<ApiResponse<{ caseId: string; status: ReconciliationStatus; auditLog: AuditLog }>> {
  await delay(500);

  // In real API: PATCH /api/v1/reconciliation/cases/:caseId/status
  // Body: { status: newStatus, actor: _actor, reason: ... }

  const auditEntry: AuditLog = {
    id: `al-${Date.now()}`,
    timestamp: new Date().toISOString(),
    caseId,
    stage: 'Review',
    action: newStatus === 'MATCHED' ? 'Match approved' : 'Match rejected',
    actor: 'Finance Controller',
    result: newStatus,
  };

  return {
    data: { caseId, status: newStatus, auditLog: auditEntry },
    success: true,
    message: newStatus === 'MATCHED' ? 'Case approved successfully' : 'Case rejected',
  };
}

// ─── Exceptions ─────────────────────────────────────────────
/**
 * GET /api/v1/exceptions
 * Returns exception records with optional filters.
 */
export async function getExceptions(
  filters?: Partial<FilterState>
): Promise<ApiResponse<Exception[]>> {
  await delay(300);

  let exceptions = [...mockExceptions];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    exceptions = exceptions.filter(
      e => e.caseId.toLowerCase().includes(q) || e.vendorName.toLowerCase().includes(q)
    );
  }

  if (filters?.severity) {
    exceptions = exceptions.filter(e => e.severity === filters.severity);
  }

  if (filters?.exceptionType) {
    exceptions = exceptions.filter(e => e.type === filters.exceptionType);
  }

  if (filters?.status) {
    exceptions = exceptions.filter(e => e.status === filters.status);
  }

  return {
    data: exceptions,
    success: true,
    pagination: { page: 1, pageSize: 50, total: exceptions.length },
  };
}

// ─── Audit Trail ────────────────────────────────────────────
/**
 * GET /api/v1/audit
 * Returns paginated audit log entries.
 */
export async function getAuditLogs(
  filters?: Partial<FilterState>,
  pagination?: Partial<PaginationState>
): Promise<ApiResponse<AuditLog[]>> {
  await delay(300);

  let logs = [...mockAuditLogs];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    logs = logs.filter(
      l =>
        l.caseId.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.stage.toLowerCase().includes(q)
    );
  }

  if (filters?.stage) {
    logs = logs.filter(l => l.stage === filters.stage);
  }

  if (filters?.actor) {
    logs = logs.filter(l => l.actor === filters.actor);
  }

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  const total = logs.length;

  return {
    data: logs.slice((page - 1) * pageSize, page * pageSize),
    success: true,
    pagination: { page, pageSize, total },
  };
}

// ─── Upload ─────────────────────────────────────────────────
/**
 * POST /api/v1/upload
 * Handles file upload, parsing, normalization, and validation.
 * In real API: multipart/form-data upload.
 */
export async function uploadRecords(
  file: File,
  category: UploadedFile['category'],
  onProgress: (status: UploadedFile['status'], progress: number) => void
): Promise<ApiResponse<UploadedFile>> {
  // Simulate multi-stage upload pipeline
  onProgress('UPLOADING', 20);
  await delay(600);

  onProgress('PARSING', 45);
  await delay(700);

  onProgress('NORMALIZING', 65);
  await delay(500);

  onProgress('VALIDATING', 85);
  await delay(400);

  onProgress('READY', 100);

  const uploadedFile: UploadedFile = {
    id: `file-${Date.now()}`,
    name: file.name,
    size: file.size,
    type: file.type,
    category,
    status: 'READY',
    progress: 100,
    recordCount: 150,
    validRecords: 148,
    warningRecords: 2,
    errorRecords: 0,
    uploadedAt: new Date().toISOString(),
    warnings: [
      'Row 43: vendor_gstin field missing',
      'Row 91: invoice_date format inconsistency (auto-corrected)',
    ],
  };

  return { data: uploadedFile, success: true, message: 'File processed successfully' };
}

/**
 * POST /api/v1/reconciliation/run
 * Triggers the reconciliation pipeline on uploaded records.
 */
export async function runReconciliation(): Promise<ApiResponse<{ jobId: string; message: string }>> {
  await delay(800);
  return {
    data: {
      jobId: `job-${Date.now()}`,
      message: 'Reconciliation started. Results will appear momentarily.',
    },
    success: true,
  };
}

// ─── Settings ────────────────────────────────────────────────
/**
 * GET /api/v1/settings
 */
export async function getSettings(): Promise<ApiResponse<SettingsConfig>> {
  await delay(200);
  return { data: mockSettings, success: true };
}

/**
 * PUT /api/v1/settings
 */
export async function updateSettings(
  settings: Partial<SettingsConfig>
): Promise<ApiResponse<SettingsConfig>> {
  await delay(400);
  const updated = { ...mockSettings, ...settings };
  return { data: updated, success: true, message: 'Settings saved successfully' };
}
