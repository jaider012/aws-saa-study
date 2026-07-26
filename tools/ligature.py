#!/usr/bin/env python3
"""Repair ligatures the PDF dropped as NUL bytes (broken ToUnicode map).

Every \\x00 in the extracted text is a missing fi/fl/ff/ffi/ffl glyph. Each one
is resolved by trying the candidates inside its surrounding word and keeping the
variant that is a real word.
"""
import re
import sys
from collections import Counter
from pathlib import Path

LIGS = ["fi", "fl", "ff", "ffi", "ffl"]

_words = set()
for p in ("/usr/share/dict/words", "/usr/dict/words"):
    f = Path(p)
    if f.exists():
        _words = {w.strip().lower() for w in f.read_text(errors="ignore").splitlines() if w.strip()}
        break

EXTRA = {
    "configure", "configured", "configures", "configuration", "configurations",
    "configuring", "traffic", "failover", "failovers", "notification",
    "notifications", "specific", "specifically", "specifies", "specified",
    "identifies", "identified", "identifier", "identifiers", "verifies",
    "certificate", "certificates", "efficient", "efficiently", "efficiency",
    "sufficient", "insufficient", "offload", "offloading", "workflow",
    "workflows", "firewall", "firewalls", "buffering", "buffers", "modifies",
    "modification", "modifications", "notifies", "notified", "simplifies",
    "simplified", "classification", "classifications", "classified", "prefix",
    "prefixes", "suffix", "suffixes", "affinity", "fifo", "flexibility",
    "fleet", "fleets", "flows", "filtering", "filtered", "filters", "findings",
    "confidentiality", "profiles", "profiling", "benefits", "defines",
    "definitions", "differences", "efforts", "effectively", "effectiveness",
    "significantly", "specifications", "lifecycle", "reflects", "conflicts",
    "staffing", "unfiltered", "identity", "identities", "qualified", "offerings",
    "firmware", "fifteen", "flagged", "fluctuating", "fluctuations", "offsite",
    "overflow", "efficiencies", "justification", "notifying", "filesystem",
    "flat", "flag", "flags", "flash", "float", "flooding", "fluid", "flush",
}
_words |= EXTRA

NUL_WORD = re.compile(r"[A-Za-z\x00]*\x00[A-Za-z\x00]*")
stats = Counter()


def is_word(w: str) -> bool:
    w = w.lower().rstrip("'s")
    return w in _words


# Tokens the dictionary cannot settle because they are not standalone words.
# Every other unresolved token in this document takes "fi", the fallback below.
MANUAL = {
    "o\x00ine": "offline",
    "O\x00ine": "Offline",
    "incomingtra\x00c": "incomingtraffic",
}


def resolve(token: str) -> str:
    """Try every ligature combination for the NULs inside one word token."""
    n = token.count("\x00")
    if n == 0:
        return token
    if token in MANUAL:
        stats["resolved"] += 1
        return MANUAL[token]
    best = None
    if n == 1:
        for lig in LIGS:
            cand = token.replace("\x00", lig, 1)
            if is_word(cand):
                best = cand
                break
    else:  # rare: two dropped glyphs in one word
        import itertools
        for combo in itertools.product(LIGS, repeat=n):
            cand = token
            for lig in combo:
                cand = cand.replace("\x00", lig, 1)
            if is_word(cand):
                best = cand
                break
    if best is None:
        stats["unresolved"] += 1
        stats[f"unres:{token}"] += 1
        best = token.replace("\x00", "fi")   # by far the most common ligature
    else:
        stats["resolved"] += 1
    return best


def repair(text: str) -> str:
    return NUL_WORD.sub(lambda m: resolve(m.group(0)), text)


if __name__ == "__main__":
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "pdf_raw.txt")
    out = repair(src.read_text(encoding="utf-8"))
    assert "\x00" not in out
    Path(sys.argv[2] if len(sys.argv) > 2 else "pdf_fixed.txt").write_text(out, encoding="utf-8")
    print(f"resolved {stats['resolved']} | fallback {stats['unresolved']}")
    print("top unresolved:", [k[6:] for k, _ in stats.most_common(40) if k.startswith("unres:")][:25])
