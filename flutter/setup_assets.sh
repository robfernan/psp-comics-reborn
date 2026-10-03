#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)/.."
FLUTTER_ASSETS_DIR="$(cd "$(dirname "$0")" && pwd)/assets"

echo "Creating flutter assets directory: $FLUTTER_ASSETS_DIR"
mkdir -p "$FLUTTER_ASSETS_DIR"

if [ ! -e "$FLUTTER_ASSETS_DIR/thumbs" ]; then
  echo "Linking project public/thumbs -> flutter/assets/thumbs"
  ln -s "$ROOT_DIR/public/thumbs" "$FLUTTER_ASSETS_DIR/thumbs"
else
  echo "flutter/assets/thumbs already exists, skipping"
fi

if [ ! -e "$FLUTTER_ASSETS_DIR/raw" ]; then
  echo "Linking project assets -> flutter/assets/raw"
  ln -s "$ROOT_DIR/assets" "$FLUTTER_ASSETS_DIR/raw"
else
  echo "flutter/assets/raw already exists, skipping"
fi

echo "Done. You can now run 'flutter pub get' in flutter/ and run the app."
