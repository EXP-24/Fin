"""Deterministic extraction + validation of financial-statement data (no LLM)."""

from .service import ANALYSIS_VERSION, analyze_document
from .statements import ExtractionResult, StatementFact, extract_statement_facts
from .validation import RULES, validate_extraction

__all__ = [
    "ANALYSIS_VERSION", "analyze_document", "ExtractionResult", "StatementFact",
    "extract_statement_facts", "validate_extraction", "RULES",
]
