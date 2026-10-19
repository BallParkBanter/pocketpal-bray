#!/usr/bin/env bash
# Install and start the 6-hourly notes push timer (systemd --user). Re-run from the
# checkout you want the timer to point at (e.g. main, after merging).
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DEST="$HOME/.config/systemd/user"
mkdir -p "$DEST"
sed "s|@REPO@|$REPO|" "$HERE/systemd/bray-notes-push.service" > "$DEST/bray-notes-push.service"
cp "$HERE/systemd/bray-notes-push.timer" "$DEST/bray-notes-push.timer"
systemctl --user daemon-reload
systemctl --user enable --now bray-notes-push.timer
systemctl --user list-timers | grep bray-notes || true
