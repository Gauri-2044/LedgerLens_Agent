# LedgerLens AI — Frontend Documentation & Integration Guide

> **Razorpay AI Buildathon — Track 04: AI Finance Controller**  
> **LedgerLens AI**: Explainable Multi-Source Finance Reconciliation Agent

---

## 📌 Project Overview

**LedgerLens AI** is an enterprise-grade financial reconciliation application designed to ingest, compare, resolve, and audit complex multi-source financial records across:
1. **Razorpay Payment Gateway & Payout Settlements**
2. **ERP Ledger Entries** (SAP, Tally, NetSuite)
3. **Bank Statement Data** (HDFC, ICICI, Axis)
4. **Tax Compliance Records** (GSTIN / NSDL filings)

The frontend is built with React 18, TypeScript, Tailwind CSS, Vite, and Recharts, featuring a dark-themed, modern fintech aesthetic inspired by Razorpay's design system.

---

## 🛠️ Work Done (Summary of Implementation)

### 1. **Core Application Architecture & Shell**
- **Root Router & Layout** ([`src/App.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/App.tsx)): Configured React Router v6/v7 with `AppShell` layout containing sidebar navigation, top bar header, and global Toast alert notifications.
- **Global Toast Notification Context** ([`src/context/ToastContext.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/context/ToastContext.tsx)): Global toast notification system supporting `success`, `error`, `warning`, and `info` popups.

### 2. **Pages & Key Features Built**
- **Dashboard ([`src/pages/Dashboard.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Dashboard.tsx))**:
  - 4 Key Performance Indicator (KPI) tiles with trend badges.
  - Reconciliation match status breakdown bar & AI confidence score distribution meter.
  - Recent discrepancy alerts and active batch status table.
- **Reconciliation Workbench ([`src/pages/Reconciliation.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Reconciliation.tsx))**:
  - Master reconciliation table with multi-dimensional filtering (Search, Status, Date Range).
  - Pagination, sorting, and inline status badges.
  - "Run Reconciliation" engine trigger action with simulated pipeline execution.
- **AI Investigation Desk ([`src/pages/Investigation.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Investigation.tsx))**:
  - 4-Source side-by-side record comparison matrix (Razorpay, ERP, Bank, GST).
  - Explainable AI Match Reasoning panel detailing exact field diffs (e.g., amount mismatch, fee discrepancies).
  - Line-item breakdown table & evidence attachments checklist.
  - Decision action controls (**Approve Match** vs **Reject Match**).
- **Upload & Ingestion Center ([`src/pages/Upload.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Upload.tsx))**:
  - Drag-and-drop file upload zones for 4 distinct financial source types.
  - Multi-stage upload progress pipeline visualization (`UPLOADING` ➔ `PARSING` ➔ `NORMALIZING` ➔ `VALIDATING` ➔ `READY`).
  - Validation log detailing parsed row counts, auto-corrected formats, and warnings.
- **Exception Center ([`src/pages/Exceptions.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Exceptions.tsx))**:
  - Exception management table with filter by Severity (`HIGH`, `MEDIUM`, `LOW`) and Exception Type (`AMOUNT_MISMATCH`, `MISSING_RECORD`, `FEE_DISCREPANCY`, `TIMING_DIFFERENCE`).
  - One-click navigation into Investigation desk.
- **Enterprise Audit Trail ([`src/pages/AuditTrail.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/AuditTrail.tsx))**:
  - Immutable audit trail of every reconciliation decision, AI match, and user approval.
  - Actor filter (`AI Agent`, `Finance Controller`, `System`) and stage filter.
- **Financial Analytics ([`src/pages/Analytics.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Analytics.tsx))**:
  - 4 Recharts visual charts: Reconciliation Trend over time, Exception Root Cause breakdown, Source volume distribution, and Auto-resolution vs Manual intervention ratio.
- **System Settings ([`src/pages/Settings.tsx`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/pages/Settings.tsx))**:
  - Matching Engine thresholds (Auto-Match confidence slider, Date tolerance days, Amount tolerance percentage).
  - AI Model selection (GPT-4o, Claude 3.5 Sonnet, Gemini Pro, Custom fine-tuned model).
  - Financial rules, Data Connectors, Team permissions, and Compliance settings.

### 3. **API Service Layer & Data Mocks**
- **Mock Data Engine** ([`src/data/mockData.ts`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/data/mockData.ts)): Realistic multi-source dataset representing Razorpay settlement transactions, ERP entries, GST filings, and bank statements.
- **API Client Abstraction** ([`src/services/api.ts`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/services/api.ts)): Decoupled service module with TypeScript interfaces and simulated async network calls (`ApiResponse<T>`).

---

## 🚀 Beginner Guide: How to Connect Real Data & Backend API

Currently, the UI uses simulated data from [`src/data/mockData.ts`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/data/mockData.ts) via [`src/services/api.ts`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/services/api.ts). Follow this step-by-step guide to connect a real backend (e.g. Node.js/Express, Python/FastAPI, Flask, or Java Spring Boot).

---

### Step 1: Add Environment Variable for Backend URL

1. Create a `.env` file inside the `frontend/` directory:
   ```bash
   # frontend/.env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```

2. Access the environment variable in TypeScript:
   ```ts
   const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
   ```

---

### Step 2: Understand the API Service Layer (`src/services/api.ts`)

Every component in the frontend calls backend endpoints through [`src/services/api.ts`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/services/api.ts). You **do not** need to edit any UI components or pages to connect your backend; you only need to replace the mock function bodies in `api.ts` with real `fetch` or `axios` HTTP calls!

---

### Step 3: Code Examples to Replace Mocks with Real HTTP Calls

#### Example A: Fetching Dashboard Metrics (GET request)

**Before (Mock implementation in `src/services/api.ts`):**
```ts
export async function getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
  await delay(400);
  return { data: mockDashboardMetrics, success: true };
}
```

**After (Real API implementation with `fetch`):**
```ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export async function getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
  try {
    const response = await fetch(`${BASE_URL}/dashboard/metrics`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const json = await response.json();
    return { data: json, success: true };
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    return { data: {} as DashboardMetrics, success: false, message: 'Failed to fetch metrics' };
  }
}
```

---

#### Example B: Updating Case Approval Status (PATCH / POST request)

**Before (Mock):**
```ts
export async function updateCaseStatus(caseId: string, newStatus: ReconciliationStatus) { ... }
```

**After (Real API with `fetch`):**
```ts
export async function updateCaseStatus(
  caseId: string,
  newStatus: ReconciliationStatus
): Promise<ApiResponse<{ caseId: string; status: ReconciliationStatus }>> {
  try {
    const response = await fetch(`${BASE_URL}/reconciliation/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus, actor: 'Finance Controller' }),
    });

    const json = await response.json();
    return { data: json.data, success: json.success, message: json.message };
  } catch (error) {
    return { data: { caseId, status: newStatus }, success: false, message: 'Update failed' };
  }
}
```

---

#### Example C: Uploading Financial Records (Multipart File Upload)

**After (Real API uploading CSV/Excel files):**
```ts
export async function uploadRecords(
  file: File,
  category: UploadedFile['category'],
  onProgress: (status: UploadedFile['status'], progress: number) => void
): Promise<ApiResponse<UploadedFile>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  onProgress('UPLOADING', 30);

  try {
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    onProgress('VALIDATING', 90);
    const json = await response.json();
    onProgress('READY', 100);

    return { data: json.data, success: true };
  } catch (err) {
    return { data: {} as UploadedFile, success: false, message: 'Upload failed' };
  }
}
```

---

## 📋 Complete Backend API Endpoints Contract

To build a compatible backend server, implement the following REST endpoint contracts expected by [`src/services/api.ts`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/frontend/src/services/api.ts):

| HTTP Method | API Path | Query Params / Body | Description |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/metrics` | None | Returns summary metrics, KPI numbers, and confidence stats |
| `GET` | `/api/v1/reconciliation/cases` | `?search=...&status=...&page=1` | Returns paginated reconciliation cases |
| `GET` | `/api/v1/reconciliation/cases/:caseId` | None | Returns 4-source data, AI reasoning, and evidence for 1 case |
| `PATCH` | `/api/v1/reconciliation/cases/:caseId/status` | `{ status: "MATCHED", actor: "..." }` | Approves or rejects a reconciliation case |
| `POST` | `/api/v1/reconciliation/run` | None | Triggers async reconciliation engine job |
| `GET` | `/api/v1/exceptions` | `?severity=HIGH&type=...` | Returns list of exception records |
| `GET` | `/api/v1/audit` | `?search=...&stage=...` | Returns paginated immutable audit logs |
| `POST` | `/api/v1/upload` | `multipart/form-data` (`file`, `category`) | Uploads financial records for ingestion |
| `GET` | `/api/v1/settings` | None | Gets engine thresholds and configuration |
| `PUT` | `/api/v1/settings` | `{ autoMatchThreshold: 0.95, ... }` | Updates engine thresholds |

---

## 💻 Local Development Commands

Navigate to the `frontend` folder:

```bash
cd frontend
```

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Open browser at `http://localhost:5173`.

### Production Build
```bash
npm run build
```

---

## 🎨 UI & Design Principles Applied
- **Color Palette**: Dark Slate background (`#0b0f19`), Navy card backgrounds (`#111827`), Emerald for Matched (`#10b981`), Amber for Review (`#f59e0b`), Red for Mismatched (`#ef4444`).
- **Typography**: Inter / Sans-Serif font hierarchy with clear weight contrast.
- **Interactivity**: Micro-animations, responsive hover transitions, loading state skeletons, and empty state fallbacks.
