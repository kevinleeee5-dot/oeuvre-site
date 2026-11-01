# Home page ↔ figure contract

The home page (`/index.html`) shows the figure full-screen in a same-origin iframe: `/being/index.html`
(`allow="camera; microphone; autoplay"`, black background). The iframe receives pointer events: clicks that
don't land on a menu word, the header or the footer go to the figure (orbit, scatter, its talk/mic control). The figure owns everything inside `being/`
(scripts, `assets/ids4/ids.json`, the five `assets/ids4/*.web.jpg` portraits, the ten clips in `assets/video/web/`, …) and can use relative paths.

Messages use `postMessage(msg, location.origin)`; both sides ignore other origins.

Figure → page
- `{type:'oeuvre-ready', camera}` once, when it can draw. `camera` is always `false` now: the figure has no camera;
  it offers only its talk control (embedded: a compact 'talk' pill under the chin that opens into the input and the mic).
- `{type:'oeuvre-face', x, y, w, h, state}` about 10×/s: the face's bounding box in CSS pixels of the iframe
  (= the viewport). The four menu words are laid out around this box (left/right of it on wide screens,
  all four above it on phones). The band of about one face-height directly under the box is kept free for
  the figure's talk control. Without the message the page uses a centred fallback box.
  The box runs crown to chin and ear to ear; hair reaches past it, so the page keeps the words a margin
  away (0.2 × box width at the sides on wide screens, 0.13 × box height above it on phones).
- `{type:'oeuvre-camera', on:false}` only as the answer to a page request (there is no camera).

Page → figure
- `{type:'oeuvre-hello', reduced}` after the iframe loads (`reduced` = prefers-reduced-motion).
- `{type:'oeuvre-pointer', x, y, w, h}` on pointer moves over the page's own layers (fallback; the figure
  sees pointer moves over itself directly).
- `{type:'oeuvre-camera', on}` (legacy): the figure always answers `{type:'oeuvre-camera', on:false}`.
- The microphone is requested by the figure only after the visitor asks (the mic button or holding the space bar) — never on load.
- Conversation: `POST /api/talk` on the same origin (`tools/dev_server.py` locally, `api/talk.php` in
  production, key kept outside the repo) — owned by the figure session.

`being/index.html` is the photographic figure, video edition (being4): five identities e–i (landscape busts, black
ground). During a hold (20–30 s) the identity's short clips play back to back over its still in exact registration (a
WebGL video texture drawn through the photo's mesh; the frame's rect in the photo comes from `tools/vid_register.py` in the
prototype folder): a calm clip first, then calm, calm, expressive in a shuffled order, never expressive twice in a row; while
it talks only the calm clip loops and it does not change identity. Each clip starts and ends on the photo: at the end of a
hold it waits for the clip to end, crossfades to the still (0.35–0.9 s), runs the particle transition to the next
identity's still, then starts that identity's first clip. Clips are muted, inline, no controls; only the current identity's
two clips and the next identity's first are loaded at a time. The face box it posts is the still's (the clips stay inside
it). Runtime files: `being/index.html`, `being/assets/ids4/ids.json`, `being/assets/ids4/{e,f,g,h,i}.web.jpg` and
`being/assets/video/web/{e,f,g,h,i}{1,2}.mp4` (H.264, 1280×960, no audio; ~9.6 MB in all, ≤ 1.6 MB each). No camera, no
MediaPipe. Debug params: `?hold=SECONDS`, `?video=0` (stills only), `?id=e…i`, `?seed=N`, `?cycle=0`, `?perf=1`.
Refresh it from the prototype folder with `tools/sync_being.sh <oeuvre-dream dir>`.
Embedded (same-origin parent), the figure hides its own HUD/status lines and the fine print (the Contact page carries the
privacy note) and keeps only the talk pill.
