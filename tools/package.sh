#!/bin/sh
# Build the Chrome Web Store upload archive from extension/.
#
#   ./tools/package.sh
#
# Produces dist/badasso-calendar-<version>.zip, containing only what the
# extension needs: the manifest, the three scripts, the popup and the icons.
set -eu
cd "$(dirname "$0")/.."

VERSION=$(sed -n 's/.*"version"[^"]*"\([^"]*\)".*/\1/p' extension/manifest.json | head -1)
ARCHIVE="dist/badasso-calendar-$VERSION.zip"

mkdir -p dist
rm -f "$ARCHIVE"

# -x excludes macOS metadata, which the store rejects.
(cd extension && zip -r -q -X "../$ARCHIVE" . -x '.*' -x '__MACOSX/*')

echo "$ARCHIVE"
# BSD head has no -n -2, so the footer is dropped with awk instead.
unzip -l "$ARCHIVE" | awk 'NR>3 && $1 ~ /^[0-9]+$/ {printf "  %-28s %8s o\n", $4, $1}'
