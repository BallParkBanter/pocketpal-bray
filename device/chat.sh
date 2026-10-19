#!/usr/bin/env bash
# device/chat.sh "<prompt>" [--pal "<name>"] [--timeout 180] [--keep-thinking] [--continue]
#
# Drives PocketPal Bray on the tablet: new chat, optional Pal, thinking OFF,
# types the prompt, sends, waits for the reply's metrics footer, screenshots.
# --continue: skip New Chat / Pal / thinking; send into the current conversation
#   (multi-turn). --pal is ignored with --continue.
# Prints ONE JSON line on stdout:
#   {"prompt","response","tok_s","ttft_ms","tools_used":[...],"screenshot","ok", "error"?}
# Exit 0 when ok, 1 otherwise (the JSON line is printed either way).
#
# Holds /tmp/bray-device.lock for the whole run.
# Limits: `adb shell input text` is ASCII-only; a literal "%s" in the prompt
# would type as a space.
set -uo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

PROMPT=""; PAL=""; TIMEOUT=180; KEEP_THINKING=0; CONTINUE=0
BRAY_MODEL_RX="${BRAY_MODEL_RX:-^gemma-4-E2B-it-Q4_0\.gguf$}"   # model to load if none is
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pal) PAL="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --keep-thinking) KEEP_THINKING=1; shift ;;
    --continue) CONTINUE=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) [[ -z "$PROMPT" ]] || { echo "chat.sh: unexpected arg: $1" >&2; exit 2; }; PROMPT="$1"; shift ;;
  esac
done
[[ -n "$PROMPT" ]] || { echo 'usage: device/chat.sh "<prompt>" [--pal "<name>"] [--timeout 180]' >&2; exit 2; }

XML="$(mktemp)"; BASE="$(mktemp)"; trap 'rm -f "$XML" "$BASE"' EXIT
SHOT=""

# emit <ok 0|1> [error] — the one JSON line, built from the last dump in $XML.
emit() {
  python3 -I "$HERE/chat_parse.py" "$PROMPT" "$SHOT" "$1" "${2:-}" "$XML"
}

dump() { _dev_ui_xml >"$XML"; }
has() { python3 -I -c '
import re, sys, xml.etree.ElementTree as ET
rx = re.compile(sys.argv[2])
for n in ET.parse(sys.argv[1]).getroot().iter("node"):
    if any(rx.search(n.get(k, "")) for k in ("text", "content-desc", "resource-id")):
        sys.exit(0)
sys.exit(1)' "$XML" "$1"; }
tap() { _dev_tap_text "$@" >/dev/null; }
fail() { emit 0 "$1"; exit 1; }

# model_state — from the dump: "chat-ok", "chat-notloaded", or for the Models
# screen the button on the $BRAY_MODEL_RX card: "card-load x y" / "card-offload".
model_state() {
  python3 -I - "$XML" "$BRAY_MODEL_RX" <<'PY'
import re, sys, xml.etree.ElementTree as ET
nodes = list(ET.parse(sys.argv[1]).getroot().iter("node"))
card = re.compile(sys.argv[2])
inp = next((n for n in nodes if n.get("resource-id") == "chat-input"), None)
if inp is not None:
    print("chat-notloaded" if "Model not loaded" in inp.get("text", "") else "chat-ok")
    sys.exit()
seen = False
for n in nodes:
    t, d = n.get("text", ""), n.get("content-desc", "")
    if not seen:
        seen = bool(card.search(t))
        continue
    if d in ("Load model", "Offload model"):  # first button after the card title
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
        x1, y1, x2, y2 = map(int, m.groups())
        print("card-offload" if d == "Offload model" else f"card-load {(x1+x2)//2} {(y1+y2)//2}")
        sys.exit()
print("unknown")
PY
}

# ensure_model — make sure a model is loaded (the app may have been killed or
# backgrounded, which auto-releases it). Loads the $BRAY_MODEL_RX card (never
# any other), then returns to Chat.
ensure_model() {
  dump || return 1
  [[ "$(model_state)" == chat-notloaded ]] || has 'No Models Available' || return 0
  tap '^Open drawer$' && sleep 1 && tap '^Models$' && sleep 2 || return 1
  local i st
  for i in $(seq 1 40); do
    dump || { sleep 3; continue; }
    if has '^(CONTINUE|Continue)$'; then tap '^(CONTINUE|Continue)$'; sleep 3; continue; fi
    st="$(model_state)"
    case "$st" in
      card-load\ *)   dev_adb shell input tap ${st#card-load } >/dev/null ;;
      card-offload)   tap '^Open drawer$' && sleep 1 && tap '^Chat$' && sleep 2; return 0 ;;
      chat-ok)        return 0 ;;
    esac
    sleep 3
  done
  return 1
}

NOT_LOADED='Model not loaded'

# prepare — chat screen, model loaded, fresh chat, Pal, thinking off.
prepare() {
  _dev_launch; sleep 3
  dump || fail "uiautomator dump failed"
  if ! has '^chat-input$'; then          # not on the chat screen
    tap '^Open drawer$' && sleep 1 && tap '^Chat$' && sleep 2
  fi
  ensure_model || fail "could not load model matching $BRAY_MODEL_RX"

  if [[ $CONTINUE == 1 ]]; then
    dump || fail "uiautomator dump failed"
    [[ "$(model_state)" == chat-ok ]]; return
  fi

  tap 'id:^reset-button$' || fail "new-chat (reset) button not found"; sleep 1

  if [[ -n "$PAL" ]]; then
    tap '^Select Pal$' || fail "Select Pal button not found"; sleep 2
    local pal_rx
    pal_rx="^$(python3 -I -c 'import re,sys; print(re.escape(sys.argv[1]))' "$PAL")(, |$)"
    # Close the sheet by its backdrop, never with BACK (BACK can background
    # the app, which auto-releases the model).
    # The "No Pal" row only exists while a Pal is active; absent means none is.
    tap "$pal_rx" || { tap '^Bottom sheet backdrop$'; [[ "$PAL" == "No Pal" ]] || fail "pal not found: $PAL"; }
    sleep 2
    # Rows past the 4th sit behind the input bar: the tap above then lands on nothing and
    # the sheet stays open. Scroll the list to its end and tap again.
    dump || fail "uiautomator dump failed"
    if has '^Bottom sheet backdrop$' && [[ "$PAL" != "No Pal" ]]; then
      local dims w h
      dims="$(python3 -I - "$XML" <<'PY'
import re, sys
import xml.etree.ElementTree as ET
n = next(ET.parse(sys.argv[1]).getroot().iter("node"))
m = re.match(r"\[0,0\]\[(\d+),(\d+)\]", n.get("bounds", ""))
print(m.group(1), m.group(2)) if m else None
PY
)"
      read -r w h <<<"$dims"
      if [[ -n "${w:-}" && -n "${h:-}" ]]; then
        dev_adb shell input swipe $((w / 2)) $((h * 78 / 100)) $((w / 2)) $((h * 44 / 100)) 500 >/dev/null; sleep 1
        tap "$pal_rx" || fail "pal not found after scroll: $PAL"; sleep 2
      fi
    fi
  fi

  dump || fail "uiautomator dump failed"
  if [[ $KEEP_THINKING == 0 ]] && has '^Disable thinking mode$'; then
    tap '^Disable thinking mode$'; sleep 1; dump || fail "uiautomator dump failed"
  fi
  # The input's placeholder says "Model not loaded..." if the context was released.
  [[ "$(model_state)" == chat-ok ]]
}

# send_and_wait — type, send, wait. Returns 0 done, 3 model not loaded, 1 timeout.
send_and_wait() {
  dump && cp "$XML" "$BASE"   # footers already on screen, before our send
  tap 'id:^chat-input$' || fail "message box not found"; sleep 1
  local esc
  esc="$(python3 -I -c '
import sys
s = sys.argv[1].replace(" ", "%s")
print("\x27" + s.replace("\x27", "\x27\\\x27\x27") + "\x27")' "$PROMPT")"
  dev_adb shell "input text $esc" || fail "input text failed"
  sleep 1
  tap 'id:^send-button$' || fail "send button not found"

  # Finished = a footer from a NEW turn (not the one already on screen before we
  # sent: with --continue the previous turn's footer is visible) that is
  # unchanged across two polls.
  local start=$SECONDS prev="" cur
  while (( SECONDS - start < TIMEOUT )); do
    sleep 3
    dump || continue
    has "^$NOT_LOADED" && return 3
    cur=""
    if python3 -I "$HERE/chat_parse.py" --is-new "$BASE" "$XML"; then
      cur="$(python3 -I "$HERE/chat_parse.py" --footers "$XML")"
    fi
    [[ -n "$cur" && "$cur" == "$prev" ]] && return 0
    prev="$cur"
  done
  return 1
}

run() {
  export BRAY_SERIAL
  BRAY_SERIAL="$(_dev_target)" || fail "tablet not connected"
  _dev_ready 2>/dev/null || fail "tablet locked or asleep — Bo must unlock"

  local attempt rc=3
  for attempt in 1 2; do              # one retry if the model got released under us
    if prepare; then
      send_and_wait; rc=$?
    else
      rc=3
    fi
    [[ $rc == 3 ]] || break
  done
  case $rc in
    0) SHOT="$(_dev_shot "$BRAY_SHOT_DIR/chat-$(date +%Y%m%d-%H%M%S).png")"; emit 1 ;;
    3) SHOT="$(_dev_shot "$BRAY_SHOT_DIR/chat-$(date +%Y%m%d-%H%M%S)-notloaded.png")"
       fail "model not loaded (released twice)" ;;
    *) SHOT="$(_dev_shot "$BRAY_SHOT_DIR/chat-$(date +%Y%m%d-%H%M%S)-timeout.png")"
       fail "timed out after ${TIMEOUT}s waiting for the reply" ;;
  esac
}

dev_locked run; rc=$?
# The lock wait timed out before run() started: still honour the one-JSON-line contract.
if [[ $rc == "$BRAY_LOCK_TIMEOUT_RC" ]]; then
  emit 0 "device lock busy: waited ${BRAY_LOCK_WAIT}s for $BRAY_LOCK (another agent is driving the tablet)"
fi
exit "$rc"
