#!/usr/bin/env bash
# device/install.sh <apk> — install PocketPal Bray on the tablet and assert it
# landed as com.pocketpalai.bray with the arm64-v8a native libs.
# Uses `install -r` (keeps app data). Never touches stock com.pocketpalai.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

apk="${1:?usage: device/install.sh <apk>}"
[[ -f "$apk" ]] || { echo "install.sh: no such file: $apk" >&2; exit 1; }

# Refuse to install anything that isn't the Bray package (protects stock PocketPal).
if command -v aapt2 >/dev/null 2>&1; then
  apk_pkg="$(aapt2 dump packagename "$apk" 2>/dev/null || true)"
  [[ -z "$apk_pkg" || "$apk_pkg" == "$BRAY_PKG" ]] || {
    echo "install.sh: APK package is $apk_pkg, expected $BRAY_PKG — refusing" >&2; exit 1; }
fi

_install() {
  export BRAY_SERIAL
  BRAY_SERIAL="$(_dev_target)"
  echo "installing $(basename "$apk") ($(du -h "$apk" | cut -f1)) to $BRAY_SERIAL ..." >&2
  dev_adb install -r "$apk" >&2

  local dump abi
  dump="$(dev_adb shell dumpsys package "$BRAY_PKG")"
  grep -q "Package \[$BRAY_PKG\]" <<<"$dump" || { echo "install.sh: $BRAY_PKG not found after install" >&2; return 1; }
  abi="$(grep -m1 -oE 'primaryCpuAbi=[^ ]+' <<<"$dump" | cut -d= -f2)"
  [[ "$abi" == arm64-v8a ]] || { echo "install.sh: primaryCpuAbi=$abi (expected arm64-v8a)" >&2; return 1; }
  echo "installed $BRAY_PKG $abi"
}
dev_locked _install
