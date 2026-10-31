#!/bin/sh
# Copy the figure from its prototype folder into being/ (self-contained).
#   tools/sync_being.sh /path/to/oeuvre-dream
# Copies being2.html -> being/index.html and the runtime assets it loads (assets/bust.json, assets/bust.bin).
# Never copies assets/src, assets/check, assets/test, tools/ or anything else.
set -eu
SRC="${1:?usage: tools/sync_being.sh SRC_DIR (the oeuvre-dream folder)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/being"
for f in being2.html assets/bust.json assets/bust.bin; do
  [ -f "$SRC/$f" ] || { echo "missing $SRC/$f" >&2; exit 1; }
done
rm -rf "$DST.tmp"
mkdir -p "$DST.tmp/assets"
cp "$SRC/being2.html" "$DST.tmp/index.html"
cp "$SRC/assets/bust.json" "$SRC/assets/bust.bin" "$DST.tmp/assets/"
rm -rf "$DST"
mv "$DST.tmp" "$DST"
echo "being/ synced from $SRC:"
(cd "$DST" && find . -type f | sort | xargs ls -l)
