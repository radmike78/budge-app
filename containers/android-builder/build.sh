#!/usr/bin/env bash
# Usage: build-android [apk|aab]
# Runs inside the android-builder image with the repo mounted at /src.
set -euo pipefail
TARGET="${1:-apk}"
cd /src
npm ci --no-audit --no-fund
# Generate the native project from app.json (ignored by git) and build it.
npx expo prebuild --platform android --no-install
cd android
if [ "$TARGET" = "aab" ]; then
  ./gradlew --no-daemon bundleRelease
  echo "AAB: android/app/build/outputs/bundle/release/"
else
  ./gradlew --no-daemon assembleRelease
  echo "APK: android/app/build/outputs/apk/release/"
fi
