<?php
declare(strict_types=1);
/*
 * POST /api/tts — the figure's voice (ElevenLabs proxy). Speaks only replies that /api/talk signed.
 *
 *   request : {"text": string, "sig": string, "session": string}
 *   response: 200 audio/mpeg  |  4xx/5xx {"error": string, "code": rate_limited|budget|bad_request|upstream|config}
 *
 * Secrets (outside public_html, next to the Claude key): oeuvre-secrets/elevenlabs.key (or env ELEVENLABS_API_KEY).
 * The signature secret is derived from the Claude key (oeuvre-secrets/anthropic.key), shared with talk.php.
 * Guards: signed text only, <= 700 characters, 60 requests per IP per hour, 25,000 characters per UTC day.
 * Counters: oeuvre-secrets/tts-counters.json under flock. Nothing logs the text or the keys.
 */

const VOICE_ID = 'SAz9YHcvj6GT2YYXdXww';            // River
const MODEL_ID = 'eleven_multilingual_v2';
const OUTPUT = 'mp3_44100_64';
const MAX_CHARS = 700;
const IP_PER_HOUR = 60;
const DAILY_CHARS = 25000;
const SECRETS_DIR = 'oeuvre-secrets';

function out_json(int $status, string $code, string $msg): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if ($status === 429) header('Retry-After: 3600');
    echo json_encode(['error' => $msg, 'code' => $code]);
    exit;
}
function logline(string $s): void { error_log('oeuvre-tts ' . $s); }
function secrets_dir(): string { return dirname(__DIR__, 2) . '/' . SECRETS_DIR; }
function read_secret(string $env, string $file, string $pattern): string {
    $k = getenv($env);
    if (is_string($k) && trim($k) !== '') return trim($k);
    $f = secrets_dir() . '/' . $file;
    if (!is_readable($f)) return '';
    return preg_match($pattern, (string) file_get_contents($f), $m) ? $m[0] : '';
}
function same_origin(): bool {
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
        if (!empty($_SERVER[$h])) return strtolower((string) parse_url($_SERVER[$h], PHP_URL_HOST) . (parse_url($_SERVER[$h], PHP_URL_PORT) ? ':' . parse_url($_SERVER[$h], PHP_URL_PORT) : '')) === $host;
    }
    return true;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out_json(405, 'bad_request', 'method not allowed');
if (!same_origin()) out_json(403, 'bad_request', 'cross-origin request refused');
if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) out_json(415, 'bad_request', 'expected application/json');
$raw = file_get_contents('php://input', false, null, 0, 8192);
$body = json_decode((string) $raw, true);
if (!is_array($body) || !is_string($body['text'] ?? null) || !is_string($body['sig'] ?? null)) out_json(400, 'bad_request', 'bad body');
$text = trim($body['text']);
if ($text === '' || mb_strlen($text) > MAX_CHARS) out_json(400, 'bad_request', 'bad text');

$claude = read_secret('ANTHROPIC_API_KEY', 'anthropic.key', '/sk-ant-[A-Za-z0-9_\-]+/');
$eleven = read_secret('ELEVENLABS_API_KEY', 'elevenlabs.key', '/sk_[A-Za-z0-9]{20,}|[a-f0-9]{32}/');
if ($claude === '' || $eleven === '') out_json(500, 'config', 'voice not configured');
$want = substr(hash_hmac('sha256', $text, hash('sha256', 'oeuvre-tts:' . $claude)), 0, 32);
if (!hash_equals($want, $body['sig'])) out_json(403, 'bad_request', 'unsigned text');

// counters (fail closed)
$dir = secrets_dir();
if (!is_dir($dir) || !is_writable($dir)) out_json(500, 'config', 'voice not configured');
$fp = @fopen($dir . '/tts-counters.json', 'c+');
if ($fp === false || !flock($fp, LOCK_EX)) out_json(500, 'config', 'voice not configured');
$st = json_decode((string) stream_get_contents($fp), true);
if (!is_array($st)) $st = ['days' => [], 'ip' => []];
$now = time(); $day = gmdate('Y-m-d', $now); $ipk = substr(hash('sha256', 'oeuvre-tts:' . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 20);
$st['days'] = array_filter((array) ($st['days'] ?? []), fn($k) => $k >= gmdate('Y-m-d', $now - 3 * 86400), ARRAY_FILTER_USE_KEY);
$hits = array_values(array_filter((array) ($st['ip'][$ipk] ?? []), fn($t) => $t > $now - 3600));
$chars = mb_strlen($text);
$used = (int) ($st['days'][$day] ?? 0);
$deny = count($hits) >= IP_PER_HOUR ? 'rate_limited' : ($used + $chars > DAILY_CHARS ? 'budget' : '');
if ($deny === '') { $hits[] = $now; $st['ip'][$ipk] = $hits; $st['days'][$day] = $used + $chars; }
foreach ((array) $st['ip'] as $k => $v) { if (!array_filter((array) $v, fn($t) => $t > $now - 3600)) unset($st['ip'][$k]); }
rewind($fp); ftruncate($fp, 0); fwrite($fp, (string) json_encode($st)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
if ($deny === 'rate_limited') out_json(429, 'rate_limited', 'too many requests');
if ($deny === 'budget') out_json(503, 'budget', 'the voice is resting for today');

$ch = curl_init('https://api.elevenlabs.io/v1/text-to-speech/' . VOICE_ID . '?output_format=' . OUTPUT);
curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => ['xi-api-key: ' . $eleven, 'Content-Type: application/json', 'Accept: audio/mpeg'],
    CURLOPT_POSTFIELDS => json_encode(['text' => $text, 'model_id' => MODEL_ID]),
]);
$audio = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
if ($code !== 200 || !is_string($audio) || $audio === '') {
    logline('status=502 upstream=' . $code . ' chars=' . $chars);
    out_json(502, 'upstream', 'the voice could not speak just now');
}
logline('status=200 chars=' . $chars . ' day=' . ($used + $chars));
header('Content-Type: audio/mpeg');
header('Cache-Control: no-store');
header('Content-Length: ' . strlen($audio));
echo $audio;
