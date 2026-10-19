#!/usr/bin/env bash
# device/shot.sh "<caption>" — screenshot the tablet and post it to Mattermost
# channel galaxy-tab-s7 (override with BRAY_MM_CHANNEL). Prints the PNG path.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

caption="${1:?usage: device/shot.sh \"<caption>\"}"
channel="${BRAY_MM_CHANNEL:-galaxy-tab-s7}"
png="$BRAY_SHOT_DIR/shot-$(date +%Y%m%d-%H%M%S).png"
dev_shot "$png" >/dev/null
"$HOME/bin/mm-post-image" --channel "$channel" "$png" "$caption" >&2
echo "$png"
