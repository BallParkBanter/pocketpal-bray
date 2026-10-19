#!/usr/bin/env bash
# Offline test of the approval hook in run-evals.sh (no tablet): needs_approval
# cases call chat.sh with --approve allow, all others without --approve (so
# chat.sh's default, Deny, applies). Uses a fake chat.sh and a private lock.
set -uo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export BRAY_LOCK="$T/lock" BRAY_EVAL_RESULTS="$T/results.md" BRAY_EVAL_CASES="$T/cases.jsonl"
export BRAY_EVAL_CHAT="$T/fake-chat.sh" FAKE_LOG="$T/calls.log"
cat >"$BRAY_EVAL_CASES" <<'J'
{"id":"t-approve","prompt":"Set my brightness to 40%","pal":"Tablet Pal","expect_tool":null,"expect_regex":"40","offline":true,"needs_approval":true,"approve_match":"Set the screen brightness to 40%\\?"}
{"id":"t-nomatch","prompt":"Run something","pal":"Tablet Pal","expect_tool":null,"expect_regex":".","offline":true,"needs_approval":true}
{"id":"t-plain","prompt":"How much battery do I have?","pal":"Tablet Pal","expect_tool":null,"expect_regex":"74","offline":true,"needs_approval":false}
{"id":"t-stray","prompt":"Turn off wifi","pal":"Tablet Pal","expect_tool":null,"expect_regex":"wifi","offline":true,"needs_approval":false}
J
cat >"$BRAY_EVAL_CHAT" <<'F'
#!/usr/bin/env bash
echo "$*" >>"$FAKE_LOG"
case "$*" in
  *"--approve allow"*) echo '{"ok":true,"response":"Brightness set to 40%","tok_s":5,"ttft_ms":1,"tools_used":[],"approvals":[{"title":"Set brightness","message":"40%?","choice":"allow"}]}' ;;
  *wifi*) echo '{"ok":true,"response":"I turned off wifi","tok_s":5,"ttft_ms":1,"tools_used":[],"approvals":[{"title":"Run a shell command","message":"svc wifi disable","choice":"deny"}]}' ;;
  *) echo '{"ok":true,"response":"Battery 74%","tok_s":5,"ttft_ms":1,"tools_used":[],"approvals":[]}' ;;
esac
F
chmod +x "$BRAY_EVAL_CHAT"
out="$("$HERE/../run-evals.sh" 2>"$T/err")"; rc=$?
fail=0
check() { if eval "$2"; then echo "PASS: $1"; else echo "FAIL: $1"; fail=1; fi; }
check "needs_approval case gets --approve allow + its approve_match" 'grep -qF "Set my brightness to 40% --pal Tablet Pal --approve allow --approve-match Set the screen brightness to 40%\?" "$FAKE_LOG"'
check "needs_approval case without approve_match is never run" '! grep -q "^Run something" "$FAKE_LOG"'
check "... and FAILs" 'grep -q "^FAIL t-nomatch .*approve_match" "$T/err"'
check "plain case gets no --approve" 'grep -q "^How much battery do I have? --pal Tablet Pal$" "$FAKE_LOG"'
check "approval case graded PASS" 'grep -q "^PASS t-approve" "$T/err"'
check "stray dialog in a plain case is FAIL" 'grep -q "^FAIL t-stray unexpected approval dialog" "$T/err"'
check "summary counts all four (no SKIP)" '[[ "$out" == "PASS 2/4" ]]'
check "exit 1 below 80 %" '[[ $rc == 1 ]]'
# chat.sh itself refuses an unscoped Allow before touching the tablet.
TABLET_CMD=/bin/false "$HERE/../chat.sh" "x" --approve allow >/dev/null 2>"$T/chat-err"; crc=$?
check "chat.sh --approve allow without --approve-match exits 2" '[[ $crc == 2 ]] && grep -q "needs --approve-match" "$T/chat-err"'
exit $fail
