"""
app/helpers/matching.py
=======================
Deterministic Reconciliation Engine

This module groups normalised records from 4 document types
(Purchase Orders, Invoices, Payments, Receipts) into
"Reconciliation Cases" and assigns each case an explainable
match status.

Pipeline
--------
  Normalised DataFrames (from process_uploads.py)
          │
          ▼
  build_reconciliation_cases()
          │
          ├── _match_vendor()        field-level vendor check
          ├── _match_amount()        field-level amount check (with tolerance)
          ├── _match_date_proximity() field-level date check
          ├── _compute_confidence()  overall confidence 0.0–1.0
          └── _assign_status()       MATCHED / AMBIGUOUS / UNMATCHED
                                     / NEEDS_REVIEW / UNRESOLVED

XAI (Explainable AI) output
---------------------------
Every ReconciliationCase carries an ``explanation`` dict:
  {
    "confidence": 0.95,
    "status": "MATCHED",
    "factors": [
      {"field": "vendor",  "result": "EXACT",   "weight": 0.35, "detail": "..."},
      {"field": "amount",  "result": "EXACT",   "weight": 0.35, "detail": "..."},
      {"field": "po_link", "result": "PRESENT", "weight": 0.15, "detail": "..."},
      {"field": "payment", "result": "PRESENT", "weight": 0.15, "detail": "..."},
    ],
    "flags": [],
    "human_summary": "All 4 factors matched exactly. High confidence."
  }

Status definitions
------------------
  MATCHED       - All critical factors passed deterministically
  AMBIGUOUS     - Partial match (vendor fuzzy OR amount within tolerance)
  UNMATCHED     - No confident link found between documents
  NEEDS_REVIEW  - Match found but has flags (e.g. date gap, small amount diff)
  UNRESOLVED    - Insufficient data to make any determination
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# Tuneable thresholds
# ---------------------------------------------------------------------------

# Amount is considered an EXACT match within this % of the larger value
AMOUNT_EXACT_TOLERANCE_PCT: float = 0.0   # 0% = must be identical
# Amount is considered a CLOSE match (AMBIGUOUS) within this %
AMOUNT_FUZZY_TOLERANCE_PCT: float = 2.0   # 2% → flags NEEDS_REVIEW

# Minimum fraction of vendor tokens that must overlap for a fuzzy vendor hit
VENDOR_TOKEN_OVERLAP_THRESHOLD: float = 0.5

# Date gap (days) beyond which a NEEDS_REVIEW flag is raised
DATE_GAP_DAYS_WARN: int = 30

# Confidence thresholds
MATCHED_MIN_CONFIDENCE: float   = 0.90
AMBIGUOUS_MIN_CONFIDENCE: float = 0.50


# ---------------------------------------------------------------------------
# Enums & lightweight data models
# ---------------------------------------------------------------------------

class MatchStatus(str, Enum):
    MATCHED      = "MATCHED"
    AMBIGUOUS    = "AMBIGUOUS"
    UNMATCHED    = "UNMATCHED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    UNRESOLVED   = "UNRESOLVED"


class FieldResult(str, Enum):
    EXACT        = "EXACT"        # identical after normalisation
    CLOSE        = "CLOSE"        # within tolerance
    FUZZY        = "FUZZY"        # partial token overlap
    MISSING      = "MISSING"      # document not uploaded
    MISMATCH     = "MISMATCH"     # clearly different
    PRESENT      = "PRESENT"      # doc exists (for PO/payment presence checks)
    ABSENT       = "ABSENT"       # doc missing


@dataclass
class FieldEvidence:
    """XAI: result of matching one field/dimension."""
    field: str                     # e.g. "vendor", "amount", "po_link"
    result: FieldResult
    weight: float                  # contribution to confidence score
    score: float                   # 0.0 – 1.0 for this field
    detail: str                    # human-readable explanation
    raw_values: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "field":      self.field,
            "result":     self.result.value,
            "weight":     self.weight,
            "score":      round(self.score, 4),
            "detail":     self.detail,
            "raw_values": self.raw_values,
        }


@dataclass
class ReconciliationCase:
    """
    One logical business transaction grouping:
      PO  →  Invoice  →  Payment  →  Receipt
    Each slot holds the raw record dict (or None if missing).
    """
    case_id: str
    purchase_order: dict | None
    invoice: dict | None
    payment: dict | None
    receipt: dict | None
    status: MatchStatus = MatchStatus.UNRESOLVED
    confidence: float = 0.0
    factors: list[FieldEvidence] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)
    human_summary: str = ""

    def to_dict(self) -> dict:
        return {
            "case_id":        self.case_id,
            "status":         self.status.value,
            "confidence":     round(self.confidence, 4),
            "purchase_order": self.purchase_order,
            "invoice":        self.invoice,
            "payment":        self.payment,
            "receipt":        self.receipt,
            "explanation": {
                "confidence":    round(self.confidence, 4),
                "status":        self.status.value,
                "factors":       [f.to_dict() for f in self.factors],
                "flags":         self.flags,
                "human_summary": self.human_summary,
            },
        }


# ---------------------------------------------------------------------------
# Internal field-level matchers
# ---------------------------------------------------------------------------

def _token_set(s: str | None) -> set[str]:
    """Split normalised vendor string into meaningful tokens (len >= 3)."""
    if not s:
        return set()
    # Remove very short filler tokens (a, of, the, pvt, ltd already expanded)
    return {t for t in re.split(r"\s+", s.lower().strip()) if len(t) >= 3}


def _match_vendor(
    v1_norm: str | None,
    v2_norm: str | None,
    v1_raw: str = "",
    v2_raw: str = "",
    weight: float = 0.35,
) -> FieldEvidence:
    """
    Compare two normalised vendor names.

    Priority:
      1. EXACT  — normalised strings are identical
      2. FUZZY  — token overlap >= VENDOR_TOKEN_OVERLAP_THRESHOLD
      3. MISMATCH
    """
    if v1_norm is None or v2_norm is None:
        return FieldEvidence(
            field="vendor", result=FieldResult.MISSING, weight=weight, score=0.0,
            detail="One or both vendor names are missing.",
            raw_values={"v1": v1_raw, "v2": v2_raw},
        )

    if v1_norm == v2_norm:
        return FieldEvidence(
            field="vendor", result=FieldResult.EXACT, weight=weight, score=1.0,
            detail=f"Vendor names match exactly after normalisation: '{v1_norm}'.",
            raw_values={"v1": v1_raw, "v2": v2_raw, "normalised": v1_norm},
        )

    # Token overlap
    t1, t2 = _token_set(v1_norm), _token_set(v2_norm)
    if t1 and t2:
        overlap = len(t1 & t2) / max(len(t1), len(t2))
    else:
        overlap = 0.0

    if overlap >= VENDOR_TOKEN_OVERLAP_THRESHOLD:
        score = 0.5 + 0.4 * overlap   # 0.5 – 0.9 range for fuzzy
        common = sorted(t1 & t2)
        return FieldEvidence(
            field="vendor", result=FieldResult.FUZZY, weight=weight, score=score,
            detail=(
                f"Vendor names partially match (token overlap {overlap:.0%}). "
                f"Common tokens: {common}. "
                f"'{v1_raw}' vs '{v2_raw}'."
            ),
            raw_values={"v1": v1_raw, "v2": v2_raw, "overlap_pct": round(overlap, 3), "common_tokens": common},
        )

    return FieldEvidence(
        field="vendor", result=FieldResult.MISMATCH, weight=weight, score=0.0,
        detail=f"Vendor names do not match: '{v1_raw}' vs '{v2_raw}'.",
        raw_values={"v1": v1_raw, "v2": v2_raw, "overlap_pct": round(overlap, 3)},
    )


def _match_amount(
    a1: float | None,
    a2: float | None,
    label1: str = "doc1",
    label2: str = "doc2",
    weight: float = 0.35,
) -> tuple[FieldEvidence, list[str]]:
    """
    Compare two normalised amounts.

    Returns (FieldEvidence, flags)  — flags are raised on CLOSE matches.
    """
    flags: list[str] = []

    if a1 is None or a2 is None:
        return FieldEvidence(
            field="amount", result=FieldResult.MISSING, weight=weight, score=0.0,
            detail="One or both amounts are missing.",
            raw_values={label1: a1, label2: a2},
        ), flags

    diff = abs(a1 - a2)
    larger = max(abs(a1), abs(a2))
    diff_pct = (diff / larger * 100) if larger else 0.0

    if diff_pct <= AMOUNT_EXACT_TOLERANCE_PCT:
        return FieldEvidence(
            field="amount", result=FieldResult.EXACT, weight=weight, score=1.0,
            detail=f"Amounts match exactly: {a1} == {a2}.",
            raw_values={label1: a1, label2: a2, "diff": 0.0},
        ), flags

    if diff_pct <= AMOUNT_FUZZY_TOLERANCE_PCT:
        flags.append(
            f"Amount difference of {diff:.2f} ({diff_pct:.2f}%) between {label1} and {label2}. "
            "Within tolerance but flagged for review."
        )
        score = max(0.5, 1.0 - diff_pct / AMOUNT_FUZZY_TOLERANCE_PCT * 0.5)
        return FieldEvidence(
            field="amount", result=FieldResult.CLOSE, weight=weight, score=score,
            detail=(
                f"Amounts are close but not identical: {a1} vs {a2} "
                f"(diff {diff:.2f}, {diff_pct:.2f}%). Flagged for review."
            ),
            raw_values={label1: a1, label2: a2, "diff": round(diff, 2), "diff_pct": round(diff_pct, 4)},
        ), flags

    return FieldEvidence(
        field="amount", result=FieldResult.MISMATCH, weight=weight, score=0.0,
        detail=(
            f"Amounts do not match: {a1} vs {a2} "
            f"(diff {diff:.2f}, {diff_pct:.2f}% — exceeds {AMOUNT_FUZZY_TOLERANCE_PCT}% tolerance)."
        ),
        raw_values={label1: a1, label2: a2, "diff": round(diff, 2), "diff_pct": round(diff_pct, 4)},
    ), flags


def _match_doc_presence(
    doc: dict | None,
    doc_label: str,
    field_name: str,
    weight: float = 0.15,
) -> FieldEvidence:
    """Check whether a linked document (PO / Payment / Receipt) exists."""
    if doc is not None:
        doc_id = doc.get(f"{doc_label}_id_normalized") or doc.get(f"{doc_label}_id", "N/A")
        return FieldEvidence(
            field=field_name, result=FieldResult.PRESENT, weight=weight, score=1.0,
            detail=f"{doc_label.upper()} record found: ID={doc_id}.",
            raw_values={"doc_id": doc_id},
        )
    return FieldEvidence(
        field=field_name, result=FieldResult.ABSENT, weight=weight, score=0.0,
        detail=f"No {doc_label.upper()} record linked to this case.",
        raw_values={},
    )


def _check_date_gap(
    date1: str | None,
    date2: str | None,
    label1: str,
    label2: str,
) -> list[str]:
    """
    Return a flag string if date gap exceeds DATE_GAP_DAYS_WARN.
    Dates must be ISO strings (YYYY-MM-DD).
    """
    if not date1 or not date2:
        return []
    try:
        from datetime import date
        d1 = date.fromisoformat(date1)
        d2 = date.fromisoformat(date2)
        gap = abs((d2 - d1).days)
        if gap > DATE_GAP_DAYS_WARN:
            return [
                f"Large date gap of {gap} days between {label1} ({date1}) "
                f"and {label2} ({date2}). May indicate a delayed transaction."
            ]
    except Exception:
        pass
    return []


# ---------------------------------------------------------------------------
# Confidence & status computation
# ---------------------------------------------------------------------------

def _compute_confidence(factors: list[FieldEvidence]) -> float:
    """
    Weighted confidence score.
    confidence = sum(factor.weight * factor.score) / sum(factor.weight)
    """
    total_weight = sum(f.weight for f in factors)
    if total_weight == 0:
        return 0.0
    weighted_sum = sum(f.weight * f.score for f in factors)
    return round(weighted_sum / total_weight, 4)


def _assign_status(
    confidence: float,
    factors: list[FieldEvidence],
    flags: list[str],
) -> MatchStatus:
    """
    Map confidence + factor results to a final MatchStatus.

    Rules (in priority order):
      1. If vendor is MISMATCH  → UNMATCHED  (hard block)
      2. If amount is MISMATCH  → UNMATCHED  (hard block)
      3. confidence >= 0.90     → MATCHED (or NEEDS_REVIEW if flags exist)
      4. confidence >= 0.50     → AMBIGUOUS
      5. else                   → UNMATCHED
    """
    vendor_result = next((f.result for f in factors if f.field == "vendor"), None)
    amount_result = next((f.result for f in factors if f.field == "amount"), None)

    if vendor_result == FieldResult.MISMATCH:
        return MatchStatus.UNMATCHED
    if amount_result == FieldResult.MISMATCH:
        return MatchStatus.UNMATCHED

    if confidence >= MATCHED_MIN_CONFIDENCE:
        return MatchStatus.NEEDS_REVIEW if flags else MatchStatus.MATCHED

    if confidence >= AMBIGUOUS_MIN_CONFIDENCE:
        return MatchStatus.AMBIGUOUS

    return MatchStatus.UNMATCHED


def _build_human_summary(
    status: MatchStatus,
    confidence: float,
    factors: list[FieldEvidence],
    flags: list[str],
) -> str:
    """
    Generate a plain-English explanation of the match outcome.
    This is the core of the XAI feature.
    """
    lines: list[str] = []

    # Status headline
    headlines = {
        MatchStatus.MATCHED:      f"✅ MATCHED — All critical factors aligned. Confidence: {confidence:.0%}.",
        MatchStatus.NEEDS_REVIEW: f"⚠️  NEEDS REVIEW — Match found but flags raised. Confidence: {confidence:.0%}.",
        MatchStatus.AMBIGUOUS:    f"🔶 AMBIGUOUS — Partial match only. Confidence: {confidence:.0%}.",
        MatchStatus.UNMATCHED:    f"❌ UNMATCHED — Could not establish confident link. Confidence: {confidence:.0%}.",
        MatchStatus.UNRESOLVED:   f"❓ UNRESOLVED — Insufficient data. Confidence: {confidence:.0%}.",
    }
    lines.append(headlines.get(status, f"Status: {status.value}"))

    # Per-factor breakdown
    lines.append("")
    lines.append("Factor breakdown:")
    for ev in factors:
        icon = {
            FieldResult.EXACT:    "✅",
            FieldResult.PRESENT:  "✅",
            FieldResult.CLOSE:    "🔶",
            FieldResult.FUZZY:    "🔶",
            FieldResult.MISSING:  "⬜",
            FieldResult.ABSENT:   "⬜",
            FieldResult.MISMATCH: "❌",
        }.get(ev.result, "⬜")
        lines.append(f"  {icon} [{ev.field.upper()}] {ev.result.value} — {ev.detail}")

    # Flags
    if flags:
        lines.append("")
        lines.append("Flags raised:")
        for flag in flags:
            lines.append(f"  ⚠️  {flag}")

    # Closing note for non-MATCHED statuses
    if status in (MatchStatus.UNMATCHED, MatchStatus.AMBIGUOUS):
        lines.append("")
        lines.append(
            "Note: 'Unmatched' does NOT mean the transaction is invalid — "
            "it means deterministic rules could not prove a match. "
            "Human review or AI fuzzy matching may resolve this."
        )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Core: case builder for one Invoice
# ---------------------------------------------------------------------------

def _build_case_for_invoice(
    case_idx: int,
    invoice: dict,
    purchase_orders: list[dict],
    payments: list[dict],
    receipts: list[dict],
) -> ReconciliationCase:
    """
    Attempt to link a single Invoice record to:
      - A Purchase Order (by vendor + amount)
      - A Payment       (by vendor + amount)
      - A Receipt       (by vendor + amount)

    Returns a fully annotated ReconciliationCase.
    """
    inv_vendor_norm = invoice.get("vendor_name_normalized")
    inv_vendor_raw  = invoice.get("vendor_name_raw", invoice.get("vendor_name", ""))
    inv_amount      = invoice.get("invoice_amount")
    inv_date        = invoice.get("invoice_date")
    inv_id          = invoice.get("invoice_id_normalized", invoice.get("invoice_id", f"INV{case_idx:04d}"))

    case_id = f"RC-{case_idx:04d}"
    flags: list[str] = []

    # ---- Find best-matching PO ----
    best_po: dict | None = None
    best_po_score: float = -1.0

    for po in purchase_orders:
        po_vn  = po.get("vendor_name_normalized")
        po_vr  = po.get("vendor_name_raw", po.get("vendor_name", ""))
        po_amt = po.get("po_amount")
        po_dt  = po.get("po_date")

        v_ev = _match_vendor(inv_vendor_norm, po_vn, inv_vendor_raw, po_vr, weight=1.0)
        a_ev, _ = _match_amount(inv_amount, po_amt, "invoice", "po", weight=1.0)
        combined = (v_ev.score + a_ev.score) / 2

        if combined > best_po_score:
            best_po_score = combined
            best_po = po if combined > 0 else None

    # ---- Find best-matching Payment ----
    best_pay: dict | None = None
    best_pay_score: float = -1.0

    for pay in payments:
        pay_vn  = pay.get("vendor_name_normalized")
        pay_vr  = pay.get("vendor_name_raw", pay.get("vendor_name", ""))
        pay_amt = pay.get("payment_amount")
        pay_dt  = pay.get("payment_date")

        v_ev = _match_vendor(inv_vendor_norm, pay_vn, inv_vendor_raw, pay_vr, weight=1.0)
        a_ev, _ = _match_amount(inv_amount, pay_amt, "invoice", "payment", weight=1.0)
        combined = (v_ev.score + a_ev.score) / 2

        if combined > best_pay_score:
            best_pay_score = combined
            best_pay = pay if combined > 0 else None

    # ---- Find best-matching Receipt ----
    best_rec: dict | None = None
    best_rec_score: float = -1.0

    for rec in receipts:
        rec_vn  = rec.get("vendor_name_normalized")
        rec_vr  = rec.get("vendor_name_raw", rec.get("vendor_name", ""))
        rec_amt = rec.get("receipt_amount")

        v_ev = _match_vendor(inv_vendor_norm, rec_vn, inv_vendor_raw, rec_vr, weight=1.0)
        a_ev, _ = _match_amount(inv_amount, rec_amt, "invoice", "receipt", weight=1.0)
        combined = (v_ev.score + a_ev.score) / 2

        if combined > best_rec_score:
            best_rec_score = combined
            best_rec = rec if combined > 0 else None

    # ---- Build evidence factors for this invoice ----

    # Factor 1: Vendor match (invoice ↔ PO, or invoice ↔ Payment as fallback)
    ref_vendor_norm = (
        (best_po or {}).get("vendor_name_normalized") or
        (best_pay or {}).get("vendor_name_normalized")
    )
    ref_vendor_raw = (
        (best_po or {}).get("vendor_name_raw", "") or
        (best_pay or {}).get("vendor_name_raw", "")
    )
    vendor_ev = _match_vendor(
        inv_vendor_norm, ref_vendor_norm,
        inv_vendor_raw, ref_vendor_raw,
        weight=0.35,
    )

    # Factor 2: Amount match (invoice ↔ PO preferred, else payment)
    ref_amount = (
        (best_po or {}).get("po_amount") or
        (best_pay or {}).get("payment_amount")
    )
    amount_ev, amt_flags = _match_amount(
        inv_amount, ref_amount,
        "invoice", "po/payment",
        weight=0.35,
    )
    flags.extend(amt_flags)

    # Factor 3: PO presence
    po_ev = _match_doc_presence(best_po, "po", "po_link", weight=0.15)

    # Factor 4: Payment presence
    pay_ev = _match_doc_presence(best_pay, "payment", "payment_link", weight=0.15)

    all_factors = [vendor_ev, amount_ev, po_ev, pay_ev]

    # ---- Date gap flags ----
    if best_po:
        flags.extend(_check_date_gap(best_po.get("po_date"), inv_date, "PO date", "Invoice date"))
    if best_pay:
        flags.extend(_check_date_gap(inv_date, best_pay.get("payment_date"), "Invoice date", "Payment date"))

    # ---- Compute confidence and status ----
    confidence = _compute_confidence(all_factors)
    status = _assign_status(confidence, all_factors, flags)
    human_summary = _build_human_summary(status, confidence, all_factors, flags)

    return ReconciliationCase(
        case_id=case_id,
        purchase_order=best_po,
        invoice=invoice,
        payment=best_pay,
        receipt=best_rec,
        status=status,
        confidence=confidence,
        factors=all_factors,
        flags=flags,
        human_summary=human_summary,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_reconciliation_cases(
    purchase_orders: list[dict],
    invoices: list[dict],
    payments: list[dict],
    receipts: list[dict],
) -> list[dict]:
    """
    Main entry point for the reconciliation engine.

    Takes 4 lists of normalised record dicts (output of process_uploads
    pipeline) and returns a list of ReconciliationCase dicts, one per
    invoice record, each with a full XAI explanation.

    Parameters
    ----------
    purchase_orders : list[dict]  — normalised PO records
    invoices        : list[dict]  — normalised Invoice records
    payments        : list[dict]  — normalised Payment records
    receipts        : list[dict]  — normalised Receipt records

    Returns
    -------
    list[dict]  — serialised ReconciliationCase objects
    """
    if not invoices:
        return []

    cases = []
    for idx, invoice in enumerate(invoices, start=1):
        case = _build_case_for_invoice(
            case_idx=idx,
            invoice=invoice,
            purchase_orders=purchase_orders,
            payments=payments,
            receipts=receipts,
        )
        cases.append(case.to_dict())

    return cases


def summarise_results(cases: list[dict]) -> dict:
    """
    Aggregate summary across all reconciliation cases.

    Returns counts and percentages per MatchStatus, plus lists of
    case IDs for each bucket — useful for dashboard display.
    """
    buckets: dict[str, list[str]] = {
        s.value: [] for s in MatchStatus
    }
    for case in cases:
        status = case.get("status", MatchStatus.UNRESOLVED.value)
        buckets.setdefault(status, []).append(case["case_id"])

    total = len(cases)
    summary = {"total_cases": total, "breakdown": {}}
    for status, ids in buckets.items():
        count = len(ids)
        summary["breakdown"][status] = {
            "count":   count,
            "pct":     round(count / total * 100, 1) if total else 0.0,
            "case_ids": ids,
        }
    return summary
