#!/usr/bin/env bash
# Build the signed PocketPal Bray release APK. Prints the APK path on the last line.
set -euo pipefail
REPO="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../.." && pwd)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
cd "$REPO"
nvm install 22.21.0 >&2
nvm use 22.21.0 >&2
command -v yarn >/dev/null || npm i -g yarn@1.22.22 >&2
# shellcheck disable=SC1091
source "${BRAY_SIGNING_ENV:-$HOME/.config/pocketpal-bray/signing.env}"
# Release version: bump BOTH lines in scripts/bray/version.env for every release.
# shellcheck disable=SC1091
source "$REPO/scripts/bray/version.env"
echo "building ${BRAY_VERSION_NAME} (versionCode ${BRAY_VERSION_CODE})" >&2
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
yarn install --frozen-lockfile >&2
(cd android && ./gradlew assembleProdRelease >&2)
APK="$REPO/android/app/build/outputs/apk/prod/release/app-prod-release.apk"
[ -f "$APK" ] || { echo "APK not found: $APK" >&2; exit 1; }
echo "$APK"
