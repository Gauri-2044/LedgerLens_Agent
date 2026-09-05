"""
app/services/audit.py
======================
Module 10 — Audit Trail

Every decision made by LedgerLens is recorded as an immutable
AuditEvent with a SHA-256 hash. Each event's hash includes the
previous event's hash, forming a tamper-evident chain:

  Event 1 → hash_1 = SHA256(event_1_data)
  Event 2 → hash_2 = SHA256(event_2_data + hash_1)
  Event 3 → hash_3 = SHA256(event_3_data + hash_2)
  ...

If ANY past event is modified, all subsequent hashes break.
This is the same principle as a blockchain, without the network.

Phase 1  — in-memory store (current)
Phase 2  — persisted to PostgreSQL (AUDIT_STORE_IN_DB=true)

Each AuditEvent records:
  • case_id
  • invoice_id
  • pipeline_stage      (which module made this decision)
  • action              (INGESTED / PARSED / MATCHED / FLAGGED / etc.)
  • previous_status     (what the status was before)
  • new_status          (what it became)
  • confidence
  • actor               ("system" | "ai" | "human")
  • details             (arbitrary JSON evidence)
  • timestamp
  • event_hash          (SHA-256 of this event + previous hash)
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Action codes
# ---------------------------------------------------------------------------

class AuditAction:
    INGESTED       = "INGESTED"
    PARSED         = "PARSED"
    NORMALISED     = "NORMALISED"
    DET_MATCHED    = "DETERMINISTIC_MATCHED"
    DET_UNMATCHED  = "DETERMINISTIC_UNMATCHED"
    FUZZY_SCORED   = "FUZZY_SCORED"
    AI_INVESTIGATED = "AI_INVESTIGATED"
    VALIDATED      = "VALIDATED"
    VALIDATION_OVERRIDE = "VALIDATION_OVERRIDE"
    FINAL_MATCHED  = "FINAL_MATCHED"
    FINAL_REVIEW   = "FINAL_NEEDS_REVIEW"
    FINAL_UNRESOLVED = "FINAL_UNRESOLVED"
    HUMAN_APPROVED = "HUMAN_APPROVED"
    HUMAN_REJECTED = "HUMAN_REJECTED"


# ---------------------------------------------------------------------------
# AuditEvent data model
# ---------------------------------------------------------------------------

@dataclass
class AuditEvent:
    case_id:         str
    invoice_id:      str
    pipeline_stage:  str
    action:          str
    previous_status: str
    new_status:      str
    confidence:      float
    actor:           str           # "system" | "ai" | "human"
    details:         dict[str, Any]
    timestamp:       str           = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    event_hash:      str           = field(default="")   # filled after creation
    prev_hash:       str           = field(default="")   # hash of previous event

    def _payload_for_hash(self) -> str:
        """Canonical JSON for hashing (excludes event_hash itself)."""
        payload = {
            "case_id":         self.case_id,
            "invoice_id":      self.invoice_id,
            "pipeline_stage":  self.pipeline_stage,
            "action":          self.action,
            "previous_status": self.previous_status,
            "new_status":      self.new_status,
            "confidence":      round(self.confidence, 6),
            "actor":           self.actor,
            "details":         self.details,
            "timestamp":       self.timestamp,
            "prev_hash":       self.prev_hash,
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))

    def compute_hash(self) -> str:
        """SHA-256 of the canonical payload."""
        return hashlib.sha256(self._payload_for_hash().encode("utf-8")).hexdigest()

    def to_dict(self) -> dict:
        return {
            "case_id":         self.case_id,
            "invoice_id":      self.invoice_id,
            "pipeline_stage":  self.pipeline_stage,
            "action":          self.action,
            "previous_status": self.previous_status,
            "new_status":      self.new_status,
            "confidence":      round(self.confidence, 4),
            "actor":           self.actor,
            "timestamp":       self.timestamp,
            "event_hash":      self.event_hash,
            "prev_hash":       self.prev_hash,
            "details":         self.details,
        }


# ---------------------------------------------------------------------------
# In-memory Audit Store (Phase 1)
# ---------------------------------------------------------------------------

class AuditStore:
    """
    Thread-safe in-memory audit log with SHA-256 hash chaining.

    Phase 2: replace `_events` list with SQLAlchemy inserts.
    """

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []
        self._last_hash: str = "0" * 64   # genesis hash (all zeros)

    def record(
        self,
        case_id:         str,
        invoice_id:      str,
        pipeline_stage:  str,
        action:          str,
        previous_status: str,
        new_status:      str,
        confidence:      float = 0.0,
        actor:           str   = "system",
        details:         dict  | None = None,
    ) -> AuditEvent:
        """
        Create, hash, and store one AuditEvent.

        Returns the stored event (with event_hash filled).
        """
        event = AuditEvent(
            case_id=case_id,
            invoice_id=invoice_id,
            pipeline_stage=pipeline_stage,
            action=action,
            previous_status=previous_status,
            new_status=new_status,
            confidence=confidence,
            actor=actor,
            details=details or {},
            prev_hash=self._last_hash,
        )
        event.event_hash = event.compute_hash()
        self._last_hash  = event.event_hash
        self._events.append(event)

        logger.debug(
            "AUDIT [%s] %s → %s  stage=%s  hash=%s",
            case_id, previous_status, new_status, pipeline_stage, event.event_hash[:12],
        )
        return event

    def get_case_history(self, case_id: str) -> list[dict]:
        """All events for a specific case, in chronological order."""
        return [
            e.to_dict() for e in self._events
            if e.case_id == case_id
        ]

    def get_all(self) -> list[dict]:
        """All recorded events (for export / dashboard)."""
        return [e.to_dict() for e in self._events]

    def verify_chain(self) -> dict:
        """
        Re-compute every hash and verify the chain is intact.

        Returns:
          { "valid": True, "events_checked": N }
          { "valid": False, "broken_at_index": i, "expected": ..., "found": ... }
        """
        prev = "0" * 64
        for i, event in enumerate(self._events):
            expected = hashlib.sha256(
                event._payload_for_hash().encode("utf-8")
            ).hexdigest()
            if event.event_hash != expected:
                return {
                    "valid": False,
                    "broken_at_index": i,
                    "case_id": event.case_id,
                    "expected_hash": expected,
                    "stored_hash":   event.event_hash,
                }
            prev = event.event_hash
        return {"valid": True, "events_checked": len(self._events)}

    def summary(self) -> dict:
        """High-level stats over all stored events."""
        from collections import Counter
        status_counts = Counter(
            e.new_status for e in self._events
            if e.action.startswith("FINAL_")
        )
        return {
            "total_events":       len(self._events),
            "final_status_counts": dict(status_counts),
            "chain_head_hash":    self._last_hash,
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

# One shared store for the lifetime of the process.
# Phase 2: replace with a DB-backed store.
audit_store = AuditStore()


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def record_pipeline_run(
    cases: list[dict],
    run_id: str = "RUN-001",
) -> list[dict]:
    """
    Walk through all enriched cases and record one final audit event
    per case reflecting its final status.

    Returns the list of audit event dicts (one per case).
    """
    audit_events: list[dict] = []

    for case in cases:
        case_id    = case.get("case_id", "UNKNOWN")
        invoice    = case.get("invoice") or {}
        invoice_id = (
            invoice.get("invoice_id_normalized")
            or invoice.get("invoice_id", "UNKNOWN")
        )
        final      = case.get("final_status") or {}
        status     = final.get("status", case.get("status", "UNRESOLVED"))
        confidence = final.get("confidence", case.get("confidence", 0.0))

        # Map status to action code
        action_map = {
            "MATCHED":      AuditAction.FINAL_MATCHED,
            "NEEDS_REVIEW": AuditAction.FINAL_REVIEW,
            "UNRESOLVED":   AuditAction.FINAL_UNRESOLVED,
        }
        action = action_map.get(status, AuditAction.FINAL_UNRESOLVED)

        # Determine actor
        ai_inv = case.get("ai_investigation")
        actor  = "ai" if ai_inv and ai_inv.get("decision") else "system"

        # Collect exceptions from final_status
        exceptions = final.get("exceptions", [])

        event = audit_store.record(
            case_id=case_id,
            invoice_id=invoice_id,
            pipeline_stage="final_status",
            action=action,
            previous_status=case.get("status", "UNRESOLVED"),
            new_status=status,
            confidence=confidence,
            actor=actor,
            details={
                "run_id":         run_id,
                "exceptions":     exceptions,
                "flags":          final.get("flags", []),
                "validation_passed": final.get("validation_passed", True),
                "tool_calls_made": (
                    ai_inv.get("tool_calls_made", []) if ai_inv else []
                ),
            },
        )
        audit_events.append(event.to_dict())

    return audit_events
