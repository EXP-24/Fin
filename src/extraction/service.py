"""One call that turns a processed report into facts + a validation report."""

from __future__ import annotations

from .statements import extract_statement_facts
from .validation import validate_extraction

# Bump whenever extraction/validation logic changes: stored analyses of an older
# version are recomputed from the stored Markdown the next time they are read.
ANALYSIS_VERSION = 2


def analyze_document(markdown: str, year: int | None, filename: str = "") -> dict:
    """Extract line-item facts and run the arithmetic checks.

    The result is JSON-serialisable and is stored next to the processed Markdown so
    the API, the UI and the calculator can all reuse it without re-parsing.
    """
    result = extract_statement_facts(markdown, year, filename)
    return {
        "version": ANALYSIS_VERSION,
        "filename": filename,
        "scope": result.scope,
        "year": result.year,
        "facts": [f.to_dict() for f in result.facts],
        "validation": validate_extraction(result),
    }
