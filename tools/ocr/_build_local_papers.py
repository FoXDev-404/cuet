"""Build the local-papers library from the PaddleOCR-VL dataset.

The OCR JSON is treated as the layout authority (page numbers, block boxes,
tables, image crops) and the Markdown as the text authority. Every parsed row is
checked back against the joined JSON page text before it is written.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OCR_DIR = Path(__file__).resolve().parent / "OCR DATA"
IMAGE_DIR = OCR_DIR / "_images"
PAGE_DIR = OCR_DIR / "_pages"
OUT_ROOT = ROOT
DATA_DIR = OUT_ROOT / "src" / "data" / "local-papers"
PUBLIC_DIR = OUT_ROOT / "public" / "local-papers"
PAPER_DIR = PUBLIC_DIR / "papers"
ASSET_DIR = PUBLIC_DIR / "assets"

# Duplicate OCR exports excluded from the canonical library. Dated exports win
# over generic 2025 files; near-duplicate exports of the same sitting are kept
# once, using the more complete canonical copy.
CANONICAL_EXCLUSIONS = {
    "Biology_2025",
    "Chemistry_2025",
    "English_2025",
    "General Test_2025",
    "Geography_2025",
    "History_2025",
    "Mathematics_2025",
    "Physics_2025",
    "History_2022",
    "Geography_2024-05-17_Shift_1A",
    "History_2024-05-18_Shift_1A",
    "Mathematics_2024-05-16_Shift_2",
    "Physics_2024-05-16_Shift_2",
    "English_2022-09-16_Shift_1",
    "Hindi_2024-05-16_Shift_1",
    "General Test_2024-05-15_Shift_2",
}

SUBJECT_INFO = {
    "Applied Mathematics": {"name": "Applied Mathematics", "slug": "applied-mathematics", "code": "APM"},
    "Biology": {"name": "Biology", "slug": "biology", "code": "BIO"},
    "Chemistry": {"name": "Chemistry", "slug": "chemistry", "code": "CHE"},
    "Computer Science": {"name": "Computer Science", "slug": "computer-science", "code": "CS"},
    "English": {"name": "English", "slug": "english", "code": "ENG"},
    "General Test": {"name": "General Test", "slug": "general-test", "code": "GT"},
    "Geography": {"name": "Geography", "slug": "geography", "code": "GEO"},
    "Hindi": {"name": "Hindi", "slug": "hindi", "code": "HIN"},
    "History": {"name": "History", "slug": "history", "code": "HIS"},
    "Mathematics": {"name": "Mathematics", "slug": "mathematics", "code": "MAT"},
    "Physics": {"name": "Physics", "slug": "physics", "code": "PHY"},
}

MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

TOKEN_RE = re.compile(r"\x00([IT])(\d+)\x00")
TABLE_RE = re.compile(r"<table\b.*?</table>", re.S | re.I)
IMG_RE = re.compile(r"<img\b[^>]*>", re.I)

RUNNING_HEADER_RE = re.compile(
    r"^(?:#{1,6}\s*)?(?:"
    r"held on\b.*|"
    r"cuet\s+(?:ug\s+)?[a-z ]*solved paper\b.*|"
    r"previous years?'? paper\b.*|"
    r"cuet ug\b.*(?:shift|paper)\b.*|"
    r"\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+,?\s+20\d{2}\b(?=.*\bshift\b).*|"
    r"\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}\s*\(shift.*|"
    r"page\s+\d+\s*(?:of\s+\d+)?|"
    r"space for rough work|"
    r"cuet\s*ug\s*-?\s*20\d{2}\s*$|"
    r"nta\s*$|national testing agency\s*$"
    r")$",
    re.I,
)

FOOTER_RE = re.compile(
    r"^(?:(?i:space for rough work|page\s+\d+\s*(?:of\s+\d+)?|\(?\s*page\s+\d+\s*\)?)|"
    r"\d{3}\s+[A-Z]/[A-Z]|[（(]\s*\d{1,3}\s*[)）])$"
)

INSTRUCTION_RE = re.compile(
    r"^(?:choose|select|mark)\s+the\s+(?:correct|most appropriate)\s+"
    r"(?:answer|option|choice)s?\b(?:\s+(?:from|given|among|below)\b.*)?$",
    re.I,
)

REPLACEMENTS = {
    "\u00a0": " ",
    "\u200b": "",
    "\ufeff": "",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2013": "-",
    "\u2014": "-",
}


def norm_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\n", " ")).strip()


def clean_surrogates(value: str) -> str:
    """Drop undecodable bytes while keeping meaningful text."""
    return value.replace("\ufffd", "")


def repair_text(value: str) -> str:
    for bad, good in REPLACEMENTS.items():
        value = value.replace(bad, good)
    return clean_surrogates(value)


@dataclass
class Token:
    index: int
    kind: str
    page: int
    html: str = ""
    bbox: list[int] | None = None
    src: Path | None = None
    rel: str = ""
    page_image: Path | None = None


@dataclass
class Doc:
    stem: str
    title: str
    pages: list[dict[str, Any]]
    text: str
    tokens: list[Token]
    page_spans: list[tuple[int, int, int]]
    md_text: str
    json_text: str
    join_ratio: float
    source_json: Path
    source_md: Path

    def page_for(self, offset: int) -> int:
        for start, end, page in self.page_spans:
            if start <= offset < end:
                return page
        return self.page_spans[-1][2] if self.page_spans else 1

    def page_range(self, start: int, end: int) -> list[int]:
        first = self.page_for(max(0, start))
        last = self.page_for(max(start, end - 1))
        return list(range(first, last + 1))

    def tokens_between(self, start: int, end: int) -> list[Token]:
        out = []
        for m in TOKEN_RE.finditer(self.text, start, end):
            idx = int(m.group(2))
            if idx < len(self.tokens):
                out.append(self.tokens[idx])
        return out


def load_doc(stem: str) -> Doc:
    json_path = next(OCR_DIR.glob(stem + "*.json"))
    md_path = next(OCR_DIR.glob(stem + "*.md"))
    data = json.loads(json_path.read_text(encoding="utf-8"))
    md_text = repair_text(md_path.read_text(encoding="utf-8"))

    tokens: list[Token] = []
    parts: list[str] = []
    page_spans: list[tuple[int, int, int]] = []
    cursor = 0

    for page_index, page in enumerate(data, start=1):
        md = repair_text((page.get("markdown") or {}).get("text") or "")
        images = (page.get("markdown") or {}).get("images") or {}
        blocks = (page.get("prunedResult") or {}).get("parsing_res_list") or []
        table_blocks = [b for b in blocks if b.get("block_label") == "table"]
        table_cursor = 0
        page_img = PAGE_DIR / stem / f"p{page_index:02d}.jpg"
        if not page_img.exists():
            page_img = PAGE_DIR / stem / f"p{page_index:02d}.png"

        def table_repl(match: re.Match[str]) -> str:
            nonlocal table_cursor
            table_html = match.group(0)
            bbox = None
            if table_cursor < len(table_blocks):
                bbox = table_blocks[table_cursor].get("block_bbox")
                table_cursor += 1
            else:
                for block in table_blocks:
                    content = block.get("block_content") or ""
                    if table_html.strip() and table_html.strip() in content:
                        bbox = block.get("block_bbox")
                        break
            token = Token(
                index=len(tokens),
                kind="table",
                page=page_index,
                html=table_html,
                bbox=[int(v) for v in bbox] if bbox else None,
                page_image=page_img if page_img.exists() else None,
            )
            tokens.append(token)
            return f"\x00T{token.index}\x00"

        md = TABLE_RE.sub(table_repl, md)

        basename_map: dict[str, str] = {}
        for rel in images:
            basename_map[os.path.basename(rel.split("?")[0])] = rel

        def img_repl(match: re.Match[str]) -> str:
            tag = match.group(0)
            src_match = re.search(r'src=["\']([^"\']+)["\']', tag, re.I)
            if not src_match:
                return ""
            src = src_match.group(1)
            basename = os.path.basename(src.split("?")[0])
            rel = basename_map.get(basename, src)
            local = IMAGE_DIR / stem / f"p{page_index:02d}_{basename}"
            token = Token(
                index=len(tokens),
                kind="image",
                page=page_index,
                src=local if local.exists() else None,
                rel=basename,
            )
            tokens.append(token)
            return f"\x00I{token.index}\x00"

        md = IMG_RE.sub(img_repl, md)
        if parts:
            cursor += 2
        start = cursor
        parts.append(md)
        cursor += len(md)
        page_spans.append((start, cursor, page_index))

    text = "\n\n".join(parts)

    # The standalone Markdown should equal the JSON page text modulo URL
    # absolutisation and page separators. Record the agreement ratio.
    import difflib

    json_text = "\n\n".join(
        repair_text((page.get("markdown") or {}).get("text") or "") for page in data
    )
    ratio = difflib.SequenceMatcher(None, text, md_text).ratio()
    header = md_text.splitlines()[0] if md_text.splitlines() else stem

    return Doc(
        stem=stem,
        title=header.lstrip("# ").strip(),
        pages=data,
        text=text,
        tokens=tokens,
        page_spans=page_spans,
        md_text=md_text,
        json_text=json_text,
        join_ratio=ratio,
        source_json=json_path,
        source_md=md_path,
    )


def clean_block(value: str, *, keep_newlines: bool = True) -> str:
    value = TOKEN_RE.sub(" ", value)
    value = re.sub(r"<[/]?(?:div|span|p|br|strong|em|u|sup|sub)[^>]*>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = repair_text(value)
    value = re.sub(r"(?m)^\s*#{1,6}\s*", "", value)
    value = re.sub(r"\*\*|__|`", "", value)
    value = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value)
    lines: list[str] = []
    for raw in value.splitlines():
        line = re.sub(r"[ \t]+", " ", raw).strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        if RUNNING_HEADER_RE.match(line) or FOOTER_RE.match(line):
            continue
        lines.append(line)
    while lines and lines[0] == "":
        lines.pop(0)
    while lines and lines[-1] == "":
        lines.pop()
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_inline(value: str) -> str:
    text = clean_block(value, keep_newlines=False)
    return norm_ws(text)


def strip_trailing_instructions(text: str) -> str:
    # Some OCR exports bleed the worked solution into the question block when
    # the four choice markers are damaged. Never show that before submit.
    text = re.split(r"(?im)^\s*(?:Solution|Answer)\s*:", text, maxsplit=1)[0]
    lines = [line for line in text.splitlines()]
    while lines:
        last = norm_ws(lines[-1])
        if not last:
            lines.pop()
            continue
        if INSTRUCTION_RE.match(last):
            lines.pop()
            continue
        break
    return "\n".join(lines).strip()


@dataclass
class ParsedQuestion:
    number: int
    stem: str
    options: list[tuple[str, str]]
    key: str | None = None
    explanation: str | None = None
    flags: list[str] = field(default_factory=list)
    page_start: int = 1
    page_end: int = 1
    images: list[Token] = field(default_factory=list)
    tables: list[Token] = field(default_factory=list)
    option_tokens: list[Token] = field(default_factory=list)
    span_start: int = 0
    span_end: int = 0
    passage: str | None = None
    passage_id: str | None = None

    @property
    def option_texts(self) -> list[str]:
        return [text for _, text in self.options]


LETTER_OPTION_RE = re.compile(r"\(([a-dA-D])\)\s*")
NUMBER_PAREN_RE = re.compile(r"\(([1-4])\)\s*")
NUMBER_LINE_RE = re.compile(
    r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?(?:\$\$[ \t]*)?"
    r"(?:\\(?:mathbf|mathrm|mathsf)\{)?([1-4])\}?[\.\)][ \t]*"
)
LETTER_LINE_RE = re.compile(
    r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?(?:\$\$[ \t]*)?"
    r"(?:\\(?:mathbf|mathrm|mathsf)\{)?([A-D])\}?[\.\)][ \t]*"
)
QUESTION_NUM_RE = re.compile(r"(?m)^[ \t]*(\d{1,3})\.\s+")
Q_PREFIX_RE = re.compile(r"(?m)^[ \t]*#{0,6}[ \t]*Q\.?\s*(\d{1,3})\s*[\.\)]\s*")
INLINE_Q_RE = re.compile(r"(?m)^[ \t]*#{0,6}[ \t]*Question\s*(\d{1,3})\b")


def _sequence_runs(
    matches: list[re.Match[str]], letters: str
) -> list[tuple[int, list[int]]]:
    """Return every complete ordered run of option markers, in printed order."""
    wanted = list(letters)
    runs: list[tuple[int, list[int]]] = []
    for i, match in enumerate(matches):
        if match.group(1).upper() != wanted[0].upper():
            continue
        picked = [i]
        j = i + 1
        k = 1
        while k < len(wanted):
            while j < len(matches) and matches[j].start() <= matches[picked[-1]].start():
                j += 1
            if j >= len(matches):
                break
            if matches[j].group(1).upper() == wanted[k].upper():
                picked.append(j)
                k += 1
                j += 1
            else:
                break
        if k == len(wanted):
            runs.append((i, picked))
    return runs


def _sequence(matches: list[re.Match[str]], letters: str) -> tuple[int, list[int]] | None:
    """Return the last complete ordered run of option markers."""
    runs = _sequence_runs(matches, letters)
    return runs[-1] if runs else None


OPTION_CUT_RE = re.compile(r"(?i)\bOptions?\s*[.:]")
RESPONSE_ID_RE = re.compile(r"\b\d{8,}\.\d\b")
OPTION_JUNK_RE = re.compile(
    r"(?i)\b(?:Question\s*(?:Number|Id|Type)|Option\s*Shuffling|Is\s*Question\s*Mandatory|"
    r"Correct\s*Marks|Wrong\s*Marks|Language)\s*:.*$"
)
TRAILING_INSTRUCTION_RE = re.compile(
    r"(?is)\s*(?:Directions?\s*\(?\s*Q(?:uestion)?\.?\s*\d{1,3}\s*[-–—]\s*"
    r"Q(?:uestion)?\.?\s*\d{1,3}\s*\)?.*|Directions?\s*:.*|"
    r"Choose\s+the\s+correct\s+answer.*|Study\s+the\s+adjoining.*|"
    r"dotted\s+line\s+is.*|the\s+next\s+figure\s+is.*)$"
)


def clean_option_text(text: str, *, inline: bool = False) -> str:
    """Remove response-sheet ids and section labels glued to a choice."""
    text = OPTION_CUT_RE.split(text)[0]
    text = OPTION_JUNK_RE.sub(" ", text)
    text = RESPONSE_ID_RE.sub(" ", text)
    text = re.split(r"(?im)^\s*(?:Solution|Answer)\s*:", text, maxsplit=1)[0]
    text = TRAILING_INSTRUCTION_RE.sub("", text)
    out = clean_inline(text)
    if inline:
        out = out.strip(" -:")
    # Drop a letter-to-number mapping fragment that OCR glued to the last
    # choice ("Generative cell B.2 C.3 D.4").
    out = re.sub(r"\s*(?:[A-D]\.\s*[1-4]\s*){2,}$", "", out).strip()
    if out.count("$$") % 2 == 1:
        out = out.replace("$$", "")
    return out


def _label_run(
    block: str,
    regex: re.Pattern[str],
    letters: str,
    *,
    inline: bool = False,
) -> tuple[list[tuple[str, str]], int, int] | None:
    matches = list(regex.finditer(block))
    runs = _sequence_runs(matches, letters)
    if not runs:
        return None

    def build(run: tuple[int, list[int]]) -> tuple[list[tuple[str, str]], int, int]:
        start_i, picked = run
        first = matches[picked[0]]
        last = matches[picked[-1]]
        options: list[tuple[str, str]] = []
        for pos, idx in enumerate(picked):
            m = matches[idx]
            end = matches[picked[pos + 1]].start() if pos + 1 < len(picked) else len(block)
            text = clean_option_text(block[m.end() : end], inline=inline)
            label = letters[pos].upper()
            options.append((label, text))
        return options, first.start(), last.end()

    # A later duplicate label run is normally the real choice block, but some
    # two-column papers print complete text choices and then a second run of
    # labels beside unrelated images from the next question. Prefer the last
    # run that actually contains readable choice text.
    for run in reversed(runs):
        candidate = build(run)
        if sum(1 for _, text in candidate[0] if text.strip()) >= 2:
            return candidate
    return build(runs[-1])


def _as_letters(
    found: tuple[list[tuple[str, str]], int, int] | None,
) -> tuple[list[tuple[str, str]], int, int] | None:
    if not found:
        return None
    options, start, end = found
    return [(chr(65 + i), text) for i, (_, text) in enumerate(options)], start, end


def _unordered_label_run(
    block: str,
    regex: re.Pattern[str],
    letters: str,
    *,
    inline: bool = False,
) -> tuple[list[tuple[str, str]], int, int] | None:
    """Recover choices printed out of order (common in answer-key exports).

    Some OCR exports print ``C. …  D. …  A. …  B. …`` or put the correct choice
    first. The labels still identify each choice, so collect one of each and
    sort by position; never infer a label that is not printed.
    """
    first_by: dict[str, re.Match[str]] = {}
    for match in regex.finditer(block):
        label = match.group(1).upper()
        if label in letters and label not in first_by:
            first_by[label] = match
    if len(first_by) != len(letters):
        return None
    ordered = sorted(first_by.values(), key=lambda match: match.start())
    if ordered[-1].start() - ordered[0].start() > 6000:
        return None
    options: list[tuple[str, str]] = []
    for pos, match in enumerate(ordered):
        end = ordered[pos + 1].start() if pos + 1 < len(ordered) else len(block)
        text = clean_option_text(block[match.end() : end], inline=inline)
        options.append((match.group(1).upper(), text))
    return options, ordered[0].start(), ordered[-1].end()


def _partial_label_run(
    block: str,
    regex: re.Pattern[str],
    letters: str,
    *,
    inline: bool = False,
    minimum: int = 3,
) -> tuple[list[tuple[str, str]], int, int] | None:
    """Recover a printed choice run that is missing one or more labels.

    The 2024 answer-key exports frequently lose the last label (or one middle
    label) while keeping the remaining choices. Only labels that are actually
    printed are used; the returned labels keep their printed identity.
    """
    first_by: dict[str, re.Match[str]] = {}
    for match in regex.finditer(block):
        label = match.group(1).upper()
        if label in letters and label not in first_by:
            first_by[label] = match
    if len(first_by) < minimum or letters[0].upper() not in first_by:
        return None
    ordered = sorted(first_by.values(), key=lambda match: match.start())
    if ordered[-1].start() - ordered[0].start() > 6000:
        return None
    options: list[tuple[str, str]] = []
    for pos, match in enumerate(ordered):
        end = ordered[pos + 1].start() if pos + 1 < len(ordered) else len(block)
        text = clean_option_text(block[match.end() : end], inline=inline)
        options.append((match.group(1).upper(), text))
    return options, ordered[0].start(), ordered[-1].end()


def _unlabelled_math_run(
    block: str, *, inline: bool = False
) -> tuple[list[tuple[str, str]], int, int] | None:
    """Use four unlabelled display-math choices in printed order.

    A few exports drop the A./B./C./D. labels but keep exactly four equations.
    Order is the only information printed, so this is used only for a complete
    set of four and never to fill a missing choice.
    """
    segments = list(re.finditer(r"\$\$.*?\$\$", block, re.S))
    if len(segments) != 4:
        return None
    options = [
        (chr(65 + i), clean_option_text(match.group(0), inline=inline))
        for i, match in enumerate(segments)
    ]
    return options, segments[0].start(), segments[-1].end()


def find_options(
    block: str, style: str, *, allow_unordered: bool = False
) -> tuple[list[tuple[str, str]], int, int] | None:
    """Locate the printed choices and return (options, start, end)."""
    has_header = allow_unordered or bool(
        re.search(r"(?im)^\s*#{0,6}\s*Options?\s*:?\s*$", block)
    )
    if style == "lower":
        lower = _label_run(block, re.compile(r"\(([a-d])\)\s*"), "abcd")
        if lower:
            return lower
        lettered = _label_run(block, LETTER_OPTION_RE, "abcd")
        if lettered:
            return lettered
        if has_header:
            unordered = _unordered_label_run(block, LETTER_OPTION_RE, "abcd")
            if unordered:
                return unordered
            return _partial_label_run(block, LETTER_OPTION_RE, "abcd")
        return _unordered_label_run(block, LETTER_OPTION_RE, "abcd")
    if style == "number":
        paren = _as_letters(_label_run(block, NUMBER_PAREN_RE, "1234"))
        line = _as_letters(_label_run(block, NUMBER_LINE_RE, "1234"))
        if paren and line:
            return line if line[1] >= paren[1] else paren
        if line or paren:
            return line or paren
        if has_header:
            unordered = _as_letters(
                _unordered_label_run(block, NUMBER_LINE_RE, "1234")
            )
            if unordered:
                return unordered
            partial = _as_letters(
                _partial_label_run(block, NUMBER_LINE_RE, "1234")
            )
            if partial:
                return partial
            return _unlabelled_math_run(block)
        return None
    if style == "letter":
        lettered = _label_run(block, LETTER_LINE_RE, "ABCD", inline=True)
        if lettered:
            return lettered
        if has_header:
            unordered = _unordered_label_run(
                block, LETTER_LINE_RE, "ABCD", inline=True
            )
            if unordered:
                return unordered
            partial = _partial_label_run(
                block, LETTER_LINE_RE, "ABCD", inline=True
            )
            if partial:
                return partial
            return _unlabelled_math_run(block, inline=True)
        return None
    raise ValueError(style)


def strip_leading_heading(text: str, number: int) -> str:
    text = re.sub(
        rf"^\s*(?:#{{0,6}}\s*)?(?:Question|Q\.?)\s*{number}\s*[\.\)]?\s*",
        "",
        text,
        flags=re.I,
    )
    # Section restarts and damaged numbering can leave a heading whose number
    # no longer matches the parser's continuous number. Strip any leading
    # Question heading; it is layout, not question text.
    text = re.sub(
        r"^\s*(?:#{0,6}\s*)?(?:Question|Q\.?)\s*\d{1,3}\s*[\.\)]?\s*",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(rf"^\s*{number}\s*[\.\)]\s*", "", text)
    return text.lstrip()


def split_questions(
    text: str,
    pattern: re.Pattern[str],
    *,
    allow_gaps: bool = True,
    max_gap: int = 10,
    allow_restart: bool = False,
) -> list[tuple[int, int, int]]:
    """Return (number, start, end) spans, keeping printed order.

    Some papers restart numbering at 1 for a second section (Applied
    Mathematics 2025). Those questions are renumbered continuously so the
    library keeps one ordered paper. Restarts are opt-in because numbered
    table rows in other papers would otherwise be mistaken for a new section.
    """
    candidates = list(pattern.finditer(text))
    spans: list[tuple[int, int, int]] = []
    run_offset = 0
    run_last = 0
    prev_global = 0
    for match in candidates:
        number = int(match.group(1))
        if spans and allow_restart and number == 1 and run_last >= 2:
            run_offset = prev_global
            run_last = 0
        if not spans:
            accepted = True
        elif number == run_last + 1:
            accepted = True
        elif number == run_last and allow_restart:
            # OCR sometimes duplicates a question number; keep the later
            # heading as the real start and drop the duplicate span.
            accepted = True
        elif allow_gaps and run_last < number <= run_last + max_gap:
            accepted = True
        elif allow_restart and number == 1 and run_last >= 2:
            accepted = True
        else:
            accepted = False
        if not accepted:
            continue
        global_number = run_offset + number
        if spans:
            old = spans[-1]
            spans[-1] = (old[0], old[1], match.start())
        spans.append((global_number, match.start(), len(text)))
        run_last = number
        prev_global = global_number
    return spans


def split_q_prefix(text: str, *, allow_restart: bool = False) -> list[tuple[int, int, int]]:
    return split_questions(text, Q_PREFIX_RE, allow_restart=allow_restart)


def split_inline(text: str) -> list[tuple[int, int, int]]:
    return split_questions(text, INLINE_Q_RE, allow_restart=True)


INLINE_QUESTION_LINE_RE = re.compile(
    r"(?m)^[ \t]*#{0,6}[ \t]*(?:Question|Q\.?)\s*(\d{1,3})\b"
)


def split_inline_question_lines(text: str) -> list[tuple[int, int, int]]:
    return split_questions(text, INLINE_QUESTION_LINE_RE, allow_restart=True)


# ---------------------------------------------------------------------------
# Profiles


def parse_solved2022(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    hints = re.search(r"(?im)^#{1,6}\s*(?:Hints\s*&\s*Explanations|Answer Key)\s*$", text)
    body = text[: hints.start()] if hints else text
    spans = split_questions(body, QUESTION_NUM_RE)
    questions: list[ParsedQuestion] = []
    for number, start, end in spans:
        block = body[start:end]
        found = find_options(block, "lower")
        if not found:
            continue
        options, opt_start, _ = found
        stem = strip_trailing_instructions(strip_leading_heading(clean_block(block[:opt_start]), number))
        if not stem and not doc.tokens_between(start, start + end):
            continue
        q = ParsedQuestion(
            number=number,
            stem=stem,
            options=options,
            page_start=doc.page_for(start),
            page_end=doc.page_for(max(start, end - 1)),
            images=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "image"],
            tables=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "table"],
            option_tokens=doc.tokens_between(start + opt_start, end),
            span_start=start,
            span_end=end,
        )
        questions.append(q)

    keys: dict[int, tuple[str, str]] = {}
    if hints:
        # Some exports wrap a key in a centered <div> or promote it to a
        # heading ("## 11. (c)"). Normalise both before matching so those
        # printed answers are not dropped.
        key_text = re.sub(r"(?i)</?div[^>]*>", "\n", text[hints.end() :])
        key_re = re.compile(
            r"(?m)^\s*#{0,6}\s*(?:S\s*)?(\d{1,3})\s*\.\s*(?:Ans\.?\s*)?"
            r"\(([a-dA-D])\*?\)\s*"
        )
        matches = list(key_re.finditer(key_text))
        for i, m in enumerate(matches):
            number = int(m.group(1))
            end = matches[i + 1].start() if i + 1 < len(matches) else len(key_text)
            explanation = clean_block(key_text[m.end() : end])
            keys[number] = (m.group(2).upper(), explanation)
    for q in questions:
        if q.number in keys:
            q.key, q.explanation = keys[q.number]
    return questions, keys


def parse_q2023(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    header = re.search(r"(?im)^#{1,6}\s*SOLUTIONS?\s*$", text)
    first_key = re.search(r"(?im)^#{0,6}\s*S\.?\s*1\.?\s*Ans\.?", text)
    # The first key marker can precede an inline "SOLUTIONS" heading (the
    # heading sometimes appears after S24). Cut the question section at
    # whichever comes first so no early answers are lost.
    body_end = len(text)
    for marker in (header, first_key):
        if marker and marker.start() < body_end:
            body_end = marker.start()
    body = text[:body_end]
    spans = split_q_prefix(body)
    questions: list[ParsedQuestion] = []
    for number, start, end in spans:
        block = body[start:end]
        found = find_options(block, "lower")
        if not found:
            continue
        options, opt_start, _ = found
        stem = strip_trailing_instructions(strip_leading_heading(clean_block(block[:opt_start]), number))
        if not stem and not doc.tokens_between(start, start + opt_start):
            continue
        q = ParsedQuestion(
            number=number,
            stem=stem,
            options=options,
            page_start=doc.page_for(start),
            page_end=doc.page_for(max(start, end - 1)),
            images=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "image"],
            tables=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "table"],
            option_tokens=doc.tokens_between(start + opt_start, end),
            span_start=start,
            span_end=end,
        )
        questions.append(q)

    keys: dict[int, tuple[str, str]] = {}
    if first_key:
        # Keys are sometimes wrapped in a centered <div>; turn the wrapper
        # into a line break so the line-start key regex still sees them.
        sol_text = re.sub(
            r"(?i)</?div[^>]*>", "\n", text[first_key.start() :]
        )
        sol_re = re.compile(r"(?im)^#{0,6}\s*S\.?\s*(\d{1,3})\.?\s*Ans\.?\s*\(?([a-dA-D])\)?")
        matches = list(sol_re.finditer(sol_text))
        for i, m in enumerate(matches):
            number = int(m.group(1))
            end = matches[i + 1].start() if i + 1 < len(matches) else len(sol_text)
            explanation = clean_block(sol_text[m.end() : end])
            explanation = re.sub(r"^Sol\.?\s*", "", explanation, flags=re.I).strip()
            keys[number] = (m.group(2).upper(), explanation)
    for q in questions:
        if q.number in keys:
            q.key, q.explanation = keys[q.number]
    return questions, keys


def parse_aggregate(doc: Doc, *, solution_header: str = "Solution") -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    sol = re.search(rf"(?im)^#{{1,6}}\s*{re.escape(solution_header)}s?\s*$", text)
    body = text[: sol.start()] if sol else text
    spans = split_q_prefix(body)
    questions: list[ParsedQuestion] = []
    for number, start, end in spans:
        block = body[start:end]
        found = find_options(block, "number")
        if not found:
            found = find_options(block, "lower")
        if not found:
            continue
        options, opt_start, _ = found
        stem = strip_trailing_instructions(strip_leading_heading(clean_block(block[:opt_start]), number))
        if not stem and not doc.tokens_between(start, start + opt_start):
            continue
        q = ParsedQuestion(
            number=number,
            stem=stem,
            options=options,
            page_start=doc.page_for(start),
            page_end=doc.page_for(max(start, end - 1)),
            images=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "image"],
            tables=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "table"],
            option_tokens=doc.tokens_between(start + opt_start, end),
            span_start=start,
            span_end=end,
        )
        questions.append(q)

    keys: dict[int, tuple[str, str]] = {}
    if sol:
        sol_text = text[sol.end() :]
        sol_re = re.compile(r"(?im)^#{0,6}\s*Q\.?\s*(\d{1,3})\.?\s*$")
        matches = list(sol_re.finditer(sol_text))
        for i, m in enumerate(matches):
            number = int(m.group(1))
            end = matches[i + 1].start() if i + 1 < len(matches) else len(sol_text)
            chunk = sol_text[m.end() : end]
            key_match = re.search(r"(?i)(?:correct\s+answer\s+is|correct\s+option\s*:?)\s*(?:option\s*)?([1-4])\b", chunk)
            if not key_match:
                key_match = re.search(r"(?i)\bAns\.?\s*(?:option\s*)?([1-4])\b", chunk)
            if key_match:
                key = chr(64 + int(key_match.group(1)))
                explanation = clean_block(chunk[key_match.end() :])
                keys[number] = (key, explanation)
    for q in questions:
        if q.number in keys:
            q.key, q.explanation = keys[q.number]
    return questions, keys


def _passage_split(stem_part: str) -> tuple[str, str | None]:
    """Split a repeated reading passage from the actual question."""
    intro = re.search(
        r"(?im)^#{0,6}\s*(?:read|study)\s+(?:the|this|the given|the following|the given passage).*$",
        stem_part,
    )
    if not intro:
        return stem_part, None
    rest = stem_part[intro.end() :]
    lines = rest.splitlines()
    # The question is normally a heading or the final paragraph before the
    # choices. Prefer a heading after at least one passage paragraph.
    heading_idx = None
    seen_para = False
    for i, line in enumerate(lines):
        raw = line.strip()
        if not raw:
            continue
        if re.match(r"^#{1,6}\s+", raw):
            if seen_para:
                heading_idx = i
                break
        else:
            seen_para = True
    if heading_idx is not None:
        passage = "\n".join(lines[:heading_idx])
        question = "\n".join(lines[heading_idx:])
    else:
        nonempty = [i for i, line in enumerate(lines) if line.strip()]
        if len(nonempty) < 2:
            return stem_part, None
        last = nonempty[-1]
        passage = "\n".join(lines[:last])
        question = "\n".join(lines[last:])
    passage = clean_block(passage)
    question = clean_block(question)
    if len(passage) < 80:
        return stem_part, None
    return question, passage


def parse_inline(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    spans = split_inline(text)
    questions: list[ParsedQuestion] = []
    passages: dict[str, str] = {}
    current_passage_id: str | None = None

    for number, start, end in spans:
        block = text[start:end]
        opt_match = re.search(r"(?im)^#{0,6}\s*Options?\s*:?\s*$", block)
        answer_match = re.search(r"(?im)^#{0,6}\s*Answer\s*[:：]\s*([A-Da-d1-4])\b", block)
        solution_match = re.search(r"(?im)^#{0,6}\s*Solution\s*:?\s*$", block)

        pre = block[: opt_match.start()] if opt_match else block[: answer_match.start()] if answer_match else block
        options_part = ""
        if opt_match:
            # Keep choices that appear after an interleaved ``Answer:`` line
            # (common in 2024 answer-key exports); only the worked solution
            # marks the true end of the choice block.
            opt_end = (
                solution_match.start()
                if solution_match and solution_match.start() > opt_match.start()
                else len(block)
            )
            options_part = block[opt_match.end() : opt_end]

        # The letter-to-number mapping ("A. 1  B. 2 ...") is sometimes glued
        # to the final numbered choice when the Options header is lost.
        glued_mapping = re.search(
            r"(?is)(?:^|[\s:])A\.\s*1\b.{0,160}?B\.\s*2\b.{0,160}?C\.\s*3\b.{0,160}?D\.\s*4\b",
            pre,
        )
        if glued_mapping and find_options(pre, "number"):
            pre = pre[: glued_mapping.start()]

        q, passage = _passage_split(pre)
        stem_source = q

        numbered = find_options(stem_source, "number")
        lettered = find_options(stem_source, "letter")
        options: list[tuple[str, str]] = []
        opt_start = len(stem_source)

        mapping_values = [
            norm_ws(m.group(1))
            for m in re.finditer(r"(?m)^[ \t]*(?:#{0,6}[ \t]*)?([A-D])[\.\)]\s*(.*)$", options_part)
        ]
        mapping_numeric = all(v in ("", "1", "2", "3", "4") for v in mapping_values) if mapping_values else False

        if numbered and (mapping_numeric or not lettered):
            options = numbered[0]
            opt_start = numbered[1]
        elif lettered:
            options = lettered[0]
            opt_start = lettered[1]
        elif numbered:
            options = numbered[0]
            opt_start = numbered[1]
        else:
            found = find_options(options_part, "letter", allow_unordered=True)
            if found:
                options = found[0]
            else:
                found = find_options(options_part, "number", allow_unordered=True)
                if found:
                    options = found[0]
            if not options:
                # Some exports put the first choices before the ``Options:``
                # heading and the remainder after it (match-list papers). Scan
                # the full block only when the normal choice block is empty.
                found = find_options(block, "number", allow_unordered=True)
                if found:
                    options = found[0]
                    opt_start = found[1]
                else:
                    found = find_options(block, "letter", allow_unordered=True)
                    if found:
                        options = found[0]
                        opt_start = found[1]

        # Some choices are printed as four unlabelled display-math blocks
        # (typical for matrix options). The mapping block proves that choices
        # exist; use the last four blocks rather than the meaningless "A. 1".
        if not options and mapping_values:
            math_blocks = list(re.finditer(r"\$\$.*?\$\$", stem_source, re.S))
            if len(math_blocks) >= 4:
                chosen = math_blocks[-4:]
                options = [
                    (chr(65 + i), clean_inline(match.group(0)))
                    for i, match in enumerate(chosen)
                ]
                opt_start = chosen[0].start()

        stem = strip_trailing_instructions(strip_leading_heading(clean_block(stem_source[:opt_start]), number))
        if not stem and not doc.tokens_between(start, start + (opt_start if opt_start else 0)):
            # A fully scanned body is still playable if a crop is attached.
            if not doc.tokens_between(start, end):
                continue

        passage_id = None
        if passage:
            digest = hashlib.sha1(norm_ws(passage).encode("utf-8")).hexdigest()[:12]
            passages.setdefault(digest, passage)
            passage_id = f"p{digest}"
            current_passage_id = passage_id
        elif current_passage_id and re.search(r"(?i)\b(passage|author|writer|poet|narrator)\b", stem):
            passage_id = current_passage_id

        qobj = ParsedQuestion(
            number=number,
            stem=stem,
            options=options,
            page_start=doc.page_for(start),
            page_end=doc.page_for(max(start, end - 1)),
            images=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "image"],
            tables=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "table"],
            option_tokens=doc.tokens_between(
                start + (opt_match.end() if opt_match else opt_start),
                start + (opt_end if opt_match else opt_start),
            )
            if opt_match
            else [],
            span_start=start,
            span_end=start
            + (
                opt_end
                if opt_match
                else solution_match.start()
                if solution_match
                else len(block)
            ),
            passage=passage,
            passage_id=passage_id,
        )
        if answer_match:
            raw_key = answer_match.group(1).upper()
            if raw_key.isdigit():
                idx = int(raw_key) - 1
                raw_key = chr(65 + idx) if 0 <= idx < len(options) else ""
            if any(label == raw_key for label, _ in options):
                qobj.key = raw_key
        if solution_match:
            expl = clean_block(block[solution_match.end() :])
            qobj.explanation = expl or None

        if not qobj.key:
            # Many 2025 papers omit the Answer line but state the key in the
            # worked solution ("[The correct option is 3.]").
            tail = block[opt_match.end() :] if opt_match else block[opt_start:]
            fallback = re.search(
                r"(?i)(?:correct\s+(?:option|answer)\s*(?:is|:)?|answer\s+is)\s*(?:option\s*)?([1-4A-D])\b",
                tail,
            )
            if fallback:
                raw_key = fallback.group(1).upper()
                if raw_key.isdigit():
                    idx = int(raw_key) - 1
                    raw_key = chr(65 + idx) if 0 <= idx < len(options) else ""
                if any(label == raw_key for label, _ in options):
                    qobj.key = raw_key
        questions.append(qobj)

    keys: dict[int, tuple[str, str]] = {}
    for q in questions:
        if q.key:
            keys[q.number] = (q.key, q.explanation or "")
    return questions, keys


def parse_plain(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    # The 2024 "ANSWER KEY" exports have damaged question numbering but intact
    # four-choice blocks, so the choices are the reliable boundary.
    return parse_option_runs(doc, "paren_number")


OPTION_RUN_PATTERNS = {
    "paren_number": re.compile(r"\(([1-4])\)\s*"),
    "line_number": re.compile(r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?([1-4])[\.\)][ \t]*"),
    "paren_letter": re.compile(r"\(([A-D])\)\s*"),
    "line_letter": re.compile(r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?([A-D])[\.\)][ \t]*"),
}

GAP_HEADING_RE = re.compile(
    # The OCR sometimes reads "Q." as "0." (Hindi 2025: "0.3.", "0.16.").
    # Consume that leading zero so it is not left at the start of the stem or
    # tacked onto the previous question's last choice.
    r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?(?:Q\.?[ \t]*)?(?:0[\.\)][ \t]*)?"
    r"(\d{1,3})[\.\)][ \t]+"
)
PAGE_MARKER_RE = re.compile(r"(?m)^[ \t]*(?:\d{3}\s*[A-Z]/[A-Z]|[（(]\s*\d{1,3}\s*[)）])[ \t]*$")


def _all_option_runs(
    text: str,
    pattern: re.Pattern[str],
    labels: str,
    *,
    start: int = 0,
    end: int | None = None,
) -> list[list[re.Match[str]]]:
    """Return every complete ordered run of four option labels."""
    limit = len(text) if end is None else end
    matches = [m for m in pattern.finditer(text, start, limit)]
    runs: list[list[re.Match[str]]] = []
    i = 0
    while i < len(matches):
        if matches[i].group(1).upper() != labels[0].upper():
            i += 1
            continue
        picked = [i]
        j = i + 1
        k = 1
        while k < len(labels):
            while j < len(matches) and matches[j].start() <= matches[picked[-1]].start():
                j += 1
            if j >= len(matches):
                break
            if matches[j].group(1).upper() == labels[k].upper():
                picked.append(j)
                k += 1
                j += 1
            else:
                break
        if k == len(labels):
            run = [matches[idx] for idx in picked]
            runs.append(run)
            i = picked[-1] + 1
        else:
            i += 1
    return runs


def _line_end(text: str, pos: int) -> int:
    newline = text.find("\n", pos)
    return len(text) if newline < 0 else newline


def _option_text(text: str, run: list[re.Match[str]], index: int, next_start: int) -> str:
    match = run[index]
    if index + 1 < len(run):
        end = run[index + 1].start()
    else:
        # The last choice is bounded by the next printed question heading when
        # one is nearby (options may wrap across several lines), otherwise by
        # the end of its line.
        window_end = min(len(text), max(next_start, match.end()) + 700)
        heading = GAP_HEADING_RE.search(text, match.end(), window_end)
        end = heading.start() if heading and heading.start() - match.end() < 700 else _line_end(text, match.end())
    raw = text[match.end() : end]
    raw = re.split(r"(?i)\bChoose the correct answer\b", raw)[0]
    raw = re.split(r"(?i)\bDirections?\s*\(", raw)[0]
    # A passage or section marker printed after the last choice belongs to the
    # next question, not to this option.
    raw = re.split(
        r"(?im)^[ \t]*#{1,6}[ \t]*(?:निम्नलिखित|Read the following|Question\s+Number\s*\()",
        raw,
    )[0]
    return clean_inline(raw)


def parse_option_runs(
    doc: Doc,
    style: str,
    *,
    body_end: int | None = None,
) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    """Parse papers whose printed question numbers are unreliable.

    The four printed choices define the question boundary. The stem is the
    text between the previous run's last choice and the current run, trimmed
    back to the last question heading (or page marker) it contains.
    """
    text = doc.text
    end = len(text) if body_end is None else body_end
    pattern = OPTION_RUN_PATTERNS[style]
    labels = "1234" if "number" in style else "ABCD"
    runs = _all_option_runs(text, pattern, labels, end=end)

    questions: list[ParsedQuestion] = []
    previous_end = 0
    expected = 1
    for run in runs:
        options: list[tuple[str, str]] = []
        for i in range(4):
            opt_text = _option_text(text, run, i, run[0].start())
            options.append((chr(65 + i), opt_text))
        # A run with fewer than two readable choices cannot be played.
        if sum(1 for _, value in options if len(value.strip()) >= 2) < 2:
            continue
        # Drop OCR debris such as "(A)", "(A)-", "(A)-(1", "(A)-(II)" that can
        # form a fake four-label run on a damaged page.
        if all(len(value.strip()) < 16 for _, value in options) and len(
            {value.strip()[:4] for _, value in options}
        ) == 1:
            previous_end = _line_end(text, run[-1].end())
            continue

        gap_start = previous_end
        gap_end = run[0].start()
        gap = text[gap_start:gap_end]
        page_marker = None
        for marker in PAGE_MARKER_RE.finditer(gap):
            page_marker = marker
        if page_marker is not None:
            gap_start += page_marker.end()
            gap = text[gap_start:gap_end]
        headings = list(GAP_HEADING_RE.finditer(gap))
        detected: int | None = None
        if headings:
            last = headings[-1]
            candidate = int(last.group(1))
            if 1 <= candidate <= 100 and candidate <= expected + 12:
                detected = candidate
                gap_start += last.end()
                gap = text[gap_start:gap_end]
        stem = strip_trailing_instructions(clean_block(gap))
        if not stem:
            # The choice labels themselves are the only content.
            previous_end = _line_end(text, run[-1].end())
            continue

        number = detected if detected is not None else expected
        if number < expected:
            number = expected
        expected = number + 1
        option_end = _line_end(text, run[-1].end())

        questions.append(
            ParsedQuestion(
                number=number,
                stem=stem,
                options=options,
                page_start=doc.page_for(gap_start),
                page_end=doc.page_for(max(gap_start, gap_end - 1)),
                images=[t for t in doc.tokens_between(gap_start, gap_end) if t.kind == "image"],
                tables=[t for t in doc.tokens_between(gap_start, gap_end) if t.kind == "table"],
                option_tokens=doc.tokens_between(run[0].start(), option_end),
                span_start=gap_start,
                span_end=option_end,
            )
        )
        previous_end = option_end

    # Drop accidental duplicate numbers while keeping the first full row.
    seen: set[int] = set()
    unique: list[ParsedQuestion] = []
    for question in questions:
        if question.number in seen:
            continue
        seen.add(question.number)
        unique.append(question)
    return unique, {}


def parse_cs2025(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    q_spans = split_q_prefix(text)
    if not q_spans:
        return [], {}
    # The solution section restarts at Q.1. after the last printed question.
    # The last span always ends at EOF, so search from the last question start.
    sol_start = text.find("Q.1.", q_spans[-1][1] + 1)
    body = text[:sol_start] if sol_start > 0 else text
    spans = split_q_prefix(body)
    questions: list[ParsedQuestion] = []
    for number, start, end in spans:
        block = body[start:end]
        found = find_options(block, "number")
        if not found:
            token_matches = list(TOKEN_RE.finditer(block))
            if len(token_matches) < 4:
                continue
            chosen = token_matches[-4:]
            options = [(chr(65 + i), "") for i in range(4)]
            opt_start = chosen[0].start()
        else:
            options, opt_start, _ = found
        stem = strip_trailing_instructions(strip_leading_heading(clean_block(block[:opt_start]), number))
        if not stem and not doc.tokens_between(start, start + opt_start):
            continue
        q = ParsedQuestion(
            number=number,
            stem=stem,
            options=options,
            page_start=doc.page_for(start),
            page_end=doc.page_for(max(start, end - 1)),
            images=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "image"],
            tables=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "table"],
            option_tokens=doc.tokens_between(start + opt_start, end),
            span_start=start,
            span_end=end,
        )
        questions.append(q)

    keys: dict[int, tuple[str, str]] = {}
    if sol_start > 0:
        sol_text = text[sol_start:]
        sol_re = re.compile(r"(?im)^#{0,6}\s*Q\.?\s*(\d{1,3})\.?\s*$")
        matches = list(sol_re.finditer(sol_text))
        for i, m in enumerate(matches):
            number = int(m.group(1))
            end = matches[i + 1].start() if i + 1 < len(matches) else len(sol_text)
            chunk = sol_text[m.end() : end]
            key_match = re.search(r"(?i)Answer\s*:?\s*(?:Option\s*)?([1-4])\b", chunk)
            if not key_match:
                key_match = re.search(r"(?i)Correct\s+Option\s*:?\s*([1-4])\b", chunk)
            if key_match:
                key = chr(64 + int(key_match.group(1)))
                explanation = clean_block(chunk[key_match.end() :])
                keys[number] = (key, explanation)
    for q in questions:
        if q.number in keys:
            q.key, q.explanation = keys[q.number]
    return questions, keys


NTA_META_FIELDS = {
    "Section",
    "Question ID",
    "Question Type",
    "Language",
    "Paper",
    "Set Name",
    "Exam Date",
    "Exam Shift",
    "A",
    "B",
    "C",
    "D",
}
NTA_PLACEHOLDER_VALUES = {
    "question",
    "question type: mcq",
    "mcq",
    "cad, vol.ii",
    "cad, vol. ii",
}


def _nta_split_label(cell: str) -> tuple[str, str] | None:
    """Split labels that OCR merged into one table cell, e.g. ``Item No: 30``."""
    match = re.match(
        r"^(Section|Item No|Question ID|Question Type|Language|Paper|Set Name|Exam Date|Exam Shift|Question|Passage|A|B|C|D)\s*:\s*(.*)$",
        cell,
        re.I | re.S,
    )
    if not match:
        return None
    label = match.group(1)
    label = next(
        (known for known in NTA_META_FIELDS | {"Item No", "Question", "Passage"} if known.lower() == label.lower()),
        label,
    )
    return label, match.group(2).strip()


def parse_nta_tables(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    """Parse NTA-style exports where every item is a series of table rows.

    Two layouts occur. Some exports put the real choices inline in the question
    (``(1) ... (4)``) and use ``A: 1`` … ``D: 4`` only as a response-code
    mapping. Others put the choice text in the ``A:`` … ``D:`` rows. Both are
    supported, and OCR-merged labels such as ``Item No: 30`` are split first.
    """
    records: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    passage_parts: list[str] = []
    question_parts: list[str] = []
    option_values: dict[str, str] = {}
    in_passage = False

    def finish() -> None:
        nonlocal current, passage_parts, question_parts, option_values, in_passage
        if current is not None:
            current["passage_parts"] = passage_parts
            current["question_parts"] = question_parts
            current["option_values"] = option_values
            records.append(current)
        current = None
        passage_parts = []
        question_parts = []
        option_values = {}
        in_passage = False

    for page_index, page in enumerate(doc.pages, start=1):
        for block in (page.get("prunedResult") or {}).get("parsing_res_list") or []:
            if block.get("block_label") != "table":
                continue
            content = block.get("block_content") or ""
            for row_match in re.finditer(r"<tr[^>]*>(.*?)</tr>", content, re.S):
                cells = [
                    norm_ws(html.unescape(re.sub(r"<[^>]+>", " ", cell)))
                    for cell in re.findall(r"<td[^>]*>(.*?)</td>", row_match.group(1), re.S)
                ]
                cells = [cell for cell in cells if cell]
                if not cells:
                    continue
                label, value = _nta_split_label(cells[0]) or (cells[0], "")
                if label == "Item No":
                    finish()
                    item = value or (cells[1] if len(cells) > 1 else "")
                    current = {"page": page_index, "item": item}
                    continue
                if current is None:
                    continue
                if label in ("A", "B", "C", "D"):
                    option_values[label] = value or (cells[1] if len(cells) > 1 else "")
                    continue
                if label in NTA_META_FIELDS:
                    continue
                if label == "Passage":
                    in_passage = True
                    merged = value or " ".join(cells[1:])
                    if merged and merged.lower() not in NTA_PLACEHOLDER_VALUES:
                        passage_parts.append(merged)
                    continue
                if label == "Question":
                    # ``Question: Question`` occasionally precedes the real body.
                    in_passage = False
                    merged = " ".join([value, *cells[1:]]) if value else " ".join(cells[1:])
                    merged = re.sub(r"(?i)^Question\s*:?\s*", "", merged).strip()
                    merged = re.sub(r"(?i)^Question Type\s*:\s*MCQ\s*", "", merged).strip()
                    if merged:
                        question_parts.append(merged)
                    continue
                text = " ".join(cell for cell in cells if cell).strip()
                if not text or text.lower() in NTA_PLACEHOLDER_VALUES:
                    continue
                if in_passage and not question_parts:
                    passage_parts.append(text)
                else:
                    question_parts.append(text)
    finish()

    questions: list[ParsedQuestion] = []
    for record in records:
        try:
            number = int(str(record.get("item", "")).strip())
        except ValueError:
            continue

        def dedupe(parts: list[str]) -> list[str]:
            seen: set[str] = set()
            lines: list[str] = []
            for part in parts:
                for line in part.splitlines():
                    line = clean_inline(line)
                    if not line or line.lower() in NTA_PLACEHOLDER_VALUES:
                        continue
                    key = line.casefold()
                    if key in seen:
                        continue
                    seen.add(key)
                    lines.append(line)
            return lines

        question_lines = dedupe(record["question_parts"])
        combined = "\n".join(question_lines)
        found = find_options(combined, "number")
        if found:
            options, opt_start, _ = found
            stem = strip_trailing_instructions(strip_leading_heading(clean_block(combined[:opt_start]), number))
        else:
            raw_options = [record["option_values"].get(label, "") for label in "ABCD"]
            # ``A: 1`` … ``D: 4`` is the response-code table, not choice text.
            if sum(1 for value in raw_options if value and value not in "1234") < 2:
                continue
            options = [
                (label, clean_inline(value)) for label, value in zip("ABCD", raw_options) if value
            ]
            stem = strip_trailing_instructions(strip_leading_heading(clean_block(combined), number))
        if not stem:
            continue
        passage = clean_block("\n".join(dedupe(record["passage_parts"]))) or None
        if passage and len(passage) < 40:
            passage = None
        questions.append(
            ParsedQuestion(
                number=number,
                stem=stem,
                options=options,
                page_start=record["page"],
                page_end=record["page"],
                passage=passage,
            )
        )
    return questions, {}


def _html_rows(content: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_match in re.finditer(r"<tr[^>]*>(.*?)</tr>", content, re.S):
        cells = [
            norm_ws(html.unescape(re.sub(r"<[^>]+>", " ", cell)))
            for cell in re.findall(r"<td[^>]*>(.*?)</td>", row_match.group(1), re.S)
        ]
        rows.append([cell for cell in cells if cell])
    return rows


def parse_keytable(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    questions: list[ParsedQuestion] = []
    keys: dict[int, tuple[str, str]] = {}
    for page in doc.pages:
        for block in (page.get("prunedResult") or {}).get("parsing_res_list") or []:
            if block.get("block_label") != "table":
                continue
            for cells in _html_rows(block.get("block_content") or ""):
                if len(cells) < 2:
                    continue
                question_cell, answer_cell = cells[0], cells[1]
                if question_cell.lower() in ("question", "questions"):
                    continue
                q_match = re.match(r"^\s*(\d{1,3})\.\s*(.+)$", question_cell, re.S)
                if not q_match:
                    continue
                number = int(q_match.group(1))
                body = q_match.group(2)
                found = find_options(body, "number")
                if not found:
                    continue
                options, opt_start, _ = found
                stem = strip_trailing_instructions(clean_block(body[:opt_start]))
                if not stem:
                    continue
                key_match = re.match(r"^\s*\(?([1-4])\)?", answer_cell)
                key = chr(64 + int(key_match.group(1))) if key_match else None
                q = ParsedQuestion(
                    number=number,
                    stem=stem,
                    options=options,
                    key=key,
                    page_start=doc.page_for(0),
                    page_end=doc.page_for(0),
                )
                if key:
                    answer_text = re.sub(r"^\s*\(?[1-4]\)?\s*", "", answer_cell).strip()
                    printed = dict(options).get(key, "")
                    if answer_text and norm_ws(answer_text).lower() not in norm_ws(printed).lower():
                        q.flags.append("answer-text-differs")
                    keys[number] = (key, "")
                questions.append(q)
    questions.sort(key=lambda q: q.number)
    return questions, keys


def parse_hindi2025(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    solution = re.search(r"(?im)^#{1,6}\s*Solutions?\s*$", text)
    body_end = solution.start() if solution else None
    questions, _ = parse_option_runs(doc, "line_number", body_end=body_end)
    questions.sort(key=lambda q: q.number)
    for question in questions:
        # "Question Number (8 to 11)" is a layout marker printed above the
        # shared passage; it is not part of the question text.
        question.stem = re.sub(
            r"(?im)^[ \t]*#{0,6}[ \t]*Question\s+Number\s*\([^)]*\)[ \t]*\n?",
            "",
            question.stem,
        ).strip()
        question.stem = re.sub(r"^\s*0[\.\)]\s*(?=\S)", "", question.stem)

    # Attach the printed passages to the questions they introduce. The OCR
    # places the passage and its instruction immediately before the first
    # question of the set, so "next four questions" (or until the next
    # passage) gives an exact mapping without guessing from keywords.
    body_text = text[:body_end] if body_end else text
    passage_re = re.compile(
        r"(?im)^[ \t]*#{0,6}[ \t]*निम्नलिखित[^\n]*(?:गद्यांश|पदार्श)[^\n]*$"
    )
    header_re = re.compile(
        r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?(?:Q\s*\.?\s*|0\s*\.\s*)(\d{1,3})\s*\."
    )
    header_positions = [
        (match.start(), int(match.group(1)))
        for match in header_re.finditer(body_text)
    ]
    by_number = {question.number: question for question in questions}
    passage_matches = list(passage_re.finditer(body_text))
    for index, match in enumerate(passage_matches):
        block_end = (
            passage_matches[index + 1].start()
            if index + 1 < len(passage_matches)
            else len(body_text)
        )
        candidates = [
            (position, number)
            for position, number in header_positions
            if match.end() <= position < block_end
        ][:4]
        if not candidates:
            continue
        passage_text = clean_block(text[match.start() : candidates[0][0]])
        passage_text = re.sub(
            r"(?im)^[ \t]*#{0,6}[ \t]*Question\s+Number\s*\([^)]*\)[ \t]*\n?",
            "",
            passage_text,
        ).strip()
        if len(passage_text) < 80:
            continue
        passage_id = "p" + hashlib.sha1(
            norm_ws(passage_text).encode("utf-8")
        ).hexdigest()[:12]
        for _, number in candidates:
            question = by_number.get(number)
            if question is None:
                continue
            question.passage = passage_text
            question.passage_id = passage_id

    keys: dict[int, tuple[str, str]] = {}
    if solution:
        solution_text = text[solution.end() :]
        answer_re = re.compile(r"(?im)^[ \t]*#{0,6}[ \t]*Answer\s*[:：]\s*[✓√]?\s*\(?([1-4])\)?\s*(.*)$")
        heading_re = re.compile(r"(?im)^[ \t]*#{0,6}[ \t]*Q\.?\s*(\d{1,3})\.?\s*$")
        entries: list[tuple[int | None, str, str, int, int]] = []
        last_heading: int | None = None
        last_heading_pos = -10000
        for line_match in re.finditer(r"(?m)^.*$", solution_text):
            line = line_match.group(0)
            heading = heading_re.match(line)
            if heading:
                last_heading = int(heading.group(1))
                last_heading_pos = line_match.start()
        # Re-scan with heading state so each answer knows its nearest heading.
        last_heading = None
        last_heading_pos = -10000
        for line_match in re.finditer(r"(?m)^.*$", solution_text):
            line = line_match.group(0)
            heading = heading_re.match(line)
            if heading:
                last_heading = int(heading.group(1))
                last_heading_pos = line_match.start()
                continue
            answer = answer_re.match(line)
            if answer:
                hint = last_heading if line_match.start() - last_heading_pos < 400 else None
                entries.append(
                    (
                        hint,
                        chr(64 + int(answer.group(1))),
                        clean_inline(answer.group(2)),
                        line_match.start(),
                        line_match.end(),
                    )
                )

        used: set[int] = set()
        cursor = 0
        ordered = sorted(questions, key=lambda q: q.number)
        for hint, key, answer_text, _, _ in entries:
            target: ParsedQuestion | None = None
            if hint is not None:
                target = next((q for q in ordered if q.number == hint and q.number not in used), None)
            if target is None and answer_text:
                needle = norm_ws(answer_text).casefold()
                for q in ordered:
                    if q.number in used or q.number < cursor:
                        continue
                    for label, option_text in q.options:
                        if label == key and needle and (
                            needle in norm_ws(option_text).casefold()
                            or norm_ws(option_text).casefold() in needle
                        ):
                            target = q
                            break
                    if target is not None:
                        break
            if target is None:
                target = next((q for q in ordered if q.number >= cursor and q.number not in used), None)
            if target is None:
                continue
            target.key = key
            used.add(target.number)
            cursor = target.number
            keys[target.number] = (key, "")
    return questions, keys


def parse_history2024(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    key_heading = re.search(r"(?i)Answer Key Set C", text)
    body_end = key_heading.start() if key_heading else None
    questions, _ = parse_option_runs(doc, "paren_number", body_end=body_end)

    keys: dict[int, tuple[str, str]] = {}
    if key_heading:
        key_text_start = key_heading.end()
        for page in doc.pages:
            for block in (page.get("prunedResult") or {}).get("parsing_res_list") or []:
                if block.get("block_label") != "table":
                    continue
                content = block.get("block_content") or ""
                if "Answer Key" not in content and not re.search(r">\s*1\s*</td>", content):
                    continue
                rows = _html_rows(content)
                if not rows or "Question" not in rows[0][0]:
                    continue
                for cells in rows[1:]:
                    if len(cells) < 2:
                        continue
                    qn = re.match(r"^\s*(\d{1,3})", cells[0])
                    key = re.match(r"^\s*\(?([1-4])\)?", cells[1])
                    if qn and key:
                        keys[int(qn.group(1))] = (chr(64 + int(key.group(1))), "")
    for q in questions:
        if q.number in keys:
            q.key = keys[q.number][0]
    return questions, keys


def parse_response(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    # Candidate answers are not authoritative keys. The sheet carries several
    # subject sections; keep HISTORY only.
    id_matches = list(re.finditer(r"(?im)^#{0,6}\s*(?:Question|Ouestion)\s+ID\s*:?\s*(\d+)", text))
    blocks: list[tuple[int, int]] = []
    if id_matches:
        if id_matches[0].start() > 0:
            blocks.append((0, id_matches[0].start()))
        for i, match in enumerate(id_matches):
            end = id_matches[i + 1].start() if i + 1 < len(id_matches) else len(text)
            blocks.append((match.start(), end))
    else:
        blocks.append((0, len(text)))

    questions: list[ParsedQuestion] = []
    section = "HISTORY"
    number = 0
    for start, end in blocks:
        block = text[start:end]
        section_match = re.search(r"(?im)^\s*Section Name\s*:\s*([A-Z ]+)", block)
        if section_match:
            section = norm_ws(section_match.group(1)).upper()
        if not section.startswith("HISTORY"):
            continue
        question_label = re.search(r"(?im)^#{0,6}\s*(?:Question|Ouestion)\s*:?\s*$", block)
        if question_label:
            body = block[question_label.end() :]
        else:
            body = re.sub(r"(?is)^.*?Question\s*:\s*", "", block, count=1)
        answer = re.search(r"(?im)^\s*Answer\s+Given\s+By\s+Candidate\s*:", body)
        if answer:
            body = body[: answer.start()]
        # Options are printed as "A text" (no dot) after the statements.
        opt_re = re.compile(r"(?m)^[ \t]*([A-D])[ \t]+(?!\.)(\S.*)$")
        matches = list(opt_re.finditer(body))
        run = _sequence(matches, "ABCD")
        if not run:
            opt_re = re.compile(r"(?m)^[ \t]*([A-D])[\.\)][ \t]+(\S.*)$")
            matches = list(opt_re.finditer(body))
            run = _sequence(matches, "ABCD")
        if not run:
            continue
        start_i, picked = run
        first = matches[picked[0]]
        options = []
        for pos, idx in enumerate(picked):
            m = matches[idx]
            opt_end = matches[picked[pos + 1]].start() if pos + 1 < len(picked) else len(body)
            options.append(
                (
                    chr(65 + pos),
                    clean_option_text(body[m.start(2) : opt_end], inline=True),
                )
            )
        stem = clean_block(body[: first.start()])
        stem = re.sub(r"(?is)^.*?Question\s*:\s*", "", stem, count=1).strip()
        if not stem:
            continue
        number += 1
        questions.append(
            ParsedQuestion(
                number=number,
                stem=stem,
                options=options,
                page_start=doc.page_for(start),
                page_end=doc.page_for(max(start, end - 1)),
                images=[t for t in doc.tokens_between(start, start + first.start()) if t.kind == "image"],
                tables=[t for t in doc.tokens_between(start, start + first.start()) if t.kind == "table"],
                span_start=start,
                span_end=start + first.start(),
            )
        )
    return questions, {}


def parse_cucet(doc: Doc) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    text = doc.text
    pattern = re.compile(r"(?m)^\s*Question Number\s*:\s*(\d{1,3})\b")
    spans = split_questions(text, pattern)
    questions: list[ParsedQuestion] = []
    for number, start, end in spans:
        block = text[start:end]
        block = re.sub(r"(?is)^.*?Correct Marks\s*:\s*\d+\s*Wrong Marks\s*:\s*\d+", "", block)
        found = find_options(block, "number")
        if found:
            options, opt_start, _ = found
        else:
            # Some CUCET rows lost the 2./3. labels; the four display-math
            # options are still printed in order.
            math_segments = list(
                re.finditer(r"\$\$.*?\$\$|\$[^$\n]+\$", block[: block.find("Options :") if "Options :" in block else len(block)], re.S)
            )
            if len(math_segments) < 4:
                continue
            chosen = math_segments[-4:]
            options = [
                (chr(65 + i), clean_inline(match.group(0))) for i, match in enumerate(chosen)
            ]
            opt_start = chosen[0].start()
        stem = strip_trailing_instructions(strip_leading_heading(clean_block(block[:opt_start]), number))
        stem = re.sub(r"(?is)^.*?Question Type\s*:\s*MCQ.*?(?:Question Mandatory\s*:\s*\w+\s*)?", "", stem).strip()
        if not stem:
            continue
        questions.append(
            ParsedQuestion(
                number=number,
                stem=stem,
                options=options,
                page_start=doc.page_for(start),
                page_end=doc.page_for(max(start, end - 1)),
                images=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "image"],
                tables=[t for t in doc.tokens_between(start, start + opt_start) if t.kind == "table"],
                option_tokens=doc.tokens_between(start + opt_start, end),
                span_start=start,
                span_end=end,
            )
        )
    return questions, {}


PROFILE_BY_STEM: dict[str, str] = {}


def detect_profile(doc: Doc) -> str:
    text = doc.text
    if doc.stem.startswith("CUCET_2021"):
        return "cucet"
    if "Candidate Response Sheet" in doc.md_text or "Answer Given By Candidate" in text:
        return "response"
    if doc.stem.startswith("General Test_2024-05-15_Shift_2"):
        return "keytable"
    if doc.stem.startswith("Hindi_2025"):
        return "hindi2025"
    if re.search(r"(?i)Answer Key Set C", text) and doc.stem.startswith("History_2024"):
        return "history2024"
    has_item_table = any(
        "Item No" in (block.get("block_content") or "")
        for page in doc.pages
        for block in (page.get("prunedResult") or {}).get("parsing_res_list") or []
        if block.get("block_label") == "table"
    )
    if has_item_table or "Item No:</td>" in doc.md_text:
        return "nta"
    if re.search(r"(?im)^#{1,6}\s*(?:Hints\s*&\s*Explanations|Answer Key)\s*$", text) and re.search(r"(?m)^\s*\d{1,3}\.\s*\([a-d]\)", text):
        return "solved2022"
    if re.search(r"(?i)\bS\s*\d{1,3}\s*\.\s*Ans", text):
        return "q2023"
    if doc.stem.startswith("Computer Science_2025"):
        return "cs2025"
    if re.search(r"(?im)^#{0,6}\s*Question\s*\d", text):
        return "inline"
    if re.search(r"(?im)^#{1,6}\s*Solutions?\s*$", text) and re.search(r"(?im)^\s*Q\.?\s*\d{1,3}\.", text):
        return "aggregate"
    if re.search(r"(?m)^\s*Q\.?\s*\d{1,3}\.", text):
        return "aggregate"
    if re.search(r"(?m)^\s*\d{1,3}\.\s", text):
        return "plain"
    return "unknown"


PARSERS = {
    "solved2022": parse_solved2022,
    "q2023": parse_q2023,
    "aggregate": parse_aggregate,
    "inline": parse_inline,
    "plain": parse_plain,
    "cs2025": parse_cs2025,
    "nta": parse_nta_tables,
    "cucet": parse_cucet,
    "keytable": parse_keytable,
    "history2024": parse_history2024,
    "hindi2025": parse_hindi2025,
    "response": parse_response,
}


def parse_doc(doc: Doc, profile: str) -> tuple[list[ParsedQuestion], dict[int, tuple[str, str]]]:
    parser = PARSERS.get(profile)
    if not parser:
        return [], {}
    return parser(doc)


DIRECTION_RANGE_RE = re.compile(
    r"(?is)\bDirections?\s*(?:\(|:)?\s*Q(?:uestion)?\.?\s*"
    r"(\d{1,3})\s*(?:-|–|—|to)\s*Q(?:uestion)?\.?\s*(\d{1,3})"
)


def attach_direction_images(doc: Doc, questions: list[ParsedQuestion]) -> None:
    """Attach a picture printed after a shared ``Direction (Qx-Qy)`` line.

    Two-column papers often place the direction and figure just before the
    first question of a set, which means the image token falls outside every
    question span. The same figure is needed by each question in the printed
    range, so it is attached to all of them rather than guessed per question.
    """
    if not questions:
        return
    by_number = {question.number: question for question in questions}
    for index, question in enumerate(questions):
        window_start = questions[index - 1].span_start if index > 0 else 0
        window = doc.text[window_start : question.span_start]
        for match in DIRECTION_RANGE_RE.finditer(window):
            first, last = int(match.group(1)), int(match.group(2))
            if last < first or not (first <= question.number <= last):
                continue
            tokens: list[Token] = []
            for token_match in TOKEN_RE.finditer(window):
                if token_match.start() < match.end():
                    continue
                token_index = int(token_match.group(2))
                if token_index >= len(doc.tokens):
                    continue
                token = doc.tokens[token_index]
                if token.kind in ("image", "table"):
                    tokens.append(token)
            if not tokens:
                continue
            for number in range(first, last + 1):
                target = by_number.get(number)
                if target is None:
                    continue
                bucket = target.tables if tokens[0].kind == "table" else target.images
                existing = {token.index for token in bucket}
                for token in tokens:
                    if token.index not in existing:
                        bucket.append(token)
                        existing.add(token.index)
                if "shared-direction-image" not in target.flags:
                    target.flags.append("shared-direction-image")


COLUMN_KEY_NUMBERS_RE = re.compile(r"(?:\d{1,3}\s*[\.\)]?\s*){2,4}")
COLUMN_KEY_ANSWERS_RE = re.compile(r"(?i)Ans\.?\s*[\(\[]?\s*([A-D])\s*[\)\]]?")


def parse_column_answer_key(doc: Doc) -> dict[int, str]:
    """Recover a column-major answer key printed as number/answer rows.

    A few exports print four columns at once::

        1. 14. 27. 40.
        Ans. (B) Ans. (D) Ans. (A) Ans. (C)

    The numbers on one line pair with the answers on the following line, so
    the mapping is still explicit and no key is inferred from position alone.
    """
    heading = re.search(r"(?im)^#{0,6}\s*Answer Key\s*$", doc.text)
    if not heading:
        return {}
    lines = [norm_ws(line) for line in doc.text[heading.end() :].splitlines() if norm_ws(line)]
    keys: dict[int, str] = {}
    index = 0
    while index < len(lines):
        line = lines[index]
        if not COLUMN_KEY_NUMBERS_RE.fullmatch(line):
            index += 1
            continue
        numbers = [int(value) for value in re.findall(r"\d{1,3}", line)]
        letters: list[str] = []
        cursor = index + 1
        while cursor < len(lines) and len(letters) < len(numbers):
            found = COLUMN_KEY_ANSWERS_RE.findall(lines[cursor])
            if not found:
                break
            letters.extend(found)
            cursor += 1
        if len(letters) < len(numbers):
            index += 1
            continue
        for number, letter in zip(numbers, letters):
            if 1 <= number <= 200:
                keys[number] = letter.upper()
        index = cursor
    return keys


def apply_recovered_keys(doc: Doc, questions: list[ParsedQuestion]) -> None:
    recovered = parse_column_answer_key(doc)
    if not recovered:
        return
    for question in questions:
        if not question.key and question.number in recovered:
            question.key = recovered[question.number]
            if "column-key" not in question.flags:
                question.flags.append("column-key")


# ---------------------------------------------------------------------------
# Printed-page corrections
# ---------------------------------------------------------------------------
#
# A handful of exports cut a question at a PDF page boundary, merged a solution
# sentence into the last choice, or put the whole question body in a scan.  The
# rows below were read back from the exact printed page images (the page number
# is recorded in the comment) and are applied after parsing, so a rebuild keeps
# the corrections.  Nothing here is inferred from a solution: every string is
# printed text.  Solutions/keys are overridden only where the printed key was
# itself mis-read (e.g. an option D that sat on the next page).

CONTENT_FIXES: dict[tuple[str, int], dict[str, Any]] = {
    # -- Page-split choices / contaminated option text ----------------------
    ("Applied Mathematics_2025-06-02_Shift_1", 31): {
        # p32: choices 1-4; the fourth is (5e)^x / log(5e) + C.
        "options": [
            ("A", r"$$ \frac{5^{x}}{\log 5}e^{x}+C $$"),
            ("B", r"$$ 5^{x} e^{x} + C $$"),
            ("C", r"$$ (5e)^{x}\log(5e)+C $$"),
            ("D", r"$$ \frac{(5e)^{x}}{\log(5e)}+C $$"),
        ],
        "key": "D",
    },
    ("Applied Mathematics_2025-06-02_Shift_1", 41): {
        # p45: the parsed A-C were solution text; the printed choices are 1-4.
        "options": [("A", "1"), ("B", "2"), ("C", "3"), ("D", "4")],
        "key": "B",
    },
    ("Applied Mathematics_2025-06-02_Shift_1", 45): {
        # p49: option 3 was dropped between the two printed columns.
        "options": [
            ("A", r"(\mathbf{A})-(\mathrm{III}),(\mathbf{B})-(\mathrm{II}),(\mathbf{C})-(\mathrm{IV}),(\mathbf{D})-(\mathrm{I})"),
            ("B", r"(\mathbf{A})-(\mathrm{III}),(\mathbf{B})-(\mathrm{I}),(\mathbf{C})-(\mathrm{II}),(\mathbf{D})-(\mathrm{IV})"),
            ("C", r"(\mathbf{A})-(\mathrm{II}),(\mathbf{B})-(\mathrm{I}),(\mathbf{C})-(\mathrm{IV}),(\mathbf{D})-(\mathrm{III})"),
            ("D", r"(\mathbf{A})-(\mathrm{II}),(\mathbf{B})-(\mathrm{IV}),(\mathbf{C})-(\mathrm{I}),(\mathbf{D})-(\mathrm{III})"),
        ],
        "key": "B",
    },
    ("Biology_2025-05-20_Shift_2", 43): {
        # pp29-30: the stem had absorbed choice 4; choices 1-4 are on p29-30.
        "stem": "In the nomenclature of restriction enzymes —",
        "options": [
            ("A", "The first letter of the name from the species and the second two letters from the different species of the prokaryotic cell"),
            ("B", "The first two letter of the name from the genus and the third letter from the species of the prokaryotic cell"),
            ("C", "The first letter of the name from the species and the second two letters from the genus of the prokaryotic cell"),
            ("D", "The first letter of the name from the genus and the second two letters from the species of the prokaryotic cell"),
        ],
        "key": "D",
    },
    ("Chemistry_2025-05-23_Shift_2", 22): {
        # p15: option 3 was dropped; the parsed C was option 4.
        "options": [
            ("A", r"(\mathrm{A})-(\mathrm{II}),(\mathrm{B})-(\mathrm{III}),(\mathrm{C})-(\mathrm{I}),(\mathrm{D})-(\mathrm{IV})"),
            ("B", r"(\mathrm{A})-(\mathrm{II}),(\mathrm{B})-(\mathrm{I}),(\mathrm{C})-(\mathrm{IV}),(\mathrm{D})-(\mathrm{III})"),
            ("C", r"(\mathrm{A})-(\mathrm{III}),(\mathrm{B})-(\mathrm{I}),(\mathrm{C})-(\mathrm{IV}),(\mathrm{D})-(\mathrm{II})"),
            ("D", r"(\mathrm{A})-(\mathrm{III}),(\mathrm{B})-(\mathrm{IV}),(\mathrm{C})-(\mathrm{I}),(\mathrm{D})-(\mathrm{II})"),
        ],
        "key": "B",
    },
    ("Geography_2025-05-16_Shift_1", 33): {
        # p29: option 4 is Shifting Cultivation.
        "options": [
            ("A", "Commercial Livestock Rearing"),
            ("B", "Nomadic Herding"),
            ("C", "Ranching"),
            ("D", "Shifting Cultivation"),
        ],
        "key": "B",
    },
    ("History_2025-05-16_Shift_1", 22): {
        # p22: option D is Lord Canning.
        "options": [
            ("A", "Lord Dalhousie"),
            ("B", "Lord William Bentinck"),
            ("C", "Lord Hardinge"),
            ("D", "Lord Canning"),
        ],
        "key": "A",
    },
    ("Mathematics_2025-06-02_Shift_1", 44): {
        # p42: option 4 is (3, infinity).
        "options": [
            ("A", "(1,2)"),
            ("B", "(2,6)"),
            ("C", "(2,3)"),
            ("D", r"(3,\infty)"),
        ],
        "key": "C",
    },
    ("Biology_2024-05-15_Shift_1", 37): {
        # p41: option D is Mammals; the stem was printed twice.
        "stem": "Among the vertebrates, which of the following is the most species-rich group?",
        "options": [
            ("A", "Reptiles"),
            ("B", "Fishes"),
            ("C", "Insects"),
            ("D", "Mammals"),
        ],
        "key": "B",
    },
    ("Biology_2024-05-15_Shift_1", 46): {
        # p51: option D is Autopolyploid.
        "options": [
            ("A", "Polyploidy"),
            ("B", "Euploidy"),
            ("C", "Aneuploidy"),
            ("D", "Autopolyploid"),
        ],
        "key": "C",
    },
    ("Biology_2024-07-19", 11): {
        # p12: option D is 2'-OH group and the printed key is D.
        "options": [
            ("A", "3'-OH group"),
            ("B", "5'-OH group"),
            ("C", "4'-OH group"),
            ("D", "2'-OH group"),
        ],
        "key": "D",
    },
    ("Biology_2024-07-19", 27): {
        # p28: option D is on the next page; remove the trailing "Answer: A".
        "options": [
            ("A", "A - BamH I; B - Cla I; C - Pst I"),
            ("B", "A - Pst I; B - Cla I; C - Hind II"),
            ("C", "A - BamH I; B - Hind II; C - Cla I"),
            ("D", "A - Cla I; B - Pst I; C - BamH I"),
        ],
        "key": "A",
    },
    ("Biology_2024-07-19", 42): {
        # p44: option D is 12; the stem was printed twice.
        "stem": "How many chromosomes are present in human primary spermatocytes?",
        "options": [("A", "46"), ("B", "23"), ("C", "92"), ("D", "12")],
        "key": "A",
    },
    ("Biology_2024-07-19", 48): {
        # p50: option D is Ticks; the stem was printed twice.
        "stem": "Which of the following is not classified into the category of parasites?",
        "options": [
            ("A", "Mosquito"),
            ("B", "Cuckoo"),
            ("C", "Cuscuta"),
            ("D", "Ticks"),
        ],
        "key": "A",
    },
    ("Chemistry_2024-05-15_Shift_1", 37): {
        # p27: choices C and D were garbled; printed key is B.
        "stem": "What will be increasing order of basic strength of the following compounds?\n\n$$ \\mathrm{C}_{2}\\mathrm{H}_{5}\\mathrm{NH}_{2},(\\mathrm{C}_{2}\\mathrm{H}_{5})_{2}\\mathrm{NH},(\\mathrm{C}_{2}\\mathrm{H}_{5})_{3}\\mathrm{N},\\mathrm{C}_{6}\\mathrm{H}_{5}\\mathrm{NH}_{2} $$",
        "options": [
            ("A", r"$ C_{2}H_{5}NH_{2} < (C_{2}H_{5})_{2}NH < (C_{2}H_{5})_{3}N < C_{6}H_{5}NH_{2} $"),
            ("B", r"$ C_{6}H_{5}NH_{2} < (C_{2}H_{5})_{3}N < C_{2}H_{5}NH_{2} < (C_{2}H_{5})_{2}NH $"),
            ("C", r"$ (C_{2}H_{5})_{3}N < (C_{2}H_{5})_{2}NH < C_{6}H_{5}NH_{2} < C_{2}H_{5}NH_{2} $"),
            ("D", r"$ (C_{2}H_{5})_{2}NH < (C_{2}H_{5})_{3}N < C_{2}H_{5}NH_{2} < C_{6}H_{5}NH_{2} $"),
        ],
        "key": "B",
    },
    ("Chemistry_2024-05-29", 36): {
        # pp35-36: the inequality symbols were mis-read; option D is on p36.
        "options": [
            ("A", "(A) < (B) < (C) < (D)"),
            ("B", "(A) < (C) < (D) < (B)"),
            ("C", "(B) < (A) < (D) < (C)"),
            ("D", "(C) < (B) < (D) < (A)"),
        ],
        "key": "B",
    },
    ("General Test_2024-05-15_Shift_3", 17): {
        # p20: option D is Graphite.
        "options": [
            ("A", "Diamond"),
            ("B", "Gold"),
            ("C", "Silver"),
            ("D", "Graphite"),
        ],
        "key": "A",
    },
    ("General Test_2024-05-15_Shift_3", 24): {
        # p28: option D is Article 26.
        "options": [
            ("A", "Article 324"),
            ("B", "Article 280"),
            ("C", "Article 264"),
            ("D", "Article 26"),
        ],
        "key": "A",
    },
    ("Geography_2024-05-17_Shift_1", 3): {
        # p4: option D is Mhow.
        "options": [
            ("A", "Rohtak"),
            ("B", "Sindri"),
            ("C", "Dispur"),
            ("D", "Mhow"),
        ],
        "key": "A",
    },
    ("Geography_2024-05-17_Shift_1", 7): {
        # p9: option D is UNDP in 1990 and the printed key is D.
        "options": [
            ("A", "WHO in 1992"),
            ("B", "UNDP in 1992"),
            ("C", "WHO in 1991"),
            ("D", "UNDP in 1990"),
        ],
        "key": "D",
    },
    ("Hindi_2024-05-16_Shift_2", 46): {
        # pp67-68: stem and choices were split across the page break.
        "stem": "प्रत्यय के कितने भेद होते हैं ?",
        "options": [
            ("A", "तीन"),
            ("B", "एक"),
            ("C", "दो"),
            ("D", "चार"),
        ],
        "key": "C",
    },
    ("History_2024-05-18_Shift_1", 7): {
        # p10: option D is Rajendra II.
        "options": [
            ("A", "Krishnadeva Raya"),
            ("B", "Harihara and Bukka"),
            ("C", "Raja Raya"),
            ("D", "Rajendra II"),
        ],
        "key": "B",
    },
    ("History_2024-05-18_Shift_1", 48): {
        # p71: option D is Punna.
        "options": [
            ("A", "Sigala"),
            ("B", "Karuni Pajapati"),
            ("C", "Mahapajapati Gotami"),
            ("D", "Punna"),
        ],
        "key": "C",
    },
    ("Mathematics_2024-05-16_Shift_1", 44): {
        # pp57-58: the four choices are graphs, not constraint text.
        "options": [("A", ""), ("B", ""), ("C", ""), ("D", "")],
        "key": "C",
    },
    ("Physics_2024-05-16_Shift_3", 3): {
        # p3: option D had been appended to option C.
        "options": [
            ("A", r"$ \overrightarrow{F}_1 = 0, \overrightarrow{F}_2 = 0, \overrightarrow{F}_3 = 0 $"),
            ("B", r"$ \overrightarrow{F}_1 = 0, \overrightarrow{F}_2 \neq 0, \overrightarrow{F}_3 = 0 $"),
            ("C", r"$ \overrightarrow{F}_1 \neq 0, \overrightarrow{F}_2 \neq 0, \overrightarrow{F}_3 \neq 0 $"),
            ("D", r"$ \overrightarrow{F}_1 = 0, \overrightarrow{F}_2 = 0, \overrightarrow{F}_3 \neq 0 $"),
        ],
        "key": "B",
    },
    ("Physics_2024-05-16_Shift_3", 23): {
        # p20: option D had been appended to option C.
        "options": [
            ("A", "No photoelectrons will be emitted"),
            ("B", r"All photoelectrons emitted will have a kinetic energy equal to $ hv_{0} $"),
            ("C", r"Maximum kinetic energy of photoelectrons emitted can be $ hv_{0} $"),
            ("D", r"Maximum kinetic energy of photoelectrons emitted will be $ 2hv_{0} $"),
        ],
        "key": "C",
    },
    ("Physics_2024-07-19_Shift_1", 45): {
        # p36: option D is on the next page.
        "options": [
            ("A", r"All ejected electrons have the same KE equal to $ (hv - hv_{0}) $"),
            ("B", r"The ejected electrons have a distribution of KE, the most energetic ones having KE equal to $ (hv - hv_{0}) $"),
            ("C", r"The most energetic electrons have KE equal to $ hv $"),
            ("D", r"The KE of ejected electrons is $ hv_{0} $"),
        ],
        "key": "B",
    },
    ("Hindi_2022-08-30_Shift_2", 5): {
        # pp3-4: option D and several words were mis-read.
        "stem": "बढ़ती आबादी के कारण धरती के संचित संसाधनों का क्या किया जा रहा है ?",
        "options": [
            ("A", "शोधन"),
            ("B", "प्रबंधन"),
            ("C", "दोहन"),
            ("D", "संक्षण"),
        ],
        "key": "C",
    },
    # -- Scanned bodies with no recoverable text in the export --------------
    ("General Test_2025-05-20_Shift_1", 8): {
        # p9: the stem sits above the figure and was not in the text layer.
        "stem": "How many triangles are there in the following figure?",
    },
    ("General Test_2025-05-20_Shift_1", 33): {
        # p32: the instruction sits above the figure options.
        "stem": "Select the option in which the given figure is embedded.",
    },
    ("Geography_2025-05-16_Shift_1", 13): {
        # p11: table + printed instruction.
        "stem": "Choose the correct answer from the options given below:",
    },
    ("Chemistry_2023-06-07_Shift_3", 15): {
        # p2: table + printed instruction.
        "stem": "Choose the correct answer from the options given below:",
    },
    ("English_2022-08-16_Shift_1", 11): {
        # p2: table + printed instruction.
        "stem": "Choose the correct answer from the options given below:",
    },
    # -- CUCET 2021: leaked layout fields and swallowed rows ----------------
    ("CUCET_2021-09-23_Shift_1", 10): {
        # The parser kept the two layout fields above the printed stem.
        "stem": "The book has passed _ fifteen editions.",
    },
    ("CUCET_2021-09-23_Shift_1", 15): {
        "stem": "A bus covers the first 39 km of its journey in 45 minutes and the remaining 25 km in 35 minutes. What is the average speed of the car?",
    },
    ("CUCET_2021-09-23_Shift_1", 19): {
        "stem": "Dinesh is taller than Chinku and Elina. Akash is not as tall as Elina. Chinku is taller than Akash. Dinesh is not as tall as Bikash. Who among them is next to the tallest one?",
    },
    ("CUCET_2021-09-23_Shift_1", 32): {
        # The OCR mis-read unit vector i as t in the stem and every choice.
        "stem": "The velocity of a body of mass 2 kg as a function of time t is given by\n\n$ v(t) = 2t\\hat{i} + t^{2}\\hat{j} $. The force acting on it, at time t = 2 s is given by",
        "options": [
            ("A", r"$ (4\hat{i} + 4\hat{j})N $"),
            ("B", r"$ (2\hat{i} + 2\hat{j})N $"),
            ("C", r"$ (4\hat{i} + 2\hat{j})N $"),
            ("D", r"$ (4\hat{i} + 8\hat{j})N $"),
        ],
    },
    ("CUCET_2021-09-23_Shift_1", 35): {
        # The block continued into the next question; the four choices were
        # printed in the text but two option ids were lost.
        "stem": "A body moves from point A to B under the action of a force, varying in magnitude as shown in the figure. Force is expressed in newton and displacement in meter. What is the total work done?",
        "options": [
            ("A", "37.5 J"),
            ("B", "100 J"),
            ("C", "12.5 J"),
            ("D", "22.5 J"),
        ],
    },
    ("CUCET_2021-09-23_Shift_1", 47): {
        # Choices 1-4 were absorbed into the stem; the parsed choices belonged
        # to the following question.
        "stem": "A positive charge q is distributed over a circular ring of radius a. It is placed in a horizontal plane and is rotated about its axis at a uniform angular speed \\omega. A horizontal magnetic field B exists in the space. The torque acting on the ring due to the magnetic force is",
        "options": [
            ("A", r"$ \frac{1}{2}q\omega a^{2}B $"),
            ("B", r"$ \frac{1}{2}q\omega aB $"),
            ("C", r"$ \frac{1}{2}q\omega^{2}aB $"),
            ("D", r"$ q\omega a^{2}B $"),
        ],
    },
    ("CUCET_2021-09-23_Shift_1", 53): {
        # Four structure crops label choices I-IV; the parsed choices belonged
        # to the next question.
        "stem": "The most stable conformation of 1,2-dibromomethane among the following is",
        "options": [("A", "I"), ("B", "II"), ("C", "III"), ("D", "IV")],
    },
    ("CUCET_2021-09-23_Shift_1", 56): {
        "stem": "Which of the following does not give iodoform test?",
    },
    ("CUCET_2021-09-23_Shift_1", 61): {
        "stem": "In which of the following compounds, metal is in lowest oxidation state?",
    },
    ("CUCET_2021-09-23_Shift_1", 81): {
        # Choices 1-4 were absorbed into the stem; the parsed choices belonged
        # to the following probability question.
        "stem": "A card is drawn at random from a pack of 52 cards. What is the probability that the card drawn is either Ace or a King?",
        "options": [
            ("A", r"$ \frac{4}{13} $"),
            ("B", r"$ \frac{1}{13} $"),
            ("C", r"$ \frac{2}{13} $"),
            ("D", "None of the above"),
        ],
    },
    ("CUCET_2021-09-23_Shift_1", 85): {
        "stem": "The equation $ ax + by + c = 0 $ represents a straight line",
    },
    ("CUCET_2021-09-23_Shift_1", 110): {
        "stem": "Which one of the following is the correct match of the product and the producer?",
    },
    ("CUCET_2021-09-23_Shift_1", 112): {
        "stem": "What is correct for test tube baby?",
    },
    # -- History 2022-08-21 Shift 1: response-sheet field leakage -----------
    ("History_2022-08-21_Shift_1", 21): {
        "stem": "Arrange the following events in the correct order of their occurrence:",
    },
    ("History_2022-08-21_Shift_1", 28): {
        "stem": "Brahmi and Kharoshti, two scripts used in earliest inscriptions and coins, were deciphered by :",
    },
    ("History_2022-08-21_Shift_1", 8): {
        # The response-sheet header was spliced into the stem.
        "stem": "Why did people believe in the rumours during the Revolt of 1857? Arrange the following in sequence-",
        "options": [
            ("A", "A, B, C, D"),
            ("B", "D, C, A, B"),
            ("C", "B, A, C, D"),
            ("D", "B, C, D, A"),
        ],
    },
    ("History_2022-08-21_Shift_1", 10): {
        # Page-header timestamp was captured inside the year.
        "options": [
            ("A", "1659"),
            ("B", "1661"),
            ("C", "1663"),
            ("D", "1665"),
        ],
    },
    ("History_2022-08-21_Shift_1", 13): {
        # Page-header timestamp was appended after the instruction.
        "stem": "From the jumbled events, select the correct sequencing :\n\nA. Mahatma Gandhi attends the First Round Table Conference at London.\n\nB. The Dandi March marks the beginning of the Civil Disobedience Movement.\n\nC. The Quit India Movement takes place.\n\nD. At the Lahore session of the Indian National Congress \"Purna Swaraj\" was accepted as the goal.\n\nChoose the correct answer from the options given below:",
    },
    ("History_2022-08-21_Shift_1", 15): {
        # A response-sheet URL was captured after the instruction.
        "stem": "Which of the following combination of statements is correct :\n\nA. In 1937, first time Provincial Elections held.\n\nB. The Muslim League failed to win a single seat in the North West Frontier Province.\n\nC. The Muslim League did very good in reserved constituencies.\n\nD. All the adult population exercised voting right in 1937.\n\nChoose the correct answer from the options given below :",
    },
    ("History_2022-08-21_Shift_1", 16): {
        # OCR dropped the leading choice label from option B.
        "options": [
            ("A", "A, B, C, D"),
            ("B", "B, A, C, D"),
            ("C", "D, B, A, C"),
            ("D", "C, A, B, D"),
        ],
    },
    ("History_2022-08-21_Shift_1", 18): {
        # The statements were parsed as the choices, swallowing the four
        # sequencing options printed after the instruction.
        "stem": "Put the following statements in sequence :\n\nA. Dr. B. R. Ambedkar was appointed as the law minister with the recommendation of Gandhi.\n\nB. Vallabhbhai Patel worked mostly behind the scenes, drafting several reports\n\nC. Jawaharlal Nehru declared the \"Objectives Resolution\", defining ideas of the Constitution\n\nD. Steering constructive discussion in the Constituent Assembly was taken care of by Dr. Rajendra Prasad\n\nChoose the correct answer from the options given below :",
        "options": [
            ("A", "A, D, C, B"),
            ("B", "D, A, B, C"),
            ("C", "B, A, C, D"),
            ("D", "C, B, D, A"),
        ],
    },
    ("History_2022-08-21_Shift_1", 19): {
        "stem": "In the Vitthala temple, the principal deity was Vitthala, a form of Vishnu. It was worshipped in which region?",
    },
    ("History_2022-08-21_Shift_1", 21): {
        # The five events were parsed as the choices, swallowing the four
        # ordering options printed after the instruction.
        "stem": "Arrange the following events in the correct order of their occurrence:\n\nA. Thousands killed in Amritsar on Independence Day\n\nB. Tension grew due to the rule of music before the mosque.\n\nC. Pakistan Resolution passed by Muslim League.\n\nD. Riots in Calcutta by people armed with rods and lathis.\n\nE. Meeting between Mahatma Gandhi and Abdul Gaffar Khan in NWFP\n\nChoose the correct answer from the options given below :",
        "options": [
            ("A", "A, B, C, D, E"),
            ("B", "B, E, D, A, C"),
            ("C", "C, B, A, E, D"),
            ("D", "B, E, C, D, A"),
        ],
    },
    ("History_2022-08-21_Shift_1", 32): {
        # Malformed LaTeX blank and a timestamp captured in option A.
        "stem": "________, executed separately by artists, were inserted to accompany the description in words-",
        "options": [
            ("A", "Manuscripts"),
            ("B", "Scribes"),
            ("C", "Paintings"),
            ("D", "Writers"),
        ],
    },
    ("History_2022-08-21_Shift_1", 33): {
        "stem": "________ too were involved in the production of manuscripts.",
    },
    ("History_2022-08-21_Shift_1", 34): {
        "stem": "The painter introduced a new kind of painting for mounting on the pages of manuscripts ________.",
    },
    ("History_2022-08-21_Shift_1", 35): {
        "stem": "Painting possesses special powers of ________ ideas.",
    },
    ("History_2022-08-21_Shift_1", 36): {
        "stem": "In Brahmanical theory Jati was based on ________ like Varna.",
    },
    ("History_2022-08-21_Shift_1", 37): {
        "stem": "The number of Varnas was fixed at four, for number of Jatis there was no ________.",
    },
    ("History_2022-08-21_Shift_1", 38): {
        "stem": "Certain communities were assigned a name of occupational category such as ________.",
    },
    ("History_2022-08-21_Shift_1", 39): {
        "stem": "Jatis which shared a common occupation or profession organised into ________.",
    },
    ("History_2022-08-21_Shift_1", 40): {
        "stem": "People living in forests were named in Brahmanical texts, Ekalavya belonged to ________.",
    },
    # -- English 2024-05-15 Shift 2: merged rows and recovered choices ------
    ("English_2024-05-15_Shift_2", 1): {
        # p2: the row absorbed question 2's text; choices (2) and (4) were
        # recovered from the same printed page image.
        "stem": "Re-arrange the following phrases in the right sequence to form a meaningful sentence.\n\n(A) for seven hours but was hardly\n\n(B) because of the absence of any motivation\n\n(C) able to decide who the murderer was\n\n(D) she worked on the case\n\nChoose the correct answer from the options given below:",
        "options": [
            ("A", "(A), (C), (D), (B)."),
            ("B", "(D), (A), (C), (B)."),
            ("C", "(D), (C), (B), (A)."),
            ("D", "(A), (B), (C), (D)."),
        ],
    },
    ("English_2024-05-15_Shift_2", 15): {
        # p5: the four printed combinations, without the OCR math wrappers.
        "stem": "Match the blanks in List-I with the Prepositions in List-II:\n\nChoose the correct answer from the options given below:",
        "options": [
            ("A", "(A) - (IV), (B) - (I), (C) - (II), (D) - (III)"),
            ("B", "(A) - (I), (B) - (III), (C) - (II), (D) - (IV)"),
            ("C", "(A) - (IV), (B) - (II), (C) - (I), (D) - (III)"),
            ("D", "(A) - (III), (B) - (IV), (C) - (I), (D) - (II)"),
        ],
    },
    ("English_2024-05-15_Shift_2", 41): {
        # The stem was cut at a page boundary.
        "stem": "Rearrange the following phrases in correct sequence to form a meaningful sentence:",
    },
    ("English_2024-05-15_Shift_2", 50): {
        # The instruction and the four parts were run together by the export.
        "stem": "Rearrange the following parts in the correct sequence to form a meaningful sentence:",
    },
}

VERIFIED_KEYS_FILE = Path(__file__).resolve().parent / "verified_keys.json"


def load_verified_keys() -> dict[str, dict[str, str]]:
    """Read the committed transcription of official answer keys.

    The file keeps the provenance for every key table and is deliberately
    separate from the OCR cache so a rebuild never depends on downloaded PDFs.
    """
    if not VERIFIED_KEYS_FILE.exists():
        return {}
    payload = json.loads(VERIFIED_KEYS_FILE.read_text(encoding="utf-8"))
    papers = payload.get("papers") or {}
    result: dict[str, dict[str, str]] = {}
    for slug, entry in papers.items():
        keys = entry.get("keys") or {}
        result[slug] = {
            str(number): str(letter).strip().upper()
            for number, letter in keys.items()
        }
    return result


VERIFIED_KEYS = load_verified_keys()


def apply_verified_keys(slug: str, questions: list[ParsedQuestion]) -> None:
    """Overlay keys transcribed from an official answer-key publication."""
    keys = VERIFIED_KEYS.get(slug)
    if not keys:
        return
    for question in questions:
        key = keys.get(str(question.number))
        if not key:
            continue
        question.key = key
        if "verified-key" not in question.flags:
            question.flags.append("verified-key")


_STALE_FLAGS = {"partial-options", "partial-image-options", "key-not-among-options"}


def apply_content_fixes(stem: str, questions: list[ParsedQuestion]) -> None:
    if not CONTENT_FIXES:
        return
    for question in questions:
        fix = CONTENT_FIXES.get((stem, question.number))
        if not fix:
            continue
        if "stem" in fix:
            question.stem = fix["stem"]
        if "options" in fix:
            question.options = list(fix["options"])
        if "key" in fix:
            question.key = fix["key"]
        if "explanation" in fix:
            question.explanation = fix["explanation"]
        question.flags = [flag for flag in question.flags if flag not in _STALE_FLAGS]


# ---------------------------------------------------------------------------
# Paper metadata
# ---------------------------------------------------------------------------

DATED_STEM_RE = re.compile(
    r"^(?P<subject>.+?)_(?P<date>\d{4}-\d{2}-\d{2})(?:_Shift_(?P<shift>\d+))?$"
)
YEAR_STEM_RE = re.compile(
    r"^(?P<subject>.+?)_(?P<year>20\d{2})(?:_Shift_(?P<shift>\d+))?$"
)


def canonical_stems() -> list[str]:
    return sorted(
        p.stem.replace(".pdf_by_PaddleOCR-VL-1.6", "")
        for p in OCR_DIR.glob("*.json")
        if "(1)" not in p.stem
        and p.stem.replace(".pdf_by_PaddleOCR-VL-1.6", "") not in CANONICAL_EXCLUSIONS
    )


def paper_metadata(stem: str) -> dict[str, Any]:
    match = DATED_STEM_RE.match(stem)
    date: str | None = None
    shift: str | None = None
    if match:
        subject = match.group("subject")
        date = match.group("date")
        year = int(date[:4])
        shift = match.group("shift")
    else:
        match = YEAR_STEM_RE.match(stem)
        if not match:
            raise ValueError(f"Cannot parse paper metadata from {stem!r}")
        subject = match.group("subject")
        year = int(match.group("year"))
        shift = match.group("shift")

    is_cucet = subject.upper() == "CUCET"
    if is_cucet:
        subject = "General Test"
    if subject not in SUBJECT_INFO:
        raise ValueError(f"Unknown subject {subject!r} in {stem!r}")
    info = SUBJECT_INFO[subject]
    date_label = ""
    if date:
        month = int(date[5:7])
        day = int(date[8:10])
        date_label = f"{day} {MONTH_NAMES[month - 1]} {year}"

    exam_label = "CUCET" if is_cucet else "CUET UG"
    if is_cucet:
        title = f"CUCET {year} General Test Previous Year Paper"
        slug = f"cucet-{year}-general-test"
    elif date_label:
        suffix = f" Shift {shift}" if shift else ""
        title = f"{exam_label} {subject} {date_label}{suffix} Previous Year Paper"
        slug = f"{info['slug']}-{date}" + (f"-shift-{shift}" if shift else "")
    else:
        suffix = f" Shift {shift}" if shift else ""
        title = f"{exam_label} {subject} {year}{suffix} Previous Year Paper"
        slug = f"{info['slug']}-{year}" + (f"-shift-{shift}" if shift else "")

    return {
        "stem": stem,
        "subject": subject,
        "subject_info": {
            "id": f"local-{info['slug']}",
            "name": info["name"],
            "slug": info["slug"],
            "code": info["code"],
        },
        "year": year,
        "date": date,
        "date_label": date_label or f"{year} paper",
        "shift": f"Shift {shift}" if shift else None,
        "title": title,
        "slug": slug,
        "is_cucet": is_cucet,
        "duration": 60 if subject == "General Test" else 45,
    }


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------


def _dedupe_tokens(tokens: list[Token]) -> list[Token]:
    seen: set[int] = set()
    out: list[Token] = []
    for token in tokens:
        if token.index in seen:
            continue
        seen.add(token.index)
        out.append(token)
    return out


def _open_rgb(path: Path) -> Image.Image | None:
    try:
        with Image.open(path) as handle:
            return handle.convert("RGB").copy()
    except Exception:  # noqa: BLE001 - a broken crop must not stop the build
        return None


def _image_box_from_name(name: str) -> list[int] | None:
    match = re.search(r"_box_(\d+)_(\d+)_(\d+)_(\d+)", name or "")
    if not match:
        return None
    x1, y1, x2, y2 = (int(value) for value in match.groups())
    if x2 <= x1 or y2 <= y1:
        return None
    return [x1, y1, x2, y2]


def token_bitmap(token: Token) -> Image.Image | None:
    """Return a usable bitmap for an image or table token."""
    if token.kind == "image":
        if token.src and token.src.exists():
            bitmap = _open_rgb(token.src)
            if bitmap is not None:
                return bitmap
        box = token.bbox or _image_box_from_name(token.rel)
        if box and token.page_image and token.page_image.exists():
            page = _open_rgb(token.page_image)
            if page is not None:
                try:
                    return page.crop(tuple(box))
                finally:
                    page.close()
        return None

    if token.kind == "table":
        if not token.page_image or not token.page_image.exists() or not token.bbox:
            return None
        page = _open_rgb(token.page_image)
        if page is None:
            return None
        try:
            return page.crop(tuple(int(value) for value in token.bbox))
        finally:
            page.close()
    return None


def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "Arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # older Pillow
        return ImageFont.load_default()


def _fit_panel(image: Image.Image) -> Image.Image:
    width, height = image.size
    if width <= 0 or height <= 0:
        return image
    scale = 1.0
    if width < 200 or height < 110:
        scale = max(200 / width, 110 / height)
    largest = max(width, height) * scale
    if largest > 620:
        scale *= 620 / largest
    scale = max(0.2, min(scale, 3.0))
    if abs(scale - 1.0) < 0.02:
        return image
    return image.resize(
        (max(1, int(width * scale)), max(1, int(height * scale))),
        Image.Resampling.LANCZOS,
    )


def compose_option_panels(
    panels: list[tuple[str, Image.Image]],
    dest: Path,
) -> bool:
    """Compose labelled answer-choice crops into one reviewable image."""
    if not panels:
        return False
    fitted = [(label, _fit_panel(image)) for label, image in panels]
    label_height = 36
    padding = 16
    gap = 14
    columns = 2 if len(fitted) > 1 else 1
    rows = (len(fitted) + columns - 1) // columns
    panel_width = max(image.width for _, image in fitted)
    panel_height = max(image.height for _, image in fitted)
    width = padding * 2 + columns * panel_width + (columns - 1) * gap
    height = padding * 2 + rows * (panel_height + label_height) + (rows - 1) * gap
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    font = _load_font(26)
    for index, (label, image) in enumerate(fitted):
        column = index % columns
        row = index // columns
        x = padding + column * (panel_width + gap)
        y = padding + row * (panel_height + label_height + gap)
        draw.rectangle(
            [x, y, x + panel_width - 1, y + panel_height + label_height - 1],
            outline=(203, 213, 225),
            width=2,
        )
        draw.text((x + 10, y + 4), label, fill=(15, 23, 42), font=font)
        paste_x = x + (panel_width - image.width) // 2
        paste_y = y + label_height + (panel_height - image.height) // 2
        canvas.paste(image, (paste_x, paste_y))
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, "JPEG", quality=92, optimize=True)
    return True


def _save_token(token: Token, dest: Path) -> bool:
    bitmap = token_bitmap(token)
    if bitmap is None:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    bitmap.save(dest, "JPEG", quality=93, optimize=True)
    return True


def _stem_token_indices(question: ParsedQuestion) -> set[int]:
    return {token.index for token in [*question.images, *question.tables]}


def _select_option_tokens(
    question: ParsedQuestion,
    doc: Doc,
) -> tuple[list[Token], list[str]]:
    """Choose the printed image/table choices and their labels.

    OCR often emits a choice image before its printed label, and a few exports
    duplicate the whole choice block. Token order is the only stable signal, so
    panels are assigned in printed order and never inferred from HTML wrappers.
    """
    readable = sum(1 for _, text in question.options if text.strip())
    if readable > 1:
        return [], []

    labels = [label for label, text in question.options if not text.strip()]
    candidates = _dedupe_tokens(
        [token for token in question.option_tokens if token.kind in ("image", "table")]
    )
    if len(candidates) == 4 and len(labels) == 4:
        # Two-column papers can print an incomplete label run beside the
        # question sequence and then a second complete run for the next
        # question. When the stem already holds several figures and its own
        # labels, the later run is not safe to use as this question's choices.
        if len(question.images) >= 5 and re.search(r"\([a-d]\)", question.stem, re.I):
            return [], []
        return candidates, labels
    if len(candidates) == 3 and len(labels) == 3:
        # Three printed image choices with three unreadable labels, e.g. one
        # text choice plus three diagrams in a four-choice question.
        return candidates, labels

    all_tokens = _dedupe_tokens(
        [
            token
            for token in doc.tokens_between(question.span_start, question.span_end)
            if token.kind in ("image", "table")
        ]
    )
    stem_indices = _stem_token_indices(question)
    remaining = [token for token in all_tokens if token.index not in stem_indices]
    if len(remaining) == 4 and len(labels) == 4:
        return remaining, labels
    if len(remaining) == 3 and len(labels) == 3:
        return remaining, labels
    return [], []


def build_question_assets(
    question: ParsedQuestion,
    doc: Doc,
    slug: str,
    destination: Path,
) -> tuple[list[dict[str, Any]], bool, bool, int, list[str]]:
    """Write exact crops for a question.

    Returns ``(assets, bodyIsImage, optionsAreImages, optionImageCount, flags)``.
    """
    assets: list[dict[str, Any]] = []
    flags: list[str] = []
    number = question.number
    stem = question.stem.strip()

    option_tokens, option_labels = _select_option_tokens(question, doc)
    option_indices = {token.index for token in option_tokens}
    stem_tokens = _dedupe_tokens(
        [
            token
            for token in [*question.images, *question.tables]
            if token.index not in option_indices
        ]
    )

    body_token: Token | None = None
    if not stem and stem_tokens:
        body_token = stem_tokens[0]

    used = 0
    for token in stem_tokens:
        used += 1
        is_body = token is body_token
        kind = "question" if is_body else ("table" if token.kind == "table" else "figure")
        filename = f"q{number:02d}-{kind}-{used}.jpg"
        path = destination / filename
        if not _save_token(token, path):
            flags.append(f"missing-{kind}-crop")
            used -= 1
            continue
        assets.append(
            {
                "id": f"q{number:02d}-{kind}-{used}",
                "kind": kind,
                "path": f"/local-papers/assets/{slug}/{filename}",
                "page": token.page,
                "alt": (
                    f"Question {number} from the printed paper"
                    if is_body
                    else (
                        f"Table for question {number}"
                        if kind == "table"
                        else f"Figure for question {number}"
                    )
                ),
            }
        )

    options_are_images = False
    option_image_count = 0
    if option_tokens:
        panels: list[tuple[str, Image.Image]] = []
        for label, token in zip(option_labels, option_tokens):
            bitmap = token_bitmap(token)
            if bitmap is None:
                flags.append("missing-option-image")
                continue
            panels.append((label, bitmap))
        if len(panels) >= 2:
            filename = f"q{number:02d}-options.jpg"
            path = destination / filename
            if compose_option_panels(panels, path):
                options_are_images = True
                option_image_count = len(panels)
                assets.append(
                    {
                        "id": f"q{number:02d}-options",
                        "kind": "options",
                        "path": f"/local-papers/assets/{slug}/{filename}",
                        "page": option_tokens[0].page,
                        "alt": f"Printed answer choices for question {number}",
                    }
                )
                flags.append("image-options")
            else:
                flags.append("option-composite-failed")

    body_is_image = bool(body_token and any(asset["kind"] == "question" for asset in assets))
    if body_is_image:
        flags.append("scanned-body")
    if 0 < len(question.options) < 4:
        flags.append("partial-options")
    if len(option_tokens) == 3 and len(option_labels) == 3:
        flags.append("partial-image-options")
    return assets, body_is_image, options_are_images, option_image_count, flags


def _normalise_options(question: ParsedQuestion) -> list[tuple[str, str]]:
    options: list[tuple[str, str]] = []
    seen: set[str] = set()
    for index, (raw_label, raw_text) in enumerate(question.options):
        label = norm_ws(str(raw_label or "")).upper()
        if label.isdigit() and 1 <= int(label) <= 6:
            label = chr(64 + int(label))
        if not match_letter(label):
            label = chr(65 + index) if index < 26 else ""
        if not label or label in seen:
            continue
        seen.add(label)
        text = clean_option_text(raw_text, inline=True)
        text = re.sub(rf"^{re.escape(label)}[\.\)]\s*", "", text, flags=re.I)
        options.append((label, text))
    if not options and question.option_tokens:
        options = [
            (chr(65 + index), "")
            for index in range(min(6, len(question.option_tokens)))
        ]
    return options


def match_letter(label: str) -> bool:
    return bool(re.fullmatch(r"[A-F]", label or ""))


def _normalise_key(question: ParsedQuestion, labels: set[str]) -> tuple[str | None, list[str]]:
    flags: list[str] = []
    key = norm_ws(question.key or "").upper()
    if not key:
        return None, flags
    if key.isdigit() and 1 <= int(key) <= 6:
        key = chr(64 + int(key))
    if key not in labels:
        flags.append("key-not-among-options")
        return None, flags
    return key, flags


def _dedupe_parsed(questions: list[ParsedQuestion]) -> list[ParsedQuestion]:
    best: dict[int, tuple[tuple[int, int, int, int, int], ParsedQuestion]] = {}
    for question in questions:
        readable = sum(1 for _, text in question.options if text.strip())
        score = (
            1 if question.key else 0,
            readable,
            1 if question.stem.strip() else 0,
            len(question.options),
            len(question.images) + len(question.tables) + len(question.option_tokens),
        )
        current = best.get(question.number)
        if current is None or score > current[0]:
            best[question.number] = (score, question)
    return [item[1] for item in sorted(best.values(), key=lambda item: item[1].number)]


def _meta_description(meta: dict[str, Any], recovered: int, scorable: int) -> str:
    title = meta["title"].replace(" Previous Year Paper", "")
    key_note = (
        f"{scorable} printed answer keys"
        if scorable > 0
        else "no printed answer key"
    )
    return (
        f"Practise the {title} as a timed, unranked mock: {recovered} recovered "
        f"questions, {key_note}, +5/-1 marking and a post-submit review. "
        "Diagrams and tables use exact printed-page crops."
    )


def build_paper_bundle(
    stem: str,
    *,
    write_assets: bool = True,
) -> tuple[dict[str, Any] | None, dict[str, Any], dict[str, Any]]:
    """Parse one paper and return (index row, paper JSON, keys entry)."""
    meta = paper_metadata(stem)
    doc = load_doc(stem)
    profile = detect_profile(doc)
    questions, _keys = parse_doc(doc, profile)
    apply_recovered_keys(doc, questions)
    questions = _dedupe_parsed(questions)
    apply_content_fixes(stem, questions)
    apply_verified_keys(meta["slug"], questions)
    attach_direction_images(doc, questions)
    if not questions:
        return None, {}, {}

    slug = meta["slug"]
    destination = ASSET_DIR / slug
    if write_assets and destination.exists():
        shutil.rmtree(destination)

    kept: list[dict[str, Any]] = []
    stored_keys: dict[str, dict[str, str]] = {}
    passages: dict[str, dict[str, str]] = {}
    source_question_count = max(question.number for question in questions)
    image_question_count = 0
    asset_count = 0

    for question in questions:
        options = _normalise_options(question)
        labels = {label for label, _ in options}
        key, key_flags = _normalise_key(question, labels)
        readable = sum(1 for _, text in options if text.strip())
        assets, body_is_image, options_are_images, option_image_count, asset_flags = build_question_assets(
            question, doc, slug, destination
        )
        flags = [*question.flags, *key_flags, *asset_flags]
        if not question.stem.strip() and not body_is_image:
            flags.append("missing-question-body")

        covered_options = readable + (option_image_count if options_are_images else 0)
        playable = (
            len(options) >= 2
            and covered_options >= len(options)
            and (bool(question.stem.strip()) or body_is_image)
            and (
                body_is_image
                or options_are_images
                or (bool(question.stem.strip()) and readable >= 2)
            )
        )
        if not playable:
            continue

        qid = f"q{question.number:02d}"
        passage_id = question.passage_id if question.passage else None
        if question.passage and passage_id:
            passages.setdefault(
                passage_id,
                {
                    "id": passage_id,
                    "title": "Reading passage",
                    "contentEn": question.passage,
                },
            )
        explanation = clean_block(question.explanation or "")
        scorable = bool(key)
        page_numbers = sorted(
            {question.page_start, *(asset["page"] for asset in assets)}
        )
        kept.append(
            {
                "id": qid,
                "sourceQuestionNo": question.number,
                "stemEn": question.stem,
                "optionsEn": [{"id": label, "text": text} for label, text in options],
                "optionsAreImages": options_are_images,
                "correctAnswer": None,
                "explanationEn": None,
                "passageId": passage_id,
                "reviewStatus": "keyed" if scorable else "pending",
                "reviewFlags": flags,
                "sourcePages": page_numbers,
                "assets": assets,
            }
        )
        if scorable and key:
            stored_keys[qid] = {"a": key, "e": explanation}
        if assets:
            image_question_count += 1
        asset_count += len(assets)

    if not kept:
        if write_assets and destination.exists():
            shutil.rmtree(destination)
        return None, {}, {}

    # Deduplicate questions by id in the impossible case of a numbering clash.
    unique: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for question in kept:
        qid = str(question["id"])
        if qid in seen_ids:
            continue
        seen_ids.add(qid)
        unique.append(question)
    kept = unique

    # Crops are written while a question is being parsed, before the playability
    # check can drop it. Remove any file that no surviving question references so
    # the published tree stays exactly the assets the JSON points at.
    if write_assets and destination.exists():
        referenced = {
            Path(asset["path"]).name
            for question in kept
            for asset in question["assets"]
        }
        for stale in destination.iterdir():
            if stale.is_file() and stale.name not in referenced:
                stale.unlink()

    scorable_count = sum(1 for question in kept if question["reviewStatus"] == "keyed")
    meta_description = _meta_description(meta, len(kept), scorable_count)
    index_row = {
        "id": f"local-{slug}",
        "slug": slug,
        "title": meta["title"],
        "metaDescription": meta_description,
        "subject": meta["subject_info"],
        "year": meta["year"],
        "date": meta["date"],
        "dateLabel": meta["date_label"],
        "shift": meta["shift"],
        "durationMinutes": meta["duration"],
        "sourceFile": f"{stem}.pdf",
        "sourceMethod": (
            "CUCET OCR export verified against the page layout; exact printed-page "
            "crops for diagrams and tables."
            if meta["is_cucet"]
            else "PaddleOCR-VL 1.6 text and layout export; exact printed-page crops "
            "for diagrams and tables."
        ),
        "questionCount": len(kept),
        "sourceQuestionCount": max(source_question_count, len(kept)),
        "scorableQuestionCount": scorable_count,
        "pendingReviewCount": len(kept) - scorable_count,
        "imageQuestionCount": image_question_count,
        "assetCount": asset_count,
        "publicationStatus": "published",
        "reviewRequired": True,
    }
    paper = {
        "exam": {
            "id": f"local-{slug}",
            "slug": slug,
            "title": meta["title"],
            "subject": meta["subject"],
            "subjectId": meta["subject_info"]["id"],
            "subjectCode": meta["subject_info"]["code"],
            "year": meta["year"],
            "examDate": meta["date"],
            "shift": meta["shift"],
            "sourceFile": f"{stem}.pdf",
            "sourceMethod": index_row["sourceMethod"],
            "questionCount": len(kept),
            "sourceQuestionCount": index_row["sourceQuestionCount"],
            "publicationStatus": "published",
            "reviewRequired": True,
            "passages": list(passages.values()),
            "questions": kept,
        }
    }
    return index_row, paper, stored_keys


def write_library(stems: list[str] | None = None) -> dict[str, Any]:
    stems = stems or canonical_stems()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PAPER_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for old in PAPER_DIR.glob("*.json"):
        old.unlink()
    for old in ASSET_DIR.iterdir():
        if old.is_dir():
            shutil.rmtree(old)

    rows: list[dict[str, Any]] = []
    key_bundle: dict[str, dict[str, dict[str, str]]] = {}
    failures: list[dict[str, str]] = []
    for stem in stems:
        try:
            row, paper, keys = build_paper_bundle(stem, write_assets=True)
        except Exception as exc:  # noqa: BLE001 - report and continue
            failures.append({"stem": stem, "error": repr(exc)})
            continue
        if not row:
            failures.append({"stem": stem, "error": "no playable questions"})
            continue
        slug = row["slug"]
        rows.append(row)
        key_bundle[slug] = keys
        (PAPER_DIR / f"{slug}.json").write_text(
            json.dumps(paper, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )

    rows.sort(key=lambda row: (-row["year"], row["subject"]["name"], row["slug"]))
    (DATA_DIR / "index.json").write_text(
        json.dumps({"papers": rows}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    (DATA_DIR / "keys.json").write_text(
        json.dumps({"papers": key_bundle}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    return {
        "papers": len(rows),
        "questions": sum(row["questionCount"] for row in rows),
        "keys": sum(row["scorableQuestionCount"] for row in rows),
        "assets": sum(row["assetCount"] for row in rows),
        "image_questions": sum(row["imageQuestionCount"] for row in rows),
        "failures": failures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only", default="")
    parser.add_argument("--audit", default="_audit.json")
    parser.add_argument("--write", action="store_true", help="write app-loadable library output")
    parser.add_argument(
        "--include-duplicates",
        action="store_true",
        help="also audit OCR files excluded as duplicate exports",
    )
    args = parser.parse_args()

    stems = canonical_stems() if not args.include_duplicates else sorted(
        p.stem.replace(".pdf_by_PaddleOCR-VL-1.6", "")
        for p in OCR_DIR.glob("*.json")
        if "(1)" not in p.stem
    )
    if args.only:
        stems = [s for s in stems if args.only.lower() in s.lower()]
    if args.limit:
        stems = stems[: args.limit]

    if args.write:
        result = write_library(stems)
        print(
            "papers={papers} questions={questions} keys={keys} assets={assets} "
            "image_questions={image_questions}".format(**result)
        )
        for failure in result["failures"]:
            print("FAILED", failure["stem"], failure["error"])
        return

    report = []
    for stem in stems:
        doc = load_doc(stem)
        profile = detect_profile(doc)
        try:
            questions, keys = parse_doc(doc, profile)
        except Exception as exc:  # noqa: BLE001 - audit must continue
            report.append({"stem": stem, "profile": profile, "error": repr(exc)})
            continue
        numbers = [q.number for q in questions]
        max_number = max(numbers) if numbers else 0
        report.append(
            {
                "stem": stem,
                "profile": profile,
                "title": doc.title,
                "questions": len(questions),
                "with_options_4": sum(1 for q in questions if len(q.options) == 4),
                "keys": len(keys),
                "key_match": sum(1 for q in questions if q.key and any(l == q.key for l, _ in q.options)),
                "images": sum(len(q.images) for q in questions),
                "tables": sum(len(q.tables) for q in questions),
                "join_ratio": round(doc.join_ratio, 5),
                "pages": len(doc.pages),
                "missing_numbers": [n for n in range(1, max_number + 1) if n not in set(numbers)],
                "keys_without_question": sorted(set(keys) - set(numbers)),
                "questions_without_key": [q.number for q in questions if not q.key],
                "bad_option_counts": [q.number for q in questions if len(q.options) != 4],
                "bad_keys": [
                    {"n": q.number, "key": q.key, "labels": [l for l, _ in q.options]}
                    for q in questions
                    if q.key and not any(l == q.key for l, _ in q.options)
                ],
                "sample": [
                    {
                        "n": q.number,
                        "stem": q.stem[:140],
                        "options": [t[:80] for _, t in q.options],
                        "key": q.key,
                        "expl": (q.explanation or "")[:80],
                    }
                    for q in questions[:3]
                ],
            }
        )

    Path(args.audit).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(r.get("questions", 0) for r in report)
    print(f"papers={len(report)} questions={total}")
    for r in report:
        if r.get("error"):
            print("ERROR", r["stem"], r["error"])
        elif r["questions"] < 40:
            print(f"LOW {r['stem'][:60]:62} {r['profile']:10} q={r['questions']:3} keys={r['keys']:3}")
        elif r["keys"] == 0 and r["profile"] not in ("plain", "nta", "cucet", "response"):
            print(f"NOKEY {r['stem'][:60]:60} {r['profile']:10} q={r['questions']:3}")


if __name__ == "__main__":
    main()
