# Kurai — Product Features

> **Kurai (暗い)** is a zero-install, browser-based API client that runs entirely from a single Node.js process. This document is the detailed feature reference — and an honest answer to the question every API tool has to face: *why not just use Postman?*

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Feature Deep-Dive](#feature-deep-dive)
   - [Request Builder](#1-request-builder)
   - [SSRF-Hardened CORS Proxy](#2-ssrf-hardened-cors-proxy)
   - [Collections](#3-collections)
   - [Environments & Variables](#4-environments--variables)
   - [Request History](#5-request-history)
   - [Scriptable Tests](#6-scriptable-tests-kuraitest)
   - [Response Viewer](#7-response-viewer)
   - [Theming & UX](#8-theming--ux)
   - [Storage Architecture](#9-pluggable-storage)
   - [CLI Launcher](#10-cli-launcher)
   - [Security Hardening](#11-security-hardening)
3. [Kurai vs Postman — The Honest Comparison](#kurai-vs-postman--the-honest-comparison)
4. [Who Kurai Is For](#who-kurai-is-for)

---

## Philosophy

Kurai is built on four convictions:

1. **An API client should not need an account.** Your requests, tokens, and API shapes are some of the most sensitive data you own. They should never transit a vendor's cloud just so you can test `GET /users`.
2. **An API client should not weigh 500 MB.** Kurai is plain HTML/CSS/ES-modules on the front and a single Express process on the back. No Electron, no build step, no framework.
3. **Security tooling should itself be secure.** A CORS-bypass proxy is an SSRF machine unless proven otherwise — Kurai treats its proxy as attack surface first, feature second.
4. **Scaling should be a config change, not a rewrite.** Storage is an interface; going from solo dev to team deployment means changing one environment variable.

---

## Feature Deep-Dive

### 1. Request Builder

The main workspace for composing HTTP requests.

- **All standard methods plus the newest one** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, **and the new HTTP `QUERY` method** (safe, idempotent GET-with-a-body for complex queries), each color-coded consistently across the method select, history rows, and collection entries.
- **Query params editor** — enable/disable rows without deleting them, live count bubbles on the tab.
- **Headers editor** — same key-value UX; up to 100 headers per request with sensible defaults (`Content-Type: application/json`, `Accept: */*`).
- **Body editor** — none / JSON / raw text / **form data** / **x-www-form-urlencoded** modes; the matching `Content-Type` is set automatically (your explicit header always wins).
- **Auth helper** — Bearer token, Basic auth, and **API Key** (as a header or a query parameter) forms that build the right credentials for you.
- **Keyboard-first** — `Ctrl/Cmd + Enter` sends from anywhere; `Enter` in the URL bar sends (browser muscle memory); newly added key-value rows auto-focus.
- **Guardrails** — URL length (2048), body size (~5 MB), and header/param caps are enforced client-side so a stray paste can't freeze the UI.

### 2. SSRF-Hardened CORS Proxy

The reason a browser-based client can work at all — and Kurai's most carefully engineered component.

Browsers block cross-origin requests; desktop clients dodge the problem by not being browsers. Kurai instead ships a local proxy (`POST /api/proxy`) that forwards requests server-side. But a naive proxy is a **Server-Side Request Forgery** weapon: anyone who can reach it can probe your internal network. Kurai's proxy assumes hostility:

| Protection | Detail |
|---|---|
| **DNS-resolution checks** | Target hostnames are resolved via the OS resolver (`dns.lookup`, both A **and** AAAA records) before any connection — a hostname whose IPv6 record points at `::1` can't slip past an IPv4-only blocklist |
| **Private range blocking** | Loopback (`127.0.0.0/8`, `::1`), RFC 1918 (`10/8`, `172.16/12`, `192.168/16`), link-local/cloud-metadata (`169.254.0.0/16` — hello, AWS IMDS), `0.0.0.0/8`, IPv6 unique-local (`fc00::/7`) and link-local (`fe80::/10`) |
| **Per-hop redirect validation** | Redirects are followed *manually* (max 5) and **every hop is re-validated** — a public URL that 302s into `169.254.169.254` gets blocked, which `fetch`'s built-in follow mode would happily allow |
| **IPv4-mapped IPv6 normalization** | `::ffff:127.0.0.1` is unwrapped and checked as `127.0.0.1` |
| **Credential hygiene** | Hop-by-hop headers (`Host`, `Connection`, `Cookie`, …) stripped; `Authorization` dropped on cross-origin redirects so your token never leaks to a redirect target |
| **Resource limits** | Streaming response-size cap (50 MB default) with early socket cancel, 30 s upstream timeout, per-IP rate limiting |
| **Typed errors** | Failures map to machine-readable codes — `SSRF_BLOCKED`, `INVALID_PROTOCOL`, `RESPONSE_TOO_LARGE`, `UPSTREAM_TIMEOUT`, `TOO_MANY_REDIRECTS` — not generic 500s |

Every response carries measured `time` (ms), `size` (bytes), and `finalUrl` (post-redirect) so the UI can show real numbers, not estimates.

> Testing a local API on purpose? `PROXY_ALLOW_PRIVATE_IPS=true` opts out — an explicit, documented decision rather than a silent default.

### 3. Collections

Organize related requests into named groups in the sidebar.

- **Create/rename/delete collections** — with item-count badges and confirm-on-delete.
- **Save the current request** into any collection with one click (the `+` on the collection row), naming it as you go.
- **Click-to-load** — selecting a saved request restores the full snapshot (method, URL, params, headers, body, auth) into the builder.
- **Expand/collapse trees** with per-request delete.
- **Snapshot semantics** — saving copies the request; later edits in the builder never silently mutate the saved version.
- **Persisted locally** (localStorage, namespaced) and mirrored by the server-side REST API (`/api/collections`) for team/self-hosted deployments.

### 4. Environments & Variables

Define variable sets and switch between them per request — the classic `dev` / `staging` / `prod` workflow.

- **`{{variable}}` template syntax** — resolved at send time across the **entire request**: URL, query params, headers, body content, form fields, and auth secrets (e.g. `{{BASE_URL}}/users`, `Bearer {{TOKEN}}`).
- **Header-bar environment selector** — one dropdown, always visible, no modal digging; a gear button opens the full manager (create/rename/delete environments, edit variables with enable/disable toggles).
- **Script access** — sandboxed test scripts read and write variables via `kurai.variables.get/set`, so a login request can capture a token for the next call.
- **REST-backed** — `/api/environments` mirrors the collection API for shared deployments.

### 5. Request History

Every sent request is logged automatically — no opt-in, no cloud sync consent screen.

- **Newest-first sidebar list** with method badge, URL, and relative timestamps ("just now", "5m", "2h").
- **Click-to-restore** any past request into the builder.
- **Live search** filters by URL or method as you type.
- **Bounded** — capped at 50 entries with oldest-eviction, so it never bloats.
- **IndexedDB-backed** with automatic localStorage fallback (private-browsing safe).

### 6. Scriptable Tests (`kurai.test()`)

Postman-style assertions without a proprietary runtime.

```js
kurai.test("status is 200", () => {
  kurai.expect(response.status).toBe(200);
});

kurai.variables.set("authToken", response.body.token);
```

- Runs in **Node's `vm` sandbox** — no filesystem, no network, no `process` access, hard 1-second timeout. A malicious or runaway script cannot touch the host.
- `kurai.test(name, fn)` collects pass/fail results with error messages.
- `kurai.expect(value).toBe() / .toEqual()` assertion API.
- `kurai.variables.get/set` bridges scripts and environments (token capture, chained requests).

### 7. Response Viewer

- **Status pill** color-coded by class (2xx green, 4xx orange, 5xx red) with human-readable status text.
- **Measured timing and size** — real numbers from the proxy, formatted for humans (`89 ms`, `12.4 KB`).
- **JSON syntax highlighting** — keys, strings, numbers, booleans, and nulls each styled, with all content HTML-escaped first (a hostile response body can't inject markup).
- **Headers tab** and **copy-body button**.
- **Empty state** that teaches the `Ctrl+Enter` shortcut instead of showing a blank pane.

### 8. Theming & UX

- **Dark and light themes**, toggled from the header, persisted across sessions, built on CSS custom-property tokens.
- **Inter + JetBrains Mono** typography — UI text and code panes each get the right typeface.
- **Responsive sidebar** — inline collapse on desktop, overlay drawer under 768 px.
- **ARIA throughout** — tabs, tabpanels, labels, and `role="status"` toasts; keyboard focus rings on every interactive element.
- **Single-instance toasts** — the newest message wins; no notification pile-up.

### 9. Pluggable Storage

Storage is an interface, not a decision baked into the product.

**Client side** — a routing layer picks the right browser store per feature: small JSON blobs (collections, environments) go to namespaced localStorage; potentially-large history goes to IndexedDB, with feature-detected fallback.

**Server side** — a `STORAGE_BACKEND` switch selects an adapter:

| Backend | Status | Use case |
|---|---|---|
| `file` | ✅ shipping | Zero-setup atomic JSON writes — solo dev |
| `postgres` | seam ready | Team deployments, horizontal replicas |
| `redis` | seam ready | Shared rate-limiting / history at SaaS scale |

Going from laptop to team server is `STORAGE_BACKEND=postgres` plus a `DATABASE_URL` — not a migration project.

### 10. CLI Launcher

```bash
npx kurai              # start server + open browser
npx kurai --port 8080  # custom port
npx kurai --no-open    # headless (CI, servers)
```

Boots the Express server, polls `/health` until ready, and opens your browser cross-platform. The same `/health` endpoint doubles as a Docker/Kubernetes liveness probe (`status`, `timestamp`, `uptime`), and the server handles SIGTERM gracefully — k8s-ready out of the box.

### 11. Security Hardening

Beyond the proxy itself:

- **Zero external security dependencies** — headers, rate limiting, and validation are hand-rolled and auditable; there's no transitive-dependency supply chain to worry about in the security-critical path.
- **CSP without `unsafe-inline` scripts**, `X-Frame-Options: DENY`, HSTS in production.
- **Per-IP sliding-window rate limiting** (100 req/min default, configurable).
- **Production mode** locks CORS to a configured origin and hides stack traces.
- **Optional API-key auth** (`AUTH_ENABLED`) with a boot-time-enforced 32-char minimum secret.
- **XSS discipline client-side** — every attacker-influenced string (URLs, response bodies, header values) is escaped before touching `innerHTML`.

---

## Kurai vs Postman — The Honest Comparison

Postman is a mature, feature-rich platform. Kurai doesn't try to out-feature it — it out-*principles* it in the areas that actually hurt day-to-day.

### Where Kurai is genuinely better

| Pain point | Postman | Kurai |
|---|---|---|
| **Forced account & cloud sync** | Sign-in required for core workflows since v11; collections sync to Postman's cloud by default — your API shapes, tokens, and internal URLs live on their servers | **No account exists.** Data lives on your disk (localStorage/IndexedDB) or your own database. There is nothing to sign into |
| **Install weight** | ~500 MB+ Electron desktop app, background updater, RAM-hungry | **Zero install.** `npm run dev` → browser tab. The whole client is plain ES modules with no build step |
| **Working offline / air-gapped** | Degraded without cloud connectivity; Scratch Pad was removed | Fully functional offline forever — there's no phone-home to fail |
| **Self-hosting for a team** | Enterprise pricing tier | **One container.** `docker compose up`, point the team at it, switch storage to Postgres. Free, ISC-licensed |
| **Pricing cliffs** | Free tier limits collaborators, collection runs, mock calls; costs scale per seat | No tiers, no seats, no metering. It's your process on your hardware |
| **Proxy/agent security** | The desktop agent bypasses CORS but its internals are closed source — you trust it blindly | The CORS proxy is ~200 lines of **auditable, aggressively SSRF-hardened** open code (per-hop redirect validation, IPv6-aware blocklists, metadata-IP blocking) |
| **Script runtime lock-in** | `pm.*` API tied to Postman's proprietary sandbox and cloud runners | `kurai.*` is a thin, readable wrapper over Node's `vm` — you can read the entire sandbox implementation in one sitting |
| **Auditability** | Closed source | Every module documents *who it is, what it owns, and who calls it*. The security-critical path has zero external dependencies |
| **Data exfiltration risk** | Tokens pasted into Postman are cloud-synced unless you carefully use vault features | Tokens never leave your machine. Cross-origin redirects even strip `Authorization` automatically |

### Where Postman still wins (honesty matters)

- **Ecosystem breadth** — mock servers, monitors, API documentation generation, OpenAPI import, gRPC/WebSocket/GraphQL clients.
- **Real-time team collaboration** — commenting, forking, workspaces with role management.
- **Maturity** — a decade of edge-case handling.

If you need those, use Postman. If what you actually do all day is *compose requests, hit endpoints, check responses, and keep your credentials to yourself* — Kurai does that with none of the weight, none of the account, and none of the trust assumptions.

### The one-line answer

> **Postman is a platform that wants your data in its cloud. Kurai is a tool that runs on your machine.** For the 90% use case — send request, read response, save for later — Kurai is faster to start, lighter to run, safer with your secrets, and free at any team size.

---

## Who Kurai Is For

- **The solo developer** who wants an API client open in a browser tab next to the code, with zero setup and zero sign-up.
- **The security-conscious team** that cannot ship internal API schemas and bearer tokens to a third-party cloud — self-host Kurai in one container behind the VPN.
- **The student / hackathon builder** on a machine where a 500 MB Electron install (or a mandatory account) is a non-starter.
- **The platform engineer** who wants an API tool whose entire security surface can be read and audited in an afternoon.

---

*See also: [ARCHITECTURE.md](ARCHITECTURE.md) for the technical design, and the [README](../README.md) for quickstart and configuration reference.*
