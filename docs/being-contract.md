# Home page ↔ figure contract

The home page (`/index.html`) shows the figure full-screen in a same-origin iframe: `/being/index.html`
(`allow="camera; microphone; autoplay"`, black background). The iframe receives pointer events: clicks that
don't land on a menu word, the header or the footer go to the figure (orbit, scatter, its talk/mic control). The figure owns everything inside `being/`
(scripts, `bust.bin`, `bust.json`, …) and can use relative paths.

Messages use `postMessage(msg, location.origin)`; both sides ignore other origins.

Figure → page
- `{type:'oeuvre-ready'}` once, when it can draw. The figure offers its own camera and talk controls.
- `{type:'oeuvre-face', x, y, w, h, state}` about 10×/s: the face's bounding box in CSS pixels of the iframe
  (= the viewport). The four menu words are laid out around this box (left/right of it on wide screens,
  all four above it on phones). The band of about one face-height directly under the box is kept free for
  the figure's talk control. Without the message the page uses a centred fallback box.
- `{type:'oeuvre-camera', on: true|false}` whenever the camera turns on or off.

Page → figure
- `{type:'oeuvre-hello', reduced}` after the iframe loads (`reduced` = prefers-reduced-motion).
- `{type:'oeuvre-pointer', x, y, w, h}` on pointer moves over the page's own layers (fallback; the figure
  sees pointer moves over itself directly).
- Camera and microphone are requested by the figure only after the visitor asks — never on load.
- Conversation: `POST /api/talk` on the same origin (`tools/dev_server.py` locally, `api/talk.php` in
  production, key kept outside the repo) — owned by the figure session.

The current `being/index.html` is a placeholder (procedural halftone head) that follows this contract.
