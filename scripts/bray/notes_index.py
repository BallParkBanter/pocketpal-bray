#!/usr/bin/env python3
"""Export the Joplin mirror into a compact offline notes DB for PocketPal Bray.

usage: notes_index.py <mirror_dir> <out_dir>

Writes  out_dir/notes/<joplin-id>.md   (frontmatter stripped)
        out_dir/index.json             {"version":1,"built":ISO,"notes":[{id,title,folder,chars}],
                                        "terms":{term:[[noteIdx,count],...]}}
Prints  "indexed N notes".
"""
import datetime
import json
import math
import os
import re
import sys
from collections import Counter

EXCLUDED_FOLDERS = ("_JopSync Archive", "Bo Notes/Web Crawling")
# Sensitive notes never leave the mirror. Patterns are matched case-insensitively against
# the note title and folder path, as whole words (a trailing "s" is allowed: "Passwords").
EXCLUDE_PATTERNS = [
    "password", "passwd", "recovery phrase", "seed phrase", "backup code", "2fa", "mfa",
    "keeper", "api key", "token", "secret", "credential", "ssn", "social security",
    "bank account", "routing number", "pin", "intimacy", "intimate", "sex",
]
_EXCLUDE_RE = re.compile(
    r"(?<![^\W_])(?:" + "|".join(re.escape(p) for p in EXCLUDE_PATTERNS) + r")s?(?![^\W_])",
    re.IGNORECASE,
)
MAX_DF = 400  # terms present in more notes than this are dropped
TITLE_WEIGHT = 5
MIN_LEN = 3
MAX_LEN = 24  # longer tokens are hashes/keys/URLs, never search terms
MAX_TERMS_PER_NOTE = 100  # per-note cap, chosen by weight x rarity (see build); keeps index.json < ~4 MB
TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)

STOP_WORDS = frozenset(
    """the and for are but not you all any can had her was one our out has have
    his how its may new now old see two way who did get let put say she too use
    that this with from they will would there their what when which about into
    than then them these those been being were your yours also just like some
    such only over very more most other each both does done here where while
    http https www com org net html""".split()
)


def parse_note(text):
    """Return (frontmatter dict, body)."""
    meta = {}
    body = text
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            for line in text[4:end].splitlines():
                key, sep, val = line.partition(":")
                if not sep:
                    continue
                val = val.strip()
                if val.startswith('"'):
                    try:
                        val = json.loads(val)
                    except ValueError:
                        val = val.strip('"')
                meta[key.strip()] = val
            body = text[end + 4:].lstrip("\n")
    return meta, body


def tokens(text):
    for tok in TOKEN_RE.findall(text.lower()):
        if MIN_LEN <= len(tok) <= MAX_LEN and tok not in STOP_WORDS:
            yield tok


def is_excluded(folder):
    return any(folder == p or folder.startswith(p + "/") for p in EXCLUDED_FOLDERS)


def is_sensitive(title, folder):
    return bool(_EXCLUDE_RE.search(title) or _EXCLUDE_RE.search(folder))


def iter_mirror(mirror_dir):
    for root, dirs, files in os.walk(mirror_dir):
        dirs[:] = sorted(d for d in dirs if d != ".git")
        for name in sorted(files):
            if name.endswith(".md"):
                yield os.path.join(root, name)


def build(mirror_dir, out_dir):
    notes_dir = os.path.join(out_dir, "notes")
    os.makedirs(notes_dir, exist_ok=True)
    notes, per_note, dropped = [], [], []
    for path in iter_mirror(mirror_dir):
        with open(path, encoding="utf-8", errors="replace") as fh:
            meta, body = parse_note(fh.read())
        nid = meta.get("joplin-id")
        if not nid:
            continue
        folder = meta.get("folder")
        if folder is None:
            folder = os.path.relpath(os.path.dirname(path), mirror_dir)
            folder = "" if folder == "." else folder
        if is_excluded(folder):
            continue
        title = meta.get("title") or os.path.splitext(os.path.basename(path))[0]
        if is_sensitive(title, folder):
            dropped.append(title)
            continue
        with open(os.path.join(notes_dir, nid + ".md"), "w", encoding="utf-8") as out:
            out.write(body)
        counts = Counter(tokens(body))
        title_toks = set(tokens(title))
        for tok in title_toks:
            counts[tok] += TITLE_WEIGHT
        notes.append({"id": nid, "title": title, "folder": folder, "chars": len(body)})
        per_note.append((counts, title_toks))
    # Pass 2: document frequency, then keep each note's most *findable* terms
    # (count x rarity), always including its title words. Frequent generic words
    # would otherwise crowd out the rare terms people actually search for.
    n_notes = max(len(notes), 1)
    df = Counter()
    for counts, _ in per_note:
        df.update(counts.keys())
    postings = {}
    for idx, (counts, title_toks) in enumerate(per_note):
        if len(counts) > MAX_TERMS_PER_NOTE:
            ranked = sorted(
                counts,
                key=lambda t: (t in title_toks, counts[t] * math.log(n_notes / df[t])),
                reverse=True,
            )
            counts = {t: counts[t] for t in ranked[:MAX_TERMS_PER_NOTE]}
        for term, n in counts.items():
            postings.setdefault(term, []).append([idx, n])
    terms = {t: p for t, p in postings.items() if len(p) <= MAX_DF}
    index = {
        "version": 1,
        "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": notes,
        "terms": terms,
    }
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    # Titles only, never bodies.
    with open(os.path.join(out_dir, "excluded-titles.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(sorted(dropped)) + "\n")
    build.dropped = dropped
    return len(notes)


def main(argv):
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    n = build(argv[1], argv[2])
    print(f"indexed {n} notes, excluded {len(build.dropped)} sensitive")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
