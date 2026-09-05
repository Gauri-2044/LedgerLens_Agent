import uuid

from fastapi import APIRouter, File, UploadFile

from app.controllers.process_uploads import (
    handle_invoices,
    handle_payments,
    handle_purchase_orders,
    handle_receipts,
)
from app.helpers.matching import build_reconciliation_cases, summarise_results
from app.helpers.response_mapper import map_cases_to_ui
from app.services.ai_investigator import investigate_unresolved_cases
from app.services.audit import audit_store, record_pipeline_run
from app.services.final_status import apply_final_status_to_cases
from app.services.validator import validate_ai_result
from app.state import update_state

reconcile_route = APIRouter(prefix="/reconcile", tags=["reconcile"])



@reconcile_route.post("/run")
async def run_reconciliation(
    purchase_orders_file: UploadFile | None = File(None),
    invoices_file:        UploadFile | None = File(None),
    payments_file:        UploadFile | None = File(None),
    receipts_file:        UploadFile | None = File(None),
):
    """
    Stages 1-4: Ingest, parse, normalise, deterministic match + XAI.
    Fastest endpoint - no AI calls made.
    """
    po_result  = await handle_purchase_orders(purchase_orders_file)
    inv_result = await handle_invoices(invoices_file)
    pay_result = await handle_payments(payments_file)
    rec_result = await handle_receipts(receipts_file)

    cases   = build_reconciliation_cases(
        purchase_orders = po_result["data"],
        invoices        = inv_result["data"],
        payments        = pay_result["data"],
        receipts        = rec_result["data"],
    )
    summary = summarise_results(cases)

    return {
        "summary":   summary,
        "cases":     cases,
        "documents": {
            "purchase_orders": po_result,
            "invoices":        inv_result,
            "payments":        pay_result,
            "receipts":        rec_result,
        },
    }


@reconcile_route.post("/investigate")
async def run_full_investigation(
    purchase_orders_file: UploadFile | None = File(None),
    invoices_file:        UploadFile | None = File(None),
    payments_file:        UploadFile | None = File(None),
    receipts_file:        UploadFile | None = File(None),
):
    """
    Full 10-module reconciliation pipeline:

    Stage 1  Ingestion          (process_uploads)
    Stage 2  Parsing            (process_uploads)
    Stage 3  Normalization      (process_uploads)
    Stage 4  Deterministic Match + XAI  (matching)
    Stage 5  XAI explanation    (embedded in cases)
    Stage 6  Fuzzy Candidates   (fuzzy_candidates)   -- AMBIGUOUS/UNMATCHED only
    Stage 7  AI Investigation   (ai_investigator)    -- AMBIGUOUS/UNMATCHED only
    Stage 8  Validation         (validator)          -- catches AI hallucinations
    Stage 9  Final Status       (final_status)       -- single authoritative verdict
    Stage 10 Audit Trail        (audit)              -- SHA-256 hash chain
    """
    run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"

    # --- Stages 1-3 ---
    po_result  = await handle_purchase_orders(purchase_orders_file)
    inv_result = await handle_invoices(invoices_file)
    pay_result = await handle_payments(payments_file)
    rec_result = await handle_receipts(receipts_file)

    po_data  = po_result["data"]
    inv_data = inv_result["data"]
    pay_data = pay_result["data"]
    rec_data = rec_result["data"]

    # --- Stage 4: deterministic matching ---
    cases = build_reconciliation_cases(
        purchase_orders=po_data,
        invoices=inv_data,
        payments=pay_data,
        receipts=rec_data,
    )

    # --- Stages 6+7: fuzzy + AI for AMBIGUOUS/UNMATCHED ---
    enriched = await investigate_unresolved_cases(
        cases=cases,
        all_purchase_orders=po_data,
        all_invoices=inv_data,
        all_payments=pay_data,
        all_receipts=rec_data,
    )

    # --- Stage 8: Validation ---
    for case in enriched:
        ai_result = case.get("ai_investigation")
        if ai_result:   # only validate if AI ran
            validation = validate_ai_result(
                case=case,
                ai_result=ai_result,
                all_purchase_orders=po_data,
                all_payments=pay_data,
                all_cases=enriched,
            )
            case["validation"] = validation.to_dict()
            # Apply validation override to case status immediately
            if validation.final_verdict != case.get("status"):
                case["status"] = validation.final_verdict
        else:
            case["validation"] = None

    # --- Stage 9: Final Status ---
    enriched = apply_final_status_to_cases(enriched)

    # --- Stage 10: Audit Trail ---
    audit_events = record_pipeline_run(enriched, run_id=run_id)

    summary = summarise_results(enriched)

    # --- Map to UI format + persist in state for dashboard GET endpoints ---
    cases_ui = map_cases_to_ui(enriched)
    documents = {
        "purchase_orders": po_result,
        "invoices":        inv_result,
        "payments":        pay_result,
        "receipts":        rec_result,
    }
    update_state(
        run_id=run_id,
        cases_raw=enriched,
        cases_ui=cases_ui,
        summary=summary,
        audit_events=audit_events,
        documents=documents,
    )

    return {
        "run_id":       run_id,
        "summary":      summary,
        "cases":        cases_ui,          # Return UI-format cases
        "audit_events": audit_events,
        "documents":    documents,
    }


# ---------------------------------------------------------------------------
# Audit endpoints
# ---------------------------------------------------------------------------

@reconcile_route.get("/audit")
def get_audit_log():
    """Return all audit events recorded in this server session."""
    return {
        "events":  audit_store.get_all(),
        "summary": audit_store.summary(),
    }


@reconcile_route.get("/audit/verify")
def verify_audit_chain():
    """Verify the SHA-256 hash chain is intact (tamper detection)."""
    return audit_store.verify_chain()


@reconcile_route.get("/audit/{case_id}")
def get_case_audit(case_id: str):
    """Return the full audit history for a single reconciliation case."""
    history = audit_store.get_case_history(case_id)
    if not history:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No audit events found for case '{case_id}'.")
    return {"case_id": case_id, "events": history}



@reconcile_route.post("/run")
async def run_reconciliation(
    purchase_orders_file: UploadFile = File(...),
    invoices_file:        UploadFile = File(...),
    payments_file:        UploadFile = File(...),
    receipts_file:        UploadFile = File(...),
):
    """
    Full reconciliation pipeline in one call.

    Accepts 4 CSV files, runs ingestion + parsing + normalisation on each,
    then runs deterministic matching and returns:
      - cases     : list of ReconciliationCase dicts with XAI explanations
      - summary   : aggregate counts per MatchStatus
      - documents : the normalised source records for all 4 doc types
    """
    # --- Stage 1+2+3: ingest, parse, normalise all four files ---
    po_result  = await handle_purchase_orders(purchase_orders_file)
    inv_result = await handle_invoices(invoices_file)
    pay_result = await handle_payments(payments_file)
    rec_result = await handle_receipts(receipts_file)

    # --- Stage 4: deterministic matching ---
    cases   = build_reconciliation_cases(
        purchase_orders = po_result["data"],
        invoices        = inv_result["data"],
        payments        = pay_result["data"],
        receipts        = rec_result["data"],
    )
    summary = summarise_results(cases)

    return {
        "summary":   summary,
        "cases":     cases,
        "documents": {
            "purchase_orders": po_result,
            "invoices":        inv_result,
            "payments":        pay_result,
            "receipts":        rec_result,
        },
    }


@reconcile_route.post("/investigate")
async def run_full_investigation(
    purchase_orders_file: UploadFile = File(...),
    invoices_file:        UploadFile = File(...),
    payments_file:        UploadFile = File(...),
    receipts_file:        UploadFile = File(...),
):
    """
    Full 7-stage reconciliation pipeline.

    Stages 1-4  : same as /reconcile/run (ingest, parse, normalise, deterministic match)
    Stage 5     : XAI explanation per case  (already embedded in cases)
    Stage 6     : Fuzzy candidate generation for AMBIGUOUS/UNMATCHED cases
    Stage 7     : Gemini AI investigation for cases with strong fuzzy candidates

    Returns the same structure as /run but with two extra fields per case:
      - fuzzy_candidates   : top-N candidates from RapidFuzz scoring
      - ai_investigation   : Gemini's structured verdict + tool call trace
    """
    # --- Stages 1-3: ingest, parse, normalise ---
    po_result  = await handle_purchase_orders(purchase_orders_file)
    inv_result = await handle_invoices(invoices_file)
    pay_result = await handle_payments(payments_file)
    rec_result = await handle_receipts(receipts_file)

    # --- Stage 4: deterministic matching ---
    cases = build_reconciliation_cases(
        purchase_orders = po_result["data"],
        invoices        = inv_result["data"],
        payments        = pay_result["data"],
        receipts        = rec_result["data"],
    )

    # --- Stages 6+7: fuzzy candidates + AI investigation for unresolved cases ---
    enriched_cases = await investigate_unresolved_cases(
        cases               = cases,
        all_purchase_orders = po_result["data"],
        all_invoices        = inv_result["data"],
        all_payments        = pay_result["data"],
        all_receipts        = rec_result["data"],
    )

    summary = summarise_results(enriched_cases)

    return {
        "summary":   summary,
        "cases":     enriched_cases,
        "documents": {
            "purchase_orders": po_result,
            "invoices":        inv_result,
            "payments":        pay_result,
            "receipts":        rec_result,
        },
    }
