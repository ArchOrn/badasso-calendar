#!/bin/sh
# Build the store upload archive from extension/.
#
#   ./tools/package.sh            # Chrome Web Store
#   ./tools/package.sh firefox    # addons.mozilla.org
#
# The Firefox build merges extension/manifest.firefox.json into the manifest:
# Gecko needs an add-on id, and a minimum version of 128 — the release that
# brought MAIN-world content scripts, on which the whole design rests.
set -eu
cd "$(dirname "$0")/.."

TARGET=${1:-chrome}
VERSION=$(sed -n 's/.*"version"[^"]*"\([^"]*\)".*/\1/p' extension/manifest.json | head -1)

case "$TARGET" in
  chrome)  ARCHIVE="dist/badasso-calendar-$VERSION.zip" ;;
  firefox) ARCHIVE="dist/badasso-calendar-$VERSION-firefox.zip" ;;
  *) echo "cible inconnue : $TARGET (attendu: chrome, firefox)" >&2; exit 1 ;;
esac

mkdir -p dist
rm -f "$ARCHIVE"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

cp -R extension/ "$STAGE/pkg"
rm -f "$STAGE/pkg/manifest.firefox.json"

if [ "$TARGET" = firefox ]; then
  python3 - "$STAGE/pkg/manifest.json" extension/manifest.firefox.json <<'PY'
import json, sys
target, overlay = sys.argv[1], sys.argv[2]
manifest = json.load(open(target))
manifest.update(json.load(open(overlay)))
json.dump(manifest, open(target, "w"), indent=2, ensure_ascii=False)
open(target, "a").write("\n")
PY
fi

# -X drops macOS metadata, which both stores reject.
(cd "$STAGE/pkg" && zip -r -q -X "$OLDPWD/$ARCHIVE" . -x '.*' -x '__MACOSX/*')

echo "$ARCHIVE"
# BSD head has no -n -2, so the footer is dropped with awk instead.
unzip -l "$ARCHIVE" | awk 'NR>3 && $1 ~ /^[0-9]+$/ {printf "  %-28s %8s o\n", $4, $1}'
