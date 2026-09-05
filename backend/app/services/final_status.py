"""
app/services/final_status.py
=============================
Module 9 — Final Status + Exceptions

This is the last decision gate before the Audit Trail.

It consolidates three signal sources:
  1. Deterministic match result       (from matching.py)
  2. AI investigation verdict         (from ai_investigator.py)
  3. Validation result                (from validator.py)

...and produces the single authoritative FinalStatus:

  MATCHED      — System has sufficient, verified evidence.
  NEEDS_REVIEW — Likely related; human confirmation required.
  UNRESOLVED   — Evidence insufficient or conflicting.

The FinalStatus also carries:
  • exceptions  : list of exception codes (AMOUNT_MISMATCH, etc.)
  • recommended_action : plain-English next step
  • decision_trail     : ordered log of each stage's contribution

IMPORTANT: UNRESOLVED does NOT mean fraud or invalid.
It means the system cannot safely automate a decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Exception codes
# ---------------------------------------------------------------------------

KNOWN_EXCEPTIONS = {
    "AMOUNT_MISMATCH",
    "VENDOR_MISMATCH",
    "MISSING_PO",
    "MISSING_PAYMENT",
    "MISSING_RECEIPT",
    "DATE_GAP",
    "DUPLICATE_SUSPECTED",
    "INSUFFICIENT_EVIDENCE",
    "LOW_AI_CONFIDENCE",
    "HALLUCINATED_PO_ID",
    "HALLUCINATED_PAYMENT",
    "VALIDATION_OVERRIDE",
}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class DecisionStep:
    """One stage in the decision trail."""
    stage:   str    # e.g. "deterministic", "ai_investigation", "validation"
    verdict: str    # MATCHED / AMBIGUOUS / UNMATCHED / NEEDS_REVIEW / UNRESOLVED
    confidence: float
    summary: str

    def to_dict(self) -> dict:
        return {
            "stage":      self.stage,
            "verdict":    self.verdict,
            "confidence": round(self.confidence, 4),
            "summary":    self.summary,
        }


@dataclass
class FinalStatus:
    status:             str              # MATCHED | NEEDS_REVIEW | UNRESOLVED
    confidence:         float
    exceptions:         list[str]        # exception codes
    recommended_action: str
    decision_trail:     list[DecisionStep]
    flags:              list[str]        # human-readable flag messages
    validation_passed:  bool

    def to_dict(self) -> dict:
        return {
            "status":             self.status,
            "confidence":         round(self.confidence, 4),
            "exceptions":         self.exceptions,
            "recommended_action": self.recommended_action,
            "validation_passed":  self.validation_passed,
            "flags":              self.flags,
            "decision_trail":     [s.to_dict() for s in self.decision_trail],
        }


# ---------------------------------------------------------------------------
# Recommended action templates
# ---------------------------------------------------------------------------

_ACTIONS = {
    "MATCHED": (
        "No action required. This transaction is fully reconciled. "
        "File in completed records."
    ),
    "NEEDS_REVIEW": (
        "Assign to finance team for manual verification. "
        "Review flagged exceptions before approving payment."
    ),
    "UNRESOLVED": (
        "Escalate to senior finance officer. "
        "Gather missing documentation (PO / payment confirmation). "
        "Do NOT process payment until resolved."
    ),
}


# ---------------------------------------------------------------------------
# Core consolidation logic
# ---------------------------------------------------------------------------

def _collect_exceptions(
    case:          dict,
    ai_result:     dict | None,
    validation:    Any,            # ValidationResult
) -> list[str]:
    """
    Collect all unique exception codes from:
      • AI investigation exceptions
      • Validation violation codes
      • Case flags (deterministic XAI flags)
    """
    codes: set[str] = set()

    # From AI result
    if ai_result:
        for exc in ai_result.get("exceptions", []):
            if exc in KNOWN_EXCEPTIONS:
                codes.add(exc)

    # From validation violations
    if validation:
        for viol in validation.violations:
            codes.add(viol.code.value)

    # From deterministic XAI flags  (case-level)
    case_flags = case.get("explanation", {}).get("flags", [])
    for flag_msg in case_flags:
        # Infer exception codes from flag message content
        if "amount" in flag_msg.lower():
            codes.add("AMOUNT_MISMATCH")
        if "date" in flag_msg.lower() and "gap" in flag_msg.lower():
            codes.add("DATE_GAP")

    # From case-level fields
    if case.get("purchase_order") is None:
        codes.add("MISSING_PO")
    if case.get("payment") is None:
        codes.add("MISSING_PAYMENT")
    if case.get("receipt") is None:
        codes.add("MISSING_RECEIPT")

    return sorted(codes)


def _build_decision_trail(
    case:        dict,
    ai_result:   dict | None,
    validation:  Any,
) -> list[DecisionStep]:
    """
    Build the ordered audit trail of all decisions made.
    """
    trail: list[DecisionStep] = []

    # Step 1: Deterministic
    det_status = case.get("status", "UNRESOLVED")
    det_conf   = case.get("confidence", 0.0)
    det_summary = case.get("explanation", {}).get("human_summary", "Deterministic matching stage.")
    trail.append(DecisionStep(
        stage="deterministic_matching",
        verdict=det_status,
        confidence=det_conf,
        summary=det_summary.split("\n")[0],   # first line only
    ))

    # Step 2: Fuzzy candidates
    fuzzy = case.get("fuzzy_candidates")
    if fuzzy is not None:
        top_score = fuzzy[0]["score"] if fuzzy else 0.0
        trail.append(DecisionStep(
            stage="fuzzy_candidate_generation",
            verdict="CANDIDATES_FOUND" if fuzzy else "NO_CANDIDATES",
            confidence=top_score / 100,
            summary=(
                f"{len(fuzzy)} fuzzy candidate(s) generated. "
                f"Top score: {top_score}/100."
            ) if fuzzy else "No strong fuzzy candidates found.",
        ))

    # Step 3: AI investigation
    if ai_result:
        trail.append(DecisionStep(
            stage="ai_investigation",
            verdict=ai_result.get("decision", "UNRESOLVED"),
            confidence=float(ai_result.get("confidence", 0.0)),
            summary=(
                "AI verdict: " + ai_result.get("decision", "?") + ". "
                + "; ".join(ai_result.get("reasons", [])[:2])
            ),
        ))

    # Step 4: Validation
    if validation:
        trail.append(DecisionStep(
            stage="validation",
            verdict=validation.final_verdict,
            confidence=1.0 if validation.passed else 0.5,
            summary=(
                f"Validation {'PASSED' if validation.passed else 'FAILED'}. "
                + (
                    validation.override_reason
                    or f"{len(validation.violations)} violation(s) found."
                )
            ),
        ))

    return trail


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_final_status(
    case:       dict,
    ai_result:  dict | None  = None,
    validation: Any          = None,   # ValidationResult | None
) -> FinalStatus:
    """
    Module 9 — Final Status.

    Produce the single authoritative FinalStatus for a reconciliation case
    by consolidating deterministic, AI, and validation signals.

    Decision priority (highest wins):
      1. Validation override   — if validation raised CRITICAL violations
      2. AI verdict            — if AI investigation ran
      3. Deterministic verdict — if no AI ran (MATCHED cases skip AI)

    Parameters
    ----------
    case       : enriched ReconciliationCase dict
    ai_result  : Gemini investigation result (or None if AI didn't run)
    validation : ValidationResult (or None if validation didn't run)

    Returns
    -------
    FinalStatus dataclass
    """
    # ---- Determine status priority ----

    # Start from deterministic
    status     = case.get("status", "UNRESOLVED")
    confidence = float(case.get("confidence", 0.0))

    # AI can upgrade AMBIGUOUS/UNMATCHED
    if ai_result and ai_result.get("decision"):
        ai_decision = ai_result["decision"]
        ai_conf     = float(ai_result.get("confidence", 0.0))

        # Only upgrade; AI can't turn MATCHED into something worse here
        # (validation handles downgrades)
        if status in ("AMBIGUOUS", "UNMATCHED", "UNRESOLVED"):
            status     = ai_decision
            confidence = ai_conf

    # Validation has final authority to downgrade
    if validation and validation.final_verdict != status:
        if validation.final_verdict in ("NEEDS_REVIEW", "UNRESOLVED"):
            status     = validation.final_verdict
            confidence = min(confidence, 0.75)   # cap confidence on override

    # ---- Collect everything ----
    exceptions = _collect_exceptions(case, ai_result, validation)
    trail      = _build_decision_trail(case, ai_result, validation)

    # Collect all human-readable flag messages
    flags: list[str] = []
    flags.extend(case.get("explanation", {}).get("flags", []))
    if validation:
        for viol in validation.violations:
            flags.append(f"[{viol.severity}] {viol.message}")
    if ai_result:
        for exc in ai_result.get("exceptions", []):
            if exc not in (v.code.value for v in (validation.violations if validation else [])):
                flags.append(f"[AI] Exception: {exc}")

    recommended_action = _ACTIONS.get(status, _ACTIONS["UNRESOLVED"])
    validation_passed  = validation.passed if validation else True

    return FinalStatus(
        status=status,
        confidence=confidence,
        exceptions=exceptions,
        recommended_action=recommended_action,
        decision_trail=trail,
        flags=flags,
        validation_passed=validation_passed,
    )


def apply_final_status_to_cases(cases: list[dict]) -> list[dict]:
    """
    Convenience wrapper: computes FinalStatus for every case in the list
    and attaches it under the 'final_status' key.

    Handles both simple (no-AI) and fully enriched cases.
    """
    for case in cases:
        ai_result  = case.get("ai_investigation")
        validation_raw = case.get("validation")

        fs = compute_final_status(
            case=case,
            ai_result=ai_result,
            validation=None,   # ValidationResult object not re-serialisable here;
                               # validator.to_dict() already stored in case["validation"]
        )
        case["final_status"] = fs.to_dict()
        case["status"]       = fs.status
        case["confidence"]   = fs.confidence

    return cases
