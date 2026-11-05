# oeuvre.co.nz

Static site for Oeuvre (BNB Management Consulting Ltd). Plain files, no build step on the host.

- `content/en.json` — every visible string (add `zh.json` / `mi.json` later; mark the language `ready` in `en.json`).
- `tools/build.py` — renders the pages from the content file: `python3 tools/build.py`
  (writes `index.html`, `work/…`, `services/`, `studio/`, `contact/`, `404.html`, `sitemap.xml`, `robots.txt`).
- `assets/site.css`, `assets/site.js` — styles and behaviour; `assets/img/` — project images.
- `being/` — the home-page figure (iframe), synced from the prototype with `tools/sync_being.sh`. Contract: `docs/being-contract.md`.
- `api/` — `talk.php` (production voice endpoint), `persona.php`, `README.md` (setup, cost guards).
- `docs/architecture.md` — sitemap, content, tone, languages, motion.
- `proto/` — the first navigation prototype (not linked from the site).
- `renovation.html` — the old "under renovation" page.

Preview locally: `python3 -I tools/dev_server.py --port 8130` → http://127.0.0.1:8130/ — static files, the site's
404 page, and `POST /api/talk` for the figure (key read at runtime from outside the repo; spend capped, counters
in `~/.oeuvre-dev/`). Plain `python3 -m http.server 8130` also works without talk. Add `?static` to any URL to skip
animations, for screenshots.

`main` deploys to https://oeuvre.co.nz automatically — merge only when the site should go live. How: the host's
`public_html` is a shallow clone of this repo, and an hPanel cron job (every minute) runs
`git fetch --depth=1 origin main && git reset --hard FETCH_HEAD` there. Do not upload files by hand: tracked files
are overwritten by the next run. Secrets and logs live outside `public_html`, in `oeuvre-secrets/`.
