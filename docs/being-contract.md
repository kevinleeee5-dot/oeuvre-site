# Home page ↔ figure contract

The home page (`/index.html`) shows the figure full-screen in a same-origin iframe: `/being/index.html`
(`allow="camera; microphone; autoplay"`, black background). The iframe receives pointer events: clicks that
don't land on a menu word, the header or the footer go to the figure (orbit, scatter, its talk/mic control). The figure owns everything inside `being/`
(scripts, `assets/ids/ids.json`, the five `assets/ids/*.web.jpg` portraits, …) and can use relative paths.

Messages use `postMessage(msg, location.origin)`; both sides ignore other origins.

Figure → page
- `{type:'oeuvre-ready', camera}` once, when it can draw (`camera`: the browser offers a camera and `?cam=0`
  is not set). The figure offers its own camera and talk controls.
- `{type:'oeuvre-face', x, y, w, h, state}` about 10×/s: the face's bounding box in CSS pixels of the iframe
  (= the viewport). The four menu words are laid out around this box (left/right of it on wide screens,
  all four above it on phones). The band of about one face-height directly under the box is kept free for
  the figure's talk control. Without the message the page uses a centred fallback box.
  The box runs crown to chin and ear to ear; hair reaches past it, so the page keeps the words a margin
  away (0.2 × box width at the sides on wide screens, 0.13 × box height above it on phones).
- `{type:'oeuvre-camera', on: true|false}` whenever the camera turns on or off.

Page → figure
- `{type:'oeuvre-hello', reduced}` after the iframe loads (`reduced` = prefers-reduced-motion).
- `{type:'oeuvre-pointer', x, y, w, h}` on pointer moves over the page's own layers (fallback; the figure
  sees pointer moves over itself directly).
- `{type:'oeuvre-camera', on}` asks the figure to start/stop the camera (optional; the figure has its own
  button). If the browser refuses, the figure answers `{type:'oeuvre-camera', on:false}`.
- Camera and microphone are requested by the figure only after the visitor asks — never on load.
- Conversation: `POST /api/talk` on the same origin (`tools/dev_server.py` locally, `api/talk.php` in
  production, key kept outside the repo) — owned by the figure session.

`being/index.html` is the photographic figure (five identities a–e, cycled through particle transitions; autonomous;
mirrors the visitor's face via MediaPipe after "let it see you"; talk via `/api/talk`). Its runtime files are
`being/index.html`, `being/assets/ids/ids.json` and `being/assets/ids/{a,b,c,d,e}.web.jpg` (the 4 MB source portraits stay in the prototype folder);
MediaPipe (`cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14`) and its face model
(`storage.googleapis.com/mediapipe-models/...`) load only after the visitor turns the camera on. Camera pixels
are never drawn or stored. Refresh it from the prototype folder with `tools/sync_being.sh <oeuvre-dream dir>`.
Embedded (same-origin parent), the figure hides its own HUD/status/legal lines and keeps only the talk control.
