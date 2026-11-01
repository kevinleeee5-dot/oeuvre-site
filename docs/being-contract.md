# Home page ↔ figure contract

The home page (`/index.html`) shows the figure full-screen in a same-origin iframe: `/being/index.html`
(`allow="camera; microphone; autoplay"`, black background). The iframe receives pointer events: clicks that
don't land on a menu word, the header or the footer go to the figure (touching the person changes the face; the
conversation panel on the right). The figure owns everything inside `being/`
(scripts, `assets/ids4/ids.json`, the five `assets/ids4/*.web.jpg` portraits, the ten clips in `assets/video/web/`, …) and can use relative paths.

Messages use `postMessage(msg, location.origin)`; both sides ignore other origins.

Figure → page
- `{type:'oeuvre-ready', camera}` once, when it can draw. The page also sets `data-face=live` on it (fallback for the first face box). `camera` is always `false` now: the figure has no camera.
- `{type:'oeuvre-face', x, y, w, h, state}` about 10×/s: the face's bounding box in CSS pixels of the iframe
  (= the viewport). The menu words land anywhere (they may overlap the hair and the person), preferring spots where at
  most ~15 % of the word covers this box. Without the message the page uses a centred fallback box.
  The box runs crown to chin and ear to ear; hair reaches past it.
- `{type:'oeuvre-panel', x, y, w, h, open, sheet, hint}` whenever the conversation panel's footprint changes (open/close, resize,
  the thread growing; deduplicated, checked ~10×/s): css px of the viewport. `open:true` — the column (desktop: ~320–372 px
  wide, right gutter, anchored by its input so it grows upward) or, with `sheet:true`, the bottom sheet (phones < 700 px and
  portrait screens, width/height < 0.8) or the right-hand drawer on short landscape screens (height < 500 px); `open:false` — the small 'Talk' tab (right edge) or pill (bottom right) it collapses to. The page keeps
  the menu words out of this rect (+28 px), moves a word that sits on it, and while a sheet is open hides its statement and
  language links. Before the first message the page assumes the column's usual place. (This replaces the old band kept free
  under the chin.) `hint` is the first-visit hint's rect `{x,y,w,h}` while it shows, else `null`; the page keeps the words
  out of it too (+16/12 px).
- `{type:'oeuvre-nav', href, x, y}` when the visitor clicks an action chip in the conversation ('Open Work →'): `href` is one
  of `/work/`, `/services/`, `/studio/`, `/contact/` (the page ignores anything that is not one of its menu links); `x, y` is
  the chip's centre, where the page starts its iris transition. The page accepts figure messages only from its own iframe.
- `{type:'oeuvre-camera', on:false}` only as the answer to a page request (there is no camera).

Page → figure
- `{type:'oeuvre-hello', reduced}` after the iframe loads (`reduced` = prefers-reduced-motion).
- `{type:'oeuvre-pointer', x, y, w, h}` on pointer moves over the page's own layers (fallback; the figure
  sees pointer moves over itself directly).
- `{type:'oeuvre-camera', on}` (legacy): the figure always answers `{type:'oeuvre-camera', on:false}`.
- `{type:'oeuvre-next'}` when the visitor presses `N` (no modifier, focus not in a text field) while the focus is on the page
  rather than in the frame. The figure treats it like its own `N` key: `changeFace(null, null)` (front from a random region),
  subject to the same cool-down and never while it listens/thinks/speaks.
- `{type:'oeuvre-viewport', kb}` on load and on every `visualViewport` resize/scroll: `kb = innerHeight - visualViewport.height
  - visualViewport.offsetTop` (the on-screen keyboard's height, css px). The figure lifts its sheet and face above it (the
  frame's own viewport does not shrink). The page's viewport meta also carries `interactive-widget=resizes-content`.
- `{type:'oeuvre-touch', x, y}` when a click lands on the current menu word's hit box but not on its ink (no glyph point
  within ~7 px), and that box lies over the face or neck (the face box widened 15 % each side and run 1.7× its height down).
  `x, y` are viewport css px (= the frame's). The figure runs its `personAt(x, y)` check and, if it is on the person,
  `changeFace(x, y)` as if touched directly; otherwise it ignores it. Clicks on the ink, and keyboard activation, navigate.
- The menu canvas never draws inside the panel rect from `oeuvre-panel` (+16 px), streaks included.
- The microphone is requested by the figure only after the visitor asks (the mic button or holding the space bar) — never on load.
- Conversation: `POST /api/talk` on the same origin (`tools/dev_server.py` locally, `api/talk.php` in
  production, key kept outside the repo) — owned by the figure session.

`being/index.html` is the photographic figure, video edition (being4): five identities e–i (landscape busts, black
ground). Composition (v5): full bleed — the picture's bottom edge always sits at or below the viewport's bottom (the chest
is cropped by the screen, no fade); the crown keeps 5 % headroom; desktop face box ~24 % of the width (21–25 % on short
screens), a little left of centre to balance the panel; compact screens (phones, portrait) centre the face, the bust fills
the width, the crown may sit up to 30 % down. Only the picture's left/right borders get a soft vignette (when it is
narrower than the screen). On a phone with the sheet open the figure rises so the face stays above the sheet.
Interaction: clicking/tapping the person (a luminance mask of the portrait) starts the transition to the next identity with
the particle front seeded at the touch (head-frame coordinates from the nearest landmarks); 4 s cool-down after a change,
never while it listens/thinks/speaks; a ripple marks the touch; a first-visit hint ('Touch the face to change it',
localStorage `oeuvre.touched`) goes after the first touch. The `N` key and a visually hidden 'Change the face' button do
the same (front from a random region). The conversation panel: prompt, four suggestion chips (sent at once), the last four
exchanges (visitor right, small grey; replies typed out in white with the voice), three 'thinking' streaks, an input and a
mic with a live level meter (its own `getUserMedia` analyser, only after the visitor taps the mic or holds space),
collapsible to a 'Talk' tab (sessionStorage `oeuvre.panel`). Replies that mention a section get up to two action chips. A hold lasts one clip (~6 s) or one and a half (~8–9 s), chosen at random; a 1.5 hold cuts during a calm clip at its `cutAt` (ids.json, the frame nearest the photo, from `tools/clip_cuts.py`) and the particle transition starts from that frozen video frame. The clips play over the still in exact registration (a
WebGL video texture drawn through the photo's mesh; the frame's rect in the photo comes from `tools/vid_register.py` in the
prototype folder); while it talks only the calm clip loops and it does not change identity. Each clip starts and ends on the
photo: a one-clip hold crossfades from the clip's end to the still, then runs the particle transition (fine 3D grains: lift
along the surface normal in perspective, depth of field, a swirl round the head occluded by its silhouette) to the next
identity's still, then starts that identity's first clip. Clips are muted, inline, no controls; only the current identity's
two clips and the next identity's first are loaded at a time. The face box it posts is the still's (the clips stay inside
it). Runtime files: `being/index.html`, `being/assets/ids4/ids.json`, `being/assets/ids4/{e,f,g,h,i}.web.jpg` and
`being/assets/video/web/{e,f,g,h,i}{1,2}.mp4` (H.264 High, 1664×1248, CRF 19–22, faststart, no audio; ≤ 2.5 MB each). No camera, no
MediaPipe. Debug params: `?hold=SECONDS`, `?video=0` (stills only), `?id=e…i`, `?seed=N`, `?cycle=0`, `?perf=1`.
Refresh it from the prototype folder with `tools/sync_being.sh <oeuvre-dream dir>`.
Embedded (same-origin parent), the figure hides its own HUD/status lines and the fine print (the Contact page carries the
privacy note); the conversation panel, the touch hint and the ripple are its only chrome.

### Cursor ring (site draws it, figure reports)
The site replaces the mouse pointer with a thin white 'O' ring (desktop mouse devices only, `html.has-o`; native cursor hidden with
`cursor: none`). The iframe swallows pointer events, so over the figure the page cannot see the mouse. The figure must:
- set `cursor: none` on its own document while `matchMedia('(hover: hover) and (pointer: fine)')` matches, and
- post `{type:'oeuvre-cursor', x, y, inside, hover, down}` to the parent on every pointer move/down/up/leave in the figure
  (x, y in the frame's CSS px = the page's; `inside:false` on leave; `hover:true` over the face, panel buttons and chips; `down` while pressed).
The site ignores the message from any other origin or window.
