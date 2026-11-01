#!/bin/sh
# Copy the figure from its prototype folder into being/ (self-contained).
#   tools/sync_being.sh /path/to/oeuvre-dream
# Copies being4.html -> being/index.html and the runtime assets it loads:
#   assets/ids4/ids.json            landmarks, mesh and video registration for the five identities e-i
#   assets/ids4/{e,f,g,h,i}.web.jpg the web-sized portraits (1600 px)
#   assets/video/web/{e..i}{1,2}.mp4 the clips (H.264 High, full 1664x1248, CRF 19-22, <= 2.5 MB, no audio; oeuvre-dream/tools/encode_web.sh), two per identity
# Never copies the source portraits (assets/ids/final), the Seedance originals (assets/video/*.mp4), the registration
# frames (assets/ids4/frames), assets/src, assets/check, assets/test, tools/ or anything else.
set -eu
SRC="${1:?usage: tools/sync_being.sh SRC_DIR (the oeuvre-dream folder)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/being"
IDS="e f g h i"
for f in being4.html assets/ids4/ids.json; do
  [ -f "$SRC/$f" ] || { echo "missing $SRC/$f" >&2; exit 1; }
done
for id in $IDS; do
  [ -f "$SRC/assets/ids4/$id.web.jpg" ] || { echo "missing $SRC/assets/ids4/$id.web.jpg" >&2; exit 1; }
  for n in 1 2; do [ -f "$SRC/assets/video/web/$id$n.mp4" ] || { echo "missing $SRC/assets/video/web/$id$n.mp4" >&2; exit 1; }; done
done
rm -rf "$DST.tmp"
mkdir -p "$DST.tmp/assets/ids4" "$DST.tmp/assets/video/web"
cp "$SRC/being4.html" "$DST.tmp/index.html"
cp "$SRC/assets/ids4/ids.json" "$DST.tmp/assets/ids4/"
for id in $IDS; do
  cp "$SRC/assets/ids4/$id.web.jpg" "$DST.tmp/assets/ids4/"
  for n in 1 2; do cp "$SRC/assets/video/web/$id$n.mp4" "$DST.tmp/assets/video/web/"; done
done
rm -rf "$DST"
mv "$DST.tmp" "$DST"
echo "being/ synced from $SRC:"
(cd "$DST" && find . -type f | sort | xargs ls -l)
du -sh "$DST"
