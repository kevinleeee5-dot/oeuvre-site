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

  /* ================= home: the menu words as streaks in a flow field, over the figure ================= */
  let words = [], face = null, wordCenter = () => null;
  if (page === "home") initHome();

  function initHome() {
    const frame = $("#being"), nav = $(".words"), menuC = $("#menu"), hit = $("#wordHit");
    words = $$(".word").map((el, i) => ({
      el, i, id: el.dataset.id, href: el.href,
      label: (el.childNodes[0] && el.childNodes[0].textContent || el.textContent).trim(),
      gw: 0, gh: 0, pts: null
    }));
    const fallback = () => {
      const s = Math.min(W * 0.42, H * 0.5);
      return { x: W / 2 - s * 0.42, y: H * 0.47 - s * 0.62, w: s * 0.84, h: s * 1.1 };
    };
    face = fallback();
    // the figure's conversation panel (a column on the right; on phones and portrait screens a bottom sheet, or its 'Talk' pill):
    // the words keep out of it. Until the figure says where it is, the column's usual place
    const compact = () => W < 700 || W / H < 0.8;
    const fallbackPanel = () => {
      if (compact()) return { x: W - 110, y: H - 120, w: 94, h: 44 };
      const pw = Math.min(372, Math.max(320, 0.24 * W)), g = Math.min(56, Math.max(16, 0.04 * W));
      return { x: W - g - pw, y: H / 2 - 160, w: pw, h: 320 };
    };
    let haveFace = false, panel = null, havePanel = false, hintR = null;
    const sameWin = e => { try { return e.source === frame.contentWindow; } catch (_) { return false; } };
    addEventListener("message", e => {
      if (e.origin !== location.origin || !e.data || typeof e.data !== "object" || !sameWin(e)) return;
      const d = e.data;
      if (d.type === "oeuvre-face" && [d.x, d.y, d.w, d.h].every(Number.isFinite) && d.w > 10 && d.h > 10) {
        // the frame fills the viewport, so its CSS pixels are ours
        face = { x: d.x, y: d.y, w: d.w, h: d.h }; if (!haveFace) body.setAttribute("data-face", "live"); haveFace = true;
        if (sound) sound.state(d.state);
      } else if (d.type === "oeuvre-panel" && [d.x, d.y, d.w, d.h].every(Number.isFinite) && d.w >= 0 && d.h >= 0) {
        panel = { x: d.x, y: d.y, w: d.w, h: d.h }; havePanel = true;
        const hn = d.hint; hintR = hn && [hn.x, hn.y, hn.w, hn.h].every(Number.isFinite) && hn.w > 0 && hn.h > 0 ? { x: hn.x - 16, y: hn.y - 12, w: hn.w + 32, h: hn.h + 24 } : null;   // the first-visit hint: words keep out of it too
        body.classList.toggle("sheet-open", !!(d.sheet && d.open));
        if (pl && !isStatic && overlaps(pl, band())) show(cur, true);               // the panel grew over the word: it moves (same moment in its cycle)
      } else if (d.type === "oeuvre-ready") {
        if (!haveFace) { body.setAttribute("data-face", "live"); haveFace = true; }   // fallback: the first face box may come a frame later
      } else if (d.type === "oeuvre-nav" && typeof d.href === "string") {
        // an action chip in the conversation ('Open Work ->'): only the menu's own sections, through the iris from the chip
        const a = words.find(w => new URL(w.href, location.href).pathname === d.href);
        if (!a) return;
        const o = Number.isFinite(d.x) && Number.isFinite(d.y) ? { x: d.x, y: d.y } : { x: W / 2, y: H / 2 };
        leave(new URL(d.href, location.href).href, o);
      }
    });
    const post = msg => { try { frame.contentWindow.postMessage(msg, location.origin); } catch (_) { } };
    onPointer = e => post({ type: "oeuvre-pointer", x: e.clientX, y: e.clientY, w: W, h: H });
    frame.addEventListener("load", () => { post({ type: "oeuvre-hello", reduced }); postKb(); });
    // the on-screen keyboard: the figure's sheet rides above it (the frame's own viewport doesn't shrink)
    const vv = window.visualViewport;
    // the browser's bottom bar (iOS Safari floats it over the page): the page is drawn full height (lvh) under it, and this is how much of
    // the bottom it covers (lvh - svh), so text and the sheet stay above it while the picture runs to the very bottom of the screen
    const probe = (u) => { const d = document.createElement("div"); d.style.cssText = `position:fixed;left:0;top:0;width:0;height:100${u};visibility:hidden;pointer-events:none`; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; };
    let bar = 0;
    const measureBar = () => { bar = Math.max(0, Math.min(200, probe("lvh") - probe("svh"))); root.style.setProperty("--bar", bar + "px"); };
    measureBar();
    const postKb = () => { measureBar(); if (vv) post({ type: "oeuvre-viewport", kb: Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)), bar }); };
    if (vv) { vv.addEventListener("resize", postKb); vv.addEventListener("scroll", postKb); }
    addEventListener("resize", postKb);

    /* ---- sound: a gapless ambient loop (Web Audio, so there is no join) that starts by itself, plus a quiet pentatonic
       glass note as the pointer travels. Browsers only let a page make sound after a first click, tap or key, so the loop is
       loaded and armed at once and begins the moment that happens (or at once where the browser already allows it) ---- */
    const sound = (() => {
      const btn = $("#soundToggle"), AC = window.AudioContext || window.webkitAudioContext;
      if (!btn || !AC) { body.classList.add("no-audio"); window.__oeuvreSound = null; return null; }
      const FULL = 0.5, DUCK = 0.16, KEY = "oeuvre-sound-off";
      const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
      const URL_ = "/assets/audio/ambient." + (safari ? "m4a" : "mp3");
      let ctx = null, master = null, amb = null, fx = null, buf = null, src = null, loading = false, on = false, ducked = false;
      let userOff = false; try { userOff = localStorage.getItem(KEY) === "1"; } catch (_) { }
      const label = () => { btn.setAttribute("aria-pressed", on); btn.setAttribute("aria-label", on ? btn.dataset.on : btn.dataset.off); };
      const ensure = () => {
        if (ctx) return ctx;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
        amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
        fx = ctx.createGain(); fx.gain.value = 1;                                   // the pointer's bus: dry + a soft echo
        const dl = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
        dl.delayTime.value = 0.36; fb.gain.value = 0.42; lp.type = "lowpass"; lp.frequency.value = 2400; wet.gain.value = 0.55;
        fx.connect(master); fx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
        return ctx;
      };
      const level = v => { if (!ctx) return; amb.gain.cancelScheduledValues(ctx.currentTime); amb.gain.setTargetAtTime(v, ctx.currentTime, 1.1); };
      const load = () => {
        if (buf || loading) return; loading = true;
        fetch(URL_).then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no))).then(b => {
          buf = b; loading = false; if (!on || src) return;
          src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(amb); src.start(0); level(ducked ? DUCK : FULL);
        }).catch(() => { loading = false; });
      };
      const resume = () => { if (ctx && ctx.state === "suspended" && on) ctx.resume().catch(() => { }); };
      const start = () => { on = true; label(); ensure(); load(); if (src) level(ducked ? DUCK : FULL); resume(); try { localStorage.removeItem(KEY); } catch (_) { } };
      const stop = () => { on = false; label(); level(0); try { localStorage.setItem(KEY, "1"); } catch (_) { } };
      btn.addEventListener("click", () => on ? stop() : start());
      document.addEventListener("visibilitychange", () => { if (!ctx || !on) return; if (document.hidden) ctx.suspend().catch(() => { }); else resume(); });
      ["pointerdown", "keydown", "touchend", "click"].forEach(t => addEventListener(t, resume, { capture: true, passive: true }));
      /* the pointer's voice: a bell note for each stretch of travel, pitch from height, pan from the side, louder when quicker */
      const SC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
      let acc = 0, lt = 0, lx = null, ly = null, lastNote = 0;
      const bell = (x, y, vel, low) => {
        if (!on || !ctx || ctx.state !== "running") return;
        const t = ctx.currentTime, i = Math.max(0, Math.min(SC.length - 1, Math.floor((1 - y / H) * SC.length)));
        const f = (low ? 110 : 261.63) * Math.pow(2, SC[i] / 12) * (low ? 1 : 1);
        const g = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o1.type = "sine"; o1.frequency.value = f; o2.type = "triangle"; o2.frequency.value = f * 2.76; g2.gain.value = 0.18;   // an inharmonic partial: glass
        o1.connect(g); o2.connect(g2); g2.connect(g);
        const peak = 0.05 * vel * (ducked ? 0.35 : 1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.5 : 1.5));
        if (pn) { pn.pan.value = Math.max(-0.85, Math.min(0.85, (x / W) * 2 - 1)); g.connect(pn); pn.connect(fx); } else g.connect(fx);
        o1.start(t); o2.start(t); o1.stop(t + 1.7); o2.stop(t + 1.7);
      };
      /* a mechanical keyboard: a short noise 'tick' through a band-pass, a low 'thock' that falls in pitch, and a tiny bright click.
         Space and Enter are deeper, Backspace lighter, the key-up a faint release. */
      let nbuf = null;
      const noise = () => { if (nbuf) return nbuf; nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nbuf; };
      const keyClick = (kind, up) => {
        if (!on || !ctx || ctx.state !== "running") return;
        const t = ctx.currentTime, heavy = kind === "space" || kind === "enter", back = kind === "back", duck = ducked ? 0.35 : 1, j = 0.92 + Math.random() * 0.16;
        const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pn) { pn.pan.value = (Math.random() - 0.5) * 0.3; pn.connect(master); }
        const out = pn || master;
        const ns = ctx.createBufferSource(); ns.buffer = noise();
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = (up ? 5200 : heavy ? 2600 : back ? 3400 : 3900) * j; bp.Q.value = 2.4;
        const ng = ctx.createGain(); const np = (up ? 0.05 : heavy ? 0.34 : back ? 0.26 : 0.3) * duck;
        ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(np, t + 0.0007); ng.gain.exponentialRampToValueAtTime(0.0001, t + (up ? 0.009 : 0.016));
        ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t, Math.random() * 0.03, 0.04);
        if (!up) {
          // a short, high "tock" for the switch bottoming out, and a lighter tick a hair later for the keycap
          const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "triangle";
          const f0 = (heavy ? 330 : back ? 460 : 520) * j; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.03);
          og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime((heavy ? 0.1 : 0.07) * duck, t + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.06 : 0.04));
          o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.08);
          const t2 = t + (heavy ? 0.016 : 0.011), ns2 = ctx.createBufferSource(); ns2.buffer = noise();
          const b2 = ctx.createBiquadFilter(); b2.type = "bandpass"; b2.frequency.value = 6200 * j; b2.Q.value = 3;
          const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t2); g2.gain.exponentialRampToValueAtTime(0.12 * duck, t2 + 0.0006); g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.008);
          ns2.connect(b2); b2.connect(g2); g2.connect(out); ns2.start(t2, Math.random() * 0.03, 0.03);
        }
      };
      window.__oeuvreSound = {
        key: keyClick,
        move(x, y) {
          const now = performance.now();
          if (lx !== null) { const d = Math.hypot(x - lx, y - ly); acc += d; const dt = Math.max(8, now - lt), sp = d / dt;
            if (acc > 120 && now - lastNote > 80) { acc = 0; lastNote = now; bell(x, y, Math.max(0.25, Math.min(1, sp / 2.2)), false); } }
          lx = x; ly = y; lt = now;
        },
        click(x, y) { bell(x, y, 0.9, true); },
      };
      if (!userOff) start(); else label();
      return { state(s) { const d = s === "speaking" || s === "listening" || s === "thinking"; if (d === ducked) return; ducked = d; if (on) level(d ? DUCK : FULL); } };
    })();


    const toggle = $("#indexToggle");
    // the list opens word by word and closes the same way, then the floating word comes back
    words.forEach((w, i) => w.el.style.setProperty("--i", i));
    let listTimer = 0;
    // the button keeps one width (its longest label), so the sound waves beside it never move
    if (toggle) {
      const fitToggle = () => {
        toggle.style.width = ""; let w = 0; const now = toggle.textContent;
        for (const t of [toggle.dataset.on, toggle.dataset.off]) { if (!t) continue; toggle.textContent = t; w = Math.max(w, toggle.getBoundingClientRect().width); }
        toggle.textContent = now; toggle.style.width = Math.ceil(w) + "px";
      };
      fitToggle();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitToggle);
      addEventListener("resize", fitToggle);
    }
    toggle && toggle.addEventListener("click", () => {
      const on = !body.classList.contains("list") || body.classList.contains("list-out");
      clearTimeout(listTimer);
      toggle.setAttribute("aria-pressed", on); toggle.textContent = on ? toggle.dataset.on : toggle.dataset.off;
      if (on) {
        body.classList.remove("list-out"); body.classList.add("list", "list-in");
        listTimer = setTimeout(() => body.classList.remove("list-in"), 1200);
        useList(true); attachToList(cur);
      } else {
        setListHover(-1); attachUntil = 0;
        body.classList.remove("list-in"); body.classList.add("list-out");
        listTimer = setTimeout(() => { body.classList.remove("list", "list-out"); listVis = 0; listC = 0; menuC.style.opacity = ""; useList(false); layout(true); }, reduced ? 0 : 620);
      }
    });

    /* ---- glyph sampling: each word becomes a cloud of points where the ink is (unit = font size) ---- */
    const N = W < 860 ? 1400 : W < 1800 ? 2600 : 3400, SAMPLE = 200, NS = 3600;
    let R = isStatic ? rng(7) : Math.random;
    // one glyph cloud for a text in a given font: points (unit = font size), ink size, and where the ink starts in the text box
    function sampleText(text, font, track) {
      const c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
      g.font = font; const tw = Math.ceil(g.measureText(text).width) + 40;
      c.width = tw; c.height = Math.ceil(SAMPLE * 1.3);
      g.font = font; if ("letterSpacing" in g) g.letterSpacing = (track * SAMPLE) + "px";
      g.fillStyle = "#fff"; g.textBaseline = "top"; g.fillText(text, 20, SAMPLE * 0.1);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let minx = c.width, maxx = 0, miny = c.height, maxy = 0, area = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 128) {
        area++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      const none = { pts: new Float32Array(0), gw: 0.5, gh: 0.5, ix: 0, iy: 0 };
      if (!area) return none;
      const step = Math.max(1.2, Math.sqrt(area / NS)), out = [];
      for (let y = miny; y <= maxy; y += step) for (let x = minx; x <= maxx; x += step) {
        const xi = Math.round(x), yi = Math.round(y);
        if (d[(yi * c.width + xi) * 4 + 3] > 128) out.push((x - minx) / SAMPLE, (y - miny) / SAMPLE);
      }
      const gw = (maxx - minx + 1) / SAMPLE, gh = (maxy - miny + 1) / SAMPLE;
      if (!(gw > 0 && gh > 0)) return none;
      return { pts: Float32Array.from(out), gw, gh, ix: (minx - 20) / SAMPLE, iy: (miny - SAMPLE * 0.1) / SAMPLE };
    }
    // each word has a list shape (its own text, in the list's font) and a floating shape: on the Chinese home the
    // floating words stay English (data-float), set like the English site; opening the list morphs one into the other
    function sampleWord(w) {
      const cs = getComputedStyle(w.el), fsz = parseFloat(cs.fontSize) || 100, lsp = parseFloat(cs.letterSpacing);
      const fam = cs.fontFamily || getComputedStyle(nav).fontFamily;
      const track = Number.isFinite(lsp) ? lsp / fsz : -0.05;
      w.L = sampleText(w.label, `${cs.fontWeight || 500} ${SAMPLE}px ${fam}`, track);
      w.F = w.el.dataset.float ? sampleText(w.el.dataset.float, `500 ${SAMPLE}px "Inter Tight", ${fam}`, -0.05) : w.L;
      useShape(w, body.classList.contains("list") ? w.L : w.F);
    }
    function useShape(w, v) { w.pts = v.pts; w.gw = v.gw; w.gh = v.gh; w.ix = v.ix; w.iy = v.iy; }
    const useList = on => words.forEach(w => { if (w.L) useShape(w, on ? w.L : w.F); });
    const sampleAll = () => words.forEach(sampleWord);

    /* ---- the particles: positions, velocities, targets (and the previous targets, for the reduced crossfade) ---- */
    const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
    const TX = new Float32Array(N), TY = new Float32Array(N), OX = new Float32Array(N), OY = new Float32Array(N), S = new Float32Array(N);
    for (let i = 0; i < N; i++) { X[i] = R() * W; Y[i] = R() * H; S[i] = R() * 6.2832; }

    /* ---- where a word lands: anywhere, at a random size, clear of the bars and the figure's conversation panel ---- */
    let fs = 60, pl = null;
    const SM = 18;                                    // room for streaks and the hold's slight drift
    const gutter = () => Math.max(24, W * 0.03);
    const band = () => { const p = isStatic || !havePanel ? fallbackPanel() : panel; return { x: p.x - 28, y: p.y - 28, w: p.w + 56, h: p.h + 56 }; };   // the conversation panel
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const faceShare = (r, f) => {
      const ox = Math.max(0, Math.min(r.x + r.w, f.x + f.w) - Math.max(r.x, f.x)), oy = Math.max(0, Math.min(r.y + r.h, f.y + f.h) - Math.max(r.y, f.y));
      return ox * oy / (r.w * r.h);
    };
    function place(w, prev) {
      const g = gutter(), phone = W < 860;
      const left = g + SM, right = W - g - SM, top = Math.max(80, g) + SM, bot = H - Math.max(110, g) - SM;
      const lo = phone ? 0.2 : 0.11, hi = phone ? 0.27 : 0.19;
      const maxFs = Math.max(8, Math.min((right - left) / w.gw, (bot - top) / w.gh));
      const b = band(), f = isStatic ? fallback() : face;
      let best = null, bestScore = -1;
      for (let n = 0; n < 90; n++) {
        let s = W * (lo + R() * (hi - lo)) * (n > 45 ? 0.75 : 1);
        s = Math.min(s, maxFs);
        const ww = w.gw * s, hh = w.gh * s;
        const x = left + R() * Math.max(0, right - left - ww), y = top + R() * Math.max(0, bot - top - hh);
        const r = { x, y, w: ww, h: hh, fs: s, cx: x + ww / 2, cy: y + hh / 2 };
        const far = prev ? Math.hypot(r.cx - prev.cx, r.cy - prev.cy) : W;
        const box = { x: x - SM, y: y - SM, w: ww + 2 * SM, h: hh + 2 * SM };
        const clear = !overlaps(box, b) && !(hintR && !isStatic && overlaps(box, hintR));
        // overlapping the hair or the edge of the face is fine; covering most of the face is not (light skin
        // eats the streaks), so prefer spots where at most ~15% of the word sits on the face box
        const score = (clear ? 2 : 0) + (faceShare(r, f) <= 0.15 ? 1 : 0) + Math.min(1, far / (W * 0.25));
        if (score >= 4) return r;
        if (score > bestScore) { best = r; bestScore = score; }
      }
      return best;
    }
    function assign(w, p, keepOld) {
      if (!keepOld) { OX.set(TX); OY.set(TY); }
      const pts = w.pts, n = pts.length / 2;
      for (let i = 0; i < N; i++) {
        if (!n) { TX[i] = R() * W; TY[i] = R() * H; continue; }
        const j = (R() * n | 0) * 2; HI[i] = j;
        TX[i] = p.x + pts[j] * p.fs + (R() - 0.5) * 1.6; TY[i] = p.y + pts[j + 1] * p.fs + (R() - 0.5) * 1.6;
      }
    }
    const HI = new Int32Array(N);                      // each particle's current glyph point (index into w.pts)

    /* ---- the list (Index): hovering a word turns it into the same streaming ink ---- */
    let listHover = -1, listC = 0;
    function listPlace(w) {
      // the label's own text box (the number in <sup> is left out), font size from the link
      const tn = w.el.childNodes[0]; if (!tn) return null;
      const rg = document.createRange(); rg.selectNodeContents(tn); const r = rg.getBoundingClientRect();
      const f = parseFloat(getComputedStyle(w.el).fontSize) || 60;
      // the canvas sample put the text's top at 0.1 em; the DOM line box is taller than the font size, so centre the ink
      const top = r.top + (r.height - f * 1.21) / 2;   // content-area top
      // while the line is still rising in, leave out its animated offset: the ink goes where the line will settle
      const tr = (getComputedStyle(w.el).translate || "").split(" "), ty = tr.length > 1 ? parseFloat(tr[1]) || 0 : 0;
      const x = r.left + w.ix * f, y = top - ty + (w.iy + 0.1) * f;
      return { x, y, w: w.gw * f, h: w.gh * f, fs: f, cx: x + w.gw * f / 2, cy: y + w.gh * f / 2 };
    }
    function setListHover(k) {
      if (k === listHover) return;
      if (listHover >= 0) words[listHover].el.classList.remove("lit");
      listHover = k;
      if (k < 0 || reduced || !words[k].pts) return;
      words[k].el.classList.add("lit"); attachUntil = 0;
      cur = k; pl = listPlace(words[k]); if (!pl) return;
      fs = pl.fs; assign(words[k], pl);
    }
    // opening the list: the floating word's ink flies onto its own line and fades out there
    let attachUntil = 0, listVis = 0;
    function attachToList(k) {
      if (reduced || !words[k] || !words[k].pts) return;
      const p = listPlace(words[k]); if (!p) return;
      cur = k; pl = p; fs = p.fs; assign(words[k], p); listC = 1; listVis = 1;
      attachUntil = performance.now() + 1300;
      // the lines are still rising into place: when they have settled, shift the targets by however far this one moved
      setTimeout(() => {
        if (listHover >= 0 || !body.classList.contains("list")) return;
        const q = listPlace(words[k]); if (!q) return;
        const dx = q.x - p.x, dy = q.y - p.y;
        for (let i = 0; i < N; i++) { TX[i] += dx; TY[i] += dy; }
        pl = q;
      }, 1000);
    }
    words.forEach((w, i) => {
      w.el.addEventListener("pointerenter", () => { if (body.classList.contains("list") && !body.classList.contains("list-out")) setListHover(i); });
      w.el.addEventListener("pointerleave", () => { if (listHover === i) setListHover(-1); });
      w.el.addEventListener("focus", () => { if (body.classList.contains("list")) setListHover(i); });
      w.el.addEventListener("blur", () => { if (listHover === i) setListHover(-1); });
    });
    addEventListener("scroll", () => { if (listHover >= 0) { const p = listPlace(words[listHover]); if (p) { pl = p; assign(words[listHover], pl); } } }, { passive: true });

    /* ---- the cycle: gather → hold → dissolve → drift, then the next word somewhere else ---- */
    const GATHER = 2200, HOLD = 3600, DISSOLVE = 1600, DRIFT = 500, HOLD_END = GATHER + HOLD, CYCLE = HOLD_END + DISSOLVE + DRIFT;
    const RHOLD = 4800, XFADE = 700;                  // reduced motion: hold, then a 700 ms crossfade
    let cur = 0, tw = 0, xf = 1, paused = 0, focused = -1, sharp = 0;
    let mctx = fit(menuC);
    const sin2 = k => { const s = Math.sin(clamp(k) * Math.PI / 2); return s * s; };
    const clearness = () => tw < GATHER ? sin2(tw / GATHER) : tw < HOLD_END ? 1 : 1 - sin2((tw - HOLD_END) / DISSOLVE);
    function show(k, keepTime) {
      if (!words[k].pts) return;
      const prev = pl;
      const np = place(words[k], prev);
      if (!np || !Number.isFinite(np.x + np.y + np.fs)) return;      // fonts not measured yet: wait for the next boot
      cur = k; pl = np; assign(words[k], pl);
      if (!keepTime) { tw = 0; xf = prev ? 0 : 1; }
      fs = pl.fs; nav.style.setProperty("--fs", fs + "px");
      hit.href = words[k].href; hit.setAttribute("aria-label", words[k].label);
    }
    // asking for a word: it gathers at a new random place, unless it is already the legible one
    const goTo = k => { if (k < 0 || !pl) return; if (k === cur && tw < HOLD_END) return; show(k); };
    function layout() { if (!body.classList.contains("list") && pl) show(cur); }
    // hover / touch pauses and sharpens; the hit link navigates (the site-wide click handler runs the iris)
    hit.addEventListener("pointerenter", () => { paused |= 1; });
    hit.addEventListener("pointerleave", () => { paused &= ~1; });
    hit.addEventListener("touchstart", () => { paused |= 1; setTimeout(() => { paused &= ~1; }, 2500); }, { passive: true });
    // keyboard: focusing a hidden word link brings that word in and holds it
    nav.addEventListener("focusin", e => { const a = e.target.closest(".word"); if (!a) return; focused = +a.dataset.i; paused |= 2; goTo(focused); });
    nav.addEventListener("focusout", () => { focused = -1; paused &= ~2; });
    // a click on the word's box but not on its ink, where the box lies over the face or neck, belongs to the figure
    // (touching the person changes the face): forward it instead of navigating
    const nearPerson = () => { const f = isStatic ? fallback() : face; return { x: f.x - f.w * 0.15, y: f.y, w: f.w * 1.3, h: f.h * 1.7 }; };
    function onInk(x, y) {
      const w = words[cur], pts = w && w.pts; if (!pts || !pl) return true;
      const u = (x - pl.x) / pl.fs, v = (y - pl.y) / pl.fs, r = Math.max(16, pl.fs * 0.18) / pl.fs, r2 = r * r;
      for (let j = 0; j < pts.length; j += 2) { const du = pts[j] - u, dv = pts[j + 1] - v; if (du * du + dv * dv < r2) return true; }
      return false;
    }
    hit.addEventListener("click", e => {
      if (e.detail === 0 || !pl || !overlaps(pl, nearPerson()) || onInk(e.clientX, e.clientY)) return;   // keyboard clicks and ink navigate
      e.preventDefault(); e.stopPropagation();
      post({ type: "oeuvre-touch", x: e.clientX, y: e.clientY });
    });
    hit.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      hit.style.cursor = !pl || !overlaps(pl, nearPerson()) || onInk(e.clientX, e.clientY) ? "pointer" : "default";
    }, { passive: true });
    // 'N' for the next face, wherever the focus is on the page (the figure also listens inside its own frame)
    addEventListener("keydown", e => {
      if ((e.key !== "n" && e.key !== "N") || e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return;
      const t = e.target; if (t && t.closest && (t.closest("input,textarea,select,[contenteditable]") || t.isContentEditable)) return;
      post({ type: "oeuvre-next" });
    });

    function placeHit(on) {
      const m = Math.max(10, fs * 0.12);
      hit.style.transform = `translate3d(${(pl.x - m).toFixed(1)}px, ${(pl.y - m).toFixed(1)}px, 0)`;
      hit.style.width = (pl.w + 2 * m).toFixed(1) + "px"; hit.style.height = (pl.h + 2 * m).toFixed(1) + "px";
      hit.style.pointerEvents = on ? "auto" : "none";
    }
    // one short mark per particle along the flow field, every ninth a bright grain
    function marks(tx, ty, alpha) {
      mctx.globalCompositeOperation = "lighter"; mctx.lineWidth = 1;
      for (let pass = 0; pass < 2; pass++) {
        mctx.strokeStyle = pass ? `rgba(255,255,255,${0.9 * alpha})` : `rgba(242,242,238,${0.4 * alpha})`; mctx.beginPath();
        for (let j = 0; j < N; j++) {
          if ((j % 9 === 0) !== (pass === 1)) continue;
          const a = Math.sin(tx[j] * 0.0021 + S[j] * 0.3) * 2.4 + Math.cos(ty[j] * 0.0027) * 2.4, l = 2.2;
          mctx.moveTo(tx[j] - Math.cos(a) * l, ty[j] - Math.sin(a) * l); mctx.lineTo(tx[j] + Math.cos(a) * l, ty[j] + Math.sin(a) * l);
        }
        mctx.stroke();
      }
      mctx.globalCompositeOperation = "source-over";
    }
    function step(c, calm) {
      const ts = performance.now() * 0.001;
      // a soft pull (no spring snap) against a flow that never stops, so a legible word is still streaming
      const nf = (0.28 - 0.19 * c) * (1 - 0.35 * sharp * c), k = 0.002 + 0.034 * c, damp = 0.9 - 0.22 * c;   // damping rises with the pull: it settles, never bounces
      const stir = ptr.has && !calm, px = ptr.x, py = ptr.y;   // in the list the pointer leaves the letters alone
      // while a word is up, a trickle of particles keeps leaving for another part of the letters
      const w = words[cur], pts = w && w.pts, n = pts ? pts.length / 2 : 0;
      if (n && pl && c > 0.25) {
        // the glyph points run row by row, so a step of a few indices is a short hop along a stroke: the ink keeps
        // creeping through the letters (a particle that would jump a gap between letters stays where it is)
        const m = Math.ceil(N * 0.08 * c), lim = 0.05;
        for (let q = 0; q < m; q++) {
          const i = R() * N | 0, j0 = HI[i], j = j0 + ((R() < 0.5 ? -1 : 1) * (1 + (R() * 3 | 0))) * 2;
          if (j < 0 || j >= pts.length || Math.abs(pts[j] - pts[j0]) + Math.abs(pts[j + 1] - pts[j0 + 1]) > lim) continue;
          HI[i] = j; TX[i] = pl.x + pts[j] * pl.fs + (R() - 0.5) * 1.6; TY[i] = pl.y + pts[j + 1] * pl.fs + (R() - 0.5) * 1.6;
        }
      }
      for (let i = 0; i < N; i++) {
        const x = X[i], y = Y[i];
        const a = Math.sin(x * 0.0021 + ts * 0.23 + S[i] * 0.3) * 2.4 + Math.cos(y * 0.0027 - ts * 0.17) * 2.4;
        let vx = VX[i] + Math.cos(a) * nf + (TX[i] - x) * k, vy = VY[i] + Math.sin(a) * nf + (TY[i] - y) * k;
        if (stir) {                                   // the pointer stirs nearby particles into a slight eddy
          const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
          if (d2 < 14400) { const f = (1 - d2 / 14400) * 0.35 / (Math.sqrt(d2) + 1); vx += (dx * 0.3 - dy * 0.9) * f; vy += (dy * 0.3 + dx * 0.9) * f; }
        }
        vx *= damp; vy *= damp; VX[i] = vx; VY[i] = vy; X[i] = x + vx; Y[i] = y + vy;
      }
    }
    function streaks(c) {
      // fade the last frames to transparent (the figure shows through), then add this frame's streaks
      mctx.globalCompositeOperation = "destination-out";
      mctx.fillStyle = `rgba(0,0,0,${(0.12 + 0.08 * c).toFixed(3)})`; mctx.fillRect(0, 0, W, H);
      mctx.globalCompositeOperation = "lighter"; mctx.lineWidth = 1;
      for (let pass = 0; pass < 2; pass++) {
        // the faint ink brightens a little as the word settles, so a held word reads over hair and skin
        mctx.strokeStyle = pass ? "rgba(255,255,255,.85)" : `rgba(242,242,238,${(0.22 + 0.16 * c).toFixed(3)})`; mctx.beginPath();
        for (let j = 0; j < N; j++) {
          if ((j % 9 === 0) !== (pass === 1)) continue;
          let lx = VX[j] * 3, ly = VY[j] * 3; const ln = Math.abs(lx) + Math.abs(ly);
          if (ln > 14) { lx *= 14 / ln; ly *= 14 / ln; }
          mctx.moveTo(X[j] - lx, Y[j] - ly); mctx.lineTo(X[j] + 0.9, Y[j] + 0.9);
        }
        mctx.stroke();
      }
      mctx.globalCompositeOperation = "source-over";
    }
    function focusRing() {
      if (focused !== cur || !words[cur].el.matches(":focus-visible")) return;
      const m = fs * 0.1;
      mctx.globalAlpha = 0.9; mctx.strokeStyle = "#fff"; mctx.lineWidth = 1.5;
      mctx.strokeRect(pl.x - m, pl.y - m, pl.w + 2 * m, pl.h + 2 * m); mctx.globalAlpha = 1;
    }

    if (isStatic) window.__oeuvre = { get face() { return face; }, get haveFace() { return haveFace; }, words, get current() { return cur; }, get placement() { return pl; } };
    wordCenter = () => pl ? { x: pl.cx, y: pl.cy } : null;
    let drawn = "", lastT = 0, acc = 0, lastSize = W + "x" + H, wasLive = false, wasReduced = reduced;
    // ?perf=1: the menu's own cost per frame (main thread), read from window.__menuPerf
    const perf = /[?&]perf=1\b/.test(location.search) ? (window.__menuPerf = { n: 0, sum: 0, max: 0, drawn: 0, dsum: 0, N, get avg() { return this.sum / Math.max(1, this.n); }, get avgDrawn() { return this.dsum / Math.max(1, this.drawn); } }) : null;
    function frameLoop(t) {
      requestAnimationFrame(frameLoop);
      if (document.hidden) { lastT = 0; return; }               // a hidden tab does no work (and resumes without a jump)
      const t0 = perf ? performance.now() : 0;
      const dt = Math.min(50, lastT ? t - lastT : 16.7); lastT = t;
      if (!pl) return;
      if (body.classList.contains("list")) {
        hit.style.pointerEvents = "none"; drawn = "";
        const sz2 = W + "x" + H; if (sz2 !== lastSize) { lastSize = sz2; mctx = fit(menuC); if (listHover >= 0) { const p = listPlace(words[listHover]); if (p) { pl = p; assign(words[listHover], pl); } } }
        const want = !reduced && (listHover >= 0 || t < attachUntil);
        listC += ((want ? 1 : 0) - listC) * (want ? 0.06 : 0.09);
        listVis += ((want ? 1 : 0) - listVis) * (want ? 0.15 : 0.05);       // nothing shows in the list unless a word is touched
        menuC.style.opacity = listVis.toFixed(3);
        if (!want && listVis < 0.02) { if (listVis > 0 || listC > 0) { listVis = 0; listC = 0; mctx.clearRect(0, 0, W, H); } return; }
        acc = Math.min(acc + dt, 50);
        let st = 0; while (acc >= 16.6) { acc -= 16.6; step(listC, true); st++; }
        if (st) streaks(listC);
        return;
      }
      const sz = W + "x" + H; if (sz !== lastSize) { lastSize = sz; mctx = fit(menuC); }
      // the real face box arrived: if the word sits on the panel or across the face, move it (same moment in its cycle)
      if (haveFace && !wasLive) { wasLive = true; if (!isStatic && (overlaps(pl, band()) || faceShare(pl, face) > 0.15)) show(cur, true); }
      if (reduced !== wasReduced) { wasReduced = reduced; mctx.clearRect(0, 0, W, H); for (let i = 0; i < N; i++) { X[i] = TX[i]; Y[i] = TY[i]; VX[i] = VY[i] = 0; } }
      sharp += ((paused ? 1 : 0) - sharp) * 0.08;

      if (reduced) {
        // no flow: faint static marks where the word is, crossfading 700 ms to the next (?static holds word 0)
        if (!isStatic) {
          xf = Math.min(1, xf + dt / XFADE);
          tw += dt; if (paused) tw = Math.min(tw, RHOLD - 1);
          if (tw >= RHOLD) show((cur + 1) % words.length);
        }
        // redraw only when something changed (a held word costs nothing)
        const key = [cur, xf, lastSize, pl.x, focused, focused >= 0 && words[focused].el.matches(":focus-visible")].join();
        if (key === drawn) return;
        drawn = key;
        mctx.clearRect(0, 0, W, H);
        if (xf < 1) marks(OX, OY, 1 - xf);
        marks(TX, TY, xf);
        placeHit(xf > 0.5); focusRing();
        return;
      }

      tw += dt; if (paused) tw = Math.min(tw, HOLD_END - 1);
      if (tw >= CYCLE) show((cur + 1) % words.length);
      const c = clearness();
      // physics at a steady 60 Hz whatever the display rate; nothing changes on a frame with no step
      acc = Math.min(acc + dt, 50);
      let steps = 0;
      while (acc >= 16.6) { acc -= 16.6; step(c); steps++; }
      if (steps) { streaks(c); focusRing(); }
      if (perf) { const d = performance.now() - t0; perf.n++; perf.sum += d; if (d > perf.max) perf.max = d; if (steps) { perf.drawn++; perf.dsum += d; } }
      placeHit(c > 0.35 && tw > GATHER * 0.4 && tw < HOLD_END + DISSOLVE * 0.5);
    }
    addEventListener("resize", () => {
      if (!haveFace) face = fallback();
      // re-place only when the word no longer fits (phone toolbars resize the viewport all the time)
      if (pl && (pl.x + pl.w > W - gutter() || pl.y + pl.h > H - Math.max(110, gutter()) || pl.w > W)) show(cur, true);
    });
    const boot = () => {
      sampleAll();
      if (isStatic) R = rng(7);
      if (isStatic || !pl) { pl = null; show(cur); } else show(cur, true);
      nav.classList.add("placed");
      if (reduced) xf = 1;
    };
    boot();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);

    /* ---- small business words: a quiet, always-changing cloud on the left two thirds, so a visitor sees what the studio does ---- */
    const tagsEl = $("#tags");
    if (tagsEl) {
      let list = []; try { list = JSON.parse(tagsEl.dataset.tags || "[]"); } catch (_) { }
      if (list.length) {
        const live = [], shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
        let queue = [];
        const next = () => { if (!queue.length) queue = shuf(list.slice()); return queue.pop(); };
        const area = () => { const phone = W < 700; return { l: Math.max(20, W * 0.03), r: W - Math.max(20, W * 0.03), t: Math.max(84, H * 0.1), b: H - (phone ? 150 : 120) }; };   // the whole screen
        const spot = (text, fsz) => {
          const A = area(), ww = text.length * fsz * 0.66 + 8, hh = fsz * 1.6, bnd = band(), f = isStatic ? fallback() : face;
          for (let n = 0; n < 40; n++) {
            const x = A.l + R() * Math.max(0, A.r - A.l - ww), y = A.t + R() * Math.max(0, A.b - A.t - hh);
            const r = { x: x - 10, y: y - 6, w: ww + 20, h: hh + 12 };
            if (overlaps(r, bnd) || (hintR && overlaps(r, hintR))) continue;
            if (pl && overlaps(r, { x: pl.x - 40, y: pl.y - 40, w: pl.w + 80, h: pl.h + 80 })) continue;
            if ((n < 24 || W < 700) && faceShare(r, { x: f.x - f.w * 0.1, y: f.y, w: f.w * 1.2, h: f.h * 1.1 }) > 0.02) continue;   // mostly clear of the face itself (eyes, mouth), but not always: they appear anywhere
            if (live.some(o => overlaps(r, o.r))) continue;
            return { x, y, r };
          }
          return null;
        };
        const GL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ&/+-";
        const scramble = (el, text, dir, ms, done) => {          // letters tumble in (dir 1) or out (dir -1), left to right
          const t0 = performance.now();
          const step = now => {
            const k = Math.min(1, (now - t0) / ms), settled = Math.floor((dir > 0 ? k : 1 - k) * text.length);
            let out = ""; for (let i = 0; i < text.length; i++) out += text[i] === " " || i < settled ? text[i] : GL[R() * GL.length | 0];
            el.textContent = out;
            if (k < 1) requestAnimationFrame(step); else { el.textContent = dir > 0 ? text : ""; if (done) done(); }
          };
          requestAnimationFrame(step);
        };
        const spawn = () => {
          const text = next(), dep = [0.18, 0.3, 0.45, 0.62, 0.8, 1][R() * 6 | 0], fsz = (W < 700 ? 8 : 9) * (0.85 + dep * 0.6), p = spot(text, fsz); if (!p) return;   // dep: far (small, dim, soft) to near (large, bright, sharp)
          const el = document.createElement("span"); el.className = "biz";
          el.style.cssText = `left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;font-size:${fsz.toFixed(1)}px;--o:${(0.14 + dep * 0.56).toFixed(2)}`;
          tagsEl.appendChild(el);
          const life = 5000 + R() * 5000, o = { el, r: p.r };
          live.push(o);
          scramble(el, text, 1, 650 + R() * 350);
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.setProperty("--dx", ((R() - 0.5) * (30 + dep * 60)).toFixed(1) + "px"); el.style.setProperty("--dy", ((R() - 0.5) * (18 + dep * 36)).toFixed(1) + "px");
            el.style.setProperty("--life", life + "ms"); el.classList.add("in");
          }));
          setTimeout(() => { el.classList.remove("in"); scramble(el, text, -1, 600); }, life - 900);
          setTimeout(() => { el.remove(); const k = live.indexOf(o); if (k >= 0) live.splice(k, 1); }, life + 100);
        };
        if (reduced || isStatic) {                      // a still, short list
          const stat = () => { tagsEl.textContent = ""; live.length = 0; list.slice(0, 6).forEach(() => { const text = next(), p = spot(text, 11.5); if (!p) return;
            const el = document.createElement("span"); el.textContent = text; el.className = "biz in still"; el.style.cssText = `left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;font-size:11.5px`;
            tagsEl.appendChild(el); live.push({ el, r: p.r }); }); };
          setTimeout(stat, 600); addEventListener("resize", () => { clearTimeout(stat.t); stat.t = setTimeout(stat, 300); });
        } else {
          const target = () => W < 700 ? 5 + (R() * 3 | 0) : 9 + (R() * 5 | 0);
          let goal = target();
          setInterval(() => { if (document.hidden) return; if (live.length < goal) { spawn(); if (R() < 0.15) goal = target(); } }, 420);
        }
      }
    }
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

  /* ================= typing sound: the figure reports keys typed in its input ================= */
  addEventListener("message", e => {
    const fr = $("#being"); let ok = false; try { ok = !!fr && e.source === fr.contentWindow; } catch (_) { }
    if (e.origin !== location.origin || !ok || !e.data || e.data.type !== "oeuvre-key") return;
    if (window.__oeuvreSound && window.__oeuvreSound.key) window.__oeuvreSound.key(String(e.data.kind || "key"), !!e.data.up);
  });

  /* ================= the O cursor ================= */
  // a thin white ring replaces the pointer on mouse devices (touch is unchanged). Over the figure's iframe the page gets no
  // pointer events, so the figure posts {type:'oeuvre-cursor', x, y, inside, hover, down} and the ring follows from there
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !reduced) {
    // two layers: a small dot that sits exactly on the pointer (set in the event, no frame of lag) and a ring that follows
    // with a short elastic lag, stretches along fast moves, is drawn towards what you hover, and sends a ripple on click
    const d = document.createElement("div"); d.className = "dot-cursor"; d.setAttribute("aria-hidden", "true"); body.appendChild(d);
    const dot = document.createElement("div"); dot.className = "cursor-dot"; dot.setAttribute("aria-hidden", "true"); body.appendChild(dot);
    root.classList.add("has-o");
    let cx = -80, cy = -80, tx = -80, ty = -80, px = -80, py = -80, seen = false, raf = 0, last = 0, hoverEl = null;
    const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
    const aim = (x, y) => {
      px = x; py = y;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;              // the dot: exactly where the pointer is, now
      if (!seen) { cx = x; cy = y; seen = true; }
      d.classList.add("on"); dot.classList.add("on"); kick();
    };
    const hit = el => el && el.closest && el.closest("a,button,summary,#wordHit,[role=button]");
    const setHover = el => { hoverEl = hit(el) || null; d.classList.toggle("big", !!hoverEl); dot.classList.toggle("big", !!hoverEl); };
    const ripple = (x, y) => {
      const r = document.createElement("div"); r.className = "cursor-ripple"; r.setAttribute("aria-hidden", "true");
      r.style.left = x + "px"; r.style.top = y + "px"; body.appendChild(r);
      r.addEventListener("animationend", () => r.remove());
    };
    addEventListener("pointermove", e => { aim(e.clientX, e.clientY); setHover(e.target); if (window.__oeuvreSound) window.__oeuvreSound.move(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener("pointerleave", () => { d.classList.remove("on"); dot.classList.remove("on"); });
    document.addEventListener("pointerover", e => setHover(e.target));
    addEventListener("pointerdown", e => { d.classList.add("down"); ripple(e.clientX, e.clientY); kick(); if (window.__oeuvreSound) window.__oeuvreSound.click(e.clientX, e.clientY); });
    addEventListener("pointerup", () => { d.classList.remove("down"); kick(); });
    addEventListener("message", e => {
      const fr = $("#being"); let ok = false; try { ok = !!fr && e.source === fr.contentWindow; } catch (_) { }
      if (e.origin !== location.origin || !ok || !e.data || e.data.type !== "oeuvre-cursor") return;
      const m = e.data;
      if (m.inside === false) { d.classList.remove("on"); dot.classList.remove("on"); return; }
      if (Number.isFinite(m.x) && Number.isFinite(m.y)) { aim(m.x, m.y); if (window.__oeuvreSound) window.__oeuvreSound.move(m.x, m.y); }
      if (m.down && !d.classList.contains("down")) { ripple(m.x, m.y); if (window.__oeuvreSound) window.__oeuvreSound.click(m.x, m.y); }
      hoverEl = null; d.classList.toggle("big", !!m.hover); dot.classList.toggle("big", !!m.hover); d.classList.toggle("down", !!m.down);
    });
    let sx = 1, sy = 1, ang = 0;
    function step(t) {
      const dt = last ? Math.min(50, t - last) : 16.7; last = t;
      // the ring's target: the pointer, drawn a fifth of the way towards the centre of what you hover (a light magnet)
      tx = px; ty = py;
      if (hoverEl && hoverEl.isConnected && hoverEl.id !== "wordHit") {
        const r = hoverEl.getBoundingClientRect();
        if (r.width < 600 && r.height < 300) { tx += (r.left + r.width / 2 - px) * 0.2; ty += (r.top + r.height / 2 - py) * 0.2; }
      }
      const k = 1 - Math.pow(1 - 0.42, dt / 16.7);                       // the same feel at 60 Hz and 120 Hz
      const vx = (tx - cx) * k, vy = (ty - cy) * k; cx += vx; cy += vy;
      // stretch along the motion, then spring back to a circle
      const sp = Math.hypot(vx, vy), want = Math.min(0.45, sp / 70);
      if (sp > 0.3) ang = Math.atan2(vy, vx);
      const kk = 1 - Math.pow(1 - 0.3, dt / 16.7);
      sx += (1 + want - sx) * kk; sy += (1 - want * 0.55 - sy) * kk;
      d.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) rotate(${ang.toFixed(3)}rad) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      const busy = Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1 || Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002;
      raf = busy ? requestAnimationFrame(step) : 0;                      // rests when the pointer does
    }
    kick();
  }


  /* ================= intro (phones and desktop): the name and the line gather as streaks (the menu's flow), then a hard wipe ================= */
  // The page opens on black. "Oeuvre" and the line gather out of a flow field as streaks, exactly like the menu words. Only when the
  // whole picture has formed (and the figure is ready) a hard-edged mask sweeps down from the top and the home is there. Once per
  // session; at most 14 s; reduced motion shows the plain words for a moment instead.
  if (root.classList.contains("intro")) {
    const box = $("#intro"), cv = $("#introC"); let ready = false, formed = false, gone = false, raf = 0;
    const leave = () => {
      if (gone) return; gone = true; try { sessionStorage.setItem("oeuvre-intro", "1"); } catch (_) { }
      root.classList.add("intro-out"); setTimeout(() => { cancelAnimationFrame(raf); root.classList.remove("intro", "intro-out"); box && box.remove(); }, 2300);
    };
    const check = () => { if (ready && formed) setTimeout(leave, 700); };
    addEventListener("message", e => {
      const fr = $("#being"); let ok = false; try { ok = !!fr && e.source === fr.contentWindow; } catch (_) { }
      if (e.origin === location.origin && ok && e.data && e.data.type === "oeuvre-ready") { ready = true; check(); }
    });
    setTimeout(leave, 14000);
    if (reduced || !cv) { setTimeout(() => { formed = true; check(); }, 2200); }
    else {
      const run = () => {
        const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
        cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext("2d"); g.scale(dpr, dpr);
        // the picture to form, set like a title page: the name fitted to the measure, the line a third of its size under it,
        // the block left on the page's gutter and a little above the middle
        const off = document.createElement("canvas"); off.width = w; off.height = h; const o = off.getContext("2d");
        const fam = getComputedStyle(document.body).fontFamily, pad = Math.max(20, Math.min(w * 0.06, 40));
        o.font = `600 100px ${fam}`; if ("letterSpacing" in o) o.letterSpacing = "-4px";
        const f1 = Math.min(w > 820 ? Math.min(200, h * 0.2) : 100, 50 * (w - 2 * pad) / o.measureText("Oeuvre").width * 2 * 0.5);   // half the width of a full-measure title
        o.font = `600 ${f1}px ${fam}`; if ("letterSpacing" in o) o.letterSpacing = (-0.04 * f1) + "px";
        const mN = o.measureText("Oeuvre"), cap = mN.actualBoundingBoxAscent || f1 * 0.72;
        o.fillStyle = "#fff"; o.textBaseline = "alphabetic"; o.fillText("Oeuvre", Math.round((w - mN.width) / 2), Math.round(h * 0.5 + cap / 2));
        const img = o.getImageData(0, 0, w, h).data, pts = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (img[(y * w + x) * 4 + 3] > 128) pts.push(x, y);
        const n = pts.length / 2; if (!n) { formed = true; check(); return; }
        // the menu's own system: a flow field that never stops, a soft pull to the glyphs, ink creeping along the strokes,
        // short streaks drawn from each particle's velocity (every ninth a bright grain) over a fading trail
        // the line is small: it gets denser ink and a calmer stream than the name, so its strokes hold together
        const nameIdx = [], lineIdx = [];
        for (let j = 0; j < pts.length; j += 2) nameIdx.push(j);
        const nName = Math.min(9000, Math.round(nameIdx.length * 1.5)), nLine = 0, N = Math.max(1, nName);
        const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N),
          TX = new Float32Array(N), TY = new Float32Array(N), HI = new Int32Array(N), SD = new Float32Array(N), FL = new Float32Array(N), BORN = new Float32Array(N);
        // a few at first, then more and more: each particle enters at its own moment (later ones far more common) and gathers on its own clock
        const SPAWN = 2800, GATHER = 1100, HOLD_MIN = 1000;
        for (let i = 0; i < N; i++) {
          const src = i < nName ? nameIdx : lineIdx, j = src[Math.random() * src.length | 0];
          TX[i] = pts[j]; TY[i] = pts[j + 1]; HI[i] = j; const ang = Math.random() * 6.283, rr = 70 + 240 * Math.random(); X[i] = TX[i] + Math.cos(ang) * rr; Y[i] = TY[i] + Math.sin(ang) * rr * 1.3;   // each comes in from somewhere around its place
          SD[i] = Math.random() * 10; FL[i] = i < nName ? 1 : 0.45; BORN[i] = SPAWN * Math.pow(Math.random(), 0.33);   // a trickle that swells
        }
        let t0 = 0, last = 0, acc = 0, tNow = 0;
        const ptr = { has: false, x: 0, y: 0 };
        box.addEventListener("pointermove", e => { ptr.has = true; ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
        box.addEventListener("pointerdown", e => { ptr.has = true; ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
        box.addEventListener("pointerup", () => { ptr.has = false; }, { passive: true });
        const step = c => {
          const ts = performance.now() * 0.001;
          if (c > 0.25) {
            const m = Math.ceil(N * 0.08 * c);
            for (let q = 0; q < m; q++) {
              const i = Math.random() * N | 0; if (tNow < BORN[i] + GATHER * 0.5) continue; const j0 = HI[i], j = j0 + ((Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() * 3 | 0))) * 2;
              if (j < 0 || j >= pts.length || Math.abs(pts[j] - pts[j0]) + Math.abs(pts[j + 1] - pts[j0 + 1]) > 3) continue;
              const jit = 0.5; HI[i] = j; TX[i] = pts[j] + (Math.random() - 0.5) * jit; TY[i] = pts[j + 1] + (Math.random() - 0.5) * jit;
            }
          }
          for (let i = 0; i < N; i++) {
            const age = tNow - BORN[i]; if (age < 0) continue;
            const u = Math.min(1, age / GATHER), ci = u * u * (3 - 2 * u), nf = 0.22 - 0.19 * ci, k = 0.006 + 0.03 * ci, damp = 0.88 - 0.2 * ci;   // the early ones settle first, so the letters fill in
            const x = X[i], y = Y[i], a = Math.sin(x * 0.0021 + ts * 0.23 + SD[i] * 0.3) * 2.4 + Math.cos(y * 0.0027 - ts * 0.17) * 2.4;
            const fl = nf * (ci < 0.9 ? 1 : 1 - (1 - FL[i]) * (ci - 0.9) * 10);
            let vx = VX[i] + Math.cos(a) * fl + (TX[i] - x) * k, vy = VY[i] + Math.sin(a) * fl + (TY[i] - y) * k;
            if (ptr.has) { const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy; if (d2 < 14400) { const f = (1 - d2 / 14400) * 0.35 / (Math.sqrt(d2) + 1); vx += (dx * 0.3 - dy * 0.9) * f; vy += (dy * 0.3 + dx * 0.9) * f; } }
            vx *= damp; vy *= damp; VX[i] = vx; VY[i] = vy; X[i] = x + vx; Y[i] = y + vy;
          }
        };
        const draw = c => {
          g.globalCompositeOperation = "destination-out"; g.fillStyle = `rgba(0,0,0,${(0.12 + 0.08 * c).toFixed(3)})`; g.fillRect(0, 0, w, h);
          g.globalCompositeOperation = "lighter"; g.lineWidth = 1;
          for (let pass = 0; pass < 2; pass++) {
            g.strokeStyle = pass ? "rgba(255,255,255,.9)" : `rgba(242,242,238,${(0.26 + 0.2 * c).toFixed(3)})`; g.beginPath();
            for (let j = 0; j < N; j++) {
              if ((j % 9 === 0) !== (pass === 1) || tNow < BORN[j]) continue;
              let lx = VX[j] * 3, ly = VY[j] * 3; const ln = Math.abs(lx) + Math.abs(ly);
              if (ln > 14) { lx *= 14 / ln; ly *= 14 / ln; }
              g.moveTo(X[j] - lx, Y[j] - ly); g.lineTo(X[j] + 0.45, Y[j] + 0.45);
            }
            g.stroke();
          }
          g.globalCompositeOperation = "source-over";
        };
        const frame = now => {
          if (!t0) { t0 = now; last = now; }
          const t = now - t0, dt = Math.min(50, now - last); last = now; tNow = t;
          const u = Math.min(1, t / (SPAWN + GATHER)), c = u * u * (3 - 2 * u);
          acc = Math.min(acc + dt, 50); let steps = 0;
          while (acc >= 16.6) { acc -= 16.6; step(c); steps++; }   // a steady 60 Hz whatever the display does, like the menu
          if (steps) draw(c);
          if (!formed && t > SPAWN + GATHER + HOLD_MIN) { formed = true; check(); }
          raf = requestAnimationFrame(frame);   // it keeps streaming under the wipe until the wipe is gone
        };
        raf = requestAnimationFrame(frame);
      };
      Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 900))]).then(run);   // never sit on black waiting for a font
    }
  }

  /* ================= resize + arrive ================= */
  addEventListener("resize", () => { W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); ictx = fit(irisC); });
  arrive();
})();
