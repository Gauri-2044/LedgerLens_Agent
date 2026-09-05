"""
app/routes/dashboard.py
========================
Dashboard API — serves the DashboardMetrics shape that the frontend
getDashboardMetrics() call expects.

Routes:
  GET  /dashboard/metrics          — KPIs, overview chart, exception breakdown
  GET  /dashboard/cases            — paginated reconciliation cases list
  GET  /dashboard/cases/:case_id   — single case detail
  PATCH /dashboard/cases/:case_id/status  — human approve / reject
  GET  /dashboard/exceptions       — exception list
  GET  /dashboard/audit            — audit log

All data is served from the in-memory app_state which is populated by
POST /reconcile/investigate.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.helpers.response_mapper import build_dashboard_metrics
from app.services.audit import audit_store, AuditAction
from app.state import app_state

dashboard_route = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class StatusUpdate(BaseModel):
    status: str          # MATCHED | NEEDS_REVIEW | UNRESOLVED
    actor:  str = "Finance Controller"
    reason: str = ""


# ---------------------------------------------------------------------------
# GET /dashboard/metrics
# ---------------------------------------------------------------------------

@dashboard_route.get("/metrics")
def get_dashboard_metrics():
    """
    Returns DashboardMetrics:
      totalRecords, automaticallyMatched, aiAssisted, needsReview, unresolved,
      matchRate, trends, reconciliationOverview, exceptionBreakdown,
      recentInvestigations
    """
    if app_state.is_empty():
        # Return zeroed metrics if no run has been made yet
        return {
            "totalRecords": 0,
            "automaticallyMatched": 0,
            "aiAssisted": 0,
            "needsReview": 0,
            "unresolved": 0,
            "matchRate": 0.0,
            "runId": "",
            "trends": {
                "totalRecords": 0, "automaticallyMatched": 0,
                "aiAssisted": 0, "needsReview": 0,
                "unresolved": 0, "matchRate": 0,
            },
            "reconciliationOverview": [],
            "exceptionBreakdown": [],
            "recentInvestigations": [],
            "message": "No reconciliation run yet. POST to /reconcile/investigate first.",
        }

    metrics = build_dashboard_metrics(
        cases_ui=app_state.cases_ui,
        cases_raw=app_state.cases_raw,
        run_id=app_state.run_id,
    )
    return metrics


# ---------------------------------------------------------------------------
# GET /dashboard/cases
# ---------------------------------------------------------------------------

@dashboard_route.get("/cases")
def get_cases(
    page:       int = Query(default=1,  ge=1),
    page_size:  int = Query(default=10, ge=1, le=100, alias="pageSize"),
    status:     str = Query(default=""),
    search:     str = Query(default=""),
):
    """
    Paginated reconciliation cases in UI format.
    Supports ?status=MATCHED|NEEDS_REVIEW|UNRESOLVED and ?search=vendor/invoice.
    """
    if app_state.is_empty():
        return {"data": [], "success": True, "pagination": {"page": 1, "pageSize": page_size, "total": 0}}

    cases = list(app_state.cases_ui)

    # Filter
    if status:
        cases = [c for c in cases if c.get("status") == status]
    if search:
        q = search.lower()
        cases = [
            c for c in cases
            if q in (c.get("id") or "").lower()
            or q in (c.get("invoiceNumber") or "").lower()
            or q in (c.get("vendorName") or "").lower()
            or q in (c.get("poNumber") or "").lower()
        ]

    total = len(cases)
    start = (page - 1) * page_size
    paginated = cases[start: start + page_size]

    return {
        "data":    paginated,
        "success": True,
        "pagination": {"page": page, "pageSize": page_size, "total": total},
    }


# ---------------------------------------------------------------------------
# GET /dashboard/cases/:case_id
# ---------------------------------------------------------------------------

@dashboard_route.get("/cases/{case_id}")
def get_case(case_id: str):
    """Return full detail for a single reconciliation case."""
    if app_state.is_empty():
        raise HTTPException(status_code=404, detail="No reconciliation run yet.")

    found = next((c for c in app_state.cases_ui if c.get("id") == case_id), None)
    if not found:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    return {"data": found, "success": True}


# ---------------------------------------------------------------------------
# PATCH /dashboard/cases/:case_id/status  (human approve / reject)
# ---------------------------------------------------------------------------

@dashboard_route.patch("/cases/{case_id}/status")
def update_case_status(case_id: str, body: StatusUpdate):
    """
    Human approval or rejection of a reconciliation case.
    Records a HUMAN_APPROVED / HUMAN_REJECTED audit event with SHA-256 hash.
    """
    if app_state.is_empty():
        raise HTTPException(status_code=404, detail="No reconciliation run yet.")

    ui_case = next((c for c in app_state.cases_ui if c.get("id") == case_id), None)
    if not ui_case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    allowed = {"MATCHED", "NEEDS_REVIEW", "UNRESOLVED"}
    if body.status not in allowed:
        raise HTTPException(status_code=422, detail=f"status must be one of {allowed}")

    previous_status = ui_case["status"]
    ui_case["status"] = body.status
    ui_case["lastUpdated"] = datetime.now(timezone.utc).isoformat()

    # Record audit event
    action = (
        AuditAction.HUMAN_APPROVED if body.status == "MATCHED"
        else AuditAction.HUMAN_REJECTED
    )
    event = audit_store.record(
        case_id=case_id,
        invoice_id=ui_case.get("invoiceId", ""),
        pipeline_stage="human_review",
        action=action,
        previous_status=previous_status,
        new_status=body.status,
        confidence=1.0,
        actor="human",
        details={
            "actor":  body.actor,
            "reason": body.reason,
        },
    )

    # Append to case audit logs
    ui_case.setdefault("auditLogs", []).append({
        "id":        event.event_hash[:8],
        "timestamp": event.timestamp,
        "caseId":    case_id,
        "stage":     "Review",
        "action":    "Match approved" if body.status == "MATCHED" else "Match rejected",
        "actor":     body.actor,
        "result":    body.status,
    })

    return {
        "data":    {"caseId": case_id, "status": body.status, "auditLog": ui_case["auditLogs"][-1]},
        "success": True,
        "message": "Case approved successfully" if body.status == "MATCHED" else "Case updated",
    }


# ---------------------------------------------------------------------------
# GET /dashboard/exceptions
# ---------------------------------------------------------------------------

@dashboard_route.get("/exceptions")
def get_exceptions(
    search:        str = Query(default=""),
    severity:      str = Query(default=""),
    exception_type: str = Query(default="", alias="exceptionType"),
    status:        str = Query(default=""),
):
    """
    Derive exception list from all cases that have an exceptionType.
    """
    if app_state.is_empty():
        return {"data": [], "success": True, "pagination": {"page": 1, "pageSize": 50, "total": 0}}

    exceptions = []
    for i, case in enumerate(app_state.cases_ui):
        exc_type = case.get("exceptionType")
        if not exc_type:
            continue
        inv = case.get("investigation") or {}
        exceptions.append({
            "id":            f"EX-{i+1:03d}",
            "caseId":        case["id"],
            "type":          exc_type,
            "vendorName":    case.get("vendorName", ""),
            "amount":        case.get("invoiceAmount"),
            "expectedValue": inv.get("expectedValue"),
            "actualValue":   inv.get("actualValue"),
            "variance":      inv.get("variance"),
            "severity":      inv.get("severity", "MEDIUM"),
            "detectedAt":    case.get("lastUpdated", ""),
            "status":        case["status"],
            "description":   _exc_description(exc_type, case),
        })

    # Filters
    if search:
        q = search.lower()
        exceptions = [e for e in exceptions if q in e["caseId"].lower() or q in e["vendorName"].lower()]
    if severity:
        exceptions = [e for e in exceptions if e.get("severity") == severity]
    if exception_type:
        exceptions = [e for e in exceptions if e["type"] == exception_type]
    if status:
        exceptions = [e for e in exceptions if e["status"] == status]

    return {
        "data":    exceptions,
        "success": True,
        "pagination": {"page": 1, "pageSize": 50, "total": len(exceptions)},
    }


def _exc_description(exc_type: str, case: dict) -> str:
    inv  = case.get("investigation") or {}
    var  = inv.get("variance")
    amt  = case.get("invoiceAmount")
    return {
        "AMOUNT_MISMATCH":     f"Amount variance of ₹{var}" if var else "Invoice and PO amounts differ",
        "VENDOR_MISMATCH":     "Vendor names do not match across documents",
        "MISSING_PAYMENT":     "No payment record found for this invoice",
        "MISSING_PO":          "Invoice received without a corresponding Purchase Order",
        "MISSING_RECEIPT":     "No receipt record found",
        "DUPLICATE_LINK":      "Invoice may be linked to more than one case",
        "DATE_GAP":            "Significant date gap between documents",
        "INSUFFICIENT_EVIDENCE": "Insufficient evidence to determine a match",
    }.get(exc_type, f"{exc_type} exception detected")


# ---------------------------------------------------------------------------
# GET /dashboard/audit
# ---------------------------------------------------------------------------

@dashboard_route.get("/audit")
def get_audit_logs(
    page:      int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100, alias="pageSize"),
    search:    str = Query(default=""),
    stage:     str = Query(default=""),
    actor:     str = Query(default=""),
):
    """Return paginated audit logs from all reconciliation runs in this session."""
    all_logs: list[dict] = []

    # Pull from the in-memory audit store (all events across all runs)
    for event in audit_store.get_all():
        all_logs.append({
            "id":        event["event_hash"][:8] if event.get("event_hash") else f"e{len(all_logs)}",
            "timestamp": event["timestamp"],
            "caseId":    event["case_id"],
            "stage":     _stage_display(event.get("pipeline_stage", "")),
            "action":    event.get("action", ""),
            "actor":     _actor_display(event.get("actor", "system")),
            "result":    event.get("new_status", ""),
        })

    # Prepend per-case audit logs from UI cases (richer detail)
    if not all_logs and not app_state.is_empty():
        for case in app_state.cases_ui:
            all_logs.extend(case.get("auditLogs", []))

    # Filters
    if search:
        q = search.lower()
        all_logs = [l for l in all_logs if q in l.get("caseId", "").lower()
                    or q in l.get("action", "").lower()
                    or q in l.get("stage", "").lower()]
    if stage:
        all_logs = [l for l in all_logs if l.get("stage") == stage]
    if actor:
        all_logs = [l for l in all_logs if l.get("actor") == actor]

    total = len(all_logs)
    start = (page - 1) * page_size
    return {
        "data":    all_logs[start: start + page_size],
        "success": True,
        "pagination": {"page": page, "pageSize": page_size, "total": total},
    }


def _stage_display(s: str) -> str:
    return {
        "deterministic_matching":    "Matching",
        "fuzzy_candidate_generation": "Matching",
        "ai_investigation":          "AI Investigation",
        "validation":                "Validation",
        "final_status":              "Review",
        "human_review":              "Review",
    }.get(s, s.replace("_", " ").title())


def _actor_display(a: str) -> str:
    return {"system": "System", "ai": "LedgerLens AI", "human": "Finance Controller"}.get(a, a)
