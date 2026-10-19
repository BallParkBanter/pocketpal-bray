"""Parse a PocketPal Bray uiautomator dump into chat.sh's one JSON line.

    python3 -I chat_parse.py <prompt> <screenshot> <ok 0|1> <error> <dump.xml>

    python3 -I chat_parse.py --footers <dump.xml>   # "<count>\t<newest footer text>"

    python3 -I chat_parse.py --dialog <dump.xml> [allow|deny]
        # rc 0 + one JSON line {"title","message","choice","x","y"} when a Bray
        # Allow/Deny approval dialog is on screen (x,y = button to tap), else rc 1.

chat.sh passes an approvals JSONL file as an optional 6th argument; its lines
land in the output's "approvals" list.

Importable for tests: parse(xml_text) -> dict of response/tok_s/ttft_ms/tools_used.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET

# TTFT is missing when the final step produced no tokens (empty reply): still a finished turn.
METRICS = re.compile(r"([\d.]+)ms/token, ([\d.]+) tokens/sec(?:.*?([\d.]+)ms TTFT)?")
# ToolUsedChip (testID tool-used-chip): "used <name>[ · N tokens · Ns]" (en.json chat.toolUsedChip)
CHIP = re.compile(r"^used (\S+?)(?: · .*)?$")
# ToolErrorBlock (testID tool-error-block): "<name> failed" (en.json chat.toolErrorBlock)
ERR = re.compile(r"^(\S+) failed$")
TOOL_CONTAINERS = {"tool-used-chip": CHIP, "tool-error-block": ERR}


def bbox(n):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
    return tuple(map(int, m.groups())) if m else None


def inside(n, b):
    nb = bbox(n)
    return bool(nb and b) and b[0] <= nb[0] and b[1] <= nb[1] and nb[2] <= b[2] and nb[3] <= b[3]


def tools_used(nodes):
    """Tool names in call order, repeats kept.

    TalentSurface renders one chip per call in step.toolCalls order, steps
    top to bottom inside the turn's single FlatList row, so call order is
    screen order: sort containers by their top edge (then left edge), which
    holds even though the list itself is inverted. A call whose tool has a
    registered TalentUI renders that UI instead of a chip and is NOT seen here.
    """
    found = []
    for n in nodes:
        rx = TOOL_CONTAINERS.get(n.get("resource-id", ""))
        b = bbox(n)
        if rx is None or b is None:
            continue
        for t in nodes:  # the label Text inside this container
            m = rx.match(t.get("text", "")) if t is not n and inside(t, b) else None
            if m:
                found.append(((b[1], b[0]), m.group(1)))
                break
    return [name for _, name in sorted(found, key=lambda x: x[0])]


def footer_texts(xml_text):
    """Metrics footers on screen, newest first (document order; inverted list)."""
    try:
        nodes = ET.fromstring(xml_text).iter("node")
    except ET.ParseError:
        return []
    return [n.get("text", "") for n in nodes
            if n.get("resource-id") == "footer-timing" and METRICS.search(n.get("text", ""))]


def new_footer(baseline, current):
    """True when `current` (footer_texts now) shows a turn that `baseline` did not:
    more footers, or a different newest footer. Guards against grading the
    previous turn's footer in a multi-turn chat."""
    if not current:
        return False
    return len(current) > len(baseline) or not baseline or current[0] != baseline[0]


BRAY_PKG = "com.pocketpalai.bray"
ALLOW = re.compile(r"^allow$", re.IGNORECASE)
DENY = re.compile(r"^deny$", re.IGNORECASE)


def approval_dialog(xml_text, choice="deny", pkg=BRAY_PKG):
    """The Bray approval dialog (askApproval -> Alert with Deny / Allow), or None.

    Only nodes of PocketPal Bray's own package count, and only buttons whose
    whole text is Allow / Deny: Shizuku's permission dialog ("Allow all the
    time", other package) is never matched, so the harness can't answer it.
    -> {"title","message","choice","x","y"} with x,y the centre of the button
    for `choice` ("allow" or "deny").
    """
    try:
        nodes = [n for n in ET.fromstring(xml_text).iter("node") if n.get("package") == pkg]
    except ET.ParseError:
        return None
    allow = next((n for n in nodes if ALLOW.match(n.get("text", "").strip())), None)
    deny = next((n for n in nodes if DENY.match(n.get("text", "").strip())), None)
    if allow is None or deny is None:
        return None
    target = allow if choice == "allow" else deny
    b = bbox(target)
    if b is None:
        return None
    title = next((n.get("text", "") for n in nodes if re.search(r":id/alert_?[tT]itle$", n.get("resource-id", ""))), "")
    message = next((n.get("text", "") for n in nodes if n.get("resource-id", "").endswith(":id/message")), "")
    return {"title": title, "message": message, "choice": "allow" if choice == "allow" else "deny",
            "x": (b[0] + b[2]) // 2, "y": (b[1] + b[3]) // 2}


def parse(xml_text):
    bubble = None
    out = {"response": "", "tok_s": None, "ttft_ms": None, "tools_used": []}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    nodes = list(root.iter("node"))
    # Newest message is first in document order (inverted FlatList), so the first
    # footer is the newest assistant turn's. With --continue older turns are on
    # screen too: everything below is scoped to the newest turn's row.
    footer = next((n for n in nodes if n.get("resource-id") == "footer-timing"
                   and METRICS.search(n.get("text", ""))), None)
    if footer is not None:
        mtext = footer.get("text", "")
        m = METRICS.search(mtext)
        out["tok_s"] = float(m.group(2))
        out["ttft_ms"] = int(float(m.group(3))) if m.group(3) else None
        # The bubble's content-desc is "<reply text>, <metrics>" but joins
        # paragraphs with ", " and omits code-block bodies, so when the whole
        # bubble is on screen rebuild the reply from the text nodes inside it.
        bubble = next((n for n in nodes if n.get("content-desc", "").endswith(", " + mtext)), None)
        if bubble is not None:
            out["response"] = bubble.get("content-desc")[: -len(", " + mtext)].strip()
            b = bbox(bubble)
            header = next((bbox(n) for n in nodes if n.get("resource-id") == "header-view"), None)
            if b and header and b[1] > header[3]:
                # Tool chips / error blocks sit inside the turn row too; they are
                # reported in tools_used, not in the reply text.
                tool_boxes = [bbox(n) for n in nodes if n.get("resource-id") in TOOL_CONTAINERS]
                lines = [n.get("text").rstrip() for n in nodes
                         if n.get("text", "").strip() and n.get("resource-id") != "footer-timing"
                         and inside(n, b) and not any(inside(n, tb) for tb in tool_boxes)]
                # Whole bubble on screen: its text nodes ARE the reply. None
                # (only tool chips) means the model ended its turn without text;
                # the content-desc would hand back the chip label instead.
                out["response"] = "\n".join(lines)
    turn = None
    if footer is not None:
        turn = bubble if bubble is not None else next((p for p in root.iter() if footer in list(p)), None)
    out["tools_used"] = tools_used(list(turn.iter("node")) if turn is not None else nodes)
    return out


def main(argv):
    if argv[1] == "--is-new":  # <baseline.xml> <current.xml>: rc 0 when current has a new turn's footer
        with open(argv[2], encoding="utf-8") as f, open(argv[3], encoding="utf-8") as g:
            return 0 if new_footer(footer_texts(f.read()), footer_texts(g.read())) else 1
    if argv[1] == "--dialog":
        with open(argv[2], encoding="utf-8") as f:
            d = approval_dialog(f.read(), argv[3] if len(argv) > 3 else "deny")
        if d is None:
            return 1
        print(json.dumps(d, ensure_ascii=False))
        return 0
    if argv[1] == "--footers":
        with open(argv[2], encoding="utf-8") as f:
            t = footer_texts(f.read())
        print("%d\t%s" % (len(t), t[0] if t else ""))
        return 0
    prompt, shot, ok, err, path = argv[1], argv[2], argv[3] == "1", argv[4], argv[5]
    try:
        with open(path, encoding="utf-8") as f:
            parsed = parse(f.read())
    except OSError:
        parsed = parse("")
    out = {"prompt": prompt, **parsed, "screenshot": shot or None, "approvals": []}
    if len(argv) > 6 and argv[6]:
        try:
            with open(argv[6], encoding="utf-8") as f:
                out["approvals"] = [json.loads(l) for l in f if l.strip()]
        except (OSError, ValueError):
            pass
    out["ok"] = ok and bool(out["response"]) and out["tok_s"] is not None
    if err:
        out["error"] = err
    elif ok and not out["ok"]:
        out["error"] = ("empty reply (the model ended its turn without text)" if out["tok_s"] is not None
                        else "reply or metrics not found in UI dump")
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
