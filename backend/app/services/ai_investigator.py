"""
app/services/ai_investigator.py
================================
Stage 7 — AI Investigation (Gemini Agentic Layer)

This service receives AMBIGUOUS or UNMATCHED reconciliation cases
(together with their fuzzy candidates) and asks Gemini to investigate
whether the records belong to the same financial transaction.

Gemini is given:
  • The invoice under investigation
  • The top fuzzy candidate (PO or Payment)
  • Any available payment/receipt records
  • A set of tool functions it can call to analyse the evidence

Gemini's tools
--------------
  search_vendor(name)              - finds normalised vendor aliases
  search_po(po_id)                 - looks up PO by ID
  search_payment(vendor, amount)   - finds payments matching vendor+amount
  calculate_variance(a, b)         - computes abs diff and % diff
  compare_records(r1, r2, fields)  - field-by-field diff table

Gemini returns structured JSON:
  {
    "decision":            "MATCHED" | "NEEDS_REVIEW" | "UNRESOLVED",
    "confidence":          0.0 – 1.0,
    "reasons":             [str, ...],
    "exceptions":          [str, ...],   # e.g. "AMOUNT_MISMATCH"
    "recommended_action":  str
  }

Env variable required
---------------------
  GEMINI_API_KEY  — your Google AI Studio API key

If the key is missing or the API call fails, the service returns a
graceful UNRESOLVED result so the pipeline does not crash.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini client (lazy import so the app starts even without the package)
# ---------------------------------------------------------------------------

try:
    import google.generativeai as genai
    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False
    logger.warning(
        "google-generativeai not installed. AI investigation will return "
        "UNRESOLVED for all cases. Run: pip install google-generativeai"
    )

GEMINI_MODEL = "gemini-2.5-flash"


# ---------------------------------------------------------------------------
# Tool implementations (Python-side)
# These are called by our code when Gemini issues a tool call.
# ---------------------------------------------------------------------------

def _tool_search_vendor(
    name: str,
    all_vendors: list[str],
) -> dict:
    """
    Given a vendor name string, return similar vendors from the dataset.
    Uses simple token overlap since this runs inside the tool handler.
    """
    name_tokens = set(name.lower().split())
    matches = []
    for v in all_vendors:
        v_tokens = set(v.lower().split())
        overlap = len(name_tokens & v_tokens) / max(len(name_tokens), len(v_tokens)) if (name_tokens or v_tokens) else 0
        if overlap > 0.3:
            matches.append({"vendor": v, "similarity": round(overlap * 100, 1)})
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return {"query": name, "matches": matches[:5]}


def _tool_search_po(
    po_id: str,
    purchase_orders: list[dict],
) -> dict:
    """Find a PO by its normalised or raw ID."""
    po_id_norm = po_id.upper().replace("-", "").replace("/", "").replace(" ", "")
    for po in purchase_orders:
        if (
            po.get("po_id_normalized", "") == po_id_norm
            or str(po.get("po_id", "")).upper() == po_id.upper()
        ):
            return {"found": True, "po": po}
    return {"found": False, "query": po_id}


def _tool_search_payment(
    vendor_name: str,
    amount: float,
    payments: list[dict],
    tolerance_pct: float = 5.0,
) -> dict:
    """Find payments matching vendor (fuzzy) and amount (within tolerance)."""
    results = []
    v_tokens = set(vendor_name.lower().split())
    for pay in payments:
        pv = str(pay.get("vendor_name_normalized", pay.get("vendor_name", "")))
        pv_tokens = set(pv.split())
        v_sim = len(v_tokens & pv_tokens) / max(len(v_tokens), len(pv_tokens)) if (v_tokens or pv_tokens) else 0
        pa = pay.get("payment_amount")
        if pa is None:
            continue
        larger = max(abs(amount), abs(pa))
        pct_diff = abs(amount - pa) / larger * 100 if larger else 0
        if v_sim > 0.3 and pct_diff <= tolerance_pct:
            results.append({
                "payment": pay,
                "vendor_similarity": round(v_sim * 100, 1),
                "amount_diff_pct": round(pct_diff, 2),
            })
    results.sort(key=lambda x: x["vendor_similarity"], reverse=True)
    return {"query": {"vendor": vendor_name, "amount": amount}, "matches": results[:5]}


def _tool_calculate_variance(a: float, b: float) -> dict:
    """Return absolute and percentage difference between two amounts."""
    diff = abs(a - b)
    larger = max(abs(a), abs(b))
    pct = round(diff / larger * 100, 4) if larger else 0.0
    return {
        "value_a":    a,
        "value_b":    b,
        "abs_diff":   round(diff, 2),
        "pct_diff":   pct,
        "within_1pct": pct <= 1.0,
        "within_2pct": pct <= 2.0,
        "within_5pct": pct <= 5.0,
    }


def _tool_compare_records(
    record1: dict,
    record2: dict,
    fields: list[str],
) -> dict:
    """Field-by-field comparison table for two records."""
    comparison = []
    for f in fields:
        v1 = record1.get(f)
        v2 = record2.get(f)
        comparison.append({
            "field":   f,
            "record1": v1,
            "record2": v2,
            "match":   str(v1).strip().lower() == str(v2).strip().lower(),
        })
    return {"comparison": comparison}


# ---------------------------------------------------------------------------
# Gemini tool schema definitions (function declarations)
# ---------------------------------------------------------------------------

_TOOL_DECLARATIONS = [
    {
        "name": "search_vendor",
        "description": (
            "Search for vendor names in the dataset that are similar to the given name. "
            "Useful to verify if two differently-spelled names refer to the same entity."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Vendor name to search for"}
            },
            "required": ["name"],
        },
    },
    {
        "name": "search_po",
        "description": "Look up a specific Purchase Order by its ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "po_id": {"type": "string", "description": "The PO ID to look up"}
            },
            "required": ["po_id"],
        },
    },
    {
        "name": "search_payment",
        "description": (
            "Find payment records matching a vendor name and approximate amount. "
            "Use this to verify whether an invoice was paid."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "vendor_name": {"type": "string"},
                "amount":      {"type": "number"},
            },
            "required": ["vendor_name", "amount"],
        },
    },
    {
        "name": "calculate_variance",
        "description": "Calculate the absolute and percentage difference between two monetary amounts.",
        "parameters": {
            "type": "object",
            "properties": {
                "a": {"type": "number", "description": "First amount"},
                "b": {"type": "number", "description": "Second amount"},
            },
            "required": ["a", "b"],
        },
    },
    {
        "name": "compare_records",
        "description": "Compare two financial records field by field to identify matches and mismatches.",
        "parameters": {
            "type": "object",
            "properties": {
                "record1": {"type": "object"},
                "record2": {"type": "object"},
                "fields":  {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of field names to compare",
                },
            },
            "required": ["record1", "record2", "fields"],
        },
    },
]


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a financial reconciliation AI agent for LedgerLens.
Your job is to investigate whether a set of financial documents
(Invoice, Purchase Order, Payment) belong to the same business transaction.

Rules you MUST follow:
1. Use ONLY the evidence provided. Do NOT invent data.
2. You MAY call the provided tools to gather more evidence.
3. You MUST return a final JSON object — nothing else in your last message.
4. If you cannot determine a match, say UNRESOLVED. Never guess.
5. "I couldn't prove it" is NOT the same as "it's invalid".

Final response MUST be valid JSON in this exact schema:
{
  "decision":           "MATCHED" | "NEEDS_REVIEW" | "UNRESOLVED",
  "confidence":         <float 0.0–1.0>,
  "reasons":            [<string>, ...],
  "exceptions":         [<string>, ...],
  "recommended_action": <string>
}

Exception codes to use: AMOUNT_MISMATCH, VENDOR_MISMATCH, MISSING_PO,
MISSING_PAYMENT, DATE_GAP, DUPLICATE_SUSPECTED, INSUFFICIENT_EVIDENCE.
"""


def _build_user_prompt(
    invoice: dict,
    candidate: dict | None,
    payment: dict | None,
    receipt: dict | None,
    fuzzy_scores: dict | None,
) -> str:
    """Build the structured investigation prompt for Gemini."""
    lines = ["Investigate the following financial records:\n"]

    lines.append("=== INVOICE (under investigation) ===")
    lines.append(json.dumps({
        "invoice_id":              invoice.get("invoice_id_normalized", invoice.get("invoice_id")),
        "vendor_raw":              invoice.get("vendor_name_raw", invoice.get("vendor_name")),
        "vendor_normalised":       invoice.get("vendor_name_normalized"),
        "amount":                  invoice.get("invoice_amount"),
        "date":                    invoice.get("invoice_date"),
    }, indent=2))

    if candidate:
        lines.append(f"\n=== CANDIDATE {candidate.get('source', 'DOCUMENT').upper()} (top fuzzy match) ===")
        rec = candidate.get("record", {})
        source = candidate.get("source", "")
        lines.append(json.dumps({
            "id":               rec.get(f"{source}_id_normalized", rec.get(f"{source}_id")),
            "vendor_raw":       rec.get("vendor_name_raw", rec.get("vendor_name")),
            "vendor_normalised":rec.get("vendor_name_normalized"),
            "amount":           rec.get(f"{source}_amount"),
            "date":             rec.get(f"{source}_date"),
        }, indent=2))
        if fuzzy_scores:
            lines.append(f"Fuzzy match score: {candidate.get('score')}/100")
            lines.append(f"Signal breakdown: {json.dumps(fuzzy_scores)}")

    if payment:
        lines.append("\n=== PAYMENT RECORD ===")
        lines.append(json.dumps({
            "payment_id":  payment.get("payment_id_normalized", payment.get("payment_id")),
            "vendor":      payment.get("vendor_name_raw", payment.get("vendor_name")),
            "amount":      payment.get("payment_amount"),
            "date":        payment.get("payment_date"),
        }, indent=2))

    if receipt:
        lines.append("\n=== RECEIPT RECORD ===")
        lines.append(json.dumps({
            "receipt_id": receipt.get("receipt_id_normalized", receipt.get("receipt_id")),
            "vendor":     receipt.get("vendor_name_raw", receipt.get("vendor_name")),
            "amount":     receipt.get("receipt_amount"),
            "date":       receipt.get("receipt_date"),
        }, indent=2))

    lines.append(
        "\nInvestigate whether these records belong to the same financial transaction. "
        "Use the available tools to gather evidence. "
        "Return ONLY the final JSON verdict."
    )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool dispatcher (called when Gemini issues a function call)
# ---------------------------------------------------------------------------

def _dispatch_tool(
    tool_name: str,
    tool_args: dict,
    context: dict,   # {purchase_orders, payments, all_vendors}
) -> str:
    """Execute the tool Gemini requested and return the JSON result string."""
    try:
        if tool_name == "search_vendor":
            result = _tool_search_vendor(
                name=tool_args["name"],
                all_vendors=context.get("all_vendors", []),
            )
        elif tool_name == "search_po":
            result = _tool_search_po(
                po_id=tool_args["po_id"],
                purchase_orders=context.get("purchase_orders", []),
            )
        elif tool_name == "search_payment":
            result = _tool_search_payment(
                vendor_name=tool_args["vendor_name"],
                amount=float(tool_args["amount"]),
                payments=context.get("payments", []),
            )
        elif tool_name == "calculate_variance":
            result = _tool_calculate_variance(
                a=float(tool_args["a"]),
                b=float(tool_args["b"]),
            )
        elif tool_name == "compare_records":
            result = _tool_compare_records(
                record1=tool_args["record1"],
                record2=tool_args["record2"],
                fields=tool_args["fields"],
            )
        else:
            result = {"error": f"Unknown tool: {tool_name}"}
    except Exception as exc:
        result = {"error": str(exc)}

    return json.dumps(result)


# ---------------------------------------------------------------------------
# Main investigator function
# ---------------------------------------------------------------------------

def _unresolved_response(reason: str = "Investigation could not be completed.") -> dict:
    return {
        "decision":           "UNRESOLVED",
        "confidence":         0.0,
        "reasons":            [reason],
        "exceptions":         ["INSUFFICIENT_EVIDENCE"],
        "recommended_action": "Manual review required.",
    }


async def investigate_case(
    invoice: dict,
    top_candidate: dict | None,
    payment: dict | None,
    receipt: dict | None,
    all_purchase_orders: list[dict],
    all_payments: list[dict],
) -> dict:
    """
    Stage 7 — AI Investigation.

    Sends the invoice + its best fuzzy candidate to Gemini for agentic
    investigation using tool-calling. Returns a structured verdict dict.

    Parameters
    ----------
    invoice              : the normalised invoice record
    top_candidate        : best fuzzy candidate (from generate_candidates)
    payment              : best matched payment record (or None)
    receipt              : matched receipt record (or None)
    all_purchase_orders  : full PO list (for tool look-ups)
    all_payments         : full Payment list (for tool look-ups)

    Returns
    -------
    dict with keys: decision, confidence, reasons, exceptions,
                    recommended_action, tool_calls_made
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or not _GENAI_AVAILABLE:
        return _unresolved_response(
            "GEMINI_API_KEY not set or google-generativeai package not installed."
        )

    # Build context for tool dispatcher
    all_vendors = list({
        r.get("vendor_name_normalized", r.get("vendor_name", ""))
        for r in all_purchase_orders + all_payments
        if r.get("vendor_name_normalized") or r.get("vendor_name")
    })
    tool_context = {
        "purchase_orders": all_purchase_orders,
        "payments":        all_payments,
        "all_vendors":     all_vendors,
    }

    # Build prompt
    fuzzy_scores = (
        top_candidate.get("signal_scores") if top_candidate else None
    )
    user_prompt = _build_user_prompt(
        invoice=invoice,
        candidate=top_candidate,
        payment=payment,
        receipt=receipt,
        fuzzy_scores=fuzzy_scores,
    )

    try:
        genai.configure(api_key=api_key)

        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=_SYSTEM_PROMPT,
            tools=_TOOL_DECLARATIONS,
        )

        chat = model.start_chat()
        tool_calls_made: list[dict] = []
        max_tool_rounds = 5   # prevent infinite loops

        response = chat.send_message(user_prompt)

        # Agentic loop: keep handling tool calls until Gemini returns text
        for _ in range(max_tool_rounds):
            # Check if Gemini wants to call a tool
            fc = None
            for part in response.candidates[0].content.parts:
                if hasattr(part, "function_call") and part.function_call.name:
                    fc = part.function_call
                    break

            if fc is None:
                break   # Gemini returned text — we're done

            tool_name = fc.name
            tool_args = dict(fc.args)
            tool_calls_made.append({"tool": tool_name, "args": tool_args})

            # Execute the tool and send result back
            tool_result = _dispatch_tool(tool_name, tool_args, tool_context)
            response = chat.send_message(
                genai.protos.Content(
                    parts=[genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=tool_name,
                            response={"result": tool_result},
                        )
                    )]
                )
            )

        # Extract final text response
        final_text = ""
        for part in response.candidates[0].content.parts:
            if hasattr(part, "text") and part.text:
                final_text += part.text

        # Parse JSON verdict from Gemini's response
        # Strip markdown code fences if present
        clean = final_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip()

        verdict = json.loads(clean)
        verdict["tool_calls_made"] = tool_calls_made
        return verdict

    except json.JSONDecodeError:
        logger.error("Gemini returned non-JSON response: %s", final_text[:500])
        return _unresolved_response("AI response could not be parsed as JSON.")
    except Exception as exc:
        logger.error("AI investigation failed: %s", exc)
        return _unresolved_response(f"AI investigation error: {type(exc).__name__}")


# ---------------------------------------------------------------------------
# Batch investigator — processes all non-MATCHED cases
# ---------------------------------------------------------------------------

async def investigate_unresolved_cases(
    cases: list[dict],
    all_purchase_orders: list[dict],
    all_invoices: list[dict],
    all_payments: list[dict],
    all_receipts: list[dict],
    min_fuzzy_score: float = 40.0,
) -> list[dict]:
    """
    For every case that is AMBIGUOUS or UNMATCHED:
      1. Generate fuzzy candidates (Stage 6)
      2. Send top candidate to Gemini for investigation (Stage 7)
      3. Attach ai_investigation result to the case dict

    MATCHED and NEEDS_REVIEW cases are returned as-is (no AI needed).

    Parameters
    ----------
    cases                : output of build_reconciliation_cases()
    all_purchase_orders  : normalised PO records
    all_invoices         : normalised Invoice records
    all_payments         : normalised Payment records
    all_receipts         : normalised Receipt records
    min_fuzzy_score      : minimum combined score to bother sending to AI

    Returns
    -------
    Enriched cases list with 'ai_investigation' key added to qualifying cases.
    """
    from app.helpers.fuzzy_candidates import generate_candidates

    # Build invoice lookup by case_id
    inv_by_case: dict[str, dict] = {}
    for inv in all_invoices:
        inv_id = inv.get("invoice_id_normalized", inv.get("invoice_id", ""))
        inv_by_case[inv_id] = inv

    enriched: list[dict] = []
    for case in cases:
        status = case.get("status", "")

        # Only investigate ambiguous/unmatched cases
        if status not in ("AMBIGUOUS", "UNMATCHED"):
            case["ai_investigation"] = None
            enriched.append(case)
            continue

        invoice = case.get("invoice") or {}

        # Stage 6: fuzzy candidates
        fuzzy = generate_candidates(
            invoice=invoice,
            purchase_orders=all_purchase_orders,
            payments=all_payments,
            top_n=3,
        )

        top = fuzzy[0] if fuzzy else None

        # Skip AI if best candidate is too weak
        if top is None or top["score"] < min_fuzzy_score:
            case["fuzzy_candidates"] = fuzzy
            case["ai_investigation"] = {
                "decision":           "UNRESOLVED",
                "confidence":         0.0,
                "reasons":            ["No strong fuzzy candidate found (score below threshold)."],
                "exceptions":         ["INSUFFICIENT_EVIDENCE"],
                "recommended_action": "Manual review required.",
                "tool_calls_made":    [],
            }
            enriched.append(case)
            continue

        # Stage 7: Gemini investigation
        payment = case.get("payment")
        receipt = case.get("receipt")

        ai_result = await investigate_case(
            invoice=invoice,
            top_candidate=top,
            payment=payment,
            receipt=receipt,
            all_purchase_orders=all_purchase_orders,
            all_payments=all_payments,
        )

        case["fuzzy_candidates"] = fuzzy
        case["ai_investigation"] = ai_result

        # Upgrade the case status from AI verdict
        ai_decision = ai_result.get("decision", "UNRESOLVED")
        if ai_decision == "MATCHED":
            case["status"] = "MATCHED"
            case["confidence"] = ai_result.get("confidence", case["confidence"])
        elif ai_decision == "NEEDS_REVIEW":
            case["status"] = "NEEDS_REVIEW"

        enriched.append(case)

    return enriched
