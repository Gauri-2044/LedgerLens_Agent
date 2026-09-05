// ============================================================
// LedgerLens AI — TypeScript Data Models
// ============================================================

export interface Vendor {
  id: string;
  name: string;
  canonicalName: string;
  gstin?: string;
  pan?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  currency: string;
  date: string;
  status: 'OPEN' | 'PARTIALLY_MATCHED' | 'MATCHED' | 'CANCELLED';
  lineItems?: POLineItem[];
}

export interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  taxAmount?: number;
  totalAmount: number;
  currency: string;
  invoiceDate: string;
  dueDate?: string;
  poReference?: string;
  gstNumber?: string;
  status: 'PENDING' | 'MATCHED' | 'DISPUTED';
}

export interface Payment {
  id: string;
  paymentId: string;
  source: 'RAZORPAYX' | 'BANK_TRANSFER' | 'NEFT' | 'RTGS' | 'IMPS';
  amount: number;
  currency: string;
  status: 'PROCESSED' | 'PENDING' | 'FAILED' | 'REVERSED';
  paymentDate: string;
  beneficiaryName?: string;
  referenceNumber?: string;
  invoiceReference?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  serviceReceived: boolean;
  receivedDate?: string;
  confirmedBy?: string;
  notes?: string;
}

export type ReconciliationStatus = 'MATCHED' | 'NEEDS_REVIEW' | 'UNRESOLVED';

export type ExceptionType =
  | 'AMOUNT_MISMATCH'
  | 'VENDOR_MISMATCH'
  | 'MISSING_PAYMENT'
  | 'DUPLICATE_INVOICE'
  | 'DUPLICATE_LINK'
  | 'MISSING_PO'
  | 'MISSING_RECEIPT'
  | 'DATE_GAP'
  | 'MULTIPLE_CANDIDATES'
  | 'INSUFFICIENT_EVIDENCE';

export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Exception {
  id: string;
  caseId: string;
  type: ExceptionType;
  vendorName: string;
  amount: number;
  expectedValue?: string | number;
  actualValue?: string | number;
  variance?: number;
  severity: ExceptionSeverity;
  detectedAt: string;
  status: ReconciliationStatus;
  description?: string;
}

export interface Evidence {
  id: string;
  label: string;
  status: 'CONFIRMED' | 'WARNING' | 'FAILED' | 'INFO';
  confidence?: number;
  detail?: string;
}

export interface InvestigationResult {
  caseId: string;
  decision: ReconciliationStatus;
  confidence: number;
  reasoning: string;
  evidence: Evidence[];
  exceptionType?: ExceptionType;
  expectedValue?: number;
  actualValue?: number;
  variance?: number;
  severity?: ExceptionSeverity;
  recommendedAction: string;
  investigatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  caseId: string;
  stage: string;
  action: string;
  actor: 'System' | 'LedgerLens AI' | 'Finance Controller';
  result: string;
  metadata?: Record<string, unknown>;
}

export interface ReconciliationCase {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  poId?: string;
  poNumber?: string;
  paymentId?: string;
  vendorName: string;
  invoiceAmount: number;
  paymentAmount?: number;
  matchScore?: number;
  status: ReconciliationStatus;
  aiAssisted?: boolean;       // true = AI upgraded this from AMBIGUOUS to MATCHED
  exceptionType?: ExceptionType;
  lastUpdated: string;
  source?: string;
  investigation?: InvestigationResult;
  purchaseOrder?: PurchaseOrder;
  invoice?: Invoice;
  payment?: Payment;
  receipt?: Receipt;
  auditLogs?: AuditLog[];
}

export interface DashboardMetrics {
  totalRecords: number;
  automaticallyMatched: number;
  aiAssisted: number;
  needsReview: number;
  unresolved: number;
  matchRate: number;
  trends: {
    totalRecords: number;
    automaticallyMatched: number;
    aiAssisted: number;
    needsReview: number;
    unresolved: number;
    matchRate: number;
  };
  reconciliationOverview: TimeSeriesPoint[];
  exceptionBreakdown: ExceptionBreakdown[];
  recentInvestigations: ReconciliationCase[];
}

export interface TimeSeriesPoint {
  date: string;
  processed: number;
  matched: number;
  needsReview: number;
}

export interface ExceptionBreakdown {
  type: string;
  count: number;
  percentage: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  category: 'PURCHASE_ORDER' | 'INVOICE' | 'PAYMENT' | 'RECEIPT';
  status: 'UPLOADING' | 'PARSING' | 'NORMALIZING' | 'VALIDATING' | 'READY' | 'ERROR';
  progress: number;
  recordCount?: number;
  validRecords?: number;
  warningRecords?: number;
  errorRecords?: number;
  uploadedAt: string;
  warnings?: string[];
}

export interface AnalyticsMetric {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  trendLabel?: string;
}

export interface SettingsConfig {
  organization: {
    name: string;
    gstin: string;
    financialYear: string;
    currency: string;
    timezone: string;
  };
  reconciliation: {
    automaticMatchThreshold: number;
    aiInvestigationThreshold: number;
    amountTolerance: number;
    vendorSimilarityThreshold: number;
    enableFuzzyMatching: boolean;
    enableGSTValidation: boolean;
  };
  confidence: {
    highConfidenceThreshold: number;
    mediumConfidenceThreshold: number;
    lowConfidenceThreshold: number;
  };
  dataSources: {
    razorpayx: boolean;
    bankStatement: boolean;
    erpIntegration: boolean;
    gstr2b: boolean;
  };
  ai: {
    model: string;
    maxInvestigationDepth: number;
    enableExplainability: boolean;
    enableGuardrails: boolean;
    humanReviewRequired: boolean;
  };
  notifications: {
    emailAlerts: boolean;
    slackIntegration: boolean;
    webhookUrl: string;
    alertOnException: boolean;
    dailyDigest: boolean;
  };
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterState {
  search: string;
  status?: ReconciliationStatus | '';
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  severity?: ExceptionSeverity | '';
  exceptionType?: ExceptionType | '';
  stage?: string;
  actor?: string;
}
