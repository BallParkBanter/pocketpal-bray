import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import notes_index  # noqa: E402


def write(root, rel, title, nid, folder, body):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        f.write(f'---\ntitle: "{title}"\njoplin-id: "{nid}"\nfolder: "{folder}"\ntags: []\n---\n\n{body}\n')


def run(files):
    with tempfile.TemporaryDirectory() as m, tempfile.TemporaryDirectory() as o:
        for args in files:
            write(m, *args)
        notes_index.build(m, o)
        idx = json.load(open(os.path.join(o, "index.json")))
        bodies = {f: open(os.path.join(o, "notes", f)).read() for f in os.listdir(os.path.join(o, "notes"))}
        return idx, bodies


FILES = [
    ("Bray Farm/cage.md", "Batting Cage", "a1", "Bray Farm", "The batting cage plug is a ZEN14 outdoor plug. cage cage"),
    ("Smart Home/ha.md", "HA devices", "b2", "Smart Home", "The plug in the barn uses zen14 too"),
    ("_JopSync Archive/old.md", "Old", "c3", "_JopSync Archive", "batting cage archived"),
    ("Bo Notes/Web Crawling/x.md", "Crawl", "d4", "Bo Notes/Web Crawling", "batting crawl"),
]


def test_terms_and_weights():
    idx, bodies = run(FILES)
    assert [n["id"] for n in idx["notes"]] == ["a1", "b2"]
    assert idx["version"] == 1 and idx["built"].endswith("Z")
    t = idx["terms"]
    assert dict(map(tuple, t["batting"])) == {0: 6}  # 1 body + 5 title
    assert dict(map(tuple, t["cage"])) == {0: 8}  # 3 in body + 5 title
    assert sorted(map(tuple, t["zen14"])) == [(0, 1), (1, 1)]
    assert "the" not in t and "is" not in t  # stop word / too short


def test_archive_and_crawling_excluded():
    idx, bodies = run(FILES)
    assert set(bodies) == {"a1.md", "b2.md"}
    assert "crawl" not in idx["terms"] and "archived" not in idx["terms"]
    assert bodies["a1.md"].startswith("The batting cage") and "joplin-id" not in bodies["a1.md"]


def test_common_terms_dropped():
    files = [(f"F/n{i}.md", f"T{i}", f"id{i}", "F", "everywhere uniqueword%d" % i) for i in range(401)]
    idx, _ = run(files)
    assert "everywhere" not in idx["terms"]
    assert "uniqueword7" in idx["terms"]


def test_sensitive_notes_excluded():
    files = [
        ("Bo Notes/wifi.md", "WiFi Passwords", "s1", "Bo Notes", "hunter2 zebrafish"),
        ("Bo Notes/p.md", "Personal Intimacy, Physiology & Relationship Profile - DEEP", "s2", "Bo Notes", "zebrafish"),
        ("Bo Notes/k.md", "Keeper Recovery Phrase", "s3", "Bo Notes", "zebrafish"),
        ("Bo Notes/ok.md", "Spinning Essex pinecone Shopping", "s4", "Bo Notes", "zebrafish"),
        ("Secrets/x.md", "Plain title", "s5", "Secrets", "zebrafish"),
    ]
    idx, bodies = run(files)
    assert [n["id"] for n in idx["notes"]] == ["s4"]
    assert set(bodies) == {"s4.md"}
    assert "hunter2" not in idx["terms"]
