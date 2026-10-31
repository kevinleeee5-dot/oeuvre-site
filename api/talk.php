<?php
declare(strict_types=1);
/*
 * POST /api/talk — the figure's voice (Claude API proxy). Production twin of tools/dev_server.py.
 *
 *   request : {"messages":[{"role":"user"|"assistant","content":string}], "session":string}
 *   response: 200 {"reply":string}  |  4xx/5xx {"error":string, "code":rate_limited|budget|bad_request|upstream|config}
 *
 * Secrets: the API key comes from getenv('ANTHROPIC_API_KEY') or from the file
 *   dirname(__DIR__, 2) . '/oeuvre-secrets/anthropic.key'   (outside public_html; see api/README.md)
 * Counters: dirname(__DIR__, 2) . '/oeuvre-secrets/talk-counters.json' (outside the web root), guarded by flock.
 * Requires PHP >= 8.1 (never, array_is_list) with curl + mbstring. Spend is reserved (worst case)
 * before each upstream call and settled from real usage after it, so caps cannot be overshot.
 * Nothing here logs message text or the key; error_log gets counts and costs only.
 */

const MODEL = 'claude-haiku-5-5';
const API_VERSION = '2026-10-21';
const API_URL = 'https://api.anthropic.com/v1/messages';
const PRICE_IN = 0.10 / 1e6;   // USD per input token (Claude Haiku 5.5, prompts <= 100K tokens)
const PRICE_OUT = 0.50 / 1e6;  // USD per output token
const MAX_TOKENS = 220;

const MAX_MESSAGES = 12;
const MAX_MSG_CHARS = 600;
const MAX_TOTAL_CHARS = 4000;
const MAX_BODY_BYTES = 16384;
const SESSION_TURNS = 14;
const IP_PER_HOUR = 40;
const IP_PER_DAY = 120;
const DAILY_USD = 4.0;
const LIFETIME_USD = 80.0;     // hard cap; the counter file can only lower it
const UPSTREAM_TIMEOUT = 25;

const SECRETS_DIR = 'oeuvre-secrets';  // sibling of public_html
const FALLBACK = 'I would rather not go there. Ask me about Oeuvre, or about what you are hoping to make.';

final class CounterError extends Exception {}

function out(int $status, array $obj): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if ($status === 429) header('Retry-After: 3600');
    echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $code, string $msg): never {
    out($status, ['error' => $msg, 'code' => $code]);
}

function logline(string $s): void {
    error_log('oeuvre-talk ' . $s);
}

function secrets_dir(): string {
    return dirname(__DIR__, 2) . '/' . SECRETS_DIR;
}

function load_key(): string {
    $k = getenv('ANTHROPIC_API_KEY');
    if (is_string($k) && trim($k) !== '') return trim($k);
    $f = secrets_dir() . '/anthropic.key';
    if (!is_readable($f)) return '';
    $raw = (string) file_get_contents($f);
    return preg_match('/sk-ant-[A-Za-z0-9_\-]+/', $raw, $m) ? $m[0] : '';
}

/*
 * Counters live next to the key, outside the web root. There is deliberately no fallback to
 * sys_get_temp_dir(): shared-host temp dirs get wiped, which would silently reset the lifetime
 * spend total. If the directory is missing or not writable, every request fails with 'config'.
 */
function counter_file(): string {
    $dir = secrets_dir();
    if (!is_dir($dir) || !is_writable($dir)) throw new CounterError('no writable ' . SECRETS_DIR);
    return $dir . '/talk-counters.json';
}

/** Run $fn(&$state) under an exclusive flock and persist the state. Fails closed. */
function with_counters(callable $fn) {
    $path = counter_file();
    $fp = @fopen($path, 'c+');
    if ($fp === false) throw new CounterError('open');
    try {
        if (!flock($fp, LOCK_EX)) throw new CounterError('lock');
        $raw = stream_get_contents($fp);
        if ($raw === false) throw new CounterError('read');
        if (trim($raw) === '') {
            $st = ['version' => 1, 'lifetime_usd' => 0.0, 'days' => [], 'ip' => [], 'sessions' => []];
        } else {
            $st = json_decode($raw, true);
            // Never reset an unreadable counter: that would reset the lifetime cap.
            if (!is_array($st) || !is_numeric($st['lifetime_usd'] ?? null)) throw new CounterError('corrupt');
        }
        $result = $fn($st);
        $json = json_encode($st, JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new CounterError('encode');
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, $json);
        fflush($fp);
        return $result;
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

function ip_key(string $ip): string {
    return substr(hash('sha256', 'oeuvre-talk:' . $ip), 0, 20);
}

function utc_day(int $ts): string {
    return gmdate('Y-m-d', $ts);
}

/** @return array{0:bool,1:?string,2:float} */
function reserve(string $ip, string $session, float $cost): array {
    $now = microtime(true);
    $day = utc_day((int) $now);
    return with_counters(function (array &$st) use ($ip, $session, $cost, $now, $day) {
        $st['days'] = is_array($st['days'] ?? null) ? $st['days'] : [];
        $st['ip'] = is_array($st['ip'] ?? null) ? $st['ip'] : [];
        $st['sessions'] = is_array($st['sessions'] ?? null) ? $st['sessions'] : [];
        $oldest = utc_day((int) ($now - 14 * 86400));
        foreach (array_keys($st['days']) as $d) if (strcmp((string) $d, $oldest) < 0) unset($st['days'][$d]);
        foreach ($st['ip'] as $k => $hits) {
            $hits = array_values(array_filter((array) $hits, fn($t) => $t > $now - 86400));
            if ($hits) $st['ip'][$k] = $hits; else unset($st['ip'][$k]);
        }
        foreach ($st['sessions'] as $k => $s) if (($s['ts'] ?? 0) < $now - 86400) unset($st['sessions'][$k]);

        $capLife = min(LIFETIME_USD, (float) ($st['lifetime_cap_usd'] ?? LIFETIME_USD));
        $st['lifetime_cap_usd'] = $capLife;
        $dd = $st['days'][$day] ?? ['usd' => 0.0, 'requests' => 0];
        if ((float) $st['lifetime_usd'] + $cost > $capLife || (float) $dd['usd'] + $cost > DAILY_USD) {
            return [false, 'budget', 0.0];
        }
        $ik = ip_key($ip);
        $hits = $st['ip'][$ik] ?? [];
        $lastHour = count(array_filter($hits, fn($t) => $t > $now - 3600));
        if ($lastHour >= IP_PER_HOUR || count($hits) >= IP_PER_DAY) return [false, 'rate_limited', 0.0];
        $s = $st['sessions'][$session] ?? ['turns' => 0, 'ts' => $now];
        if ((int) $s['turns'] >= SESSION_TURNS) return [false, 'rate_limited', 0.0];

        $hits[] = $now;
        $st['ip'][$ik] = $hits;
        $st['sessions'][$session] = ['turns' => (int) $s['turns'] + 1, 'ts' => $now];
        $st['lifetime_usd'] = (float) $st['lifetime_usd'] + $cost;
        $dd['usd'] = (float) $dd['usd'] + $cost;
        $dd['requests'] = (int) $dd['requests'] + 1;
        $st['days'][$day] = $dd;
        return [true, null, $cost];
    });
}

/** @return array{0:float,1:float} day total, lifetime total */
function settle(float $reserved, float $actual): array {
    $day = utc_day(time());
    return with_counters(function (array &$st) use ($reserved, $actual, $day) {
        $delta = $actual - $reserved;
        $st['lifetime_usd'] = max(0.0, (float) $st['lifetime_usd'] + $delta);
        $dd = $st['days'][$day] ?? ['usd' => 0.0, 'requests' => 0];
        $dd['usd'] = max(0.0, (float) $dd['usd'] + $delta);
        $st['days'][$day] = $dd;
        return [$dd['usd'], $st['lifetime_usd']];
    });
}

function validate($body): ?string {
    if (!is_array($body) || array_is_list($body)) return 'body must be a JSON object';
    $session = $body['session'] ?? null;
    if (!is_string($session) || !preg_match('/^[A-Za-z0-9_-]{8,64}$/', $session)) {
        return 'session must be 8-64 chars of [A-Za-z0-9_-]';
    }
    $msgs = $body['messages'] ?? null;
    if (!is_array($msgs) || !array_is_list($msgs) || count($msgs) < 1 || count($msgs) > MAX_MESSAGES) {
        return 'messages must be a list of 1-' . MAX_MESSAGES . ' items';
    }
    $total = 0;
    foreach ($msgs as $i => $m) {
        if (!is_array($m) || array_is_list($m) || count($m) !== 2
            || !array_key_exists('role', $m) || !array_key_exists('content', $m)) {
            return 'each message must be {role, content}';
        }
        if (!in_array($m['role'], ['user', 'assistant'], true)) return 'role must be user or assistant';
        if ($m['role'] !== ($i % 2 === 0 ? 'user' : 'assistant')) return 'roles must alternate, starting with user';
        if (!is_string($m['content']) || trim($m['content']) === '') return 'content must be a non-empty string';
        $len = mb_strlen($m['content'], 'UTF-8');
        if ($len > MAX_MSG_CHARS) return 'message too long';
        $total += $len;
    }
    if ($total > MAX_TOTAL_CHARS) return 'conversation too long';
    if ($msgs[count($msgs) - 1]['role'] !== 'user') return 'last message must be from the user';
    return null;
}

function same_origin(): bool {
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
        $v = $_SERVER[$h] ?? '';
        if ($v !== '') {
            $p = parse_url($v);
            if (!is_array($p) || !isset($p['host'])) return false;
            $netloc = strtolower($p['host'] . (isset($p['port']) ? ':' . $p['port'] : ''));
            return $netloc === $host;
        }
    }
    return true;
}

function clean_reply(string $t): string {
    $t = preg_replace('/[*_#`>\[\]]/u', '', $t) ?? $t;
    return trim(preg_replace('/\s+/u', ' ', $t) ?? $t);
}

/** @return array{0:int,1:array} */
function call_claude(string $key, string $system, array $messages): array {
    $payload = [
        'model' => MODEL,
        'max_tokens' => MAX_TOKENS,
        'system' => $system,
        'messages' => array_map(fn($m) => ['role' => $m['role'], 'content' => $m['content']], $messages),
        // Short spoken replies: no thinking (accepted on Haiku 5.5 at effort <= high), low effort.
        'thinking' => ['type' => 'disabled'],
        'output_config' => ['effort' => 'low'],
    ];
    $ch = curl_init(API_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => UPSTREAM_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'content-type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: ' . API_VERSION,
        ],
    ]);
    $resp = curl_exec($ch);
    $status = $resp === false ? 0 : (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $data = is_string($resp) ? json_decode($resp, true) : null;
    return [$status, is_array($data) ? $data : []];
}

// ---------------------------------------------------------------------------------- main
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'bad_request', 'method not allowed');
}
if (!same_origin()) fail(403, 'bad_request', 'cross-origin request refused');
$ctype = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($ctype !== 'application/json') fail(415, 'bad_request', 'expected application/json');
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($raw === false || $raw === '' || strlen($raw) > MAX_BODY_BYTES) fail(413, 'bad_request', 'body missing or too large');
$body = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) fail(400, 'bad_request', 'invalid JSON');
$err = validate($body);
if ($err !== null) fail(400, 'bad_request', $err);

$key = load_key();
$persona = @include __DIR__ . '/persona.php';
if ($key === '' || !is_string($persona) || $persona === '') {
    logline('status=500 code=config key=' . ($key === '' ? 'missing' : 'ok'));
    fail(500, 'config', 'server not configured');
}

$msgs = $body['messages'];
$total = 0;
foreach ($msgs as $m) $total += mb_strlen($m['content'], 'UTF-8');
// Pessimistic reservation: ~2 chars per token for input, full max_tokens for output.
$estIn = (int) ceil((mb_strlen($persona, 'UTF-8') + $total) / 2) + 100;
$reserve = $estIn * PRICE_IN + MAX_TOKENS * PRICE_OUT;

try {
    [$ok, $code, $reserved] = reserve((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $body['session'], $reserve);
} catch (Throwable $e) {
    logline('status=500 code=config counters=unavailable');
    fail(500, 'config', 'server not configured');
}
if (!$ok) {
    logline('status=' . ($code === 'budget' ? 503 : 429) . ' code=' . $code);
    if ($code === 'budget') fail(503, 'budget', 'the figure is resting for now');
    fail(429, 'rate_limited', 'too many messages, try again later');
}

$t0 = microtime(true);
[$st, $data] = call_claude($key, $persona, $msgs);
$usage = is_array($data['usage'] ?? null) ? $data['usage'] : null;
$tin = (int) ($usage['input_tokens'] ?? 0);
$tout = (int) ($usage['output_tokens'] ?? 0);
$actual = $usage !== null ? $tin * PRICE_IN + $tout * PRICE_OUT : ($st === 200 ? $reserved : 0.0);
try {
    [$dayUsd, $lifeUsd] = settle($reserved, $actual);
} catch (Throwable $e) {
    $dayUsd = $lifeUsd = NAN;
}
$info = sprintf('in=%d out=%d cost=%.6f day=%.4f life=%.4f ms=%d upstream=%d',
    $tin, $tout, $actual, $dayUsd, $lifeUsd, (int) ((microtime(true) - $t0) * 1000), $st);

if ($st === 200) {
    if (($data['stop_reason'] ?? '') === 'refusal') {
        logline('status=200 code=ok stop=refusal ' . $info);
        out(200, ['reply' => FALLBACK]);
    }
    $text = '';
    foreach ((array) ($data['content'] ?? []) as $b) {
        if (is_array($b) && ($b['type'] ?? '') === 'text') $text .= ' ' . (string) ($b['text'] ?? '');
    }
    $text = clean_reply($text);
    if (($data['stop_reason'] ?? '') === 'max_tokens') {  // trim to the last full sentence
        $cut = max((int) strrpos($text, '. '), (int) strrpos($text, '? '), (int) strrpos($text, '! '));
        if ($cut > 0) $text = substr($text, 0, $cut + 1);
    }
    if ($text === '') {
        logline('status=502 code=upstream empty ' . $info);
        fail(502, 'upstream', 'empty reply');
    }
    logline('status=200 code=ok ' . $info);
    out(200, ['reply' => $text]);
}
if ($st === 401 || $st === 403) {
    logline('status=500 code=config ' . $info);
    fail(500, 'config', 'server not configured');
}
logline('status=502 code=upstream ' . $info);
fail(502, 'upstream', 'the figure could not answer just now');
