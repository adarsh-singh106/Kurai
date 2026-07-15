# Kurai ⚡

**A modern, zero-install, browser-based API client for developers.** Think Postman — but open, lightweight, self-hostable, and running entirely from a single Node.js process.

```
npm install && npm run dev   →   http://localhost:3000   →   start sending requests
```

---

## Why Kurai?

| | Kurai | Typical desktop API clients |
|---|---|---|
| Install | None — runs in the browser | 500MB+ desktop app |
| Account required | Never | Often forced sign-in |
| Data ownership | Your disk / your database | Vendor cloud |
| CORS-restricted APIs | Built-in SSRF-safe proxy | Desktop-only workaround |
| Self-host for a team | One container | Enterprise pricing |
| Scriptable tests | Sandboxed `kurai.test()` API | Proprietary runtime |

## Features

- **Request builder** — all HTTP methods including the new `QUERY`, headers, query params, JSON/raw/form-data/x-www-form-urlencoded bodies, Bearer/Basic/API-Key auth
- **URL ⇄ Params live sync** — type `?page=1&limit=2` in the URL bar and param rows appear; edit a row and the URL rewrites instantly (unchecking a row drops it from the URL). Pasting `GET https://…` from docs auto-sets the method
- **Test scripts** — Postman-like `kurai.test()` / `kurai.expect()` assertions run against every response in an isolated `vm` sandbox (1s timeout); results land in the **Test Results** tab. Scripts can extract values (`kurai.variables.set('TOKEN', response.json.token)`) straight into the active environment to chain requests
- **Response viewer** — status/time/size chips, **Body** (Pretty / Raw / sandboxed HTML Preview / Visualize-as-table), **Headers** and **Cookies** tabs with count badges, copy-raw-body button
- **Resizable workspace** — drag the request/response divider and the sidebar edge; sizes persist, double-click resets
- **SSRF-hardened proxy** — bypass CORS safely; private/loopback/metadata IPs (IPv4 *and* IPv6) are blocked on every redirect hop, not just the first request
- **Collections** — save and organize requests, persisted server-side
- **Environments** — variable sets (`{{baseUrl}}`-style) switchable per request; the active environment survives reloads, and unresolved variables are caught client-side with a friendly error before anything is sent
- **History** — automatic log of recent requests
- **Pluggable storage** — zero-setup atomic JSON files on disk (no database required); the storage layer is an interface, so a different backend is a config change, not a rewrite
- **Dark & light themes**

### Scripting API (Tests tab)

Write assertions in the request's **Tests** tab — they run server-side in a `vm` sandbox after each response:

```js
kurai.test('status is 200', () => kurai.expect(response.status).toBe(200));
kurai.test('fast enough',   () => kurai.expect(response.time).toBeLessThan(500));
kurai.test('has users',     () => kurai.expect(response.json.data).toContain(expected));

// Chain requests: extract a value, use it as {{TOKEN}} in the next request
kurai.variables.set('TOKEN', response.json.token);
```

| API | Description |
|---|---|
| `response` | `{ status, statusText, headers, body, json, time, size }` — `json` is the parsed body or `null` |
| `kurai.test(name, fn)` | Registers one test row; `fn` throwing = fail |
| `kurai.expect(v)` | Matchers: `toBe`, `toEqual`, `toBeLessThan`, `toBeGreaterThan`, `toContain` |
| `kurai.variables.get/set` | Read the active environment; writes merge back after the request |

Sandbox guarantees: no filesystem, no network, no process access, 1-second hard timeout — a broken script can never lose the HTTP response.

## Quickstart

```bash
git clone <repo-url> && cd Kurai
npm install
cp .env.example .env        # optional — sensible defaults built in
npm run dev                 # nodemon, auto-reload
# or
npm start                   # production
```

Open **http://localhost:3000**.

### Try it against the demo API

A built-in demo server exercises every Kurai feature (all methods incl. `QUERY`, every body format, all three auth schemes, status/delay/size simulators):

```bash
npm run demo                              # demo API on http://127.0.0.1:5100
PROXY_ALLOW_PRIVATE_IPS=true npm run dev  # Kurai, allowed to reach localhost
```

Then follow the step-by-step walkthrough in [test-server/README.md](test-server/README.md).

### Docker

```bash
docker compose -f docker/docker-compose.yml up
```

## API Reference

All responses use a uniform envelope:

```jsonc
{ "ok": true,  "data": { ... } }            // success
{ "ok": false, "error": { "code": "SSRF_BLOCKED", "message": "..." } }  // failure
```

### `POST /api/proxy`

Forwards a request to any public URL, bypassing browser CORS.

```jsonc
{
  "url": "https://api.example.com/users",   // required
  "method": "POST",                          // required
  "headers": { "Content-Type": "application/json" },
  "body": "{\"name\":\"kurai\"}",
  "script": "kurai.test('ok', () => kurai.expect(response.status).toBe(200));",  // optional test script
  "variables": { "BASE_URL": "https://api.example.com" }                          // optional env snapshot for the script
}
```

Returns `status`, `statusText`, `headers`, `setCookies` (array — one entry per `Set-Cookie`), `body`, `time` (ms), `size` (bytes), and `finalUrl` (after redirects). When a `script` is supplied, the result also carries `testResults` (`[{ name, passed, error }]`) and `variables` (post-script values). Error codes: `INVALID_URL`, `INVALID_PROTOCOL`, `SSRF_BLOCKED` (403), `RESPONSE_TOO_LARGE` (413), `RATE_LIMITED` (429), `UPSTREAM_UNREACHABLE` (502), `TOO_MANY_REDIRECTS` (502), `UPSTREAM_TIMEOUT` (504).

### Collections — `/api/collections`

| Method | Path | Action |
|---|---|---|
| GET | `/` | List collections |
| POST | `/` | Create |
| GET | `/:id` | Fetch one (404 if missing) |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Delete |

### Environments — `/api/environments`

Same shape: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`.

### History — `/api/history`

`GET /` lists recent requests (last 50, in-memory); `DELETE /` clears.

### `GET /health`

Liveness probe for Docker/Kubernetes/load balancers — returns `status`, `timestamp`, `uptime`.

## Configuration

All via environment variables (see [.env.example](.env.example)):

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `NODE_ENV` | `development` | `production` enables HSTS, hides stack traces, locks CORS to `CORS_ORIGIN` |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin in production |
| `STORAGE_BACKEND` | `file` | Atomic JSON files on disk — no database required |
| `PROXY_TIMEOUT_MS` | `30000` | Upstream timeout |
| `PROXY_MAX_RESPONSE_BYTES` | `52428800` | 50MB body cap |
| `PROXY_ALLOW_PRIVATE_IPS` | `false` | ⚠️ only for testing local APIs |
| `RATE_LIMIT_ENABLED` | `true` | |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | `60000` / `100` | Per-IP sliding window |
| `AUTH_ENABLED` / `AUTH_SECRET` | `false` / — | Phase 2: API-key auth (secret min 32 chars, enforced at boot) |

## Architecture

```
client/   Vanilla JS SPA — feature folders (request, response, collections,
          environment, history), IndexedDB + localStorage persistence
server/   Express 5 (ESM)
 ├─ routes/       thin HTTP handlers, uniform JSON envelope
 ├─ middleware/   security headers, validation, rate limit, logging, errors
 ├─ services/     proxyEngine (SSRF-safe fetch), scriptSandbox (vm), storage selector
 └─ storage/      file adapter (atomic JSON writes) behind a swappable interface
```

Design principles: **zero external security dependencies** (headers, rate limiting, and validation are hand-rolled and auditable), every module documents *who it is / what it owns*, and storage is an interface so scale is a config change — not a rewrite.

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Full product feature reference (and the Kurai-vs-Postman breakdown) in [docs/FEATURES.md](docs/FEATURES.md).

## Scaling path

1. **Solo dev (today):** `file` backend (atomic JSON writes), in-memory rate limits — zero setup, no database anywhere.
2. **Team:** run behind nginx (`trust proxy` already configured) in one container; collections/environments live on a shared volume.
3. **Beyond:** the storage layer is a small interface (`server/storage/`), so swapping the file adapter for anything else is a config change — stateless server containers, the health endpoint, and graceful SIGTERM shutdown are already k8s-ready.

## Security model

- **SSRF protection:** hostname + DNS-resolved IPv4/IPv6 checks against loopback, RFC1918, link-local (cloud metadata), and unique-local ranges — re-validated on **every redirect hop**; only `http:`/`https:` allowed
- **Header hygiene:** hop-by-hop headers stripped; `Authorization` dropped on cross-origin redirects
- **Response limits:** streaming size cap with early socket cancel
- **Hardened headers:** CSP without `unsafe-inline` scripts, X-Frame-Options DENY, HSTS in production
- **Sandboxed scripts:** user test scripts run in `vm` with no filesystem/network/process access and a hard timeout

## Contributing / Development

```bash
npm run dev          # auto-reload server
```

No build step — the client is plain ES modules served statically.

## License

ISC
