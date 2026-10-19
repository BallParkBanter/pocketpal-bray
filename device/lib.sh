# device/lib.sh — shared helpers for driving PocketPal Bray on the Galaxy Tab S7.
#
#   source "$(dirname "$0")/lib.sh"
#
# Every function that touches the tablet runs under `flock /tmp/bray-device.lock`
# so parallel agents never drive the screen at the same time. The lock is
# re-entrant inside one process tree (BRAY_DEVICE_LOCK_HELD), so a script can
# take it once for a whole multi-step flow (`dev_locked my_flow`) and still call
# the individual helpers.
#
# Safety: nothing here may disable Wi-Fi, reboot, or touch other apps' data.
# The tablet is Wi-Fi only; there is no second way in.

BRAY_PKG="${BRAY_PKG:-com.pocketpalai.bray}"
BRAY_LOCK="${BRAY_LOCK:-/tmp/bray-device.lock}"
BRAY_LOCK_WAIT="${BRAY_LOCK_WAIT:-900}"       # seconds to wait for another agent
TABLET_CMD="${TABLET_CMD:-$HOME/projects/galaxy-tab-s7/tablet}"
BRAY_SHOT_DIR="${BRAY_SHOT_DIR:-/tmp/bray-shots}"

# dev_locked <cmd...> — run cmd while holding the device lock (re-entrant).
# Exit 75 (BRAY_LOCK_TIMEOUT_RC) if another agent holds it for BRAY_LOCK_WAIT s.
#
# The lock fd (9) must never leak into child processes: `tablet status` can
# start a daemonized `ssh -f -N -L 5599:…` tunnel, and if that inherited fd 9
# it would hold the lock forever and deadlock every other agent. So cmd runs
# with `9>&-`: bash moves its own copy of fd 9 to a close-on-exec fd for the
# duration, so the lock stays held by this subshell but no exec'd program
# (tablet, ssh, adb, sleep, ...) inherits it. device/tests/test_lock.sh proves it.
BRAY_LOCK_TIMEOUT_RC=75
dev_locked() {
  if [[ -n "${BRAY_DEVICE_LOCK_HELD:-}" ]]; then
    "$@"
    return
  fi
  (
    exec 9>>"$BRAY_LOCK"
    if ! flock -w "$BRAY_LOCK_WAIT" 9; then
      echo "dev_locked: timed out after ${BRAY_LOCK_WAIT}s waiting for $BRAY_LOCK" >&2
      exit "$BRAY_LOCK_TIMEOUT_RC"
    fi
    export BRAY_DEVICE_LOCK_HELD=1
    "$@" 9>&-
  )
}

# dev_target — echo the adb serial. Uses $BRAY_SERIAL if already resolved and
# still attached, otherwise asks `tablet status` (which reconnects). Never
# hard-code the serial: the LAN IP and port move.
_dev_target() {
  if [[ -n "${BRAY_SERIAL:-}" ]] && [[ "$(adb -s "$BRAY_SERIAL" get-state 2>/dev/null)" == device ]]; then
    echo "$BRAY_SERIAL"
    return 0
  fi
  local out serial
  out="$("$TABLET_CMD" status 2>&1)"
  # Same parse as family-app/rig/adb.py parse_tablet_status.
  serial="$(printf '%s\n' "$out" | grep -m1 'connected: yes' | grep -oE '[A-Za-z0-9_.-]+:[0-9]+\)' | tr -d ')')"
  if [[ -z "$serial" ]]; then
    echo "dev_target: tablet not connected: $(printf '%s\n' "$out" | head -1)" >&2
    return 1
  fi
  echo "$serial"
}
dev_target() { dev_locked _dev_target; }

# dev_adb <args...> — adb against the tablet (resolves the serial once per call
# chain; export BRAY_SERIAL="$(dev_target)" in scripts to avoid repeats).
dev_adb() {
  local s
  s="$(_dev_target)" || return 1
  adb -s "$s" "$@"
}

# dev_ready — exit 1 unless the screen is awake and unlocked. Never unlocks.
_dev_ready() {
  local power win
  power="$(dev_adb shell dumpsys power 2>/dev/null)" || return 1
  win="$(dev_adb shell dumpsys window 2>/dev/null)" || return 1
  grep -q 'mWakefulness=Awake' <<<"$power" || { echo "dev_ready: screen not awake" >&2; return 1; }
  grep -q 'isKeyguardShowing=false' <<<"$win" || { echo "dev_ready: keyguard showing (Bo must unlock)" >&2; return 1; }
}
dev_ready() { dev_locked _dev_ready; }

# dev_ui_xml — print the raw uiautomator dump (retries: dump fails while the
# UI is animating, e.g. during token streaming).
_dev_ui_xml() {
  local i xml
  for i in 1 2 3 4 5; do
    xml="$(dev_adb exec-out 'uiautomator dump /sdcard/bray-ui.xml >/dev/null 2>&1 && cat /sdcard/bray-ui.xml' 2>/dev/null)"
    if [[ "$xml" == *"</hierarchy>"* ]]; then
      printf '%s\n' "$xml"
      return 0
    fi
    sleep 1
  done
  echo "dev_ui_xml: uiautomator dump failed" >&2
  return 1
}
dev_ui_xml() { dev_locked _dev_ui_xml; }

# _dev_ui_parse <mode> [regex [after-regex]] — parse a dump on stdin.
#   lines: one line per non-empty text / content-desc ("T: ..." / "D: ...")
#   tap:   centre "x y" of the first node whose text or content-desc matches
#          regex ("id:<regex>" matches the resource-id = React Native testID
#          instead). With after-regex, only nodes after the first node matching
#          it (document order) count — e.g. the "Load model" button of one card.
_dev_ui_parse() {
  python3 -I -c '
import re, sys, xml.etree.ElementTree as ET
mode = sys.argv[1]
pat = sys.argv[2] if len(sys.argv) > 2 else ""
idmode = pat.startswith("id:")
rx = re.compile(pat[3:] if idmode else pat) if pat else None
after = re.compile(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else None
root = ET.fromstring(sys.stdin.read())
def hit(n, r):
    for v in (n.get("text", ""), n.get("content-desc", "")):
        if r.search(v):
            return True
    return False
seen_after = after is None
for n in root.iter("node"):
    t, d = n.get("text", ""), n.get("content-desc", "")
    if mode == "lines":
        for tag, v in (("T", t), ("D", d)):
            if v.strip():
                print(tag + ": " + v.replace("\n", "\\n"))
        continue
    if not seen_after:
        seen_after = hit(n, after)
        continue
    ok = rx.search(n.get("resource-id", "")) if idmode else hit(n, rx)
    if ok:
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds", ""))
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            sys.exit(0)
if mode == "tap":
    sys.exit(1)
' "$@"
}

# dev_ui_text — uiautomator text + content-desc lines ("T: ..." / "D: ...").
_dev_ui_text() { _dev_ui_xml | _dev_ui_parse lines; }
dev_ui_text() { dev_locked _dev_ui_text; }

# dev_tap_text <regex> [after-regex] — tap the centre of the first node whose
# text or content-desc matches the (Python) regex; "id:<regex>" matches the
# testID/resource-id instead. Refuses if the tablet is locked.
_dev_tap_text() {
  local xy
  _dev_ready || return 1
  xy="$(_dev_ui_xml | _dev_ui_parse tap "$1" "${2:-}")" || { echo "dev_tap_text: no node matches /$1/" >&2; return 1; }
  # shellcheck disable=SC2086
  dev_adb shell input tap $xy
}
dev_tap_text() { dev_locked _dev_tap_text "$@"; }

# dev_shot <out.png> — screenshot, validated (relay sometimes truncates) and
# resized so the long side is <= 2000 px.
_dev_shot() {
  local out="$1" raw i
  mkdir -p "$(dirname "$out")"
  raw="$(mktemp --suffix=.png)"
  for i in 1 2 3 4; do
    dev_adb exec-out screencap -p >"$raw" 2>/dev/null
    if python3 -I -c '
import sys
from PIL import Image
im = Image.open(sys.argv[1]); im.load()
im.thumbnail((2000, 2000))
im.save(sys.argv[2])
' "$raw" "$out" 2>/dev/null; then
      rm -f "$raw"
      echo "$out"
      return 0
    fi
    sleep 1
  done
  rm -f "$raw"
  echo "dev_shot: screencap failed/truncated 4 times" >&2
  return 1
}
dev_shot() { dev_locked _dev_shot "$1"; }

# dev_free_ram_mb — MemAvailable in MB.
_dev_free_ram_mb() {
  dev_adb shell cat /proc/meminfo | awk '/^MemAvailable:/ {print int($2/1024)}'
}
dev_free_ram_mb() { dev_locked _dev_free_ram_mb; }

# dev_launch — bring PocketPal Bray to the front (does not restart it).
_dev_launch() {
  dev_adb shell monkey -p "$BRAY_PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}
dev_launch() { dev_locked _dev_launch; }

# dev_focus — package of the focused window.
_dev_focus() {
  dev_adb shell dumpsys window | grep -m1 -E 'mCurrentFocus=' | grep -oE '[a-z][a-z0-9_]*(\.[a-z0-9_]+)+/' | tr -d /
}
dev_focus() { dev_locked _dev_focus; }
