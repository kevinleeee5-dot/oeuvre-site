# /api/talk — the figure's voice

`POST /api/talk` lets visitors talk to the figure. It proxies to the Anthropic Claude API
(model `claude-haiku-5-5`, `max_tokens` 220, no thinking, effort `low`) with a fixed persona
(`api/persona.php`, the single source used by both servers).

| File | Where it runs |
|---|---|
| `api/talk.php` | Production (Hostinger, PHP ≥ 8.1 with curl + mbstring) |
| `api/persona.php` | System prompt. Requested directly over HTTP it outputs nothing. |
| `tools/dev_server.py` | Local dev: static files + the same endpoint (python3 stdlib only) |
| `tools/test_talk.py` | Offline tests against a mock upstream (costs nothing) |

## Contract

```
POST /api/talk   Content-Type: application/json
{"messages":[{"role":"user","content":"Hi"}], "session":"<8-64 chars A-Za-z0-9_->"}

200 {"reply": "..."}
4xx/5xx {"error": "...", "code": "rate_limited" | "budget" | "bad_request" | "upstream" | "config"}
```

- Max 12 messages, each ≤ 600 chars, total ≤ 4000; roles alternate starting with `user`;
  last is `user`; each message is exactly `{role, content}` with string content. Body ≤ 16 KB.
- Same-origin only: if `Origin` (or else `Referer`) is present, its host:port must equal `Host`.
- Status codes: 400/403/413/415 `bad_request`, 429 `rate_limited` (with `Retry-After`),
  503 `budget`, 502 `upstream`, 500 `config`. A model refusal returns 200 with a gentle
  fixed reply.
- The client should keep the conversation itself and send the last ≤ 12 messages; the server
  stores no message text.

## Cost guards

| Guard | Value |
|---|---|
| Output per reply | `max_tokens` 220 |
| Per session | 14 user turns (counted server-side) |
| Per IP | 40 requests / hour, 120 / day (IP stored as a truncated SHA-256 only) |
| Daily spend (UTC day) | USD 4 |
| Lifetime spend | USD 80 in production, USD 15 for the dev server |

Spend is computed from the API's `usage` at Claude Haiku 5.5 prices (USD 0.10 / 1M input,
0.50 / 1M output tokens). Before each upstream call the worst case for that call is reserved
under an exclusive `flock`, then settled to the real cost, so concurrent requests cannot push a
counter past its cap. If the counter file is unreadable the endpoint fails closed (`config`)
instead of resetting. Dev (15) + production (80) lifetime caps add up to USD 95, under the
USD 100 limit. A real reply costs about USD 0.0001, so USD 4/day is roughly 30,000 replies.

**Belt and braces:** also set a monthly spend limit for this key's workspace in the Anthropic
Console (Settings → Limits). That limit is enforced by Anthropic and is the only cap that also
covers a leaked key.

Logs hold only status, error code, token counts, costs and timing — never the key or message text.

## Production setup (Hostinger)

Hostinger's layout is `~/domains/<your-domain>/public_html/` (web root). With the site's
`api/` folder at `public_html/api/`, `talk.php` looks for its secrets in
`dirname(__DIR__, 2) . '/oeuvre-secrets/'`, i.e.

```
~/domains/<your-domain>/oeuvre-secrets/anthropic.key        <- the key, one line
~/domains/<your-domain>/oeuvre-secrets/talk-counters.json   <- created automatically
~/domains/<your-domain>/public_html/api/talk.php
```

That folder is a sibling of `public_html`, so it is never web-reachable. (If the site lives in a
subfolder such as `public_html/site/api/`, the path moves one level down accordingly:
`public_html/oeuvre-secrets/` would then be web-reachable — keep `api/` directly under
`public_html`, or set the key via an environment variable.)

Create it once, over SSH (hPanel → Advanced → SSH Access):

```sh
cd ~/domains/<your-domain>
mkdir -m 700 oeuvre-secrets
umask 077
nano oeuvre-secrets/anthropic.key     # paste the sk-ant-… key on one line, save
chmod 600 oeuvre-secrets/anthropic.key
```

Or with hPanel's File Manager: create the folder `oeuvre-secrets` next to `public_html`
(not inside it), create `anthropic.key` in it, paste the key, and set permissions to 600 for
the file and 700 for the folder. The folder must be writable by PHP (it holds the counters);
if it is missing or not writable every request returns `config`.

Alternatively set `ANTHROPIC_API_KEY` as an environment variable for PHP; it takes
precedence over the file. The counters still need the `oeuvre-secrets` folder.

Never commit the key: the repository is public. `oeuvre-secrets/` is outside the repo by design.

The figure posts to `/api/talk` (no extension). The root `.htaccess` rewrites that to
`api/talk.php` and returns 404 for `tools/`, `docs/`, `proto/` and `README.md` files.

To check it works after deploying:

```sh
curl -s -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello"}],"session":"deploycheck01"}' \
  https://<your-domain>/api/talk
```

To raise or reset caps, edit the constants at the top of `talk.php`. `lifetime_usd` in
`talk-counters.json` is the running total; `lifetime_cap_usd` there can only lower the cap.

## Local development

```sh
python3 -I tools/dev_server.py --port 8124       # http://127.0.0.1:8124/
python3 -I tools/test_talk.py                    # offline tests, mock upstream
```

The dev server reads `ANTHROPIC_API_KEY`, or else extracts the key at startup from the RTF file
path in `KEY_RTF` (outside this folder). Dev counters live in
`~/.oeuvre-dev/talk-counters.json` (persistent, outside the project). The dev server refuses to serve `.log`, `.key`,
`.rtf`, `.env`, `.php`, `.py`, `.sh` and dot-files.
