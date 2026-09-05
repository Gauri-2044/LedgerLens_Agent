"""
app/core/config.py
==================
Central application configuration.

All values are read from environment variables (or the .env file via
python-dotenv). Import the singleton `settings` anywhere in the app:

    from app.core.config import settings
    print(settings.GEMINI_API_KEY)
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

# Load .env file at import time (safe to call multiple times)
load_dotenv()


class Settings:
    # ------------------------------------------------------------------
    # LLM
    # ------------------------------------------------------------------
    GEMINI_API_KEY: str           = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL:   str           = os.getenv("GEMINI_MODEL",   "gemini-2.5-flash")

    # ------------------------------------------------------------------
    # Database (PostgreSQL)
    # ------------------------------------------------------------------
    DATABASE_URL:   str           = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://ledgerlens:ledgerlens@localhost:5432/ledgerlens"
    )
    DB_POOL_SIZE:   int           = int(os.getenv("DB_POOL_SIZE",  "5"))
    DB_MAX_OVERFLOW: int          = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    DB_ECHO_SQL:    bool          = os.getenv("DB_ECHO_SQL", "false").lower() == "true"

    # ------------------------------------------------------------------
    # Frontend
    # ------------------------------------------------------------------
    VITE_URL:       str           = os.getenv("VITE_URL", "http://localhost:1357")
    CORS_ORIGINS:   list[str]     = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:1357,http://localhost:5173",
        "https://ledger-lens-frontend.vercel.app/"
    ).split(",")

    # ------------------------------------------------------------------
    # File upload limits
    # ------------------------------------------------------------------
    MAX_FILE_SIZE_MB: int         = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    ALLOWED_EXTENSIONS: list[str] = [".csv"]

    # ------------------------------------------------------------------
    # Reconciliation thresholds
    # ------------------------------------------------------------------
    # Deterministic matching
    MATCHED_MIN_CONFIDENCE: float   = float(os.getenv("MATCHED_MIN_CONFIDENCE",   "0.90"))
    AMBIGUOUS_MIN_CONFIDENCE: float = float(os.getenv("AMBIGUOUS_MIN_CONFIDENCE", "0.50"))
    AMOUNT_FUZZY_TOLERANCE_PCT: float = float(os.getenv("AMOUNT_FUZZY_TOLERANCE_PCT", "2.0"))

    # Fuzzy candidate generation
    FUZZY_MIN_SCORE: float        = float(os.getenv("FUZZY_MIN_SCORE", "40.0"))
    FUZZY_TOP_N:     int          = int(os.getenv("FUZZY_TOP_N", "5"))

    # Validation
    AI_MIN_CONFIDENCE:  float     = float(os.getenv("AI_MIN_CONFIDENCE", "0.70"))
    MAX_GEMINI_TOOL_ROUNDS: int   = int(os.getenv("MAX_GEMINI_TOOL_ROUNDS", "5"))

    # ------------------------------------------------------------------
    # Audit trail
    # ------------------------------------------------------------------
    AUDIT_STORE_IN_DB: bool       = os.getenv("AUDIT_STORE_IN_DB", "false").lower() == "true"
    AUDIT_CHAIN_HASH:  bool       = os.getenv("AUDIT_CHAIN_HASH",  "true").lower()  == "true"

    # ------------------------------------------------------------------
    # App metadata
    # ------------------------------------------------------------------
    APP_TITLE:       str          = "LedgerLens AI Agent"
    APP_VERSION:     str          = "1.0.0"
    DEBUG:           bool         = os.getenv("DEBUG", "false").lower() == "true"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance (cached)."""
    return Settings()


# Convenience singleton for direct import
settings: Settings = get_settings()
