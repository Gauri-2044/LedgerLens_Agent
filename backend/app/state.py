"""
app/state.py
============
In-memory application state store.

Holds the results of the last reconciliation run so that GET endpoints
(dashboard, cases list, case detail) can serve data without re-running
the pipeline.

Phase 2: replace with PostgreSQL persistence.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class RunState:
    run_id:       str = ""
    ran_at:       str = ""
    cases_ui:     list[dict] = field(default_factory=list)   # UI-mapped cases
    cases_raw:    list[dict] = field(default_factory=list)   # backend-native cases
    summary:      dict       = field(default_factory=dict)
    audit_events: list[dict] = field(default_factory=list)
    documents:    dict       = field(default_factory=dict)

    def is_empty(self) -> bool:
        return not self.run_id


# Singleton — one shared state for the server process
app_state = RunState()


def update_state(
    run_id:       str,
    cases_raw:    list[dict],
    cases_ui:     list[dict],
    summary:      dict,
    audit_events: list[dict],
    documents:    dict,
) -> None:
    app_state.run_id       = run_id
    app_state.ran_at       = datetime.now(timezone.utc).isoformat()
    app_state.cases_raw    = cases_raw
    app_state.cases_ui     = cases_ui
    app_state.summary      = summary
    app_state.audit_events = audit_events
    app_state.documents    = documents
