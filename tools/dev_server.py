#!/usr/bin/env python3
"""Local dev server for the Oeuvre site: static files + POST /api/talk (Claude API proxy).

    python3 -I tools/dev_server.py [--port 8130] [--host 127.0.0.1] [--root DIR]

Static files are served from --root (default: the repo root, the folder above tools/) like
`python3 -m http.server`; missing pages get /404.html with status 404 (as .htaccess does in
production), with explicit
MIME types for .mjs/.wasm/.bin/.json. Secrets, logs and PHP sources are never served.

POST /api/talk  {messages:[{role, content}], session}  ->  200 {reply} | 4xx/5xx {error, code}
Same contract as api/talk.php (production). See api/README.md.

API key: env ANTHROPIC_API_KEY, else extracted at startup from the RTF file in KEY_RTF.
The key is held in memory only; it is never logged, printed or written anywhere.

Cost guards (all enforced server-side, counters in a JSON file OUTSIDE the web root, guarded
by flock): max_tokens 220, 14 user turns per session, 40 req/hour and 120 req/day per IP,
a daily spend cap and a hard lifetime spend cap. Spend is reserved (worst case) before each
upstream call and settled from the real `usage` afterwards, so concurrent requests cannot
overshoot a cap. The log records only status codes, token counts and costs.

Test-only env overrides (can only LOWER caps): OEUVRE_TALK_DAILY_USD, OEUVRE_TALK_LIFETIME_USD,
OEUVRE_TALK_COUNTERS (counter file path), OEUVRE_TALK_UPSTREAM (must be a localhost URL).
"""
import argparse
import fcntl
import hashlib
import http.server
import json
import math
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_RTF = "/Users/trevion/Downloads/Oeuvre/Oeuvre API key.rtf"
ELEVEN_RTF = "/Users/trevion/Downloads/Oeuvre/Elevenlabs API.rtf"   # ElevenLabs key for /api/tts (memory only, never logged)
TTS_VOICE, TTS_MODEL, TTS_OUTPUT = "SAz9YHcvj6GT2YYXdXww", "eleven_multilingual_v2", "mp3_44100_64"   # River
PERSONA_FILE = os.path.join(ROOT, "api", "persona.php")

# ---- model + prices (Claude Haiku 5.5, USD per token, prompts <= 100K tokens) -------------
MODEL = "claude-haiku-5-5"
API_VERSION = "2026-10-21"
PRICE_IN = 0.10 / 1e6
PRICE_OUT = 0.50 / 1e6
MAX_TOKENS = 220

# ---- limits ---------------------------------------------------------------------------------
MAX_MESSAGES = 12
MAX_MSG_CHARS = 600
MAX_TOTAL_CHARS = 4000
MAX_BODY_BYTES = 16384
SESSION_TURNS = 14
IP_PER_HOUR = 40
IP_PER_DAY = 120
DAILY_USD_DEFAULT = 4.0
# Dev lifetime cap is deliberately low: production (api/talk.php) has its own USD 80 lifetime
# counter, and dev + prod together must stay under the USD 100 the owner allows.
LIFETIME_USD_HARD = 15.0
UPSTREAM_TIMEOUT = 25

SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
DENY_RE = re.compile(r"(\.(log|key|rtf|env|php|pem|py|sh)$)|(/\.)|(^\.)", re.I)


def env_cap(name, hard):
    """Env can lower a cap for tests, never raise it."""
    try:
        v = float(os.environ.get(name, hard))
    except ValueError:
        v = hard
    return max(0.0, min(v, hard))


DAILY_USD = env_cap("OEUVRE_TALK_DAILY_USD", DAILY_USD_DEFAULT)
LIFETIME_USD = env_cap("OEUVRE_TALK_LIFETIME_USD", LIFETIME_USD_HARD)
# Persistent (not the temp dir, which macOS clears) and outside the project folder.
COUNTER_FILE = os.environ.get("OEUVRE_TALK_COUNTERS") or os.path.expanduser(
    "~/.oeuvre-dev/talk-counters.json")
UPSTREAM = os.environ.get("OEUVRE_TALK_UPSTREAM", "https://api.anthropic.com")
_up = urllib.parse.urlparse(UPSTREAM)
if UPSTREAM != "https://api.anthropic.com" and _up.hostname not in ("127.0.0.1", "localhost", "::1"):
    sys.exit("OEUVRE_TALK_UPSTREAM must be a localhost URL (refusing to send the key elsewhere)")
UPSTREAM_URL = UPSTREAM.rstrip("/") + "/v1/messages"


def log(msg):
    sys.stderr.write("%s %s\n" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg))
    sys.stderr.flush()


# ---- secrets / persona ----------------------------------------------------------------------
def load_key():
    k = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if k:
        return k
    try:
        with open(KEY_RTF, encoding="latin-1") as f:
            raw = f.read()
    except OSError:
        return ""
    # Strip RTF: drop control words / groups, then take the sk-ant- token.
    text = re.sub(r"\\'[0-9a-fA-F]{2}", "", raw)
    m = re.search(r"sk-ant-[A-Za-z0-9_\-]+", text)
    return m.group(0) if m else ""


def load_eleven_key():
    k = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if k:
        return k
    try:
        with open(ELEVEN_RTF, encoding="latin-1") as f:
            raw = f.read()
    except OSError:
        return ""
    m = re.search(r"\bsk_[A-Za-z0-9]{20,}\b", raw) or re.search(r"\b[a-f0-9]{32}\b", raw)
    return m.group(0) if m else ""


def tts_sig(text):
    """Same signature as api/talk.php: /api/tts speaks only replies this server gave."""
    import hmac
    secret = hashlib.sha256(("oeuvre-tts:" + API_KEY).encode()).hexdigest().encode()
    return hmac.new(secret, text.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def load_persona():
    with open(PERSONA_FILE, encoding="utf-8") as f:
        src = f.read()
    return src.split("<<<'PERSONA'\n", 1)[1].split("\nPERSONA;", 1)[0].strip()


API_KEY = ""
ELEVEN_KEY = ""
PERSONA = ""


# ---- counters (JSON file + flock) -----------------------------------------------------------
class CounterError(Exception):
    pass


_thread_lock = threading.Lock()


def with_counters(fn):
    """Run fn(state) -> result under an exclusive lock; persist state. Fails closed."""
    os.makedirs(os.path.dirname(COUNTER_FILE), mode=0o700, exist_ok=True)
    with _thread_lock:
        fd = os.open(COUNTER_FILE, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            with os.fdopen(os.dup(fd), "r+", encoding="utf-8") as f:
                raw = f.read()
                if raw.strip():
                    try:
                        st = json.loads(raw)
                        if not isinstance(st, dict) or not isinstance(st.get("lifetime_usd"), (int, float)):
                            raise ValueError
                    except ValueError:
                        # Never reset a corrupt counter (that would reset the lifetime cap).
                        raise CounterError("counter file unreadable")
                else:
                    st = {"version": 1, "lifetime_usd": 0.0, "days": {}, "ip": {}, "sessions": {}}
                result = fn(st)
                f.seek(0)
                f.truncate()
                f.write(json.dumps(st, separators=(",", ":")))
                f.flush()
                os.fsync(f.fileno())
                return result
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def ip_key(ip):
    # Store a truncated hash, not the raw address.
    return hashlib.sha256(("oeuvre-talk:" + ip).encode()).hexdigest()[:20]


def estimate_reserve(total_chars):
    est_in = math.ceil((len(PERSONA) + total_chars) / 2) + 100  # pessimistic (~2 chars/token)
    return est_in * PRICE_IN + MAX_TOKENS * PRICE_OUT


def reserve(ip, session, total_chars):
    """Check every guard and reserve worst-case spend. Returns (ok, code, reserved_usd)."""
    now = time.time()
    day = today()
    cost = estimate_reserve(total_chars)

    def fn(st):
        days = st.setdefault("days", {})
        for d in list(days):
            if d < datetime.fromtimestamp(now - 14 * 86400, timezone.utc).strftime("%Y-%m-%d"):
                del days[d]
        ips = st.setdefault("ip", {})
        for k in list(ips):
            ips[k] = [t for t in ips[k] if t > now - 86400]
            if not ips[k]:
                del ips[k]
        sess = st.setdefault("sessions", {})
        for k in list(sess):
            if sess[k].get("ts", 0) < now - 86400:
                del sess[k]

        cap_life = min(LIFETIME_USD, float(st.get("lifetime_cap_usd", LIFETIME_USD)))
        st["lifetime_cap_usd"] = cap_life
        dd = days.setdefault(day, {"usd": 0.0, "requests": 0})
        if st["lifetime_usd"] + cost > cap_life or dd["usd"] + cost > DAILY_USD:
            return False, "budget", 0.0
        hits = ips.get(ip_key(ip), [])
        if len([t for t in hits if t > now - 3600]) >= IP_PER_HOUR or len(hits) >= IP_PER_DAY:
            return False, "rate_limited", 0.0
        s = sess.get(session, {"turns": 0, "ts": now})
        if s["turns"] >= SESSION_TURNS:
            return False, "rate_limited", 0.0
        # commit
        ips[ip_key(ip)] = hits + [now]
        sess[session] = {"turns": s["turns"] + 1, "ts": now}
        st["lifetime_usd"] += cost
        dd["usd"] += cost
        dd["requests"] += 1
        return True, None, cost

    return with_counters(fn)


def settle(reserved, actual):
    day = today()

    def fn(st):
        delta = actual - reserved
        st["lifetime_usd"] = max(0.0, st["lifetime_usd"] + delta)
        dd = st.setdefault("days", {}).setdefault(day, {"usd": 0.0, "requests": 0})
        dd["usd"] = max(0.0, dd["usd"] + delta)
        return dd["usd"], st["lifetime_usd"]

    return with_counters(fn)


# ---- validation -----------------------------------------------------------------------------
def validate(body):
    if not isinstance(body, dict):
        return "body must be a JSON object"
    session = body.get("session")
    if not isinstance(session, str) or not SESSION_RE.match(session):
        return "session must be 8-64 chars of [A-Za-z0-9_-]"
    msgs = body.get("messages")
    if not isinstance(msgs, list) or not (1 <= len(msgs) <= MAX_MESSAGES):
        return "messages must be a list of 1-%d items" % MAX_MESSAGES
    total = 0
    for i, m in enumerate(msgs):
        if not isinstance(m, dict) or set(m) != {"role", "content"}:
            return "each message must be {role, content}"
        role, content = m["role"], m["content"]
        if role not in ("user", "assistant"):
            return "role must be user or assistant"
        if role != ("user" if i % 2 == 0 else "assistant"):
            return "roles must alternate, starting with user"
        if not isinstance(content, str) or not content.strip():
            return "content must be a non-empty string"
        if len(content) > MAX_MSG_CHARS:
            return "message too long"
        total += len(content)
    if total > MAX_TOTAL_CHARS:
        return "conversation too long"
    if msgs[-1]["role"] != "user":
        return "last message must be from the user"
    return None


def clean_reply(text):
    t = re.sub(r"[*_#`>\[\]]", "", text)
    t = re.sub(r"\s+", " ", t).strip()
    return t


# ---- upstream -------------------------------------------------------------------------------
def call_claude(messages):
    payload = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": PERSONA,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
        # Short spoken replies: no thinking (accepted on Haiku 5.5 at effort <= high), low effort.
        "thinking": {"type": "disabled"},
        "output_config": {"effort": "low"},
    }
    req = urllib.request.Request(
        UPSTREAM_URL, data=json.dumps(payload).encode(), method="POST",
        headers={"content-type": "application/json", "x-api-key": API_KEY,
                 "anthropic-version": API_VERSION})
    try:
        with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {}
        return e.code, body
    except Exception:
        return 0, {}


FALLBACK = "I would rather not go there. Ask me about Oeuvre, or about what you are hoping to make."


# ---- HTTP handler ---------------------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm",
        ".bin": "application/octet-stream", ".json": "application/json",
        ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml",
        ".task": "application/octet-stream",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):  # static access log: method + path only, no bodies
        log("%s %s" % (self.address_string(), fmt % args))

    def send_head(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if DENY_RE.search(path) or path.startswith("/tools/review_render"):
            self.send_error(404)
            return None
        return super().send_head()

    def send_error(self, code, message=None, explain=None):
        # Serve the site's own 404 page for GET/HEAD misses, like ErrorDocument in .htaccess.
        page = os.path.join(ROOT, "404.html")
        if code == 404 and self.command in ("GET", "HEAD") and os.path.isfile(page):
            with open(page, "rb") as f:
                b = f.read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            if self.command == "GET":
                self.wfile.write(b)
            return
        super().send_error(code, message, explain)

    def do_POST(self):
        if urllib.parse.urlsplit(self.path).path == "/api/tts":
            return self.tts()
        if urllib.parse.urlsplit(self.path).path != "/api/talk":
            return self.reply(404, {"error": "not found", "code": "bad_request"})
        t0 = time.time()
        status, out, info = self.talk()
        self.reply(status, out)
        log("talk status=%d code=%s %s ms=%d" % (status, out.get("code", "ok"), info,
                                                 (time.time() - t0) * 1000))

    def do_OPTIONS(self):
        self.reply(405, {"error": "method not allowed", "code": "bad_request"})

    def same_origin(self):
        host = (self.headers.get("Host") or "").lower()
        for h in ("Origin", "Referer"):
            v = self.headers.get(h)
            if v:
                return urllib.parse.urlsplit(v).netloc.lower() == host
        return True

    def talk(self):
        if not self.same_origin():
            return 403, {"error": "cross-origin request refused", "code": "bad_request"}, ""
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            return 415, {"error": "expected application/json", "code": "bad_request"}, ""
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n <= 0 or n > MAX_BODY_BYTES:
            return 413, {"error": "body missing or too large", "code": "bad_request"}, ""
        try:
            body = json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return 400, {"error": "invalid JSON", "code": "bad_request"}, ""
        err = validate(body)
        if err:
            return 400, {"error": err, "code": "bad_request"}, ""
        if not API_KEY or not PERSONA:
            return 500, {"error": "server not configured", "code": "config"}, ""
        msgs = body["messages"]
        total = sum(len(m["content"]) for m in msgs)
        try:
            ok, code, reserved = reserve(self.client_address[0], body["session"], total)
        except (CounterError, OSError):
            return 500, {"error": "server not configured", "code": "config"}, "counters=unavailable"
        if not ok:
            if code == "budget":
                return 503, {"error": "the figure is resting for now", "code": "budget"}, ""
            return 429, {"error": "too many messages, try again later", "code": "rate_limited"}, ""

        st, data = call_claude(msgs)
        usage = data.get("usage") or {}
        tin, tout = int(usage.get("input_tokens") or 0), int(usage.get("output_tokens") or 0)
        actual = tin * PRICE_IN + tout * PRICE_OUT if usage else (reserved if st == 200 else 0.0)
        try:
            day_usd, life_usd = settle(reserved, actual)
        except (CounterError, OSError):
            day_usd = life_usd = float("nan")
        info = "in=%d out=%d cost=%.6f day=%.4f life=%.4f" % (tin, tout, actual, day_usd, life_usd)

        if st == 200:
            if data.get("stop_reason") == "refusal":
                return 200, {"reply": FALLBACK, "sig": tts_sig(FALLBACK)}, info + " stop=refusal"
            text = " ".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
            text = clean_reply(text)
            if data.get("stop_reason") == "max_tokens":  # trim to the last full sentence
                cut = max(text.rfind(". "), text.rfind("? "), text.rfind("! "))
                text = text[:cut + 1] if cut > 0 else text
            if not text:
                return 502, {"error": "empty reply", "code": "upstream"}, info
            return 200, {"reply": text, "sig": tts_sig(text)}, info
        if st in (401, 403):
            return 500, {"error": "server not configured", "code": "config"}, info + " upstream=%d" % st
        return 502, {"error": "the figure could not answer just now", "code": "upstream"}, \
            info + " upstream=%d" % st

    def tts(self):
        """POST /api/tts {text, sig}: ElevenLabs audio for a signed reply (dev twin of api/tts.php)."""
        if not self.same_origin():
            return self.reply(403, {"error": "cross-origin request refused", "code": "bad_request"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n).decode("utf-8")) if 0 < n <= 8192 else None
        except (ValueError, UnicodeDecodeError):
            body = None
        text = (body or {}).get("text") if isinstance(body, dict) else None
        sig = (body or {}).get("sig") if isinstance(body, dict) else None
        if not isinstance(text, str) or not isinstance(sig, str) or not text.strip() or len(text) > 700:
            return self.reply(400, {"error": "bad body", "code": "bad_request"})
        import hmac
        if not ELEVEN_KEY or not API_KEY or not hmac.compare_digest(tts_sig(text.strip()), sig):
            return self.reply(403 if ELEVEN_KEY else 500, {"error": "unsigned text or no voice", "code": "bad_request"})
        req = urllib.request.Request(
            "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=%s" % (TTS_VOICE, TTS_OUTPUT),
            data=json.dumps({"text": text.strip(), "model_id": TTS_MODEL}).encode(),
            headers={"xi-api-key": ELEVEN_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                audio = r.read()
        except urllib.error.HTTPError as e:
            log("tts upstream=%d" % e.code)
            return self.reply(502, {"error": "the voice could not speak just now", "code": "upstream"})
        except (urllib.error.URLError, OSError):
            return self.reply(502, {"error": "the voice could not speak just now", "code": "upstream"})
        log("tts status=200 chars=%d" % len(text))
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)

    def reply(self, status, obj):
        b = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        if status == 429:
            self.send_header("Retry-After", "3600")
        self.end_headers()
        self.wfile.write(b)


def main():
    global API_KEY, PERSONA
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8130)
    ap.add_argument("--root", default=None, help="folder to serve (default: repo root)")
    a = ap.parse_args()
    if a.root:
        global ROOT, PERSONA_FILE
        ROOT = os.path.abspath(a.root)
        PERSONA_FILE = os.path.join(ROOT, "api", "persona.php")
    API_KEY = load_key()
    global ELEVEN_KEY
    ELEVEN_KEY = load_eleven_key()
    PERSONA = load_persona()
    log("dev_server root=%s model=%s key=%s daily_cap=%.2f lifetime_cap=%.2f counters=%s" % (
        ROOT, MODEL, "loaded" if API_KEY else "MISSING", DAILY_USD, LIFETIME_USD, COUNTER_FILE))
    srv = http.server.ThreadingHTTPServer((a.host, a.port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
