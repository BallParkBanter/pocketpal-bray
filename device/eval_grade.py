"""Grading + table rows for device/run-evals.sh. Pure functions, no tablet.

CLI (used by run-evals.sh):
  eval_grade.py select <cases.jsonl> [--only PREFIX] [--offline]   -> case JSON lines
  eval_grade.py grade <case-json> <result-json-line>                -> {"status","reason"}
  eval_grade.py row <stamp> <case-json> <status> <result-json-line> -> markdown table row
"""
import json
import re
import sys

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"


def select(cases, only=None, offline=False):
    out = []
    for c in cases:
        if only and not c["id"].startswith(only):
            continue
        if offline and not c.get("offline"):
            continue
        out.append(c)
    return out


def grade(case, result):
    """-> (status, reason). Skips never reach the denominator (caller's job)."""
    if case.get("needs_approval"):
        # TODO(later task): drive the Allow/Deny dialog, then grade these normally.
        return SKIP, "needs_approval: approval handling not implemented yet"
    if not result.get("ok"):
        return FAIL, "not ok: " + str(result.get("error") or "no error given")
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
    if cmd == "select":
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
        for c in select(cases, only, offline):
            print(json.dumps(c))
    elif cmd == "grade":
        st, why = grade(json.loads(argv[2]), _load_result(argv[3]))
        print(json.dumps({"status": st, "reason": why}))
    elif cmd == "row":
        print(row(argv[2], json.loads(argv[3]), argv[4], _load_result(argv[5])))
    else:
        sys.exit("unknown command: " + cmd)


if __name__ == "__main__":
    main(sys.argv)
