# 🏗️ LedgerLens AI — System Architecture & Data Models

This document details the internal technical architecture, agentic tool workflows, mathematical scoring logic, and repository structure of **LedgerLens AI**.

---

## 1. Bottom-Up System Architecture

LedgerLens AI employs a decoupled, multi-stage processing model where raw financial inputs pass through deterministic matching, fuzzy evidence generation, agentic LLM investigation, anti-hallucination validation, and cryptographic audit hashing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND LAYER                                   │
│            React 18 + Vite + TypeScript + TailwindCSS + Recharts            │
│  [Dashboard Metrics] [Reconciliation Table] [Case Modal] [Audit Timeline]  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ REST API (JSON / Multipart CSV)
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                            FASTAPI BACKEND                                  │
│                                                                             │
│  ┌───────────────────────┐   ┌───────────────────────┐                      │
│  │ Ingestion & Uploads   │   │  AppState Store       │                      │
│  │ (process_uploads.py)  │   │  (state.py)           │                      │
│  └───────────┬───────────┘   └───────────▲───────────┘                      │
│              │                           │ Update State                     │
│  ┌───────────▼───────────┐               │                                  │
│  │ Deterministic Matcher ├───────────────┤ Exact Matches                    │
│  │ (matching.py)         │               │                                  │
│  └───────────┬───────────┘               │                                  │
│              │ Ambiguous Records         │                                  │
│  ┌───────────▼───────────┐               │                                  │
│  │ Fuzzy Candidate Engine│               │                                  │
│  │ (fuzzy_candidates.py) │               │                                  │
│  └───────────┬───────────┘               │                                  │
│              │ Top Candidates + Evidence │                                  │
│  ┌───────────▼───────────┐               │                                  │
│  │ Gemini AI Agentic     │               │                                  │
│  │ Investigator          │               │                                  │
│  │ (ai_investigator.py)  │               │                                  │
│  └───────────┬───────────┘               │                                  │
│              │ Structured Decision       │                                  │
│  ┌───────────▼───────────┐               │                                  │
│  │ Validation Guardrail  │               │                                  │
│  │ (validator.py)        │               │                                  │
│  └───────────┬───────────┘               │                                  │
│              │ Verified Status           │                                  │
│  ┌───────────▼───────────┐               │                                  │
│  │ Cryptographic Audit   ├───────────────┘                                  │
│  │ Logger (audit.py)     │                                                  │
│  └───────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MCP & Agentic AI Architecture

The AI Investigation Agent in [`app/services/ai_investigator.py`](file:///c:/Users/HP/Desktop/Projects/RazorpayBuildathon/backend/app/services/ai_investigator.py) utilizes **Gemini 2.5 Flash** with function-calling capabilities.

### Agentic Tools Available to Gemini

```python
tools = [
    search_vendor(name: str) -> list[str],
    # Searches normalised vendor dictionary to resolve corporate acronyms & aliases
    
    search_po(po_id: str) -> dict,
    # Searches Purchase Orders by exact or partial ID
    
    search_payment(vendor: str, amount: float) -> list[dict],
    # Finds payment records matching vendor name and/or transaction amount
    
    calculate_variance(val1: float, val2: float) -> dict,
    # Computes absolute currency difference and percentage variance
    
    compare_records(rec1: dict, rec2: dict, fields: list[str]) -> dict
    # Generates line-by-line field comparison table between 2 records
]
```

### Agentic Execution Loop
1. **Context Assembly**: Ambiguous invoice and top fuzzy candidate records are serialized into a system prompt.
2. **Tool Selection**: Gemini autonomously determines whether to call `search_vendor` or `calculate_variance`.
3. **Reasoning Synthesis**: Evaluates tool outputs against rules (e.g. variance $\le 2.0\%$).
4. **Structured Decision Emission**:
   ```json
   {
     "decision": "MATCHED",
     "confidence": 0.96,
     "reasons": [
       "Vendor alias match confirmed ('AWS India' -> 'Amazon Web Services India Pvt Ltd')",
       "Amount variance within allowable 0.02% threshold"
     ],
     "exceptions": [],
     "recommended_action": "Auto-approve match"
   }
   ```

---

## 3. Reconciliation & Mathematical Scoring Logic

Reconciliation confidence is calculated using a multi-attribute weighted score:

$$\text{Final Confidence} = w_v \cdot S_{\text{vendor}} + w_a \cdot S_{\text{amount}} + w_d \cdot S_{\text{date}} + w_r \cdot S_{\text{ref}}$$

### Weight Matrix
- **Vendor Similarity Weight ($w_v = 0.45$)**: Computed using RapidFuzz Token Set Ratio.
- **Amount Proximity Weight ($w_a = 0.30$)**: 
  $$S_{\text{amount}} = 1 - \frac{|A_{\text{inv}} - A_{\text{target}}|}{\max(A_{\text{inv}}, A_{\text{target}})}$$
- **Date Proximity Weight ($w_d = 0.15$)**: Linear decay function based on day difference.
- **Reference ID Weight ($w_r = 0.10$)**: Partial substring and Levenshtein similarity on reference numbers.

### Resolution Tiers

| Status | Confidence Range ($c$) | Action Required |
| :--- | :---: | :--- |
| **MATCHED** | $c \ge 0.90$ | Automated approval & immediate state commitment |
| **NEEDS_REVIEW** | $0.50 \le c < 0.90$ | Flagged for human review with AI reasoning breakdown |
| **UNRESOLVED** | $c < 0.50$ | Exception logged; requires manual entry/correction |

---

## 4. Complete Repository Structure

```
RazorpayBuildathon/
├── Artifacts/                  # Screenshots, logos, architecture diagrams, demo files
├── data/                       # Sample CSV files & benchmark datasets
│   ├── Purchase Orders.csv
│   ├── Invoices.csv
│   ├── Payments.csv
│   ├── Receipts.csv
│   └── expected_results.csv
├── ARCHITECTURE.md             # System architecture & model specification (this file)
├── README.md                   # Main project introduction & quickstart guide
├── backend/                    # FastAPI Backend Application
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint, CORS setup, router mounting
│   │   ├── state.py            # In-memory application state manager
│   │   ├── core/
│   │   │   └── config.py       # Configuration singleton (.env loader)
│   │   ├── controllers/
│   │   │   └── process_uploads.py # CSV Ingestion & Normalization engine
│   │   ├── helpers/
│   │   │   ├── matching.py     # Deterministic 3-Way & 4-Way matching engine
│   │   │   ├── fuzzy_candidates.py # RapidFuzz fuzzy candidate generation
│   │   │   └── response_mapper.py # Snake_case -> camelCase UI data transformer
│   │   ├── services/
│   │   │   ├── ai_investigator.py # Gemini 2.5 Flash Agentic Investigator
│   │   │   ├── validator.py    # Anti-hallucination guardrail validator
│   │   │   ├── final_status.py # Final status evaluator & exception assigner
│   │   │   └── audit.py        # SHA-256 cryptographic audit logger
│   │   └── routes/
│   │       ├── uploads.py      # Upload validation endpoint
│   │       ├── reconcile.py    # Main 10-stage pipeline orchestrator endpoint
│   │       └── dashboard.py    # Dashboard metrics, cases list & review endpoints
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Environment template
└── frontend/                   # React + TypeScript Frontend
    ├── src/
    │   ├── components/         # Dashboard, Navbar, Modal, Case Table components
    │   ├── services/           # Axios / Fetch API client
    │   ├── types/              # TypeScript interfaces (ReconciliationCase, etc.)
    │   ├── App.tsx             # Root React component
    │   └── index.css           # Modern design system & styles
    ├── package.json
    └── vite.config.ts
```
