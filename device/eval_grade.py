"""Grading + table rows for device/run-evals.sh. Pure functions, no tablet.

CLI (used by run-evals.sh):
  eval_grade.py select <cases.jsonl> [--only PREFIX] [--offline]   -> case JSON lines
  eval_grade.py skipped <cases.jsonl> [--only PREFIX] [--offline]  -> "id: reason" per skipped case
A case with a "skip" reason is never run (e.g. MCP cases: MCP is opt-in).
  eval_grade.py grade <case-json> <result-json-line>                -> {"status","reason"}
  eval_grade.py row <stamp> <case-json> <status> <result-json-line> -> markdown table row
"""
import json
import re
import sys

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"


def select(cases, only=None, offline=False, skipped=False):
    """Cases to run. skipped=True instead returns the ones held back by "skip"."""
    out = []
    for c in cases:
        if bool(c.get("skip")) != skipped:
            continue
        if only and not c["id"].startswith(only):
            continue
        if offline and not c.get("offline"):
            continue
        out.append(c)
    return out


def grade(case, result):
    try:
        return _grade(case, result)
    except Exception as e:  # bad regex, missing key, wrong types ...
        return FAIL, "grader error: %s: %s" % (type(e).__name__, e)


def _grade(case, result):
    """Never raises: any error while grading is a FAIL.
    -> (status, reason). SKIP is no longer produced (kept for the CLI contract)."""
    if not result.get("ok"):
        return FAIL, "not ok: " + str(result.get("error") or "no error given")
    # Approval hook: run-evals.sh runs needs_approval cases with
    # `chat.sh --approve allow --approve-match <case.approve_match>`, which taps
    # Allow on Bray's Allow/Deny dialog ONLY if its message fully matches, and
    # lists every dialog it answered in result["approvals"]. Every other case
    # runs with the default --approve deny, so a dialog there is a FAIL (and
    # was denied, so nothing changed).
    approvals = result.get("approvals") or []
    bad = next((a for a in approvals if a.get("mismatch")), None)
    if bad is not None:
        return FAIL, "approval dialog did not match approve_match (denied): %s" % bad.get("message")
    if case.get("needs_approval"):
        if not case.get("approve_match"):
            return FAIL, "needs_approval case has no approve_match"
        if not any(a.get("choice") == "allow" for a in approvals):
            return FAIL, "needs_approval: no approval dialog appeared"
    elif approvals:
        return FAIL, "unexpected approval dialog (denied): %s" % (approvals[0].get("message") or approvals[0].get("title"))
    resp = result.get("response") or ""
    if not re.search(case["expect_regex"], resp, re.IGNORECASE):
        return FAIL, "regex /%s/ did not match" % case["expect_regex"]
    tool = case.get("expect_tool")
    if tool and tool not in (result.get("tools_used") or []):
        return FAIL, "tool %s not used (used: %s)" % (tool, result.get("tools_used") or [])
    return PASS, ""


def _cell(s, n=None):
    s = re.sub(r"\s+", " ", str(s)).strip()
    if n and len(s) > n:
        s = s[: n - 1] + "..."
    return s.replace("|", "\\|")


def row(stamp, case, status, result):
    tok = result.get("tok_s")
    ttft = result.get("ttft_ms")
    tools = ",".join(result.get("tools_used") or []) or "-"
    excerpt = result.get("response") or result.get("error") or ""
    return "| %s | %s | %s | %s | %s | %s | %s |" % (
        _cell(stamp), _cell(case["id"]), status,
        "-" if tok is None else tok, "-" if ttft is None else ttft,
        _cell(tools), _cell(excerpt, 80))


def _load_result(line):
    try:
        return json.loads(line)
    except ValueError:
        return {"ok": False, "error": "chat.sh printed no JSON"}


def main(argv):
    cmd = argv[1]
    if cmd in ("select", "skipped"):
        only, offline = None, False
        args = argv[3:]
        while args:
            a = args.pop(0)
            if a == "--only":
                only = args.pop(0)
            elif a == "--offline":
                offline = True
        with open(argv[2], encoding="utf-8") as f:
            cases = [json.loads(l) for l in f if l.strip()]
        for c in select(cases, only, offline, skipped=(cmd == "skipped")):
            print(json.dumps(c) if cmd == "select" else "%s: %s" % (c["id"], c["skip"]))
    elif cmd == "grade":
        st, why = grade(json.loads(argv[2]), _load_result(argv[3]))
        print(json.dumps({"status": st, "reason": why}))
    elif cmd == "row":
        print(row(argv[2], json.loads(argv[3]), argv[4], _load_result(argv[5])))
    else:
        sys.exit("unknown command: " + cmd)


if __name__ == "__main__":
    main(sys.argv)
