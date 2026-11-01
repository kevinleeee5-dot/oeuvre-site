#!/usr/bin/env python3
"""Build the Oeuvre site as plain static files from content/<lang>.json.

    python3 tools/build.py

Writes index.html, work/…, services/, studio/, contact/, 404.html, sitemap.xml at the repo root.
English lives at the root. A finished translation (content/zh.json, content/mi.json with "ready": true in
the languages list) is written under /zh/ or /mi/; missing keys fall back to English.
"""
import html
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
VERSION = "20261102h"  # bump to bust caches of css/js
# the sound toggle: a speaker; off = a small cross, on = three bars as waves (css animates them)
SOUND_ICON = ('<svg class="spk" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">'
              '<path d="M3.5 7.6h2.8L10 4.4v11.2l-3.7-3.2H3.5z" fill="currentColor"/>'
              '<path class="x" d="M13 8.2l3.6 3.6M16.6 8.2L13 11.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
              '</svg><span class="snd" aria-hidden="true"><i></i><i></i><i></i></span>')


def esc(s):
    return html.escape(str(s), quote=True)


def merge(base, over):
    if over is None:
        return base
    if isinstance(base, dict) and isinstance(over, dict):
        out = dict(base)
        for k, v in over.items():
            out[k] = merge(base.get(k), v)
        return out
    return over


def image_size(src):
    """Real pixel size of an image under the repo (keeps width/height attributes honest)."""
    p = ROOT / src.lstrip("/")
    if not p.exists():
        return None
    try:
        out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(p)], capture_output=True, text=True).stdout
        w = int(re.search(r"pixelWidth: (\d+)", out).group(1))
        h = int(re.search(r"pixelHeight: (\d+)", out).group(1))
        return w, h
    except Exception:
        return None


def fix_sizes(img):
    if img and img.get("src"):
        size = image_size(img["src"])
        if size:
            img["w"], img["h"] = size
    return img


# ---------------------------------------------------------------- shell

def page(c, *, lang_prefix, path, page_id, section, title, description, body, body_class="", alternates=()):
    s = c["site"]
    full_title = s["name"] if page_id == "home" else f"{title} — {s['name']}"
    canonical = s["url"] + path
    langs = []
    for l in c["languages"]:
        if l.get("hidden"):                       # e.g. 中 while the Chinese site is off: no chip, no link
            continue
        cur = l["code"] == c["lang"]
        if l["ready"]:
            href = ("/" if l["code"] == "en" else f"/{l['code']}/") + path.lstrip("/")
            langs.append(f'<a href="{esc(href)}" lang="{esc(l["code"])}" hreflang="{esc(l["code"])}"'
                         f'{" aria-current=\"true\"" if cur else ""} title="{esc(l["name"])}">{esc(l["label"])}</a>')
        else:
            langs.append(f'<span aria-disabled="true" lang="{esc(l["code"])}" title="{esc(l["name"])} — {esc(s["soon"])}">{esc(l["label"])}</span>')
    alt_links = "\n".join(f'<link rel="alternate" hreflang="{a}" href="{esc(h)}">' for a, h in alternates)
    mini = ""
    if page_id != "home":
        items = "".join(
            f'<li><a href="{lang_prefix}{m["href"]}"{" aria-current=\"page\"" if m["id"] == section else ""}>{esc(m["label"])}</a></li>'
            for m in c["menu"])
        mini = f'<nav class="mini" aria-label="{esc(s["sections"])}"><ul>{items}</ul></nav>'
    return f"""<!doctype html>
<html lang="{esc(c['htmlLang'])}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<title>{esc(full_title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="google-site-verification" content="HdM9d1ZrdcDQDWXiHn4fNgn0pB8N0wssrnslsydQ_Ps">
<link rel="canonical" href="{esc(canonical)}">
{alt_links}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(s['name'])}">
<meta property="og:title" content="{esc(full_title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{esc(s['url'])}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Oeuvre">
<link rel="manifest" href="/assets/site.webmanifest">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&amp;family=Geist+Mono:wght@300;400&amp;display=swap">
<link rel="stylesheet" href="/assets/site.css?v={VERSION}">
<script>(function(d){{d.className=d.className.replace('no-js','js');try{{if(sessionStorage.getItem('oeuvre-iris')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.className+=' arriving'}}catch(e){{}}{"try{if((innerWidth<=820||matchMedia('(pointer:coarse)').matches)&&(!sessionStorage.getItem('oeuvre-intro')||/[?&]intro(&|$)/.test(location.search)))d.className+=' intro'}catch(e){}" if page_id == 'home' else ''}}})(document.documentElement)</script>
<script src="/assets/site.js?v={VERSION}" defer></script>
</head>
<body class="p-{page_id} {body_class}" data-page="{page_id}" data-section="{esc(section)}">
<a class="skip" href="#main">{esc(s['skip'])}</a>
<header class="bar">
  <a class="mark" href="{lang_prefix or '/'}" aria-label="{esc(s['name'])} — {esc(s['home'])}">{esc(s['name'])}</a>
  {mini}
  {'<button class="snd-btn" type="button" id="soundToggle" aria-pressed="false" aria-label="' + esc(s['sound_on']) + '" data-on="' + esc(s['sound_off']) + '" data-off="' + esc(s['sound_on']) + '">' + SOUND_ICON + '</button>\n  <button class="chip" type="button" id="indexToggle" aria-pressed="false" data-on="' + esc(s['float']) + '" data-off="' + esc(s['index']) + '">' + esc(s['index']) + '</button>' if page_id == 'home' else ''}
</header>
{body}
{cta(c, lang_prefix) if page_id not in ("home", "contact", "notfound") else ""}
<footer class="foot">
  <p class="foot-legal">{esc(s['legal'])}</p>
  <div class="langs" role="group" aria-label="{esc(s['languages'])}">{''.join(langs)}</div>
</footer>
<canvas id="iris" aria-hidden="true"></canvas>
<div id="live" class="sr-only" aria-live="polite"></div>
</body>
</html>
"""


def cta(c, P):
    s = c["site"]
    return (f'<aside class="cta wrap"><p class="kicker">{esc(s["ctaLead"])}</p>'
            f'<a class="cta-link" href="{P}/contact/"><span>{esc(s["ctaLink"])}</span><span class="arr" aria-hidden="true">→</span></a></aside>')


def back(c, href):
    return f'<a class="back" href="{esc(href)}"><span aria-hidden="true">←</span> {esc(c["site"]["back"])}</a>'


def figure(img, cls="", eager=False):
    """An image that the script turns into halftone dots, then resolves into the photo."""
    if img.get("kind") and not img.get("src"):
        cap = f'<figcaption>{esc(img["caption"])}</figcaption>' if img.get("caption") else ""
        return (f'<figure class="ht ph {cls}" data-kind="{esc(img["kind"])}">'
                f'<canvas role="img" aria-label="{esc(img["alt"])}"></canvas>{cap}</figure>')
    fit = img.get("fit", "cover")
    g = " graphic" if img.get("graphic") else ""
    w, h = img.get("w", 1600), img.get("h", 1000)
    ratio = w / h
    shape = "tall" if ratio < 0.8 else ("wide" if ratio > 1.9 else "")
    return (f'<figure class="ht fit-{fit}{g} {shape} {cls}" style="--ar:{w}/{h}">'
            f'<img src="{esc(img["src"])}" alt="{esc(img["alt"])}" width="{w}" height="{h}" '
            f'{"fetchpriority=\"high\"" if eager else "loading=\"lazy\""} decoding="async"></figure>')


# ---------------------------------------------------------------- pages

def home(c, P):
    s = c["site"]
    words = "".join(
        f'<li><a class="word" data-i="{i}" data-id="{m["id"]}" href="{P}{m["href"]}">{esc(m["label"])}<sup aria-hidden="true">0{i + 1}</sup></a></li>'
        for i, m in enumerate(c["menu"]))
    nm = "".join(f'<span style="animation-delay:{0.12 * i:.2f}s">{esc(ch)}</span>' for i, ch in enumerate(s["name"]))
    ln = "".join(f"<span>{esc(t.strip().rstrip('.'))}.</span>" for t in s["statement"].split(". ") if t.strip().strip("."))
    body = f"""<div id="intro" aria-hidden="true"><canvas id="introC"></canvas><div class="i-name">{esc(s["name"])}</div></div>
<main id="main" class="home">
  <h1 class="sr-only">{esc(s['name'])} — {esc(s['statement'])}</h1>
  <div class="being">
    <iframe id="being" src="/being/index.html" title="{esc(s['beingTitle'])}" allow="camera; microphone; autoplay"></iframe>
  </div>
  <nav class="words" aria-label="Main"><ul>{words}</ul></nav>
  <div id="tags" aria-hidden="true" data-tags="{esc(json.dumps(c.get('homeTags', []), ensure_ascii=False))}"></div>
  <canvas id="menu" aria-hidden="true"></canvas>
  <a id="wordHit" class="word-hit" href="{P}{c["menu"][0]["href"]}" aria-hidden="true" tabindex="-1"></a>
  <div class="home-foot">
    <div class="home-copy"><p class="home-statement">{esc(s['statement']).replace('. ', '.<br>')}</p>
    <p class="home-support">{esc(s.get('support',''))}</p></div>
  </div>
</main>"""
    return body


def work_index(c, P):
    W = c["work"]
    rows = []
    detail = W.get("publishDetail", True)         # false: the project detail pages are off the site until the new design is ready
    for i, p in enumerate(W["projects"]):
        tag, href = ("a", f' href="{P}/work/{p["slug"]}/"') if detail else ("div", "")
        rows.append(f"""<li><{tag} class="row"{href} data-src="{esc(p['hero']['src'])}" data-fit="{esc(p['hero'].get('fit', 'cover'))}"{' data-graphic' if p['hero'].get('graphic') else ''}>
  <span class="n">0{i + 1}</span><span class="nm">{esc(p['name'])}</span>
  <span class="meta">{' · '.join(esc(t) for t in p['tags'])} <span class="yr">— {esc(p['year'])}</span></span>
  <span class="oc">{esc(p['outcome'])}</span></{tag}></li>""")
    return f"""<main id="main" class="wrap">
  {back(c, P + '/')}
  <h1 class="page-title" data-count="{len(W['projects']):02d}">{esc(W['title'])}</h1>
  <p class="lead">{esc(W['intro'])}</p>
  <ol class="work-list">{''.join(rows)}</ol>
  <canvas id="preview" aria-hidden="true"></canvas>
</main>"""


def case(c, P, i):
    W, L = c["work"], c["work"]["labels"]
    p = W["projects"][i]
    nx = W["projects"][(i + 1) % len(W["projects"])]
    link = (f'<div><span>{esc(L["visit"])}</span><b><a href="{esc(p["link"]["href"])}" rel="noopener" target="_blank">{esc(p["link"]["label"])} ↗</a></b></div>'
            if p.get("link") else "")
    gallery = "".join(figure(g, g.get("span", "half")) for g in p["gallery"])
    return f"""<main id="main">
<article class="wrap case">
  {back(c, P + '/work/')}
  <header class="case-head">
    <p class="kicker">{esc(W['title'])} / 0{i + 1}</p>
    <h1 class="page-title">{esc(p['name'])}</h1>
    <p class="lead">{esc(p['outcome'])}</p>
    <div class="case-meta">
      <div><span>{esc(L['sector'])}</span><b>{esc(p['sector'])}</b></div>
      <div><span>{esc(L['role'])}</span><b>{' · '.join(esc(t) for t in p['tags'])}</b></div>
      <div><span>{esc(L['year'])}</span><b>{esc(p['year'])}</b></div>
      {link}
    </div>
  </header>
  {figure(p['hero'], 'hero', eager=True)}
  <section class="cols"><h2>{esc(L['brief'])}</h2><p class="big">{esc(p['brief'])}</p></section>
  <section class="cols"><h2>{esc(L['did'])}</h2><ol class="steps">{''.join(f'<li>{esc(d)}</li>' for d in p['did'])}</ol></section>
  <div class="gallery n{len(p['gallery'])}">{gallery}</div>
  <section class="cols"><h2>{esc(L['result'])}</h2><p class="big">{esc(p['result'])}</p></section>
  <a class="next" href="{P}/work/{nx['slug']}/"><span>{esc(W['next'])}</span><strong>{esc(nx['name'])}</strong><em>{esc(nx['outcome'])}</em></a>
</article>
</main>"""


def services(c, P):
    V, L = c["services"], c["services"]["labels"]
    rows = []
    for i, it in enumerate(V["items"]):
        soon = f' <span class="tag">{esc(it["soon"])}</span>' if it.get("soon") else ""
        cta = f' <a href="{P}/contact/">{esc(c["contact"]["write"])} →</a>' if it.get("soon") else ""
        rows.append(f"""<li class="svc{' soon' if it.get('soon') else ''}" id="{it['id']}">
  <details>
    <summary><span class="n">0{i + 1}</span><span class="sn">{esc(it['name'])}{soon}</span><span class="pm" aria-hidden="true"></span></summary>
    <div class="svc-body">
      <div><h3>{esc(L['what'])}</h3><p>{esc(it['what'])}</p></div>
      <div><h3>{esc(L['get'])}</h3><p>{esc(it['get'])}{cta}</p></div>
      <div><h3>{esc(L['time'])}</h3><p>{esc(it['time'])}</p></div>
    </div>
  </details>
</li>""")
    return f"""<main id="main" class="wrap">
  {back(c, P + '/')}
  <h1 class="page-title">{esc(V['title'])}</h1>
  <p class="lead">{esc(V['intro'])}</p>
  <ul class="svc-list">{''.join(rows)}</ul>
  <p class="closing">{esc(V['closing'])}</p>
</main>"""


def studio(c, P):
    V = c["studio"]
    words = " ".join(f"<span>{esc(w)}</span>" for w in V["statement"].split(" "))
    return f"""<main id="main" class="wrap">
  {back(c, P + '/')}
  <h1 class="page-title">{esc(V['title'])}</h1>
  <p class="statement-big">{words}</p>
  <div class="studio-body">{''.join(f'<p>{esc(t)}</p>' for t in V['body'])}</div>
  <h2 class="label">{esc(V['principlesTitle'])}</h2>
  <div class="principles">{''.join(f'<div><span class="n">0{i + 1}</span><h3>{esc(p["name"])}</h3><p>{esc(p["text"])}</p></div>' for i, p in enumerate(V['principles']))}</div>
  <p class="legal">{esc(c['site']['legal'])}<br>{esc(c['site']['place'])}</p>
</main>"""


def contact(c, P):
    V, s = c["contact"], c["site"]
    m = s["email"]
    user, dom = m.split("@")
    return f"""<main id="main" class="wrap">
  {back(c, P + '/')}
  <h1 class="page-title">{esc(V['title'])}</h1>
  <p class="lead">{esc(V['lead'])}</p>
  <a class="mail" href="mailto:{esc(m)}"><span>{esc(user)}</span><span>@{esc(dom)}</span></a>
  <div class="contact-actions">
    <a class="btn" href="mailto:{esc(m)}">{esc(V['write'])} <span aria-hidden="true">→</span></a>
    <button class="btn ghost" type="button" id="copyMail" data-email="{esc(m)}" data-done="{esc(V['copied'])}" hidden>{esc(V['copy'])}</button>
  </div>
  <p class="contact-note">{esc(V['reply'])}<br>{esc(s['place'])}</p>
</main>"""


def not_found(c, P):
    V = c["notFound"]
    return f"""<main id="main" class="wrap nf">
  <p class="kicker">404</p>
  <h1 class="page-title">{esc(V['title'])}</h1>
  <p class="lead">{esc(V['text'])}</p>
  <a class="btn" href="{P or '/'}">{esc(V['home'])} <span aria-hidden="true">→</span></a>
</main>"""


# ---------------------------------------------------------------- build

def write(rel, text):
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    return rel


def build():
    en = json.loads((CONTENT / "en.json").read_text(encoding="utf-8"))
    for p in en["work"]["projects"]:
        fix_sizes(p["hero"])
        for g in p["gallery"]:
            fix_sizes(g)
    ready = [l["code"] for l in en["languages"] if l["ready"]]
    written, urls = [], []
    for code in ready:
        c = en if code == "en" else merge(en, json.loads((CONTENT / f"{code}.json").read_text(encoding="utf-8")))
        P = "" if code == "en" else f"/{code}"
        base = "" if code == "en" else f"{code}/"

        def alts(path):
            return [(l, en["site"]["url"] + ("/" if l == "en" else f"/{l}/") + path.lstrip("/")) for l in ready] + \
                   [("x-default", en["site"]["url"] + path)]

        pages = [
            ("index.html", "/", "home", "", c["site"]["name"], c["site"]["description"], home(c, P)),
            ("work/index.html", "/work/", "work", "work", c["work"]["title"], c["work"]["metaDescription"], work_index(c, P)),
        ]
        for i, p in enumerate(c["work"]["projects"] if c["work"].get("publishDetail", True) else []):
            pages.append((f"work/{p['slug']}/index.html", f"/work/{p['slug']}/", "case", "work", p["name"], p["outcome"], case(c, P, i)))
        pages += [
            ("services/index.html", "/services/", "services", "services", c["services"]["title"], c["services"]["metaDescription"], services(c, P)),
            ("studio/index.html", "/studio/", "studio", "studio", c["studio"]["title"], c["studio"]["metaDescription"], studio(c, P)),
            ("contact/index.html", "/contact/", "contact", "contact", c["contact"]["title"], c["contact"]["metaDescription"], contact(c, P)),
        ]
        for rel, path, pid, section, title, desc, body in pages:
            written.append(write(base + rel, page(c, lang_prefix=P, path=path, page_id=pid, section=section, title=title,
                                                  description=desc, body=body, alternates=alts(path))))
            urls.append(en["site"]["url"] + P + path)
        if code == "en":
            written.append(write("404.html", page(c, lang_prefix=P, path="/404.html", page_id="notfound", section="",
                                                  title="404", description=c["notFound"]["text"], body=not_found(c, P))))
    sitemap = "\n".join(f"  <url><loc>{esc(u)}</loc></url>" for u in urls)
    written.append(write("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sitemap}\n</urlset>\n'))
    written.append(write("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /proto/\nDisallow: /tools/\nSitemap: {en['site']['url']}/sitemap.xml\n"))
    print("\n".join(written))


if __name__ == "__main__":
    build()
