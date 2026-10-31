#!/bin/sh
# Copy the figure from its prototype folder into being/ (self-contained).
#   tools/sync_being.sh /path/to/oeuvre-dream
# Copies being3.html -> being/index.html and the runtime assets it loads:
# assets/ids/ids.json (landmarks + mesh for the five identities a-e) and the five
# web-sized portraits assets/ids/{a,b,c,d,e}.web.jpg.
# Never copies the 4 MB source portraits (*.jpg, *.orig.jpg), the per-id landmark
# dumps (*.json, *.err), assets/src, assets/check, assets/test, tools/ or anything else.
set -eu
SRC="${1:?usage: tools/sync_being.sh SRC_DIR (the oeuvre-dream folder)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/being"
IDS="a b c d e"
for f in being3.html assets/ids/ids.json; do
  [ -f "$SRC/$f" ] || { echo "missing $SRC/$f" >&2; exit 1; }
done
for id in $IDS; do
  [ -f "$SRC/assets/ids/$id.web.jpg" ] || { echo "missing $SRC/assets/ids/$id.web.jpg" >&2; exit 1; }
done
rm -rf "$DST.tmp"
mkdir -p "$DST.tmp/assets/ids"
cp "$SRC/being3.html" "$DST.tmp/index.html"
cp "$SRC/assets/ids/ids.json" "$DST.tmp/assets/ids/"
for id in $IDS; do cp "$SRC/assets/ids/$id.web.jpg" "$DST.tmp/assets/ids/"; done
rm -rf "$DST"
mv "$DST.tmp" "$DST"
echo "being/ synced from $SRC:"
(cd "$DST" && find . -type f | sort | xargs ls -l)
