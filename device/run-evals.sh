#!/usr/bin/env bash
# device/run-evals.sh [--only <id-prefix>] [--offline]
#
# Runs each case in device/evals/cases.jsonl through chat.sh, appends one row per
# case to docs/eval-results.md, prints "PASS n/m". Exit 1 if pass rate < 80 %.
# needs_approval cases need "approve_match" (a regex that must FULLY match the
# dialog's message) and run with `chat.sh --approve allow --approve-match`;
# Allow is tapped only on a full match, anything else is Denied and FAILs. A
# needs_approval case without approve_match is not run (FAIL). All other cases
# run with the default --approve deny. SKIP (not counted in m) is no longer produced.
#
# cases.jsonl line: {"id","prompt","pal","expect_tool","expect_regex","offline",
#   "needs_approval", "setup"?}. With "setup", that text is sent first as a normal
# new chat, then "prompt" goes in with --continue; only the last reply is graded.
# Holds the device lock across the whole run (chat.sh re-enters it).
set -uo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
source "$HERE/lib.sh"
CASES="${BRAY_EVAL_CASES:-$HERE/evals/cases.jsonl}"
RESULTS="${BRAY_EVAL_RESULTS:-$HERE/../docs/eval-results.md}"
CHAT="${BRAY_EVAL_CHAT:-$HERE/chat.sh}"

ONLY=(); OFFLINE=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY=(--only "$2"); shift 2 ;;
    --offline) OFFLINE=(--offline); shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "run-evals.sh: unexpected arg: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$RESULTS" ]]; then
  mkdir -p "$(dirname "$RESULTS")"
  cat >"$RESULTS" <<'HDR'
# Eval results

Appended by `device/run-evals.sh`. Cases live in `device/evals/cases.jsonl`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
HDR
fi

jf() { python3 -I -c 'import json,sys; v=json.loads(sys.argv[1]).get(sys.argv[2]); print("" if v is None else v)' "$@"; }

# Approval cases change real settings. With the real chat.sh, snapshot the
# brightness (value + auto mode) before the run and put it back afterwards.
SAVED_BRIGHTNESS=""
save_settings() {
  [[ -z "${BRAY_EVAL_CHAT:-}" ]] || return 0
  SAVED_BRIGHTNESS="$(dev_adb shell 'echo $(settings get system screen_brightness) $(settings get system screen_brightness_mode)' 2>/dev/null | tr -d '\r')"
}
restore_settings() {
  [[ -n "$SAVED_BRIGHTNESS" ]] || return 0
  local b m; read -r b m <<<"$SAVED_BRIGHTNESS"
  [[ "$b" =~ ^[0-9]+$ && "$m" =~ ^[01]$ ]] || return 0
  dev_adb shell "settings put system screen_brightness $b; settings put system screen_brightness_mode $m" >/dev/null 2>&1 &&
    echo "restored brightness $b (mode $m)" >&2
}

run_cases() {
  local sout pass=0 fail=0 skip=0 case_json id pal setup prompt out g status stamp
  while IFS= read -r case_json; do
    [[ -n "$case_json" ]] || continue
    id="$(jf "$case_json" id)"; pal="$(jf "$case_json" pal)"
    setup="$(jf "$case_json" setup)"; prompt="$(jf "$case_json" prompt)"
    stamp="$(date '+%Y-%m-%d %H:%M')"
    local palargs=(); [[ -n "$pal" ]] && palargs=(--pal "$pal")
    # needs_approval: tap Allow on Bray's approval dialog; everything else
    # keeps chat.sh's default (Deny) so a stray dialog can't change anything.
    local approve=() am=""
    if [[ "$(jf "$case_json" needs_approval)" == True ]]; then
      am="$(jf "$case_json" approve_match)"
      approve=(--approve allow --approve-match "$am")
    fi
    echo "== $id" >&2
    if [[ ${#approve[@]} -gt 0 && -z "$am" ]]; then
      # Never Allow without knowing exactly what: don't even run the case.
      out='{"ok":false,"error":"needs_approval case has no approve_match: not run"}'
    elif [[ -n "$setup" ]]; then
      sout="$("$CHAT" "$setup" "${palargs[@]}" </dev/null)"
      if [[ "$(jf "$sout" ok)" != True ]]; then   # setup failed: don't run the follow-up
        out="$(python3 -I -c 'import json,sys; print(json.dumps({"ok": False, "error": "setup failed: " + (json.loads(sys.argv[1]).get("error") or "no error given")}))' "$sout" 2>/dev/null)"
        [[ -n "$out" ]] || out='{"ok":false,"error":"setup failed: chat.sh printed no JSON"}'
      else
        out="$("$CHAT" "$prompt" --continue "${approve[@]}" </dev/null)"
      fi
    else
      out="$("$CHAT" "$prompt" "${palargs[@]}" "${approve[@]}" </dev/null)"
    fi
    g="$(python3 -I "$HERE/eval_grade.py" grade "$case_json" "$out" 2>/dev/null)"
    status="$(jf "$g" status 2>/dev/null)"
    # Fail closed: a crashed or garbled grader is a FAIL, never a SKIP.
    case "$status" in PASS|FAIL|SKIP) ;; *) status=FAIL; g='{"reason":"grader crashed or printed no status"}' ;; esac
    echo "$status $id $(jf "$g" reason)" >&2
    python3 -I "$HERE/eval_grade.py" row "$stamp" "$case_json" "$status" "$out" >>"$RESULTS" ||
      echo "| $stamp | $id | $status | - | - | - | (row formatting failed) |" >>"$RESULTS"
    case "$status" in PASS) pass=$((pass+1)) ;; FAIL) fail=$((fail+1)) ;; *) skip=$((skip+1)) ;; esac
  done < <(python3 -I "$HERE/eval_grade.py" select "$CASES" "${ONLY[@]}" "${OFFLINE[@]}")
  local m=$((pass+fail))
  echo "PASS $pass/$m"
  (( skip )) && echo "($skip skipped)" >&2
  (( m == 0 )) && return 0
  (( pass * 100 >= 80 * m )) || return 1
}

run_all() {
  local rc
  save_settings
  run_cases; rc=$?
  restore_settings
  return $rc
}

dev_locked run_all
