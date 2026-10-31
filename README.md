# oeuvre.co.nz

Static site for Oeuvre (BNB Management Consulting Ltd). Plain files, no build step on the host.

- `content/en.json` — every visible string (add `zh.json` / `mi.json` later; mark the language `ready` in `en.json`).
- `tools/build.py` — renders the pages from the content file: `python3 tools/build.py`
  (writes `index.html`, `work/…`, `services/`, `studio/`, `contact/`, `404.html`, `sitemap.xml`, `robots.txt`).
- `assets/site.css`, `assets/site.js` — styles and behaviour; `assets/img/` — project images.
- `being/` — the home-page figure (iframe). Contract: `docs/being-contract.md`.
- `docs/architecture.md` — sitemap, content, tone, languages, motion.
- `proto/` — the first navigation prototype (not linked from the site).
- `renovation.html` — the old "under renovation" page.

Preview locally: `python3 -m http.server 8130` → http://127.0.0.1:8130/ (add `?static` to any URL to skip
animations, for screenshots).

`main` deploys to https://oeuvre.co.nz automatically — merge only when the site should go live.
