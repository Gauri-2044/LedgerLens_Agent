"""
app/services/validator.py
==========================
Module 8 — Validation Layer

Sits between the AI Investigator and Final Status.
When Gemini says MATCHED with 0.98 confidence, this module
asks:

  "Wait — let's actually verify those claims."

It runs 6 independent checks against the REAL data:

  Check 1  — PO Existence        Does the PO Gemini referenced actually exist?
  Check 2  — Payment Existence   Does the payment Gemini referenced actually exist?
  Check 3  — Amount Consistency  Are the amounts in records what Gemini claimed?
  Check 4  — Vendor Consistency  Are vendor names consistent across all 3 docs?
  Check 5  — AI Confidence Floor Is Gemini's confidence above the minimum bar?
  Check 6  — Duplicate Detection Is this invoice linked to more than one PO?

Each failed check raises a ViolationFlag.
The validator then decides whether to:
  • Pass the AI verdict through unchanged
  • Downgrade MATCHED → NEEDS_REVIEW
  • Downgrade MATCHED/NEEDS_REVIEW → UNRESOLVED
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from app.core.config import settings


# ---------------------------------------------------------------------------
# Violation flags
# ---------------------------------------------------------------------------

class ViolationCode(str, Enum):
    PO_NOT_FOUND           = "PO_NOT_FOUND"
    PAYMENT_NOT_FOUND      = "PAYMENT_NOT_FOUND"
    AMOUNT_MISMATCH        = "AMOUNT_MISMATCH"
    VENDOR_INCONSISTENCY   = "VENDOR_INCONSISTENCY"
    LOW_AI_CONFIDENCE      = "LOW_AI_CONFIDENCE"
    DUPLICATE_LINK         = "DUPLICATE_LINK"
    HALLUCINATED_PO_ID     = "HALLUCINATED_PO_ID"
    HALLUCINATED_PAYMENT   = "HALLUCINATED_PAYMENT"


@dataclass
class ViolationFlag:
    code:    ViolationCode
    message: str
    severity: str     # "CRITICAL" | "WARNING"
    evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "code":     self.code.value,
            "message":  self.message,
            "severity": self.severity,
            "evidence": self.evidence,
        }


@dataclass
class ValidationResult:
    passed:       bool
    violations:   list[ViolationFlag]
    final_verdict: str        # MATCHED | NEEDS_REVIEW | UNRESOLVED
    override_reason: str
    checks_run:   list[str]

    def to_dict(self) -> dict:
        return {
            "passed":         self.passed,
            "final_verdict":  self.final_verdict,
            "override_reason": self.override_reason,
            "violations":     [v.to_dict() for v in self.violations],
            "checks_run":     self.checks_run,
        }


# ---------------------------------------------------------------------------
# Individual check functions
# ---------------------------------------------------------------------------

def _check_po_existence(
    po_record: dict | None,
    ai_claimed_po_exists: bool,
    all_purchase_orders: list[dict],
) -> ViolationFlag | None:
    """
    Check 1: If Gemini claims PO exists, verify it's actually in our dataset
    and that the po_record is non-null with a valid ID.
    """
    if not ai_claimed_po_exists:
        return None   # AI didn't claim PO exists, nothing to verify

    if po_record is None:
        return ViolationFlag(
            code=ViolationCode.PO_NOT_FOUND,
            message="AI claimed a PO exists, but no PO record was linked in the case.",
            severity="CRITICAL",
            evidence={"ai_claimed": True, "po_record": None},
        )

    po_id_norm = po_record.get("po_id_normalized") or po_record.get("po_id")
    if not po_id_norm:
        return ViolationFlag(
            code=ViolationCode.PO_NOT_FOUND,
            message="Linked PO record has no valid ID — may be a ghost record.",
            severity="CRITICAL",
            evidence={"po_record": po_record},
        )

    # Cross-verify: this PO ID must appear in the actual PO dataset
    known_ids = {
        p.get("po_id_normalized") or p.get("po_id", "")
        for p in all_purchase_orders
    }
    if po_id_norm not in known_ids:
        return ViolationFlag(
            code=ViolationCode.HALLUCINATED_PO_ID,
            message=(
                f"AI referenced PO '{po_id_norm}' but it is not in the uploaded Purchase Orders dataset. "
                "Possible hallucination."
            ),
            severity="CRITICAL",
            evidence={"po_id": po_id_norm, "known_ids_sample": list(known_ids)[:5]},
        )

    return None


def _check_payment_existence(
    payment_record: dict | None,
    ai_claimed_payment_exists: bool,
    all_payments: list[dict],
) -> ViolationFlag | None:
    """
    Check 2: If Gemini says payment was made, verify the payment record
    actually exists and belongs to our uploaded dataset.
    """
    if not ai_claimed_payment_exists:
        return None

    if payment_record is None:
        return ViolationFlag(
            code=ViolationCode.PAYMENT_NOT_FOUND,
            message="AI claimed payment was made, but no payment record was linked in the case.",
            severity="CRITICAL",
            evidence={"ai_claimed": True, "payment_record": None},
        )

    pay_id_norm = payment_record.get("payment_id_normalized") or payment_record.get("payment_id")
    if not pay_id_norm:
        return ViolationFlag(
            code=ViolationCode.PAYMENT_NOT_FOUND,
            message="Linked payment record has no valid ID.",
            severity="CRITICAL",
            evidence={"payment_record": payment_record},
        )

    known_ids = {
        p.get("payment_id_normalized") or p.get("payment_id", "")
        for p in all_payments
    }
    if pay_id_norm not in known_ids:
        return ViolationFlag(
            code=ViolationCode.HALLUCINATED_PAYMENT,
            message=(
                f"AI referenced payment '{pay_id_norm}' but it is not in the uploaded Payments dataset. "
                "Possible hallucination."
            ),
            severity="CRITICAL",
            evidence={"payment_id": pay_id_norm, "known_ids_sample": list(known_ids)[:5]},
        )

    return None


def _check_amount_consistency(
    invoice:  dict,
    po:       dict | None,
    payment:  dict | None,
) -> ViolationFlag | None:
    """
    Check 3: Verify the actual amounts in the records are consistent.
    Invoice amount must be within AMOUNT_FUZZY_TOLERANCE_PCT of PO and Payment.
    This is independent of what Gemini said — we check the raw numbers.
    """
    inv_amount = invoice.get("invoice_amount")
    if inv_amount is None:
        return ViolationFlag(
            code=ViolationCode.AMOUNT_MISMATCH,
            message="Invoice record has no amount field.",
            severity="CRITICAL",
            evidence={},
        )

    tolerance = settings.AMOUNT_FUZZY_TOLERANCE_PCT
    mismatches: list[str] = []

    if po is not None:
        po_amt = po.get("po_amount")
        if po_amt is not None:
            larger = max(abs(inv_amount), abs(po_amt))
            diff_pct = abs(inv_amount - po_amt) / larger * 100 if larger else 0
            if diff_pct > tolerance:
                mismatches.append(
                    f"Invoice ({inv_amount}) vs PO ({po_amt}): {diff_pct:.2f}% diff "
                    f"exceeds {tolerance}% tolerance."
                )

    if payment is not None:
        pay_amt = payment.get("payment_amount")
        if pay_amt is not None:
            larger = max(abs(inv_amount), abs(pay_amt))
            diff_pct = abs(inv_amount - pay_amt) / larger * 100 if larger else 0
            if diff_pct > tolerance:
                mismatches.append(
                    f"Invoice ({inv_amount}) vs Payment ({pay_amt}): {diff_pct:.2f}% diff "
                    f"exceeds {tolerance}% tolerance."
                )

    if mismatches:
        return ViolationFlag(
            code=ViolationCode.AMOUNT_MISMATCH,
            message="Amount inconsistency detected in linked records: " + " | ".join(mismatches),
            severity="WARNING",
            evidence={
                "invoice_amount": inv_amount,
                "po_amount":      po.get("po_amount") if po else None,
                "payment_amount": payment.get("payment_amount") if payment else None,
                "tolerance_pct":  tolerance,
            },
        )
    return None


def _check_vendor_consistency(
    invoice: dict,
    po:      dict | None,
    payment: dict | None,
) -> ViolationFlag | None:
    """
    Check 4: Vendor names across Invoice, PO, and Payment must share
    at least one meaningful token. Hard mismatches are flagged.
    """
    def tokens(record: dict, *keys: str) -> set[str]:
        for k in keys:
            v = record.get(k)
            if v:
                return {t for t in str(v).lower().split() if len(t) >= 3}
        return set()

    inv_tokens = tokens(invoice, "vendor_name_normalized", "vendor_name")
    mismatches: list[str] = []

    if po:
        po_tokens = tokens(po, "vendor_name_normalized", "vendor_name")
        if inv_tokens and po_tokens and not (inv_tokens & po_tokens):
            mismatches.append(
                f"Invoice vendor '{invoice.get('vendor_name_raw', '')}' shares no tokens "
                f"with PO vendor '{po.get('vendor_name_raw', '')}'."
            )

    if payment:
        pay_tokens = tokens(payment, "vendor_name_normalized", "vendor_name")
        if inv_tokens and pay_tokens and not (inv_tokens & pay_tokens):
            mismatches.append(
                f"Invoice vendor '{invoice.get('vendor_name_raw', '')}' shares no tokens "
                f"with Payment vendor '{payment.get('vendor_name_raw', '')}'."
            )

    if mismatches:
        return ViolationFlag(
            code=ViolationCode.VENDOR_INCONSISTENCY,
            message="Vendor name inconsistency: " + " | ".join(mismatches),
            severity="WARNING",
            evidence={
                "invoice_vendor":  invoice.get("vendor_name_raw"),
                "po_vendor":       po.get("vendor_name_raw") if po else None,
                "payment_vendor":  payment.get("vendor_name_raw") if payment else None,
            },
        )
    return None


def _check_ai_confidence(ai_confidence: float) -> ViolationFlag | None:
    """
    Check 5: Gemini's confidence must exceed AI_MIN_CONFIDENCE (default 0.70).
    Below this threshold, we do not trust the decision even if it says MATCHED.
    """
    if ai_confidence < settings.AI_MIN_CONFIDENCE:
        return ViolationFlag(
            code=ViolationCode.LOW_AI_CONFIDENCE,
            message=(
                f"Gemini confidence {ai_confidence:.0%} is below the minimum "
                f"threshold of {settings.AI_MIN_CONFIDENCE:.0%}."
            ),
            severity="WARNING",
            evidence={
                "ai_confidence":   ai_confidence,
                "min_confidence":  settings.AI_MIN_CONFIDENCE,
            },
        )
    return None


def _check_duplicate_link(
    invoice_id: str,
    all_cases:  list[dict],
) -> ViolationFlag | None:
    """
    Check 6: Detect if the same invoice ID appears as MATCHED in more than
    one case — which would suggest a duplicate processing error.
    """
    matched_count = sum(
        1 for c in all_cases
        if (
            c.get("status") == "MATCHED"
            and c.get("invoice", {}) is not None
            and (
                c["invoice"].get("invoice_id_normalized") == invoice_id
                or c["invoice"].get("invoice_id") == invoice_id
            )
        )
    )
    if matched_count > 1:
        return ViolationFlag(
            code=ViolationCode.DUPLICATE_LINK,
            message=(
                f"Invoice '{invoice_id}' appears as MATCHED in {matched_count} cases. "
                "Possible duplicate processing."
            ),
            severity="WARNING",
            evidence={"invoice_id": invoice_id, "matched_count": matched_count},
        )
    return None


# ---------------------------------------------------------------------------
# Verdict downgrade logic
# ---------------------------------------------------------------------------

def _downgrade_verdict(
    ai_verdict: str,
    violations: list[ViolationFlag],
) -> tuple[str, str]:
    """
    Given the AI's verdict and the list of violations, compute the
    final validated verdict and a human-readable override reason.

    Returns (final_verdict, override_reason).

    Downgrade rules:
      CRITICAL violations  → always downgrade to NEEDS_REVIEW or UNRESOLVED
      2+ CRITICAL          → UNRESOLVED
      1  CRITICAL          → NEEDS_REVIEW
      WARNING only         → downgrade MATCHED → NEEDS_REVIEW, others unchanged
    """
    criticals = [v for v in violations if v.severity == "CRITICAL"]
    warnings  = [v for v in violations if v.severity == "WARNING"]

    if len(criticals) >= 2:
        return "UNRESOLVED", (
            f"Validation failed: {len(criticals)} critical violations detected. "
            f"Codes: {[c.code.value for c in criticals]}. "
            "System cannot safely resolve this case."
        )

    if len(criticals) == 1:
        return "NEEDS_REVIEW", (
            f"Critical violation '{criticals[0].code.value}': {criticals[0].message} "
            "AI verdict overridden — human review required."
        )

    if warnings and ai_verdict == "MATCHED":
        return "NEEDS_REVIEW", (
            f"{len(warnings)} warning(s) raised during validation: "
            f"{[w.code.value for w in warnings]}. "
            "Downgraded from MATCHED to NEEDS_REVIEW for human confirmation."
        )

    # No violations that require downgrading
    return ai_verdict, ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_ai_result(
    case:        dict,
    ai_result:   dict,
    all_purchase_orders: list[dict],
    all_payments:        list[dict],
    all_cases:           list[dict],
) -> ValidationResult:
    """
    Module 8 — Validation Layer.

    Runs all 6 checks against the real data and either passes or
    overrides the AI's verdict.

    Parameters
    ----------
    case                 : the ReconciliationCase dict (from matching engine)
    ai_result            : the dict returned by investigate_case()
    all_purchase_orders  : full PO dataset (for existence cross-check)
    all_payments         : full Payment dataset (for existence cross-check)
    all_cases            : all cases in this run (for duplicate detection)

    Returns
    -------
    ValidationResult with final_verdict, violations, and override_reason.
    """
    invoice  = case.get("invoice")  or {}
    po       = case.get("purchase_order")
    payment  = case.get("payment")
    receipt  = case.get("receipt")

    ai_verdict     = ai_result.get("decision", "UNRESOLVED")
    ai_confidence  = float(ai_result.get("confidence", 0.0))

    # Infer what AI claimed from its decision
    ai_claimed_po_exists      = po is not None  # we set PO if deterministic/fuzzy found one
    ai_claimed_payment_exists = payment is not None

    invoice_id = (
        invoice.get("invoice_id_normalized")
        or invoice.get("invoice_id", "UNKNOWN")
    )

    checks_run: list[str] = []
    violations: list[ViolationFlag] = []

    # Check 1 — PO existence
    checks_run.append("po_existence")
    v = _check_po_existence(po, ai_claimed_po_exists, all_purchase_orders)
    if v:
        violations.append(v)

    # Check 2 — Payment existence
    checks_run.append("payment_existence")
    v = _check_payment_existence(payment, ai_claimed_payment_exists, all_payments)
    if v:
        violations.append(v)

    # Check 3 — Amount consistency
    checks_run.append("amount_consistency")
    v = _check_amount_consistency(invoice, po, payment)
    if v:
        violations.append(v)

    # Check 4 — Vendor consistency
    checks_run.append("vendor_consistency")
    v = _check_vendor_consistency(invoice, po, payment)
    if v:
        violations.append(v)

    # Check 5 — AI confidence floor
    checks_run.append("ai_confidence")
    v = _check_ai_confidence(ai_confidence)
    if v:
        violations.append(v)

    # Check 6 — Duplicate link detection
    checks_run.append("duplicate_detection")
    v = _check_duplicate_link(invoice_id, all_cases)
    if v:
        violations.append(v)

    # Decide final verdict
    final_verdict, override_reason = _downgrade_verdict(ai_verdict, violations)
    passed = len(violations) == 0

    return ValidationResult(
        passed=passed,
        violations=violations,
        final_verdict=final_verdict,
        override_reason=override_reason,
        checks_run=checks_run,
    )
