"""
app/helpers/response_mapper.py
================================
Transforms the backend's snake_case case dicts into the exact
camelCase shape that the frontend TypeScript types expect.

UI type: ReconciliationCase  (frontend/src/types/index.ts)

Every function here is a pure transformation — no DB, no IO.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Stage display name mapping (audit log)
# ---------------------------------------------------------------------------

_STAGE_NAMES = {
    "deterministic_matching":    "Matching",
    "fuzzy_candidate_generation": "Matching",
    "ai_investigation":          "AI Investigation",
    "validation":                "Validation",
    "final_status":              "Review",
    "ingestion":                 "Ingestion",
    "normalization":             "Normalization",
}

_ACTOR_NAMES = {
    "system": "System",
    "ai":     "LedgerLens AI",
    "human":  "Finance Controller",
}


# ---------------------------------------------------------------------------
# Exception severity derivation
# ---------------------------------------------------------------------------

def _amount_severity(variance_pct: float | None) -> str:
    if variance_pct is None:
        return "MEDIUM"
    if variance_pct < 1.0:
        return "LOW"
    if variance_pct < 5.0:
        return "MEDIUM"
    if variance_pct < 20.0:
        return "HIGH"
    return "CRITICAL"


# ---------------------------------------------------------------------------
# Sub-object mappers
# ---------------------------------------------------------------------------

def _map_purchase_order(po: dict | None) -> dict | None:
    if not po:
        return None
    return {
        "id":         po.get("po_id_raw") or po.get("po_id_normalized", ""),
        "poNumber":   po.get("po_id_raw") or po.get("po_id_normalized", ""),
        "vendorId":   po.get("vendor_id", ""),
        "vendorName": po.get("vendor_name_raw") or po.get("vendor_name", ""),
        "amount":     po.get("po_amount") or 0,
        "currency":   po.get("currency", "INR"),
        "date":       po.get("po_date", ""),
        "status":     "PARTIALLY_MATCHED",
    }


def _map_invoice(inv: dict | None) -> dict | None:
    if not inv:
        return None
    amount = inv.get("invoice_amount") or 0
    return {
        "id":            inv.get("invoice_id_raw") or inv.get("invoice_id_normalized", ""),
        "invoiceNumber": inv.get("invoice_id_raw") or inv.get("invoice_id_normalized", ""),
        "vendorId":      inv.get("vendor_id", ""),
        "vendorName":    inv.get("vendor_name_raw") or inv.get("vendor_name", ""),
        "amount":        amount,
        "taxAmount":     inv.get("tax_amount", 0),
        "totalAmount":   inv.get("total_amount") or amount,
        "currency":      inv.get("currency", "INR"),
        "invoiceDate":   inv.get("invoice_date", ""),
        "dueDate":       inv.get("due_date"),
        "poReference":   inv.get("po_id") or inv.get("po_id_raw"),
        "gstNumber":     inv.get("gstin") or inv.get("gst_number"),
        "status":        "PENDING",
    }


def _map_payment(pay: dict | None) -> dict | None:
    if not pay:
        return None
    # Infer payment source from available fields
    source = pay.get("payment_source") or pay.get("source", "BANK_TRANSFER")
    if isinstance(source, str) and source.upper() not in (
        "RAZORPAYX", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS"
    ):
        source = "BANK_TRANSFER"
    pay_id = pay.get("payment_id_raw") or pay.get("payment_id_normalized", "")
    return {
        "id":              pay_id,
        "paymentId":       pay.get("razorpay_payment_id") or f"rzrpay_pout_{pay_id}",
        "source":          source.upper() if source else "BANK_TRANSFER",
        "amount":          pay.get("payment_amount") or 0,
        "currency":        pay.get("currency", "INR"),
        "status":          "PROCESSED",
        "paymentDate":     pay.get("payment_date", ""),
        "beneficiaryName": pay.get("vendor_name_raw") or pay.get("vendor_name", ""),
        "referenceNumber": pay.get("reference_number") or pay.get("utr_number"),
    }


def _map_receipt(rec: dict | None) -> dict | None:
    if not rec:
        return None
    return {
        "id":              rec.get("receipt_id_raw") or rec.get("receipt_id_normalized", ""),
        "receiptNumber":   rec.get("receipt_id_raw") or rec.get("receipt_id_normalized", ""),
        "serviceReceived": True,
        "receivedDate":    rec.get("receipt_date", ""),
        "confirmedBy":     rec.get("confirmed_by") or rec.get("approved_by"),
        "notes":           rec.get("notes"),
    }


# ---------------------------------------------------------------------------
# Investigation mapper
# ---------------------------------------------------------------------------

def _map_investigation(case: dict) -> dict | None:
    """
    Merge explanation (deterministic XAI) + ai_investigation (Gemini verdict)
    into the UI's InvestigationResult shape.
    """
    explanation   = case.get("explanation") or {}
    ai_result     = case.get("ai_investigation")
    final_status  = case.get("final_status") or {}

    case_id    = case.get("case_id", "")
    confidence = final_status.get("confidence") or case.get("confidence", 0.0)
    status     = final_status.get("status") or case.get("status", "UNRESOLVED")

    # Build reasoning paragraph
    reasoning_parts: list[str] = []
    if ai_result:
        reasoning_parts.extend(ai_result.get("reasons", []))
    if not reasoning_parts:
        reasoning_parts.append(explanation.get("human_summary", "Deterministic analysis completed."))
    reasoning = " ".join(reasoning_parts)

    # Build evidence array from explanation factors
    evidence: list[dict] = []
    factor_labels = {
        "vendor":       "Vendor identity match",
        "amount":       "Amount verification",
        "po_link":      "Purchase Order relationship",
        "payment_link": "Payment record found",
    }
    status_map = {
        "EXACT":    "CONFIRMED",
        "PRESENT":  "CONFIRMED",
        "CLOSE":    "WARNING",
        "FUZZY":    "WARNING",
        "MISSING":  "INFO",
        "ABSENT":   "INFO",
        "MISMATCH": "FAILED",
    }
    for i, factor in enumerate(explanation.get("factors", []), start=1):
        field_name  = factor.get("field", "")
        field_res   = factor.get("result", "")
        evidence.append({
            "id":         f"e{i}",
            "label":      factor_labels.get(field_name, field_name.replace("_", " ").title()),
            "status":     status_map.get(field_res, "INFO"),
            "confidence": round(factor.get("score", 0.0) * 100),
            "detail":     factor.get("detail", ""),
        })

    # Add validation flags as evidence items
    validation = case.get("validation") or {}
    for viol in validation.get("violations", []):
        evidence.append({
            "id":         f"v-{viol.get('code', '')}",
            "label":      viol.get("code", "").replace("_", " ").title(),
            "status":     "WARNING" if viol.get("severity") == "WARNING" else "FAILED",
            "confidence": None,
            "detail":     viol.get("message", ""),
        })

    # Add flags
    for flag in explanation.get("flags", []):
        evidence.append({
            "id":         f"f{len(evidence)}",
            "label":      "Flag",
            "status":     "WARNING",
            "confidence": None,
            "detail":     flag,
        })

    # Exception + variance
    exceptions = final_status.get("exceptions") or []
    exception_type = exceptions[0] if exceptions else None

    # Compute variance from invoice and PO/payment amounts
    inv  = case.get("invoice") or {}
    po   = case.get("purchase_order")
    pay  = case.get("payment")
    inv_amount = inv.get("invoice_amount")
    ref_amount = (po or {}).get("po_amount") or (pay or {}).get("payment_amount")
    variance    = round(abs(inv_amount - ref_amount), 2) if inv_amount and ref_amount else None
    variance_pct = round(abs(inv_amount - ref_amount) / max(abs(ref_amount), 1) * 100, 3) if variance else None
    severity    = _amount_severity(variance_pct) if exception_type == "AMOUNT_MISMATCH" else (
        "HIGH" if exception_type in ("MISSING_PAYMENT", "MISSING_PO") else "MEDIUM"
    )

    recommended = final_status.get("recommended_action") or (
        ai_result.get("recommended_action") if ai_result else None
    ) or "Review required."

    return {
        "caseId":            case_id,
        "decision":          status,
        "confidence":        round(confidence * 100),
        "reasoning":         reasoning,
        "evidence":          evidence,
        "exceptionType":     exception_type,
        "expectedValue":     ref_amount,
        "actualValue":       inv_amount,
        "variance":          variance,
        "severity":          severity,
        "recommendedAction": recommended,
        "investigatedAt":    datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Audit log mapper
# ---------------------------------------------------------------------------

def _map_audit_logs(case: dict) -> list[dict]:
    """Convert backend AuditEvent dicts to UI AuditLog shape."""
    logs: list[dict] = []

    case_id    = case.get("case_id", "")
    inv        = case.get("invoice") or {}
    inv_vendor = inv.get("vendor_name_raw") or inv.get("vendor_name", "")
    inv_vendor_norm = inv.get("vendor_name_normalized", "")

    # Always synthesize ingestion + normalization events (they happened even
    # if no AuditEvent was recorded for them individually)
    logs.append({
        "id":        f"{case_id}-al-ingestion",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "caseId":    case_id,
        "stage":     "Ingestion",
        "action":    "Record ingested from CSV",
        "actor":     "System",
        "result":    "SUCCESS",
    })

    if inv_vendor != inv_vendor_norm:
        logs.append({
            "id":        f"{case_id}-al-norm",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "caseId":    case_id,
            "stage":     "Normalization",
            "action":    "Vendor canonicalized",
            "actor":     "System",
            "result":    f"{inv_vendor} → {inv_vendor_norm}",
        })

    # Deterministic match step
    det_status = (case.get("explanation") or {}).get("status") or case.get("status", "")
    logs.append({
        "id":        f"{case_id}-al-det",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "caseId":    case_id,
        "stage":     "Matching",
        "action":    "Deterministic match attempted",
        "actor":     "System",
        "result":    det_status,
    })

    # Fuzzy candidates
    fuzzy = case.get("fuzzy_candidates")
    if fuzzy is not None:
        logs.append({
            "id":        f"{case_id}-al-fuzzy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "caseId":    case_id,
            "stage":     "Matching",
            "action":    "Fuzzy candidates generated",
            "actor":     "System",
            "result":    f"{len(fuzzy)} candidate(s) found. Top score: {fuzzy[0]['score'] if fuzzy else 0}/100",
        })

    # AI Investigation
    ai = case.get("ai_investigation")
    if ai and ai.get("decision"):
        logs.append({
            "id":        f"{case_id}-al-ai-start",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "caseId":    case_id,
            "stage":     "AI Investigation",
            "action":    "AI investigation started",
            "actor":     "LedgerLens AI",
            "result":    "STARTED",
        })
        tool_calls = ai.get("tool_calls_made", [])
        if tool_calls:
            logs.append({
                "id":        f"{case_id}-al-ai-tools",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "caseId":    case_id,
                "stage":     "AI Investigation",
                "action":    f"Evidence collected via {len(tool_calls)} tool call(s)",
                "actor":     "LedgerLens AI",
                "result":    f"{len(ai.get('reasons', []))} evidence items evaluated",
            })
        logs.append({
            "id":        f"{case_id}-al-ai-verdict",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "caseId":    case_id,
            "stage":     "AI Investigation",
            "action":    "AI verdict issued",
            "actor":     "LedgerLens AI",
            "result":    f"{ai.get('decision')} (confidence: {round(ai.get('confidence', 0) * 100)}%)",
        })

    # Validation
    validation = case.get("validation")
    if validation:
        logs.append({
            "id":        f"{case_id}-al-val",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "caseId":    case_id,
            "stage":     "Validation",
            "action":    "Confidence verified",
            "actor":     "System",
            "result":    f"Confidence: {round((case.get('confidence') or 0) * 100)}%  |  "
                         f"{'PASSED' if validation.get('passed') else 'OVERRIDDEN'}",
        })

    # Final status
    final = case.get("final_status") or {}
    final_status_val = final.get("status") or case.get("status", "UNRESOLVED")
    logs.append({
        "id":        f"{case_id}-al-final",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "caseId":    case_id,
        "stage":     "Review",
        "action":    "Final status assigned",
        "actor":     "System",
        "result":    final_status_val,
    })

    return logs


# ---------------------------------------------------------------------------
# Main mapper
# ---------------------------------------------------------------------------

def map_case_to_ui(case: dict) -> dict:
    """
    Transform one backend ReconciliationCase dict into the UI's
    ReconciliationCase shape (camelCase, flat IDs, score ×100).

    This is the single canonical adapter between backend and frontend.
    """
    final_status = case.get("final_status") or {}
    status   = final_status.get("status") or case.get("status", "UNRESOLVED")
    confidence = final_status.get("confidence") or case.get("confidence", 0.0)
    match_score = round(confidence * 100)

    inv  = case.get("invoice")  or {}
    po   = case.get("purchase_order")
    pay  = case.get("payment")
    rec  = case.get("receipt")

    # Top-level IDs (use raw format for display, normalized for lookups)
    invoice_id_raw  = inv.get("invoice_id_raw") or inv.get("invoice_id_normalized", "")
    invoice_num_raw = inv.get("invoice_id_raw") or invoice_id_raw
    po_id_raw       = (po or {}).get("po_id_raw") or (po or {}).get("po_id_normalized", "")
    pay_id_raw      = (pay or {}).get("payment_id_raw") or (pay or {}).get("payment_id_normalized", "")
    vendor_name     = inv.get("vendor_name_raw") or inv.get("vendor_name", "")

    exceptions  = final_status.get("exceptions") or []
    exception_type = exceptions[0] if exceptions else None

    # Determine if AI was involved
    ai_inv      = case.get("ai_investigation")
    ai_assisted = bool(ai_inv and ai_inv.get("decision") and status == "MATCHED")

    return {
        "id":            case.get("case_id", ""),
        "invoiceId":     invoice_id_raw,
        "invoiceNumber": invoice_num_raw,
        "poId":          po_id_raw or None,
        "poNumber":      po_id_raw or None,
        "paymentId":     pay_id_raw or None,
        "vendorName":    vendor_name,
        "invoiceAmount": inv.get("invoice_amount"),
        "paymentAmount": (pay or {}).get("payment_amount"),
        "matchScore":    match_score,
        "status":        "MATCHED" if ai_assisted else status,
        "aiAssisted":    ai_assisted,
        "exceptionType": exception_type,
        "lastUpdated":   datetime.now(timezone.utc).isoformat(),
        "source":        "CSV Import",
        "purchaseOrder": _map_purchase_order(po),
        "invoice":       _map_invoice(inv),
        "payment":       _map_payment(pay),
        "receipt":       _map_receipt(rec),
        "investigation": _map_investigation(case),
        "auditLogs":     _map_audit_logs(case),
    }


def map_cases_to_ui(cases: list[dict]) -> list[dict]:
    """Batch-map all backend cases to UI format."""
    return [map_case_to_ui(c) for c in cases]


# ---------------------------------------------------------------------------
# Dashboard metrics builder
# ---------------------------------------------------------------------------

def build_dashboard_metrics(
    cases_ui:     list[dict],
    cases_raw:    list[dict],
    run_id:       str = "",
) -> dict:
    """
    Build the DashboardMetrics shape the UI's getDashboardMetrics() expects.
    """
    total     = len(cases_ui)
    matched   = sum(1 for c in cases_ui if c["status"] == "MATCHED" and not c.get("aiAssisted"))
    ai_asst   = sum(1 for c in cases_ui if c.get("aiAssisted"))
    review    = sum(1 for c in cases_ui if c["status"] == "NEEDS_REVIEW")
    unresolved = sum(1 for c in cases_ui if c["status"] == "UNRESOLVED")
    match_rate = round((matched + ai_asst) / total * 100, 1) if total else 0.0

    # Exception breakdown
    from collections import Counter
    exc_counter: Counter = Counter()
    for c in cases_ui:
        exc = c.get("exceptionType")
        if exc:
            exc_counter[exc] += 1
    exc_total = sum(exc_counter.values()) or 1
    exception_breakdown = [
        {
            "type":       _exc_label(exc),
            "count":      cnt,
            "percentage": round(cnt / exc_total * 100),
        }
        for exc, cnt in exc_counter.most_common()
    ]

    # Time series — just today's run
    from datetime import date
    today = date.today().strftime("%b %d")
    time_series = [{
        "date":        today,
        "processed":   total,
        "matched":     matched + ai_asst,
        "needsReview": review,
    }]

    return {
        "totalRecords":         total,
        "automaticallyMatched": matched,
        "aiAssisted":           ai_asst,
        "needsReview":          review,
        "unresolved":           unresolved,
        "matchRate":            match_rate,
        "runId":                run_id,
        "trends": {
            "totalRecords":         0,
            "automaticallyMatched": 0,
            "aiAssisted":           0,
            "needsReview":          0,
            "unresolved":           0,
            "matchRate":            0,
        },
        "reconciliationOverview": time_series,
        "exceptionBreakdown":     exception_breakdown,
        "recentInvestigations":   cases_ui[:5],
    }


def _exc_label(code: str) -> str:
    return {
        "AMOUNT_MISMATCH":     "Amount Mismatch",
        "VENDOR_MISMATCH":     "Vendor Mismatch",
        "MISSING_PAYMENT":     "Missing Payment",
        "MISSING_PO":          "Missing PO",
        "MISSING_RECEIPT":     "Missing Receipt",
        "DUPLICATE_LINK":      "Duplicate Invoice",
        "DATE_GAP":            "Date Gap",
        "INSUFFICIENT_EVIDENCE": "Multiple Candidates",
    }.get(code, code.replace("_", " ").title())
