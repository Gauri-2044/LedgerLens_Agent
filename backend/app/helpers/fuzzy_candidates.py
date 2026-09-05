"""
app/helpers/fuzzy_candidates.py
================================
Stage 6 — Fuzzy Candidate Generation

When deterministic matching fails (AMBIGUOUS / UNMATCHED), this module
uses RapidFuzz to find the most likely candidate POs/Payments for a
given Invoice by scoring across four signals:

  Signal              Weight   Method
  ------------------  ------   ----------------------------------------
  Vendor similarity    0.50    rapidfuzz token_set_ratio (handles word
                               reordering and abbreviation differences)
  Amount proximity     0.30    Exponential decay on % difference
  Date proximity       0.10    Exponential decay on day gap
  Doc-ID similarity    0.10    rapidfuzz partial_ratio on normalised IDs

Final combined score is 0–100.
Candidates are returned sorted descending by score.

Usage
-----
  from app.helpers.fuzzy_candidates import generate_candidates

  candidates = generate_candidates(
      invoice=inv_record,          # normalised dict from process_uploads
      purchase_orders=po_records,  # list of normalised PO dicts
      payments=pay_records,
      top_n=5,
  )
"""

from __future__ import annotations

import math
from datetime import date
from typing import Any

try:
    from rapidfuzz import fuzz as _fuzz
    _RAPIDFUZZ_AVAILABLE = True
except ImportError:  # graceful fallback if rapidfuzz not installed
    _RAPIDFUZZ_AVAILABLE = False


# ---------------------------------------------------------------------------
# Weights (must sum to 1.0)
# ---------------------------------------------------------------------------

W_VENDOR: float = 0.50
W_AMOUNT: float = 0.30
W_DATE:   float = 0.10
W_DOC_ID: float = 0.10

# Amount decay: score = 100 * exp(-k * diff_pct)
# k = ln(2) / HALF_SCORE_PCT  →  score halves at HALF_SCORE_PCT difference
AMOUNT_HALF_SCORE_PCT: float = 5.0   # 5% difference -> 50 score
_AMOUNT_K = math.log(2) / AMOUNT_HALF_SCORE_PCT

# Date decay: score = 100 * exp(-k * gap_days)
DATE_HALF_SCORE_DAYS: float = 30.0
_DATE_K = math.log(2) / DATE_HALF_SCORE_DAYS


# ---------------------------------------------------------------------------
# Individual signal scorers (all return 0–100)
# ---------------------------------------------------------------------------

def _vendor_score(v1_norm: str | None, v2_norm: str | None) -> float:
    """
    Token-set ratio on normalised vendor strings.
    token_set_ratio handles:
      - word reordering ("AWS India" vs "India AWS")
      - subset matching ("AWS" in "Amazon Web Services India")
    Returns 0–100.
    """
    if not v1_norm or not v2_norm:
        return 0.0
    if not _RAPIDFUZZ_AVAILABLE:
        # Fallback: simple token overlap
        t1 = set(v1_norm.split())
        t2 = set(v2_norm.split())
        denom = max(len(t1), len(t2))
        return (len(t1 & t2) / denom * 100) if denom else 0.0
    return _fuzz.token_set_ratio(v1_norm, v2_norm)


def _amount_score(a1: float | None, a2: float | None) -> float:
    """
    Exponential decay: perfect at 0 diff, halves at AMOUNT_HALF_SCORE_PCT.
    Returns 0–100.
    """
    if a1 is None or a2 is None:
        return 0.0
    larger = max(abs(a1), abs(a2))
    if larger == 0:
        return 100.0
    diff_pct = abs(a1 - a2) / larger * 100
    return round(100 * math.exp(-_AMOUNT_K * diff_pct), 2)


def _date_score(d1_iso: str | None, d2_iso: str | None) -> float:
    """
    Exponential decay: perfect at 0 days gap, halves at DATE_HALF_SCORE_DAYS.
    Returns 0–100.
    """
    if not d1_iso or not d2_iso:
        return 50.0   # unknown date = neutral, not penalised
    try:
        gap = abs((date.fromisoformat(d1_iso) - date.fromisoformat(d2_iso)).days)
        return round(100 * math.exp(-_DATE_K * gap), 2)
    except ValueError:
        return 50.0


def _doc_id_score(id1_norm: str | None, id2_norm: str | None) -> float:
    """
    Partial ratio on normalised doc IDs (separators already stripped).
    Useful when invoice references a PO ID in its own ID string.
    Returns 0–100.
    """
    if not id1_norm or not id2_norm:
        return 0.0
    if not _RAPIDFUZZ_AVAILABLE:
        # Fallback: substring check
        return 80.0 if (id1_norm in id2_norm or id2_norm in id1_norm) else 0.0
    return _fuzz.partial_ratio(id1_norm, id2_norm)


# ---------------------------------------------------------------------------
# Combined scorer
# ---------------------------------------------------------------------------

def _combined_score(
    vendor_s: float,
    amount_s: float,
    date_s:   float,
    doc_id_s: float,
) -> float:
    """Weighted average of all signals, rounded to 2 d.p."""
    return round(
        W_VENDOR * vendor_s
        + W_AMOUNT * amount_s
        + W_DATE   * date_s
        + W_DOC_ID * doc_id_s,
        2,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_candidates(
    invoice: dict[str, Any],
    purchase_orders: list[dict[str, Any]],
    payments: list[dict[str, Any]] | None = None,
    top_n: int = 5,
) -> list[dict[str, Any]]:
    """
    Stage 6 — Fuzzy Candidate Generation.

    For a single Invoice, score every PO (and optionally every Payment)
    across 4 signals and return the top-N candidates, sorted by combined
    score descending.

    Parameters
    ----------
    invoice         : normalised invoice record dict
    purchase_orders : list of normalised PO record dicts
    payments        : list of normalised Payment record dicts (optional)
    top_n           : maximum candidates to return per source type

    Returns
    -------
    list of candidate dicts, each containing:
      {
        "source"        : "purchase_order" | "payment",
        "record"        : <the matched record>,
        "score"         : 0–100  (combined),
        "signal_scores" : { vendor, amount, date, doc_id },
        "explanation"   : human-readable rationale
      }
    Sorted by score descending.
    """
    inv_vendor_norm = invoice.get("vendor_name_normalized") or ""
    inv_vendor_raw  = invoice.get("vendor_name_raw", invoice.get("vendor_name", ""))
    inv_amount      = invoice.get("invoice_amount")
    inv_date        = invoice.get("invoice_date")
    inv_id_norm     = invoice.get("invoice_id_normalized", "")

    candidates: list[dict] = []

    # --- Score each PO ---
    for po in purchase_orders:
        po_vendor_norm = po.get("vendor_name_normalized") or ""
        po_vendor_raw  = po.get("vendor_name_raw", po.get("vendor_name", ""))
        po_amount      = po.get("po_amount")
        po_date        = po.get("po_date")
        po_id_norm     = po.get("po_id_normalized", "")

        v_s = _vendor_score(inv_vendor_norm, po_vendor_norm)
        a_s = _amount_score(inv_amount, po_amount)
        d_s = _date_score(inv_date, po_date)
        i_s = _doc_id_score(inv_id_norm, po_id_norm)
        score = _combined_score(v_s, a_s, d_s, i_s)

        explanation = (
            f"Vendor similarity: {v_s:.1f}/100 "
            f"('{inv_vendor_raw}' vs '{po_vendor_raw}'). "
            f"Amount proximity: {a_s:.1f}/100 "
            f"(invoice={inv_amount}, po={po_amount}). "
            f"Date proximity: {d_s:.1f}/100. "
            f"Doc-ID similarity: {i_s:.1f}/100."
        )

        candidates.append({
            "source": "purchase_order",
            "record": po,
            "score":  score,
            "signal_scores": {
                "vendor": round(v_s, 2),
                "amount": round(a_s, 2),
                "date":   round(d_s, 2),
                "doc_id": round(i_s, 2),
            },
            "explanation": explanation,
        })

    # --- Score each Payment (if provided) ---
    for pay in (payments or []):
        pay_vendor_norm = pay.get("vendor_name_normalized") or ""
        pay_vendor_raw  = pay.get("vendor_name_raw", pay.get("vendor_name", ""))
        pay_amount      = pay.get("payment_amount")
        pay_date        = pay.get("payment_date")
        pay_id_norm     = pay.get("payment_id_normalized", "")

        v_s = _vendor_score(inv_vendor_norm, pay_vendor_norm)
        a_s = _amount_score(inv_amount, pay_amount)
        d_s = _date_score(inv_date, pay_date)
        i_s = _doc_id_score(inv_id_norm, pay_id_norm)
        score = _combined_score(v_s, a_s, d_s, i_s)

        explanation = (
            f"Vendor similarity: {v_s:.1f}/100 "
            f"('{inv_vendor_raw}' vs '{pay_vendor_raw}'). "
            f"Amount proximity: {a_s:.1f}/100 "
            f"(invoice={inv_amount}, payment={pay_amount}). "
            f"Date proximity: {d_s:.1f}/100. "
            f"Doc-ID similarity: {i_s:.1f}/100."
        )

        candidates.append({
            "source": "payment",
            "record": pay,
            "score":  score,
            "signal_scores": {
                "vendor": round(v_s, 2),
                "amount": round(a_s, 2),
                "date":   round(d_s, 2),
                "doc_id": round(i_s, 2),
            },
            "explanation": explanation,
        })

    # Sort descending and take top N
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:top_n]
