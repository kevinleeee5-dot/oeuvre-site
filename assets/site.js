/* Oeuvre — site behaviour. Plain script, no build step.
   One transition everywhere (the halftone iris), floating menu words on the home page,
   halftone images that resolve into photos, and a few quiet page effects. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const root = document.documentElement;
  const body = document.body;
  const page = body.dataset.page;
  const section = body.dataset.section || "";
  const reducedMQ = matchMedia("(prefers-reduced-motion: reduce)");
  // ?static renders the final state at once (used for screenshot checks)
  const isStatic = /[?&]static\b/.test(location.search);
  if (isStatic) root.classList.add("static");
  let reduced = reducedMQ.matches || isStatic;
  reducedMQ.addEventListener && reducedMQ.addEventListener("change", e => { reduced = e.matches; });
  const KEY = "oeuvre-iris";
  const store = {
    get() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) { return null; } },
    set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { } },
    clear() { try { sessionStorage.removeItem(KEY); } catch (_) { } }
  };

  let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2);
  const fit = (c, w = W, h = H) => { c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); const x = c.getContext("2d"); x.setTransform(DPR, 0, 0, DPR, 0, 0); return x; };
  const tween = (ms, fn) => new Promise(res => {
    const t0 = performance.now();
    const f = now => { const p = clamp((now - t0) / ms); fn(p); p < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  });

  /* ================= the iris: one transition for every page change ================= */
  const irisC = $("#iris");
  let ictx = fit(irisC);
  function drawIris(o, p, grow) {
    const step = W < 600 ? 20 : 26, maxR = step * 0.74, feather = Math.max(W, H) * 0.3;
    const D = Math.max(Math.hypot(o.x, o.y), Math.hypot(W - o.x, o.y), Math.hypot(o.x, H - o.y), Math.hypot(W - o.x, H - o.y));
    const front = p * (D + feather);
    ictx.clearRect(0, 0, W, H); ictx.fillStyle = "#fff"; ictx.beginPath();
    for (let y = step / 2; y < H + step; y += step) for (let x = step / 2; x < W + step; x += step) {
      const k = ease(clamp((front - Math.hypot(x - o.x, y - o.y)) / feather));
      const r = maxR * (grow ? k : 1 - k);
      if (r < 0.4) continue;
      ictx.moveTo(x + r, y); ictx.arc(x, y, r, 0, 6.2832);
    }
    ictx.fill();
  }
  let leaving = false;
  async function leave(url, origin) {
    if (leaving) return; leaving = true;
    store.set({ x: origin.x / W, y: origin.y / H, from: section, t: Date.now() });
    if (reduced) { location.href = url; return; }
    root.classList.add("busy");
    prefetch(url);
    const t = setTimeout(() => { location.href = url; }, 900); // if animation frames are throttled
    await tween(520, p => drawIris(origin, p, true));
    clearTimeout(t); location.href = url;
  }
  async function arrive() {
    const s = store.get(); store.clear();
    if (!root.classList.contains("arriving")) return;
    if (!s || Date.now() - s.t > 6000 || reduced) { root.classList.remove("arriving"); return; }
    let o = { x: s.x * W, y: s.y * H };
    if (page === "home" && s.from) { const w = wordCenter(s.from); if (w) o = w; }
    drawIris(o, 1, true);
    root.classList.remove("arriving");
    const safety = setTimeout(() => ictx.clearRect(0, 0, W, H), 2000);
    await new Promise(r => setTimeout(r, 40));
    await tween(680, p => drawIris(o, p, false));
    clearTimeout(safety); ictx.clearRect(0, 0, W, H);
  }
  addEventListener("pageshow", e => { if (e.persisted) { leaving = false; root.classList.remove("busy", "arriving"); ictx.clearRect(0, 0, W, H); } });

  const sameSite = a => a.origin === location.origin && !a.hasAttribute("download") && a.target !== "_blank" &&
    !(a.pathname === location.pathname && a.hash) && !a.href.startsWith("mailto:");
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !sameSite(a)) return;
    e.preventDefault();
    let o;
    if (e.detail === 0 || (!e.clientX && !e.clientY)) { const r = a.getBoundingClientRect(); o = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    else o = { x: e.clientX, y: e.clientY };
    leave(a.href, o);
  });
  const prefetched = new Set();
  function prefetch(url) {
    if (prefetched.has(url)) return; prefetched.add(url);
    const l = document.createElement("link"); l.rel = "prefetch"; l.href = url; document.head.appendChild(l);
  }
  ["pointerenter", "focusin", "touchstart"].forEach(ev => document.addEventListener(ev, e => {
    const a = e.target.closest && e.target.closest("a[href]"); if (a && sameSite(a)) prefetch(a.href);
  }, { capture: true, passive: true }));
  addEventListener("keydown", e => {
    if (e.key !== "Escape" || page === "home" || e.target.closest("input,textarea")) return;
    const up = page === "case" ? "/work/" : "/";
    leave(new URL(up, location.href).href, { x: W / 2, y: H / 2 });
  });

  /* ================= page titles: letters rise in ================= */
  $$(".page-title").forEach(h => {
    if (reduced) return;
    const text = h.textContent; h.setAttribute("aria-label", text);
    let i = 0;
    const escc = ch => ch.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    h.innerHTML = text.split(" ").map(w => `<span class="w" aria-hidden="true">${[...w].map(ch => `<span class="ch" style="--i:${i++}">${escc(ch)}</span>`).join("")}</span>`).join(" ");
    if (root.classList.contains("arriving")) h.classList.add("late");
  });

  /* ================= pointer ================= */
  const ptr = { x: W / 2, y: H / 2, has: false };
  addEventListener("pointermove", e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true; onPointer(e); }, { passive: true });
  let onPointer = () => { };

  /* ================= home: the menu words as particle text around the face ================= */
  let words = [], face = null, wordCenter = () => null;
  if (page === "home") initHome();

  function initHome() {
    const frame = $("#being"), nav = $(".words"), menuC = $("#menu"), hit = $("#wordHit");
    const idxLinks = $$(".idx a");
    words = $$(".word").map((el, i) => ({
      el, i, id: el.dataset.id, href: el.href,
      label: (el.childNodes[0] && el.childNodes[0].textContent || el.textContent).trim(),
      x: 0, y: 0, tx: 0, ty: 0, w: 0, h: 0, gw: 0, gh: 0, pts: null
    }));
    const fallback = () => {
      const s = Math.min(W * 0.42, H * 0.5);
      return { x: W / 2 - s * 0.42, y: H * 0.47 - s * 0.62, w: s * 0.84, h: s * 1.1 };
    };
    face = fallback();
    let haveFace = false;
    addEventListener("message", e => {
      if (e.origin !== location.origin || !e.data || typeof e.data !== "object") return;
      const d = e.data;
      if (d.type === "oeuvre-face" && [d.x, d.y, d.w, d.h].every(Number.isFinite) && d.w > 10 && d.h > 10) {
        // the frame fills the viewport, so its CSS pixels are ours
        face = { x: d.x, y: d.y, w: d.w, h: d.h }; if (!haveFace) body.setAttribute("data-face", "live"); haveFace = true;
      }
    });
    const post = msg => { try { frame.contentWindow.postMessage(msg, location.origin); } catch (_) { } };
    onPointer = e => post({ type: "oeuvre-pointer", x: e.clientX, y: e.clientY, w: W, h: H });
    frame.addEventListener("load", () => post({ type: "oeuvre-hello", reduced }));

    const toggle = $("#indexToggle");
    toggle && toggle.addEventListener("click", () => {
      const on = body.classList.toggle("list");
      toggle.setAttribute("aria-pressed", on); toggle.textContent = on ? toggle.dataset.on : toggle.dataset.off;
      if (!on) layout(true);
    });

    /* ---- glyph sampling: each word becomes N points where the ink is ---- */
    const N = W < 860 ? 720 : 1000, SAMPLE = 240;
    const R = rng(7);
    function sampleWord(w) {
      const c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
      const font = `500 ${SAMPLE}px ${getComputedStyle(nav).fontFamily}`;
      g.font = font; const tw = Math.ceil(g.measureText(w.label).width) + 40;
      c.width = tw; c.height = Math.ceil(SAMPLE * 1.3);
      g.font = font; if ("letterSpacing" in g) g.letterSpacing = (-0.05 * SAMPLE) + "px";
      g.fillStyle = "#fff"; g.textBaseline = "top"; g.fillText(w.label, 20, SAMPLE * 0.1);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let minx = c.width, maxx = 0, miny = c.height, maxy = 0, area = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 128) {
        area++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      if (!area) { w.pts = []; w.gw = w.gh = 0.5; return; }
      const step = Math.max(2, Math.sqrt(area / (N * 1.08)));
      const out = [];
      for (let y = miny; y <= maxy; y += step) for (let x = minx; x <= maxx; x += step) {
        const px = x + (R() - 0.5) * step * 0.75, py = y + (R() - 0.5) * step * 0.75;
        const xi = Math.round(px), yi = Math.round(py);
        if (xi < 0 || yi < 0 || xi >= c.width || yi >= c.height || d[(yi * c.width + xi) * 4 + 3] <= 128) continue;
        out.push({ x: (px - minx) / SAMPLE, y: (py - miny) / SAMPLE });
      }
      // every word gets exactly N points: thin out or double up (with a nudge) so particles map 1:1
      while (out.length > N) out.splice(Math.floor(R() * out.length), 1);
      const base = out.length;
      while (out.length < N && base) { const o = out[Math.floor(R() * base)]; out.push({ x: o.x + (R() - 0.5) * 0.012, y: o.y + (R() - 0.5) * 0.012 }); }
      // left-to-right order so a flight between two words reads as a flow, not a shuffle
      out.sort((a, b) => (a.x + a.y * 0.15) - (b.x + b.y * 0.15));
      w.pts = out; w.gw = (maxx - minx + 1) / SAMPLE; w.gh = (maxy - miny + 1) / SAMPLE;
    }
    // per-particle character: size, breathing phase, flight detour, a few strays
    const P = Array.from({ length: N }, (_, i) => ({
      r: 0.7 + R() * 0.7, ph: R() * 6.283, f: 0.6 + R() * 0.9, d: R(),
      dx: (R() - 0.5) * 2, dy: (R() - 0.5) * 2, stray: R() < 0.045, sa: 0.5 + R() * 1.5, sb: R() * 6.283
    }));
    const sampleAll = () => words.forEach(sampleWord);

    /* ---- where each word wants to be, given the face box ---- */
    let fs = 60;
    function layout(snap) {
      if (body.classList.contains("list")) return;
      const g = Math.max(16, W * 0.02), top = 74, bottom = H - 70;
      const wide = W >= 860;
      // The face box runs crown-to-chin, ear-to-ear; the figure's hair reaches past it, so keep
      // words a hair-margin away (sides on wide screens, above the crown on phones).
      const hairX = face.w * 0.2, hairY = face.h * 0.13;
      const room = Math.max(0, face.y - hairY - 6 - top);
      fs = wide ? clamp(W * 0.075, 40, 138) : clamp(Math.min(W * 0.135, room / 4 / 0.92), 28, 72);
      nav.style.setProperty("--fs", fs + "px");
      words.forEach(w => { w.w = w.gw * fs; w.h = w.gh * fs; });
      const f = face;
      words.forEach(w => {
        const left = w.i % 2 === 0, upper = w.i < 2;
        let x, y;
        if (wide) {
          x = left ? f.x - hairX - g - w.w : f.x + f.w + hairX + g;
          if (x < g) x = g; if (x + w.w > W - g) x = W - g - w.w;
          y = upper ? f.y + f.h * (left ? 0.02 : 0.28) - w.h / 2 : f.y + f.h * (left ? 0.72 : 1.0) - w.h / 2;
        } else {
          // phones: all four words above the face, staggered left/right; the band under the face
          // belongs to the figure's talk control
          x = left ? g : W - g - w.w;
          const lo = top, hi = Math.max(top + 4 * w.h * 0.95, f.y - hairY - 6);
          y = lo + (hi - lo - w.h) * (w.i / 3);
        }
        y = clamp(y, top, bottom - w.h);
        w.tx = x; w.ty = y;
        if (snap || !w.placed) { w.x = x; w.y = y; w.placed = true; }
      });
      nav.classList.add("placed");
    }

    /* ---- the cycle: one word holds, then its dots fly into the next ---- */
    const HOLD = 4000, FLY = reduced ? 700 : 1500;
    let cur = 0, nxt = -1, flyT0 = 0, holdT0 = performance.now(), pending = -1;
    let paused = 0, focused = -1, sharp = 0, pos = P.map(() => ({ x: 0, y: 0 }));
    let mctx = fit(menuC);
    const goTo = k => { if (k === cur || k < 0) return; if (nxt >= 0) { pending = k; return; } nxt = k; flyT0 = performance.now(); };
    // hover / touch pauses and sharpens; the hit link navigates (the site-wide click handler runs the iris)
    hit.addEventListener("pointerenter", () => { paused |= 1; });
    hit.addEventListener("pointerleave", () => { paused &= ~1; });
    hit.addEventListener("touchstart", () => { paused |= 1; setTimeout(() => { paused &= ~1; }, 2500); }, { passive: true });
    // keyboard: focusing a hidden word link brings that word in and holds it
    nav.addEventListener("focusin", e => { const a = e.target.closest(".word"); if (!a) return; focused = +a.dataset.i; paused |= 2; goTo(focused); });
    nav.addEventListener("focusout", () => { focused = -1; paused &= ~2; });
    // the tiny index previews a word on hover/focus and navigates on click
    idxLinks.forEach(a => {
      const k = +a.dataset.i;
      a.addEventListener("pointerenter", () => { paused |= 4; goTo(k); });
      a.addEventListener("pointerleave", () => { paused &= ~4; });
      a.addEventListener("focus", () => { paused |= 4; goTo(k); });
      a.addEventListener("blur", () => { paused &= ~4; });
    });
    const setCurrent = k => {
      cur = k; holdT0 = performance.now();
      hit.href = words[k].href; hit.setAttribute("aria-label", words[k].label);
      idxLinks.forEach(a => { +a.dataset.i === k ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"); });
    };
    setCurrent(0);

    const target = (w, i, t, par) => {
      const p = w.pts[i], q = P[i];
      let x = w.x + p.x * fs + par.x, y = w.y + p.y * fs + par.y;
      if (!reduced) {
        const j = (1 - sharp * 0.85) * fs * 0.012;          // breathing
        x += Math.sin(t * 0.0011 * q.f + q.ph) * j; y += Math.cos(t * 0.0009 * q.f + q.ph * 1.3) * j;
        if (q.stray) {                                        // a few dots drift loose around the word
          const a = fs * 0.22 * q.sa * (1 - sharp * 0.7);
          x += Math.sin(t * 0.00025 * q.f + q.sb) * a; y += Math.cos(t * 0.0002 * q.f + q.sb * 2.1) * a * 0.6;
        }
      }
      return [x, y];
    };
    function drawWord(w, t, par, alpha, k) {
      // k: 0..1 flight progress for crossfade/flight; here draws the word at rest
      mctx.globalAlpha = alpha; mctx.beginPath();
      const rs = (1.3 + 0.3 * sharp) * clamp(fs / 70, 0.7, 1.6);
      for (let i = 0; i < N; i++) {
        const [x, y] = target(w, i, t, par); pos[i].x = x; pos[i].y = y;
        const r = P[i].r * rs * (P[i].stray ? 0.75 : 1);
        mctx.moveTo(x + r, y); mctx.arc(x, y, r, 0, 6.2832);
      }
      mctx.fill();
    }
    function drawFlight(a, b, t, par, p) {
      const rs = (1.3 + 0.3 * sharp) * clamp(fs / 70, 0.7, 1.6);
      const amp = Math.min(W, H) * 0.09;
      mctx.beginPath(); mctx.globalAlpha = 1;
      for (let i = 0; i < N; i++) {
        const q = P[i];
        // each dot leaves on its own cue, so the old word frays before the new one gathers
        const k = ease(clamp((p - q.d * 0.4) / 0.6));
        const [ax, ay] = target(a, i, t, par), [bx, by] = target(b, i, t, par);
        const s = Math.sin(k * 3.1416);
        const x = ax + (bx - ax) * k + q.dx * amp * s, y = ay + (by - ay) * k + q.dy * amp * s * 0.7 - s * amp * 0.25;
        pos[i].x = x; pos[i].y = y;
        const r = q.r * rs * (1 - 0.35 * s) * (q.stray ? 0.75 : 1);
        mctx.moveTo(x + r, y); mctx.arc(x, y, r, 0, 6.2832);
      }
      mctx.fill();
    }
    function placeHit(w, par, on) {
      const m = Math.max(10, fs * 0.12);
      hit.style.transform = `translate3d(${(w.x + par.x - m).toFixed(1)}px, ${(w.y + par.y - m).toFixed(1)}px, 0)`;
      hit.style.width = (w.w + 2 * m).toFixed(1) + "px"; hit.style.height = (w.h + 2 * m).toFixed(1) + "px";
      hit.style.pointerEvents = on ? "auto" : "none";
    }
    if (isStatic) window.__oeuvre = { get face() { return face; }, get haveFace() { return haveFace; }, words, get current() { return cur; } };
    wordCenter = id => { const w = words.find(w => w.id === id); return w ? { x: w.x + w.w / 2, y: w.y + w.h / 2 } : null; };
    let lastFace = "", lastSize = "";
    function frameLoop(t) {
      requestAnimationFrame(frameLoop);
      const key = haveFace ? [face.x, face.y, face.w, face.h].map(v => Math.round(v / 4)).join() : "f";
      if (key !== lastFace) { lastFace = key; layout(false); }
      if (body.classList.contains("list")) { mctx.clearRect(0, 0, W, H); hit.style.pointerEvents = "none"; return; }
      const sz = W + "x" + H; if (sz !== lastSize) { lastSize = sz; mctx = fit(menuC); }
      const k = reduced ? 1 : 0.08;
      words.forEach(w => { w.x += (w.tx - w.x) * k; w.y += (w.ty - w.y) * k; });
      sharp += ((paused ? 1 : 0) - sharp) * 0.1;
      // the cycle (?static holds the first word so screenshots are deterministic)
      if (nxt < 0 && !paused && !isStatic && t - holdT0 > HOLD) goTo((cur + 1) % words.length);
      let p = 0;
      if (nxt >= 0) {
        p = clamp((t - flyT0) / FLY);
        if (p >= 1) { setCurrent(nxt); nxt = -1; if (pending >= 0 && pending !== cur) { goTo(pending); } pending = -1; }
      }
      const par = w => reduced ? { x: 0, y: 0 } : {
        x: Math.sin(t * 0.00035 + w.i * 1.7) * 6 - (ptr.x / W - 0.5) * 22 * (0.6 + 0.2 * w.i),
        y: Math.cos(t * 0.0003 + w.i * 2.3) * 5 - (ptr.y / H - 0.5) * 14 * (0.6 + 0.2 * w.i)
      };
      mctx.clearRect(0, 0, W, H); mctx.fillStyle = "#fff";
      const a = words[cur];
      if (nxt < 0) { drawWord(a, t, par(a), 0.78 + 0.22 * sharp); placeHit(a, par(a), true); }
      else {
        const b = words[nxt];
        if (reduced) { drawWord(a, t, par(a), (1 - p) * 0.9); drawWord(b, t, par(b), p * 0.9); }
        else drawFlight(a, b, t, par(a), p);
        placeHit(p < 0.5 ? a : b, par(p < 0.5 ? a : b), false);
      }
      // keyboard focus ring around the word (the link itself is visually hidden)
      if (focused === cur && nxt < 0 && words[cur].el.matches(":focus-visible")) {
        const w = words[cur], q = par(w), m = fs * 0.1;
        mctx.globalAlpha = 0.9; mctx.strokeStyle = "#fff"; mctx.lineWidth = 1.5;
        mctx.strokeRect(w.x + q.x - m, w.y + q.y - m, w.w + 2 * m, w.h + 2 * m);
      }
      mctx.globalAlpha = 1;
    }
    addEventListener("resize", () => { if (!haveFace) face = fallback(); layout(true); });
    const boot = () => { sampleAll(); layout(true); };
    boot();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
    requestAnimationFrame(frameLoop);
  }

  /* ================= halftone images ================= */
  function rng(seed) { let x = seed * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); }
  function placeholder(kind, w, h, seed) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); const R = rng(seed);
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    if (kind === "dashboard") {
      const pad = w * 0.05, cols = 3, rows = 2, gw = (w - pad * 2 - pad * 0.4 * (cols - 1)) / cols, gh = (h - pad * 2 - pad * 0.4 * (rows - 1)) / rows;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const x = pad + k * (gw + pad * 0.4), y = pad + r * (gh + pad * 0.4);
        g.fillStyle = (r + k) % 3 === 1 ? "#8a8a8a" : "#3a3a3a"; g.beginPath(); g.roundRect ? g.roundRect(x, y, gw, gh, 14) : g.rect(x, y, gw, gh); g.fill();
        g.fillStyle = "#ddd"; g.fillRect(x + 16, y + 16, gw * 0.35, 7);
        if ((r + k) % 2) { for (let b = 0; b < 6; b++) { const bh = (0.2 + R() * 0.6) * gh * 0.55; g.fillStyle = "#cfcfcf"; g.fillRect(x + 16 + b * gw * 0.14, y + gh - 16 - bh, gw * 0.08, bh); } }
        else { g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); for (let p = 0; p <= 10; p++) { const px = x + 16 + p * (gw - 32) / 10, py = y + gh * 0.45 + R() * gh * 0.4; p ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
      }
    }
    return c;
  }
  function loadImage(src) {
    return new Promise(res => { const im = new Image(); im.decoding = "async"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  // Draw an image into a w×h greyscale canvas, the same way CSS shows it (cover / contain with padding).
  function sourceFrom(im, w, h, fitMode, pad, graphic) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = graphic ? "#fff" : "#0b0b0b"; g.fillRect(0, 0, w, h);
    let sc, iw, ih;
    if (fitMode === "contain") { const bw = w * (1 - 2 * pad), bh = h * (1 - 2 * pad); sc = Math.min(bw / im.width, bh / im.height); }
    else sc = Math.max(w / im.width, h / im.height);
    iw = im.width * sc; ih = im.height * sc;
    g.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih);
    const d = g.getImageData(0, 0, w, h), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      let l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
      if (graphic) l = clamp((0.985 - l) * 25);
      px[i] = px[i + 1] = px[i + 2] = l * 255; px[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  function dots(ctx, src, w, h, step) {
    const px = src._px || (src._px = src.getContext("2d").getImageData(0, 0, w, h).data);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#fff"; ctx.beginPath();
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
      const i = ((y | 0) * w + (x | 0)) * 4, r = step * 0.56 * Math.sqrt(px[i] / 255);
      if (r > 0.3) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
    }
    ctx.fill();
  }
  async function resolve(canvas, src, w, h, keep) {
    const ctx = fit(canvas, w, h);
    const tok = (canvas._tok = (canvas._tok || 0) + 1);
    if (reduced) { ctx.drawImage(src, 0, 0, w, h); return; }
    const start = clamp(Math.min(w, h) / 40, 9, 18);
    await tween(700, p => { if (canvas._tok === tok) dots(ctx, src, w, h, start - (start - 3) * ease(p)); });
    if (keep) await tween(300, p => { if (canvas._tok !== tok) return; dots(ctx, src, w, h, 3); ctx.globalAlpha = p; ctx.drawImage(src, 0, 0, w, h); ctx.globalAlpha = 1; });
  }
  async function revealFigure(fig, i) {
    const r = fig.getBoundingClientRect(), w = Math.max(40, Math.round(r.width)), h = Math.max(40, Math.round(r.height));
    let canvas = $("canvas", fig);
    if (fig.classList.contains("ph")) { await resolve(canvas, placeholder(fig.dataset.kind, w, h, i + 1), w, h, true); return; }
    const img = $("img", fig);
    const im = await loadImage(img.currentSrc || img.src);
    if (!im) { fig.classList.add("done"); return; }
    canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true"); fig.appendChild(canvas);
    const pad = fig.classList.contains("fit-contain") ? (fig.classList.contains("hero") ? 0.04 : 0.06) : 0;
    const src = sourceFrom(im, w, h, fig.classList.contains("fit-contain") ? "contain" : "cover", pad, fig.classList.contains("graphic"));
    await resolve(canvas, src, w, h, false);
    fig.classList.add("done");
    if (!reduced) await tween(380, p => { canvas.style.opacity = 1 - p; });
    canvas.remove();
  }
  const figs = $$(".ht");
  if (figs.length) {
    const started = new Set();
    const go = f => { if (started.has(f)) return; started.add(f); revealFigure(f, figs.indexOf(f)).catch(() => f.classList.add("done")); };
    if (!("IntersectionObserver" in window)) figs.forEach(f => f.classList.add("done"));
    else {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return; io.unobserve(e.target); go(e.target);
      }), { threshold: 0.12 });
      figs.forEach(f => io.observe(f));
    }
    // the hero never waits for scrolling
    const hero = $(".ht.hero"); if (hero) setTimeout(() => go(hero), root.classList.contains("arriving") ? 500 : 150);
    // safety net: never leave a photo hidden
    setTimeout(() => figs.forEach(f => { if (!started.has(f) && f.getBoundingClientRect().top < H) go(f); }), 2500);
  }

  /* ================= work index: halftone preview follows the cursor ================= */
  const pv = $("#preview");
  if (pv) {
    const PW = 360, PH = 250; let shown = null; const cache = new Map();
    const pos = (x, y) => { pv.style.transform = `translate(${Math.min(x + 28, W - PW - 16)}px, ${clamp(y - PH / 2, 70, H - PH - 16)}px)`; };
    async function show(a, x, y) {
      if (shown === a) return; shown = a; pos(x, y); pv.classList.add("on");
      let src = cache.get(a);
      if (!src) {
        const im = await loadImage(a.dataset.src); if (!im || shown !== a) return;
        const contain = a.dataset.fit === "contain";
        src = sourceFrom(im, PW, PH, contain ? "contain" : "cover", contain ? 0.08 : 0, a.hasAttribute("data-graphic")); cache.set(a, src);
      }
      if (shown === a) resolve(pv, src, PW, PH, true);
    }
    const hide = () => { shown = null; pv.classList.remove("on"); };
    $$(".row").forEach(a => {
      a.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") show(a, e.clientX, e.clientY); });
      a.addEventListener("pointerleave", hide);
      a.addEventListener("focus", () => { if (!matchMedia("(hover: hover)").matches) return; const b = a.getBoundingClientRect(); show(a, W - PW - 60, b.top + b.height / 2); });
      a.addEventListener("blur", hide);
    });
    addEventListener("pointermove", e => { if (shown) pos(e.clientX, e.clientY); }, { passive: true });
    addEventListener("scroll", hide, { passive: true });
  }

  /* ================= studio: the statement lights up word by word ================= */
  const stmt = $(".statement-big");
  if (stmt) {
    const spans = $$("span", stmt);
    const upd = () => {
      const r = stmt.getBoundingClientRect();
      const p = reduced ? 1 : clamp((H * 0.92 - r.top) / (r.height + H * 0.3));
      const n = Math.round(p * spans.length);
      spans.forEach((s, i) => s.classList.toggle("on", i < n));
    };
    upd(); addEventListener("scroll", upd, { passive: true }); addEventListener("resize", upd);
  }

  /* ================= contact: copy + a trail of dots ================= */
  const copy = $("#copyMail");
  if (copy && navigator.clipboard) {
    copy.hidden = false;
    const label = copy.textContent;
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(copy.dataset.email); copy.textContent = copy.dataset.done; $("#live").textContent = copy.dataset.done; } catch (_) { }
      setTimeout(() => { copy.textContent = label; }, 1800);
    });
  }
  if (page === "contact" && !reduced && matchMedia("(hover: hover)").matches) {
    const c = document.createElement("canvas"); c.id = "trail"; c.setAttribute("aria-hidden", "true"); body.appendChild(c);
    let tctx = fit(c); const pts = [];
    onPointer = e => pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    addEventListener("resize", () => { tctx = fit(c); });
    const draw = now => {
      requestAnimationFrame(draw);
      while (pts.length && now - pts[0].t > 700) pts.shift();
      tctx.clearRect(0, 0, W, H); if (pts.length < 2) return;
      tctx.fillStyle = "#fff"; tctx.beginPath();
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 10));
        for (let k = 0; k < n; k++) {
          const r = 3.4 * (1 - (now - a.t) / 700); if (r < 0.3) continue;
          const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
          tctx.moveTo(x + r, y); tctx.arc(x, y, r, 0, 6.2832);
        }
      }
      tctx.fill();
    };
    requestAnimationFrame(draw);
  }

  /* ================= the dot cursor ================= */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !reduced) {
    const d = document.createElement("div"); d.className = "dot-cursor"; d.setAttribute("aria-hidden", "true"); body.appendChild(d);
    let cx = -50, cy = -50, tx = -50, ty = -50;
    addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; d.classList.add("on"); }, { passive: true });
    document.addEventListener("pointerleave", () => d.classList.remove("on"));
    const fr = $("#being"); if (fr) fr.addEventListener("pointerenter", () => d.classList.remove("on"));
    addEventListener("pointerdown", () => d.classList.add("down")); addEventListener("pointerup", () => d.classList.remove("down"));
    document.addEventListener("pointerover", e => d.classList.toggle("big", !!(e.target.closest && e.target.closest("a,button,summary"))));
    const step = () => { cx += (tx - cx) * 0.25; cy += (ty - cy) * 0.25; d.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ================= resize + arrive ================= */
  addEventListener("resize", () => { W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); ictx = fit(irisC); });
  arrive();
})();
