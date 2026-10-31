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

  /* ================= home: words around the face ================= */
  let words = [], face = null, wordCenter = () => null;
  if (page === "home") initHome();

  function initHome() {
    const frame = $("#being"), nav = $(".words");
    words = $$(".word").map((el, i) => ({ el, i, id: el.dataset.id, x: 0, y: 0, tx: 0, ty: 0, w: 0, h: 0 }));
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
        face = { x: d.x, y: d.y, w: d.w, h: d.h }; haveFace = true;
      } else if (d.type === "oeuvre-ready") {
        if (d.camera) $("#seeYou").hidden = false;
      } else if (d.type === "oeuvre-camera") {
        const b = $("#seeYou"); b.textContent = d.on ? b.dataset.on : b.dataset.off; b.setAttribute("aria-pressed", !!d.on);
      }
    });
    const post = msg => { try { frame.contentWindow.postMessage(msg, location.origin); } catch (_) { } };
    onPointer = e => post({ type: "oeuvre-pointer", x: e.clientX, y: e.clientY, w: W, h: H });
    $("#seeYou").addEventListener("click", () => post({ type: "oeuvre-camera", on: $("#seeYou").getAttribute("aria-pressed") !== "true" }));
    frame.addEventListener("load", () => post({ type: "oeuvre-hello", reduced }));

    const toggle = $("#indexToggle");
    toggle && toggle.addEventListener("click", () => {
      const on = body.classList.toggle("list");
      toggle.setAttribute("aria-pressed", on); toggle.textContent = on ? toggle.dataset.on : toggle.dataset.off;
      if (!on) layout(true);
    });

    // Where each word wants to be, given the face box.
    function layout(snap) {
      if (body.classList.contains("list")) return;
      const g = Math.max(16, W * 0.02), top = 74, bottom = H - 70;
      const wide = W >= 860;
      const fs = wide ? clamp(W * 0.075, 40, 138) : clamp(W * 0.135, 38, 72);
      nav.style.setProperty("--fs", fs + "px");
      words.forEach(w => { w.w = w.el.offsetWidth; w.h = w.el.offsetHeight; });
      const f = face, cx = f.x + f.w / 2;
      words.forEach(w => {
        const left = w.i % 2 === 0, upper = w.i < 2;
        let x, y;
        if (wide) {
          x = left ? f.x - g - w.w : f.x + f.w + g;
          if (x < g) x = g; if (x + w.w > W - g) x = W - g - w.w;
          y = upper ? f.y + f.h * (left ? 0.02 : 0.28) - w.h / 2 : f.y + f.h * (left ? 0.78 : 1.06) - w.h / 2;
        } else {
          // phones: two words in the space above the face, two below, staggered left/right
          x = left ? g : W - g - w.w;
          const lo = upper ? top : f.y + f.h * 0.9, hi = upper ? f.y + f.h * 0.12 : bottom - 40;
          const span = Math.max(hi - lo - w.h, w.h * 1.2);
          y = lo + span * (left ? 0.06 : 0.94);
        }
        y = clamp(y, top, bottom - w.h);
        w.tx = x; w.ty = y;
        if (snap || !w.placed) { w.x = x; w.y = y; w.placed = true; }
      });
      nav.classList.add("placed");
    }
    wordCenter = id => { const w = words.find(w => w.id === id); return w ? { x: w.x + w.w / 2, y: w.y + w.h / 2 } : null; };
    let lastFace = "";
    function frameLoop(t) {
      requestAnimationFrame(frameLoop);
      const key = haveFace ? [face.x, face.y, face.w, face.h].map(v => Math.round(v / 4)).join() : "f";
      if (key !== lastFace) { lastFace = key; layout(false); }
      if (body.classList.contains("list")) return;
      const k = reduced ? 1 : 0.08;
      words.forEach(w => {
        w.x += (w.tx - w.x) * k; w.y += (w.ty - w.y) * k;
        let dx = 0, dy = 0;
        if (!reduced) {
          dx = Math.sin(t * 0.00035 + w.i * 1.7) * 10 - (ptr.x / W - 0.5) * 28 * (0.6 + 0.2 * w.i);
          dy = Math.cos(t * 0.0003 + w.i * 2.3) * 8 - (ptr.y / H - 0.5) * 18 * (0.6 + 0.2 * w.i);
        }
        w.el.style.transform = `translate3d(${(w.x + dx).toFixed(1)}px, ${(w.y + dy).toFixed(1)}px, 0)`;
        const d = Math.hypot(ptr.x - (w.x + w.w / 2), ptr.y - (w.y + w.h / 2));
        w.el.style.setProperty("--o", ptr.has ? (0.5 + 0.5 * clamp(1 - d / 440)).toFixed(3) : 0.7);
      });
    }
    addEventListener("resize", () => { if (!haveFace) face = fallback(); layout(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout(true));
    layout(true);
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
    addEventListener("pointerdown", () => d.classList.add("down")); addEventListener("pointerup", () => d.classList.remove("down"));
    document.addEventListener("pointerover", e => d.classList.toggle("big", !!(e.target.closest && e.target.closest("a,button,summary"))));
    const step = () => { cx += (tx - cx) * 0.25; cy += (ty - cy) * 0.25; d.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ================= resize + arrive ================= */
  addEventListener("resize", () => { W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); ictx = fit(irisC); });
  arrive();
})();
