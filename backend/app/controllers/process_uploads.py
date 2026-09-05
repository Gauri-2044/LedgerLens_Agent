"""
controllers/process_uploads.py
================================
Handles all three stages of data processing for uploaded CSV files:

  1. INGESTION      - Receive file, validate extension & size, read into DataFrame
  2. PARSING        - Verify required columns; apply aliases; coerce types
  3. NORMALIZATION  - Canonicalize dates, amounts, vendor names, document IDs

Supported document types:
  - Purchase Orders
  - Invoices
  - Payments
  - Receipts
"""

import io
import re
import unicodedata
from datetime import datetime
from typing import Any

import pandas as pd
from fastapi import HTTPException, UploadFile

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv"}

# Required columns per document type (after header normalisation)
REQUIRED_COLUMNS: dict[str, list[str]] = {
    "purchase_orders": ["po_id", "vendor_name", "po_amount", "po_date"],
    "invoices":        ["invoice_id", "vendor_name", "invoice_amount", "invoice_date"],
    "payments":        ["payment_id", "vendor_name", "payment_amount", "payment_date"],
    "receipts":        ["receipt_id", "vendor_name", "receipt_amount", "receipt_date"],
}

# Common alternative header names mapped to canonical names
COLUMN_ALIASES: dict[str, dict[str, str]] = {
    "purchase_orders": {
        "po_no": "po_id", "order_id": "po_id", "purchase_order_id": "po_id",
        "supplier": "vendor_name", "vendor": "vendor_name",
        "amount": "po_amount", "total": "po_amount", "order_amount": "po_amount",
        "date": "po_date", "order_date": "po_date",
    },
    "invoices": {
        "invoice_no": "invoice_id", "inv_id": "invoice_id", "bill_id": "invoice_id",
        "supplier": "vendor_name", "vendor": "vendor_name",
        "amount": "invoice_amount", "total": "invoice_amount", "inv_amount": "invoice_amount",
        "date": "invoice_date", "inv_date": "invoice_date",
    },
    "payments": {
        "payment_no": "payment_id", "txn_id": "payment_id", "transaction_id": "payment_id",
        "supplier": "vendor_name", "vendor": "vendor_name",
        "amount": "payment_amount", "total": "payment_amount", "paid_amount": "payment_amount",
        "date": "payment_date", "txn_date": "payment_date", "paid_date": "payment_date",
    },
    "receipts": {
        "receipt_no": "receipt_id", "rec_id": "receipt_id", "grn_id": "receipt_id",
        "supplier": "vendor_name", "vendor": "vendor_name",
        "received_amount": "receipt_amount", "amount": "receipt_amount", "total": "receipt_amount", "rec_amount": "receipt_amount",
        "date": "receipt_date", "rec_date": "receipt_date", "receipt_dt": "receipt_date",
    },
}

# Column name look-ups per doc type
DOC_ID_COL: dict[str, str] = {
    "purchase_orders": "po_id",
    "invoices":        "invoice_id",
    "payments":        "payment_id",
    "receipts":        "receipt_id",
}

# Default sample files if no file is uploaded
DEFAULT_DATA_PATHS: dict[str, str] = {
    "purchase_orders": "../data/purchase_orders.csv",
    "invoices":        "../data/invoices.csv",
    "payments":        "../data/payments.csv",
    "receipts":        "../data/receipts.csv",
}

AMOUNT_COL: dict[str, str] = {
    "purchase_orders": "po_amount",
    "invoices":        "invoice_amount",
    "payments":        "payment_amount",
    "receipts":        "receipt_amount",
}
DATE_COL: dict[str, str] = {
    "purchase_orders": "po_date",
    "invoices":        "invoice_date",
    "payments":        "payment_date",
    "receipts":        "receipt_date",
}


# ---------------------------------------------------------------------------
# Stage 1 - INGESTION
# ---------------------------------------------------------------------------

async def ingest_file(file: UploadFile | str | None, doc_type: str) -> pd.DataFrame:
    """
    INGESTION STAGE
    ---------------
    Supports UploadFile stream, file path string, or default dataset fallback.
    """
    import os

    # If no file provided or string path provided, load from disk
    if file is None or isinstance(file, str):
        path = file if isinstance(file, str) else DEFAULT_DATA_PATHS.get(doc_type, "")
        if not os.path.exists(path):
            # Try absolute path from workspace root
            alt_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", f"{doc_type}.csv")
            if os.path.exists(alt_path):
                path = alt_path

        if not os.path.exists(path):
            raise HTTPException(
                status_code=400,
                detail=f"No upload provided and default dataset '{path}' not found for {doc_type}.",
            )
        try:
            return pd.read_csv(path)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not read default CSV '{path}': {exc}",
            )

    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid file type '{ext}' for {doc_type}. "
                f"Accepted: {', '.join(ALLOWED_EXTENSIONS)}"
            ),
        )

    raw_bytes = await file.read()

    if len(raw_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded file '{filename}' is empty.",
        )

    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        size_mb = len(raw_bytes) / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=(
                f"File '{filename}' exceeds the {MAX_FILE_SIZE_MB} MB limit "
                f"({size_mb:.2f} MB uploaded)."
            ),
        )

    try:
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse CSV '{filename}': {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=422,
            detail=f"CSV '{filename}' contains no data rows.",
        )

    return df


# ---------------------------------------------------------------------------
# Stage 2 - PARSING
# ---------------------------------------------------------------------------

def parse_dataframe(df: pd.DataFrame, doc_type: str) -> pd.DataFrame:
    """
    PARSING STAGE
    -------------
    1. Normalise column headers: lowercase, strip whitespace, replace
       spaces/special characters with underscores.
    2. Apply column aliases so common alternative names are accepted.
    3. Verify all required columns are present.
    4. Drop completely empty rows.

    Raises HTTPException listing missing columns if validation fails.
    """
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"\s+", "_", regex=True)
        .str.replace(r"[^\w]", "_", regex=True)
    )

    alias_map = COLUMN_ALIASES.get(doc_type, {})
    df.rename(columns=alias_map, inplace=True)

    # Fallback for vendor_name if missing in CSV headers (e.g. receipts.csv)
    if "vendor_name" not in df.columns:
        if "vendor_id" in df.columns:
            df["vendor_name"] = df["vendor_id"]
        else:
            df["vendor_name"] = "Unknown Vendor"

    required = REQUIRED_COLUMNS[doc_type]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Missing required columns",
                "doc_type": doc_type,
                "missing_columns": missing,
                "required_columns": required,
                "found_columns": list(df.columns),
            },
        )

    df.dropna(subset=required, how="all", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


# ---------------------------------------------------------------------------
# Stage 3 - NORMALIZATION helpers
# ---------------------------------------------------------------------------

_DATE_FORMATS = [
    "%Y-%m-%d",    # 2026-08-01
    "%d-%m-%Y",    # 01-08-2026
    "%d/%m/%Y",    # 01/08/2026
    "%m/%d/%Y",    # 08/01/2026
    "%d %b %Y",    # 01 Aug 2026
    "%d %B %Y",    # 01 August 2026
    "%b %d, %Y",   # Aug 1, 2026
    "%B %d, %Y",   # August 1, 2026
    "%Y/%m/%d",    # 2026/08/01
    "%d-%b-%Y",    # 01-Aug-2026
]


def _normalize_date(raw: Any) -> str | None:
    """Return ISO date string YYYY-MM-DD, or None if unparseable."""
    if pd.isna(raw):
        return None
    s = str(raw).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    try:
        return pd.to_datetime(s, dayfirst=True).strftime("%Y-%m-%d")
    except Exception:
        return None


def _normalize_amount(raw: Any) -> float | None:
    """
    Strip currency symbols (Rs, $, EUR, GBP, JPY), commas, and whitespace
    then cast to float rounded to 2 d.p.
    Handles: Rs10,500 | 10,500.00 | 10500 | USD 1,000.50
    """
    if pd.isna(raw):
        return None
    s = str(raw).strip()
    # Remove currency symbols and thousands separators
    s = re.sub(r"[\u20b9$\u20ac\u00a3\u00a5,\s]", "", s)
    # Remove alphabetic currency codes (e.g. USD, INR, Rs)
    s = re.sub(r"[A-Za-z]+", "", s)
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def _normalize_vendor(raw: Any) -> str | None:
    """
    Canonical vendor name:
      1. Unicode -> ASCII (NFKD decomposition)
      2. Lowercase
      3. Expand common abbreviations (Pvt, Ltd, Inc, Corp, Co, etc.)
      4. Strip punctuation
      5. Collapse whitespace

    Example: 'AWS India Pvt. Ltd.' -> 'aws india private limited'
    """
    if pd.isna(raw):
        return None
    s = str(raw).strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    abbrev = {
        r"\bpvt\b\.?": "private",
        r"\bltd\b\.?": "limited",
        r"\bllp\b\.?": "limited liability partnership",
        r"\binc\b\.?": "incorporated",
        r"\bcorp\b\.?": "corporation",
        r"\bco\b\.?(?=\s|$)": "company",
        r"\bintl\b\.?": "international",
        r"\bmfg\b\.?": "manufacturing",
    }
    for pattern, replacement in abbrev.items():
        s = re.sub(pattern, replacement, s)
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _normalize_doc_id(raw: Any) -> str | None:
    """
    Strip separators from document IDs for canonical comparison.
    INV/2026/001 | INV-2026-001 | INV 2026 001  ->  INV2026001
    """
    if pd.isna(raw):
        return None
    return re.sub(r"[\s\-/\\]", "", str(raw).strip().upper())


# ---------------------------------------------------------------------------
# Stage 3 - NORMALIZATION (main)
# ---------------------------------------------------------------------------

def normalize_dataframe(df: pd.DataFrame, doc_type: str) -> pd.DataFrame:
    """
    NORMALIZATION STAGE
    -------------------
    Produces normalized versions of key columns:
      - Document ID   ->  <col>_normalized  (separators stripped, uppercase)
      - Vendor name   ->  vendor_name_normalized  (lowercase canonical)
      - Amount        ->  <col>  (float, in-place)
      - Date          ->  <col>  (ISO YYYY-MM-DD string, in-place)

    Original raw values are preserved in <col>_raw columns for audit,
    so reconciliation reports can show both original and normalised values.
    """
    id_col     = DOC_ID_COL[doc_type]
    amount_col = AMOUNT_COL[doc_type]
    date_col   = DATE_COL[doc_type]

    # Document ID
    df[f"{id_col}_raw"]         = df[id_col].astype(str)
    df[f"{id_col}_normalized"]  = df[id_col].apply(_normalize_doc_id)

    # Vendor name
    df["vendor_name_raw"]        = df["vendor_name"].astype(str)
    df["vendor_name_normalized"] = df["vendor_name"].apply(_normalize_vendor)

    # Amount
    df[f"{amount_col}_raw"] = df[amount_col].astype(str)
    df[amount_col]           = df[amount_col].apply(_normalize_amount)

    # Date
    df[f"{date_col}_raw"] = df[date_col].astype(str)
    df[date_col]           = df[date_col].apply(_normalize_date)

    return df


# ---------------------------------------------------------------------------
# Response builder
# ---------------------------------------------------------------------------

def _build_response(df: pd.DataFrame, doc_type: str) -> dict:
    """Convert the final DataFrame to a JSON-serialisable response dict."""
    records = df.where(pd.notna(df), None).to_dict(orient="records")
    return {
        "doc_type": doc_type,
        "total_records": len(records),
        "columns": list(df.columns),
        "data": records,
    }


# ---------------------------------------------------------------------------
# Public entry points called from routes
# ---------------------------------------------------------------------------

async def handle_purchase_orders(file: UploadFile) -> dict:
    """Full pipeline for Purchase Orders CSV."""
    doc_type = "purchase_orders"
    df = await ingest_file(file, doc_type)
    df = parse_dataframe(df, doc_type)
    df = normalize_dataframe(df, doc_type)
    return _build_response(df, doc_type)


async def handle_invoices(file: UploadFile) -> dict:
    """Full pipeline for Invoices CSV."""
    doc_type = "invoices"
    df = await ingest_file(file, doc_type)
    df = parse_dataframe(df, doc_type)
    df = normalize_dataframe(df, doc_type)
    return _build_response(df, doc_type)


async def handle_payments(file: UploadFile) -> dict:
    """Full pipeline for Payments CSV."""
    doc_type = "payments"
    df = await ingest_file(file, doc_type)
    df = parse_dataframe(df, doc_type)
    df = normalize_dataframe(df, doc_type)
    return _build_response(df, doc_type)


async def handle_receipts(file: UploadFile) -> dict:
    """Full pipeline for Receipts CSV."""
    doc_type = "receipts"
    df = await ingest_file(file, doc_type)
    df = parse_dataframe(df, doc_type)
    df = normalize_dataframe(df, doc_type)
    return _build_response(df, doc_type)
