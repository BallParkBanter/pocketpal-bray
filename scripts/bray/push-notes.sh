#!/usr/bin/env bash
# push-notes.sh — build the offline notes DB from the Joplin mirror and push it to the tablet.
# Builds into /tmp/bray-notes, then `adb push --sync` to the app's external files dir.
# Prints "pushed N notes". Holds the device lock while pushing; index.json goes last so it
# never references a note that has not arrived yet.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
# shellcheck source=../../device/lib.sh
source "$REPO/device/lib.sh"

MIRROR="${BRAY_MIRROR:-$HOME/projects/joplin-mirror}"
OUT="${BRAY_NOTES_OUT:-/tmp/bray-notes}"
DEST="/sdcard/Android/data/$BRAY_PKG/files/notes-db"

# Best effort: the mirror normally pulls itself every minute.
git -C "$MIRROR" pull --ff-only -q 2>/dev/null || true

rm -rf "$OUT"
python3 -I "$HERE/notes_index.py" "$MIRROR" "$OUT" >&2
count="$(find "$OUT/notes" -name '*.md' | wc -l)"

_push() {
  local serial
  serial="$(_dev_target)"
  dev_adb shell mkdir -p "$DEST/notes"
  adb -s "$serial" push --sync "$OUT/notes/." "$DEST/notes/" >&2
  adb -s "$serial" push "$OUT/index.json" "$DEST/index.json" >&2
}
dev_locked _push
echo "pushed $count notes"
