#!/usr/bin/env python3
"""Build the study-app question bank from the two source documents.

  * PDF  -> question stems + the real A/B/C/D/E options
  * TXT  -> the correct answer + written explanation

Both share the same 1..684 numbering, so records are joined on the question
number and then cross-checked by text similarity before a letter is accepted
as correct. Anything that cannot be verified is dropped rather than guessed.

    python3 tools/build_data.py            # uses the defaults below
    SAA_PDF=... SAA_TXT=... python3 tools/build_data.py

Writes src/data/{questions,topics,snippets}.json
"""
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ligature import repair                      # noqa: E402
from topics import TOPICS, classify, DOMAINS     # noqa: E402

HERE = Path(__file__).parent
ROOT = HERE.parent
OUT = ROOT / "src" / "data"
CACHE = HERE / ".cache"

PDF_SRC = Path(os.environ.get(
    "SAA_PDF",
    "/Users/jaiderpanqueva/Downloads/AWS Certified Solutions Architect Associate SAA-C03.pdf"))
TXT_SRC = Path(os.environ.get(
    "SAA_TXT", "/Users/jaiderpanqueva/Downloads/AWS SAA-03 Solution.txt"))
CODE_SRC = Path(os.environ.get(
    "SAA_CODE", "/Users/jaiderpanqueva/Downloads/code_v2025-10-27"))


def log(msg):
    print(msg, file=sys.stderr)


# ══════════════════════════════════════════════ 1. PDF: stems + real options
def pdf_text() -> str:
    """Extract the PDF once and cache it. The document's font has a broken
    ToUnicode map that drops fi/fl/ff ligatures as NUL bytes, so repair those."""
    cached = CACHE / "pdf_fixed.txt"
    if cached.exists() and cached.stat().st_mtime > PDF_SRC.stat().st_mtime:
        return cached.read_text(encoding="utf-8")
    from pypdf import PdfReader
    log(f"extracting {PDF_SRC.name} ...")
    reader = PdfReader(str(PDF_SRC))
    text = repair("\n".join(p.extract_text() or "" for p in reader.pages))
    CACHE.mkdir(exist_ok=True)
    cached.write_text(text, encoding="utf-8")
    return text


OPT = re.compile(r"(?m)^([A-F])\.[ \t]+")


def tidy(s: str) -> str:
    s = s.replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s{2,}", " ", re.sub(r"[ \t]*\n[ \t]*", " ", s)).strip()


def reflow(stem: str) -> str:
    """Undo the PDF's hard wrapping. Lines are wrapped at a fixed width, so a
    line that stops well short of that width ended a real paragraph; every
    other break is an artefact and gets joined back into flowing text."""
    lines = [ln.strip() for ln in stem.split("\n") if ln.strip()]
    lines = [ln for ln in lines if re.search(r"[A-Za-z0-9]", ln)]   # drop stray "." lines
    if len(lines) < 2:
        return " ".join(lines)
    width = max(len(ln) for ln in lines)
    out = [lines[0]]
    for prev, cur in zip(lines, lines[1:]):
        if len(prev) < width - 12:
            out.append("\n" + cur)          # previous line ended early
        else:
            out.append(" " + cur)
    return "".join(out).strip()


pdf_q = {}
parts = re.split(r"Topic\s*\d+\s*Question\s*#(\d+)", pdf_text())
for i in range(1, len(parts) - 1, 2):
    num, body = int(parts[i]), parts[i + 1]
    hits = list(OPT.finditer(body))
    if not hits:
        continue
    options = []
    for j, h in enumerate(hits):
        end = hits[j + 1].start() if j + 1 < len(hits) else len(body)
        text = tidy(body[h.end():end])
        if text:
            options.append({"letter": h.group(1), "text": text})
    stem = reflow(re.sub(r"[ \t]{2,}", " ", body[: hits[0].start()]))
    if len(stem) >= 60 and len(options) >= 2:
        pdf_q[num] = {"stem": stem, "options": options}

log(f"PDF: {len(pdf_q)} questions with options")

# ══════════════════════════════════════════════ 2. TXT: answers + rationale
raw = TXT_SRC.read_text(encoding="utf-8").replace("\r\n", "\n")
for a, b in [("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-")]:
    raw = raw.replace(a, b)

SEP_LINE = re.compile(r"(?m)^[\-=_\s]{8,}$")
CAND = re.compile(r"(?m)^[ \t]*(IMP>+)?[ \t]*(\d{1,3})[ \t]*[\]\).][ \t]*")
SCENARIO = re.compile(r"^(An?|The)\s+[\w-]+.{0,140}?"
                      r"(compan|solutions architect|organization|startup|business|"
                      r"application|university|hospital|developer|team|firm|agency|"
                      r"enterprise|research|gaming|media|gov)", re.I)
ANSWER_TAG = re.compile(r"(?i)^[ \t]*(?:ans|answers?|correct\s+answers?)\s*[-:]\s*")
LETTER = re.compile(r"^[ \t]*\(?([A-F])[\.\)][ \t]+")
CHOOSE = re.compile(r"\(choose\s+(two|three|2|3)", re.I)
STEM_END = re.compile(r"(\?[ \t]*$)|(choose\s+(two|three|2|3)\.?\)?[ \t]*$)", re.I)
WORDNUM = {"two": 2, "three": 3, "2": 2, "3": 3}

# The numbering is mostly sequential; a few explanation bullets ("1. Real-time
# ...") look like question markers, so only accept a marker that continues the
# sequence or that is clearly followed by a fresh scenario.
marks, prev = [], 0
for m in CAND.finditer(raw):
    n = int(m.group(2))
    if prev < n <= prev + 25:
        marks.append(m)
        prev = n
    elif SCENARIO.match(raw[m.end(): m.end() + 200]):
        marks.append(m)


def norm_ws(s: str) -> str:
    return re.sub(r"[ \t]+", " ", s).strip()


def chunks_of(rest: str):
    """Split the post-stem text into answer/explanation units. A unit starts at
    a blank line, a lettered line, or an explicit answer tag."""
    out, cur, blank = [], [], True
    for ln in rest.split("\n"):
        if not ln.strip():
            blank = True
            continue
        if blank or LETTER.match(ln) or ANSWER_TAG.match(ln):
            if cur:
                out.append(" ".join(cur))
            cur = [norm_ws(ln)]
        else:
            cur.append(norm_ws(ln))
        blank = False
    if cur:
        out.append(" ".join(cur))
    return [c for c in (norm_ws(c) for c in out) if c]


txt_q = {}
for i, m in enumerate(marks):
    num, important = int(m.group(2)), bool(m.group(1))
    end = marks[i + 1].start() if i + 1 < len(marks) else len(raw)
    body = SEP_LINE.sub("", raw[m.end():end]).strip("\n")
    if not body.strip():
        continue
    lines = body.split("\n")

    q_end = None
    for k, ln in enumerate(lines):
        if not ln.strip():
            continue
        if ANSWER_TAG.match(ln) or LETTER.match(ln):
            break
        if STEM_END.search(ln.strip()):
            q_end = k
    if q_end is None:
        for k, ln in enumerate(lines):
            if not ln.strip() and k > 0 and "".join(lines[:k]).strip():
                q_end = k - 1
                break
    if q_end is None:
        continue

    stem = norm_ws(" ".join(lines[: q_end + 1]))
    if len(stem) < 60:
        continue
    n_ans = WORDNUM[CHOOSE.search(stem).group(1).lower()] if CHOOSE.search(stem) else 1
    ch = chunks_of("\n".join(lines[q_end + 1:]))
    if not ch:
        continue

    answers, letters, expl = [], [], []
    tagged = next((c for c in ch if ANSWER_TAG.match(c)), None)
    if tagged:
        for part in re.split(r"\s+\+\s+(?=\(?[A-F][\.\)]\s)",
                             ANSWER_TAG.sub("", tagged, count=1)):
            lm = LETTER.match(part)
            if lm:
                letters.append(lm.group(1))
                part = LETTER.sub("", part, count=1)
            answers.append(part.strip())
        expl = [c for c in ch if c is not tagged]
    else:
        lettered = [c for c in ch if LETTER.match(c)][:n_ans]
        if lettered:
            for c in lettered:
                letters.append(LETTER.match(c).group(1))
                answers.append(LETTER.sub("", c, count=1).strip())
            expl = [c for c in ch if c not in lettered]
        else:
            answers, expl = ch[:n_ans], ch[n_ans:]

    answers = [a for a in (a.strip().strip(".").strip() for a in answers) if len(a) >= 6]
    if not answers:
        continue
    txt_q.setdefault(num, {
        "answers": answers, "letters": letters, "important": important,
        "stem": stem, "n_ans": n_ans,
        "explanation": "\n\n".join(e for e in expl if len(e) > 25).strip(),
    })

log(f"TXT: {len(txt_q)} questions with answers")

# ══════════════════════════════════════════════════════ 3. join and verify
STOP = set("a an the to of in on for and or with that this is are be by as at from "
           "will can use uses using their its it company companies solution "
           "requirements each new all into most least".split())


def toks(s):
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 2}


def sim(a: str, b: str) -> float:
    ta, tb = toks(a), toks(b)
    if not ta or not tb:
        return 0.0
    jac = len(ta & tb) / len(ta | tb)
    return 0.65 * jac + 0.35 * SequenceMatcher(None, a.lower()[:400], b.lower()[:400]).ratio()


def squash(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


SENT_SPLIT = re.compile(r"(?<=[a-z0-9\)])\.\s+(?=[A-Z])")


def variants(answer: str):
    """The TXT answer is sometimes the option verbatim and sometimes a
    paraphrase with the rationale glued on. Compare against both."""
    out = [answer]
    first = SENT_SPLIT.split(answer, maxsplit=1)[0]
    if 10 < len(first) < len(answer):
        out.append(first)
    return out


def match_score(option: str, answer: str) -> float:
    so, best = squash(option), 0.0
    for v in variants(answer):
        sv = squash(v)
        if sv and (sv in so or (len(sv) > 40 and so in sv)):
            return 1.0
        best = max(best, sim(option, v))
    return best


def trailing_rationale(answer: str, option: str) -> str:
    """When the TXT glued the rationale onto the answer, recover the extra
    sentences so the explanation is not lost."""
    sentences = SENT_SPLIT.split(answer)
    if len(sentences) < 2:
        return ""
    tail = ". ".join(s.strip() for s in sentences[1:]).strip()
    if len(tail) < 40 or squash(tail) in squash(option):
        return ""
    return tail


merged = []
stats = dict.fromkeys(
    ["letter_ok", "letter_fixed", "matched", "letter_only",
     "unresolved", "rejected_mismatch", "no_txt", "stem_mismatch"], 0)

for num, pq in sorted(pdf_q.items()):
    tq = txt_q.get(num)
    if not tq:
        stats["no_txt"] += 1
        continue
    if sim(pq["stem"], tq["stem"]) < 0.35:
        stats["stem_mismatch"] += 1
        continue

    opts = {o["letter"]: o["text"] for o in pq["options"]}
    n_needed = tq["n_ans"]
    correct, confidence = [], "high"

    if tq["letters"] and all(l in opts for l in tq["letters"]):
        if all(match_score(opts[l], a) >= 0.35
               for l, a in zip(tq["letters"], tq["answers"])):
            correct = list(dict.fromkeys(tq["letters"]))[:n_needed]
            stats["letter_ok"] += 1

    if not correct:
        used, scores = set(), []
        for a in tq["answers"][:n_needed]:
            best, best_s = None, 0.0
            for l, o in opts.items():
                if l in used:
                    continue
                s = match_score(o, a)
                if s > best_s:
                    best, best_s = l, s
            if best and best_s >= 0.42:
                correct.append(best)
                used.add(best)
                scores.append(best_s)
        if correct:
            stats["letter_fixed" if tq["letters"] else "matched"] += 1
            confidence = "medium" if min(scores) < 0.6 else "high"
            if len(correct) < n_needed:
                confidence = "low"
        elif tq["letters"] and all(l in opts for l in tq["letters"]):
            # the TXT names a letter but paraphrases the option; accept it only
            # if the answer is at least on-topic with the choices offered
            pool = " ".join(opts.values())
            if max(sim(pool, v) for v in variants(tq["answers"][0])) >= 0.12:
                correct = list(dict.fromkeys(tq["letters"]))[:n_needed]
                confidence, stats["letter_only"] = "medium", stats["letter_only"] + 1
            else:
                stats["rejected_mismatch"] += 1
                continue
        else:
            stats["unresolved"] += 1
            continue

    extra = [trailing_rationale(a, opts.get(l, ""))
             for l, a in zip(correct, tq["answers"])]
    explanation = "\n\n".join(x for x in ([tq["explanation"]] + extra) if x).strip()

    merged.append({
        "num": num,
        "question": pq["stem"],
        "options": pq["options"],
        "correct": sorted(correct),
        "explanation": explanation,
        "multi": n_needed > 1,
        "important": tq["important"],
        "confidence": confidence,
    })

log(f"joined: {len(merged)}  {stats}")

# ═══════════════════════════════ 3b. hand-checked answer-key corrections
# On several "choose two/three" questions the TXT only names one answer, so
# the join records a single letter and marks the record low confidence. Those
# were reviewed by hand in tools/answer_fixes.json and are applied here.
FIXES = HERE / "answer_fixes.json"
if FIXES.exists():
    fixes = json.loads(FIXES.read_text(encoding="utf-8"))
    applied = 0
    for r in merged:
        fix = fixes.get(str(r["num"]))
        if not fix:
            continue
        r["correct"] = sorted(fix["correct"])
        r["multi"] = len(fix["correct"]) > 1
        r["confidence"] = "high"          # verified by hand against the stem
        applied += 1
    log(f"claves corregidas a mano: {applied}/"
        f"{sum(1 for k in fixes if not k.startswith('_'))}")

# ══════════════════════════ 3b. hand-written explanations for the gaps
# The source TXT leaves a few hundred questions without any rationale. Those
# were written by hand into tools/explanations.json (keyed by question number)
# and are filled in here so a rebuild does not drop them again.
EXPL_OVERLAY = HERE / "explanations.json"
if EXPL_OVERLAY.exists():
    overlay = json.loads(EXPL_OVERLAY.read_text(encoding="utf-8"))
    filled = 0
    for r in merged:
        if not r["explanation"] and str(r["num"]) in overlay:
            r["explanation"] = overlay[str(r["num"])]
            filled += 1
    log(f"explicaciones escritas a mano: {filled}/{len(overlay)}")

# ══════════════════════════════════════════════════════════ 4. tag by topic
for r in merged:
    correct_texts = [o["text"] for o in r["options"] if o["letter"] in r["correct"]]
    other_texts = [o["text"] for o in r["options"] if o["letter"] not in r["correct"]]
    r["topic"], r["services"], r["domain"] = classify(r["question"], correct_texts, other_texts)
    r["id"] = f"q{r['num']}"

counts = {}
for r in merged:
    counts[r["topic"]] = counts.get(r["topic"], 0) + 1

topics_out = [{"id": tid, "name": name, "blurb": blurb, "count": counts.get(tid, 0)}
              for tid, name, blurb in TOPICS if counts.get(tid, 0)]
domains_out = [{"id": d, "name": name} for d, name, _ in DOMAINS]

# ═══════════════════════════════════════════ 5. hands-on snippets by topic
SNIPPET_TOPIC = {
    "s3": "s3", "s3-advanced": "s3", "ebs": "storage", "efs": "storage",
    "ec2-fundamentals": "compute", "cli": "compute", "kinesis": "analytics",
    "kms": "security", "route53": "network", "sqs": "integration",
    "api-gateway": "integration", "ssm": "management", "cloudformation": "deployment",
}
LANG = {".sh": "bash", ".py": "python", ".yaml": "yaml", ".yml": "yaml",
        ".json": "json", ".sql": "sql", ".html": "html", ".txt": "text"}

snippets = []
if CODE_SRC.exists():
    for f in sorted(CODE_SRC.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in LANG:
            continue
        folder = f.relative_to(CODE_SRC).parts[0]
        topic = SNIPPET_TOPIC.get(folder)
        if not topic:
            continue
        try:
            code = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if not code.strip() or len(code) > 20000:
            continue
        snippets.append({
            "id": str(f.relative_to(CODE_SRC)),
            "topic": topic,
            "folder": folder,
            "name": f.name,
            "lang": LANG[f.suffix.lower()],
            "code": code.rstrip(),
        })
log(f"snippets: {len(snippets)}")

# ══════════════════════════════════════════════════════════════ 6. emit
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "questions.json").write_text(
    json.dumps(merged, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
(OUT / "topics.json").write_text(
    json.dumps({"topics": topics_out, "domains": domains_out},
               ensure_ascii=False, indent=1), encoding="utf-8")
(OUT / "snippets.json").write_text(
    json.dumps(snippets, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

log("\n── banco de preguntas ─────────────────────")
for t in topics_out:
    log(f"  {t['count']:4d}  {t['name']}")
log(f"  {len(merged):4d}  TOTAL   "
    f"(multi-respuesta: {sum(1 for r in merged if r['multi'])}, "
    f"destacadas: {sum(1 for r in merged if r['important'])}, "
    f"sin explicación: {sum(1 for r in merged if not r['explanation'])})")
log(f"→ {OUT}")
