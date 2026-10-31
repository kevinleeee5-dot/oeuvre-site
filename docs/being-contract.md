# Home page ↔ figure contract

The home page (`/index.html`) shows the figure full-screen in a same-origin iframe: `/being/index.html`
(`allow="camera; autoplay"`, `pointer-events: none`, black background). The figure owns everything inside `being/`
(scripts, `bust.bin`, `bust.json`, …) and can use relative paths.

Messages use `postMessage(msg, location.origin)`; both sides ignore other origins.

Figure → page
- `{type:'oeuvre-ready', camera: true|false}` once, when it can draw. `camera: true` makes the page show a
  "Let it see you" button (bottom-left).
- `{type:'oeuvre-face', x, y, w, h, state}` about 10×/s: the face's bounding box in CSS pixels of the iframe
  (= the viewport). The four menu words are laid out around this box (left/right of it on wide screens,
  above/below it on phones). Without it the page uses a centred fallback box.
- `{type:'oeuvre-camera', on: true|false}` whenever the camera turns on or off (updates the button label).

Page → figure
- `{type:'oeuvre-hello', reduced}` after the iframe loads (`reduced` = prefers-reduced-motion).
- `{type:'oeuvre-pointer', x, y, w, h}` on every pointer move (the iframe gets no pointer events itself).
- `{type:'oeuvre-camera', on: true|false}` when the visitor presses the button. Ask for the camera only then —
  never on load.

The current `being/index.html` is a placeholder (procedural halftone head) that follows this contract.
