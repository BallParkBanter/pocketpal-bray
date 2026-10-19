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

MIN_NOTES="${BRAY_MIN_NOTES:-1000}"

# Safety: never prune/push from a missing mirror or an implausibly small export.
[[ -d "$MIRROR" ]] || { echo "push-notes.sh: mirror $MIRROR is not a directory - aborting, tablet untouched" >&2; exit 3; }

# Best effort: the mirror normally pulls itself every minute.
git -C "$MIRROR" pull --ff-only -q 2>/dev/null || true

rm -rf "$OUT"
python3 -I "$HERE/notes_index.py" "$MIRROR" "$OUT" >&2
count="$(find "$OUT/notes" -name '*.md' | wc -l)"

if (( count < MIN_NOTES )); then
  echo "push-notes.sh: only $count notes exported (< $MIN_NOTES) - aborting, tablet untouched" >&2
  exit 3
fi
[[ -z "${BRAY_DRY_RUN:-}" ]] || { echo "dry run: would push $count notes"; exit 0; }

_push() {
  local serial
  serial="$(_dev_target)"
  dev_adb shell mkdir -p "$DEST/notes"
  adb -s "$serial" push --sync "$OUT/notes/." "$DEST/notes/" >&2
  # Prune our own stale copies (deleted/excluded notes). Guarded: only <32-hex>.md files,
  # only inside $DEST/notes/, and only names absent from this build.
  case "$DEST/notes" in
    /sdcard/Android/data/com.pocketpalai.bray/files/notes-db/notes) ;;
    *) echo "push-notes.sh: refusing to prune outside notes-db/notes" >&2; return 1 ;;
  esac
  local stale name removed=0
  stale="$(comm -13 <(cd "$OUT/notes" && ls | sort) \
    <(adb -s "$serial" shell "ls $DEST/notes" | tr -d '\r' | grep -E '^[0-9a-f]{32}\.md$' | sort))"
  while IFS= read -r name; do
    [[ "$name" =~ ^[0-9a-f]{32}\.md$ ]] || continue
    adb -s "$serial" shell "rm -f '$DEST/notes/$name'" </dev/null
    removed=$((removed + 1))
  done <<<"$stale"
  echo "pruned $removed stale notes" >&2
  adb -s "$serial" push "$OUT/index.json" "$DEST/index.json" >&2
}
dev_locked _push
echo "pushed $count notes"
