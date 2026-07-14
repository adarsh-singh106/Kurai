---
name: kurai
description: >
  Use this skill when building, extending, or reasoning about Kurai — a production-grade,
  browser-based API testing platform (Postman clone). Covers: full system architecture,
  file-by-file engineering decisions, proxy design, state management, collection/environment
  data models, scalability patterns, Docker/IDE/CLI distribution, and the self-explanatory
  commenting standard. Trigger on any task that involves adding a feature, designing a new
  layer, writing a route, structuring a file, or making an infrastructure decision for Kurai.
---

# Kurai — Engineering Skill

> "Dark, precise, and fast." — the product ethos.
> Kurai (暗い) means dark in Japanese. The product is a developer tool that lives where
> developers live: in their terminal, their IDE, their browser. It earns trust by being
> engineered better than what it replaces.

---

## 0. The One Rule That Governs Everything

**Every file must be self-explanatory to a human reading it cold.**

This means:

- Every file begins with a **file-level comment block** (who I am, what I own, what I do NOT own, what calls me)
- Every function has a **JSDoc block** that says WHY it exists, not just what it does
- Every non-obvious decision has an **inline comment** that starts with `// WHY:` explaining the reasoning
- Every magic number or constant has a name and a comment explaining its origin
- No abbreviations except universally accepted ones (`req`, `res`, `url`, `id`, `db`)
- State mutations are always annotated with what triggered them

This is not documentation overhead — it is how a billion-dollar engineering team communicates across time zones and years.

---

## 1. What Kurai Is (Product Mental Model)

Kurai is NOT a frontend that wraps fetch(). It is a **developer workflow platform** whose entry point happens to be an HTTP request builder.

The five-layer mental model — build for all five even when shipping only the first two:

```
Layer 1 — Request Engine       Send HTTP requests from the browser, bypass CORS
Layer 2 — Workspace            Collections, environments, history, variables
Layer 3 — Project Awareness    Read local codebases, auto-detect routes, import OpenAPI
Layer 4 — Integration          IDE plugins, CLI runner, CI/CD hooks, framework SDKs
Layer 5 — Intelligence         AI-assisted test generation, contract diffing, anomaly detection
```

**Hackathon scope:** Layer 1 + 2, with Layer 3's file-structure foundations already in place.
**Resume scope:** Layer 1 + 2 + 3 + partial 4.
**Product scope:** All five.

---

## 2. Repository Structure

> **Note on client architecture:** The feature-slice pattern below (features/[name]/Service+Storage+View)
> is the canonical Kurai client structure — it is superior to a flat modules/ folder and is what
> the actual codebase uses. Each feature is fully self-contained. Adding a new feature = add one
> folder, three files, touch nothing else.

```
kurai/
├── client/                        # Pure HTML/CSS/JS — zero framework dependencies
│   ├── index.html                 # Shell. Loads CSS then JS. No logic here.
│   ├── main.js                    # Boot sequence: init core → init features → render UI
│   ├── styles/                    # (or css/) — all visual concerns live here
│   │   ├── reset.css              # Normalize browser defaults (box-sizing, margin, etc.)
│   │   ├── tokens.css             # Design tokens: colors, spacing, radii, fonts as CSS vars
│   │   ├── components.css         # Reusable UI atoms: buttons, inputs, badges, tabs
│   │   ├── layout.css             # Three-panel layout: sidebar | main | response
│   │   └── themes/
│   │       ├── dark.css           # Dark theme (default) — overrides tokens
│   │       └── light.css          # Light theme
│   │
│   ├── core/                      # The nervous system. Loaded first. Nothing imports FROM here
│   │   │                          # except features. Core never imports features.
│   │   ├── state.js               # THE one source of truth. ALL runtime state lives here.
│   │   │                          # No other file stores state. See Section 4 for rules.
│   │   ├── eventBus.js            # Pub/sub bus. Files talk through events, never direct imports.
│   │   └── constants.js           # HTTP methods, status codes, limits. Read-only, no logic.
│   │
│   ├── features/                  # Feature-slice architecture. One folder = one product feature.
│   │   │                          # Each feature owns its Service (logic) + Storage (persist)
│   │   │                          # + View (DOM). Features talk to each other via core/eventBus.
│   │   │
│   │   ├── collections/
│   │   │   ├── collectionService.js   # Business logic: create, rename, nest, delete collections
│   │   │   ├── collectionStorage.js   # Persist to storage adapter (localStorage or server API)
│   │   │   └── collectionView.js      # Sidebar tree: render, expand/collapse, drag/drop
│   │   │
│   │   ├── environment/
│   │   │   ├── environmentService.js  # Env CRUD + {{variable}} resolution logic
│   │   │   ├── environmentStorage.js  # Persist environments to storage adapter
│   │   │   └── environmentView.js     # Env selector dropdown + variable editor modal
│   │   │
│   │   ├── history/
│   │   │   ├── historyService.js      # Circular buffer of last 50 sent requests
│   │   │   ├── historyStorage.js      # Persist history to IndexedDB (survives page reload)
│   │   │   └── historyView.js         # History panel: list, click-to-restore, clear
│   │   │
│   │   ├── request/
│   │   │   ├── requestService.js      # Orchestrates a send: resolve vars → build → call proxy
│   │   │   ├── requestState.js        # WHY THIS EXISTS: request slice selectors + mutations.
│   │   │   │                          # Does NOT store state. Reads/writes core/state.js only.
│   │   │   │                          # Think of it as "the request API into core state."
│   │   │   └── requestView.js         # Builder panel: method, URL bar, params/headers/body tabs
│   │   │
│   │   └── response/
│   │       ├── responseService.js     # Parse raw proxy payload, compute stats, run test scripts
│   │       ├── responseState.js       # WHY THIS EXISTS: response slice selectors + mutations.
│   │       │                          # Does NOT store state. Reads/writes core/state.js only.
│   │       └── responseView.js        # Viewer panel: status badge, body, headers, timeline tabs
│   │
│   ├── network/                   # All HTTP concerns. Nothing outside this folder calls fetch().
│   │   ├── proxyClient.js         # Sends request to Kurai's own /api/proxy endpoint
│   │   ├── requestBuilder.js      # Assembles the fetch options object from state
│   │   └── auth.js                # Builds auth headers: Bearer, Basic, API Key, OAuth2
│   │
│   └── storage/                   # Client-side persistence adapter. Swappable backend.
│       ├── index.js               # Adapter selector: routes calls to localStorage or server API
│       ├── localStorage.js        # Default: browser localStorage (zero setup, works offline)
│       └── indexedDB.js           # For history: larger quota, survives cache clears better
│
├── server/
│   ├── index.js                   # Entry point: wires Express, loads middleware, starts
│   ├── config.js                  # All config from env vars + defaults. NEVER inline config.
│   ├── routes/
│   │   ├── proxy.js               # POST /api/proxy — the core CORS bypass engine
│   │   ├── collections.js         # CRUD /api/collections
│   │   ├── environments.js        # CRUD /api/environments
│   │   ├── history.js             # GET/DELETE /api/history
│   │   └── health.js              # GET /health — for Docker, load balancers, k8s probes
│   ├── middleware/
│   │   ├── rateLimit.js           # Per-IP rate limiting on proxy route
│   │   ├── validate.js            # Request body validation (Zod schemas)
│   │   ├── logger.js              # Structured JSON logging (Winston)
│   │   ├── errorHandler.js        # Global error handler — never leak stack traces
│   │   └── security.js            # Helmet, CORS policy, content-type enforcement
│   ├── services/
│   │   ├── proxyEngine.js         # Core proxy logic: forward, measure, return
│   │   ├── storageService.js      # Abstraction over storage backend (file → DB swappable)
│   │   └── scriptSandbox.js       # Isolated VM for running pre/post request scripts
│   └── storage/
│       ├── file/                  # Default: JSON files on disk (zero-setup)
│       │   ├── collections.json
│       │   └── environments.json
│       └── adapters/
│           ├── fileAdapter.js     # Reads/writes JSON files
│           ├── postgresAdapter.js # Swappable: full Postgres backend (SaaS mode)
│           └── redisAdapter.js    # Cache layer for history + session data
│
├── docker/
│   ├── Dockerfile                 # Multi-stage: build → slim production image
│   ├── docker-compose.yml         # One-command local setup with Postgres + Redis
│   ├── docker-compose.dev.yml     # Dev overrides: hot reload, source mounts
│   └── .dockerignore
│
├── .kurai/                        # Per-project config (checked into user's repo)
│   └── kurai.config.yaml          # Port, auth mode, storage backend, IDE plugin config
│
├── cli/
│   └── kurai.js                   # npx kurai — bootstraps server + opens browser
│
├── docs/
│   └── ARCHITECTURE.md            # This file, living in the repo
│
├── .env.example                   # Every env var documented with type + default + purpose
├── package.json
└── README.md
```

---

## 3. Core Data Models

These are the contracts everything else is built around. Define them first. Change them carefully.

### 3.1 Request Object

```js
/**
 * RequestObject — the canonical shape of a single HTTP request.
 *
 * This shape lives in three places:
 *  1. state.currentRequest (in-memory, being built)
 *  2. CollectionItem.request (persisted inside a collection)
 *  3. POST /api/proxy body (sent to the server)
 *
 * Any field added here MUST be handled in all three places.
 */
const RequestObject = {
  id: "uuid-v4",                        // stable identity for saved requests
  name: "Get user by ID",               // human label, shown in sidebar
  method: "GET",                        // GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS
  url: "{{BASE_URL}}/users/{{userId}}", // raw URL, may contain {{variables}}
  params: [                             // query string params (separate from URL for editing)
    { key: "limit", value: "10", enabled: true, description: "" }
  ],
  headers: [
    { key: "Content-Type", value: "application/json", enabled: true, description: "" }
  ],
  body: {
    type: "none",       // none | json | form-data | x-www-form-urlencoded | raw | binary
    content: "",        // raw string content
    formData: []        // [{key, value, type: "text"|"file", enabled}] for form-data
  },
  auth: {
    type: "inherit",    // inherit (from collection) | none | bearer | basic | apiKey | oauth2
    bearer: { token: "{{AUTH_TOKEN}}" },
    basic: { username: "", password: "" },
    apiKey: { key: "X-API-Key", value: "", in: "header" },  // in: header | query
    oauth2: { /* OAuth2 config — Layer 4 concern */ }
  },
  scripts: {
    pre: "",            // JS string — runs before request is sent
    post: ""            // JS string — runs after response received, can set vars
  },
  meta: {
    createdAt: "ISO8601",
    updatedAt: "ISO8601",
    description: ""
  }
}
```

### 3.2 Collection Object

```js
/**
 * Collection — a named group of requests with shared auth + variables.
 *
 * Collections can be nested (folder inside folder) via the `items` array.
 * A CollectionItem is either a request (leaf) or a folder (node with children).
 *
 * This structure is intentionally close to the OpenAPI/Postman collection format
 * so import/export is straightforward.
 */
const Collection = {
  id: "uuid-v4",
  name: "GitHub API",
  description: "",
  auth: { type: "inherit" },           // default auth for all requests in collection
  variables: [                         // collection-scoped variables
    { key: "BASE_URL", value: "https://api.github.com", enabled: true }
  ],
  items: [
    {
      id: "uuid-v4",
      type: "folder",                  // folder | request
      name: "Users",
      items: [
        {
          id: "uuid-v4",
          type: "request",
          name: "Get user",
          request: { /* RequestObject */ }
        }
      ]
    }
  ],
  meta: {
    version: 1,                        // increment on breaking schema changes
    createdAt: "ISO8601",
    updatedAt: "ISO8601",
    exportedFrom: "kurai"              // identifies source on import
  }
}
```

### 3.3 Environment Object

```js
/**
 * Environment — a named set of key/value variables.
 *
 * Variable resolution order (later overrides earlier):
 *   Global environment → Active environment → Collection variables → Local (scripts)
 *
 * Secret values are stored with `secret: true` — they are masked in the UI
 * and NEVER included in exported files. This is a hard rule.
 */
const Environment = {
  id: "uuid-v4",
  name: "Production",
  variables: [
    { key: "BASE_URL",    value: "https://api.example.com", enabled: true, secret: false },
    { key: "AUTH_TOKEN",  value: "sk-prod-xxxx",            enabled: true, secret: true }
  ],
  meta: { createdAt: "ISO8601", updatedAt: "ISO8601" }
}
```

### 3.4 Response Object (in-memory only, never persisted)

```js
/**
 * ResponseObject — what the proxy returns and the UI displays.
 *
 * This is constructed by response.js from the raw proxy payload.
 * It is NEVER stored to disk — history stores only the RequestObject + lightweight meta.
 */
const ResponseObject = {
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  body: "{ \"id\": 1 }",             // raw string — viewer decides how to render
  bodyParsed: { id: 1 },             // parsed if Content-Type is JSON/XML
  size: 1024,                        // bytes
  time: 142,                         // ms (measured end-to-end by proxy)
  timings: {                         // breakdown (advanced — shows in timeline tab)
    dns: 10,
    connect: 30,
    tls: 40,
    firstByte: 120,
    download: 22
  },
  testResults: [],                   // [{name, passed, error}] from post-request scripts
  error: null                        // non-null if network error (not HTTP error — 404 is valid)
}
```

---

## 4. State Architecture (state.js)

`state.js` is the brain. It owns all runtime data. No other file mutates state directly — they call state methods and emit events.

```js
/**
 * state.js
 *
 * WHO I AM: The single source of truth for all runtime application state.
 *
 * WHAT I OWN:
 *   - currentRequest (what's in the builder right now)
 *   - currentResponse (what's in the viewer right now)
 *   - collections (all saved collections, loaded from server on boot)
 *   - environments (all saved environments)
 *   - activeEnvironmentId (which env is selected)
 *   - history (last 50 sent requests)
 *   - ui (active tab, loading flags, modal state)
 *
 * WHAT I DO NOT OWN:
 *   - DOM (ui.js owns DOM)
 *   - Network calls (request.js and collections.js own fetch)
 *   - Persistence (storage.js and API calls own that)
 *
 * WHO CALLS ME: Every other module reads from me. Mutations go through my methods.
 *
 * PATTERN: Publish an event on every mutation so UI can react.
 *   state.setMethod('POST')          — mutates state
 *   events.emit('request:changed')   — UI reacts
 *   This keeps state and UI fully decoupled.
 */

const state = (() => {
  // WHY private: prevents external code from mutating state.X = Y directly,
  // which would bypass event emission and break UI reactivity.
  let _state = {
    currentRequest: { /* default RequestObject */ },
    currentResponse: null,
    collections: [],
    environments: [],
    activeEnvironmentId: null,
    history: [],
    ui: {
      activeTab: 'params',   // params | headers | body | auth | scripts | tests
      loading: false,
      sidebarWidth: 280,
      theme: 'dark'
    }
  }

  return {
    // Read
    get: (path) => { /* deep get by dot-path */ },

    // Write — each method emits the right event
    setMethod: (method) => { /* mutate + emit 'request:changed' */ },
    setUrl: (url) => { /* mutate + emit 'request:changed' */ },
    setResponse: (response) => { /* mutate + emit 'response:received' */ },
    setLoading: (bool) => { /* mutate + emit 'ui:loading' */ },
    addToHistory: (entry) => { /* circular push to history[50] */ },

    // Computed
    resolvedUrl: () => { /* replace {{vars}} using active environment */ },
    activeEnvironment: () => { /* return env by activeEnvironmentId */ }
  }
})()
```

---

## 5. The Proxy Engine (the engineering heart of Kurai)

This is the most important file in the server. It must be bulletproof.

```js
/**
 * proxyEngine.js
 *
 * WHO I AM: The CORS bypass engine. I am why Kurai can test any API from a browser.
 *
 * THE PROBLEM I SOLVE:
 *   Browsers enforce Same-Origin Policy. A page at localhost:5173 cannot fetch
 *   api.stripe.com — the browser blocks it before the request leaves the machine.
 *   Node.js has no browser, no SOP, no CORS enforcement. I run in Node.js.
 *   I receive the request from the browser, forward it from Node.js to the real server,
 *   and return the response. The browser only ever talks to localhost.
 *
 * SECURITY BOUNDARIES I ENFORCE:
 *   1. Block requests to private IP ranges (SSRF protection)
 *      — prevents users from using Kurai to probe internal networks
 *   2. Enforce timeout (default 30s) — prevents slowloris / hanging connections
 *   3. Cap response size (default 50MB) — prevents OOM on huge binary responses
 *   4. Strip dangerous request headers (Host, Connection) before forwarding
 *   5. Never forward user cookies from Kurai's own session to target servers
 *
 * WHAT I DO NOT DO:
 *   - I do not authenticate users (middleware does that)
 *   - I do not store anything (history module does that)
 *   - I do not modify response bodies (response.js on the client does that)
 */

const BLOCKED_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^localhost$/i
]

// WHY we measure time with process.hrtime.bigint() instead of Date.now():
// Date.now() has ~1ms resolution and can be affected by system clock adjustments.
// hrtime gives nanosecond resolution, monotonically increasing. For a tool
// that developers use to benchmark APIs, accuracy here is a product feature.
async function forwardRequest({ method, url, headers, body, timeout = 30000 }) {
  const start = process.hrtime.bigint()

  // SSRF check — resolve hostname before connecting
  const hostname = new URL(url).hostname
  if (isBlockedHost(hostname, BLOCKED_IP_RANGES)) {
    throw new ProxyError('SSRF_BLOCKED', `Requests to ${hostname} are not allowed`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: sanitizeHeaders(headers),  // strip Host, Connection, Transfer-Encoding
      body: ['GET', 'HEAD'].includes(method) ? undefined : body,
      signal: controller.signal,
      redirect: 'follow'                  // follow redirects — developer expectation
    })

    const end = process.hrtime.bigint()
    const timeMs = Number(end - start) / 1_000_000  // nanoseconds → milliseconds

    // WHY we read body as text, not json():
    // The client decides how to parse and display the body.
    // If we parse it here, we lose the raw string needed for display,
    // and we'd crash on non-JSON responses.
    const bodyText = await readBodyWithSizeLimit(response, 50 * 1024 * 1024)

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: bodyText,
      time: Math.round(timeMs),
      size: Buffer.byteLength(bodyText, 'utf8')
    }
  } finally {
    clearTimeout(timer)
  }
}
```

---

## 6. Variable Resolution (the {{mustache}} system)

```js
/**
 * environment.js
 *
 * Variable resolution runs in this priority order (later = higher priority):
 *
 *   [1] Global environment variables
 *   [2] Active environment variables          ← user selects "Production" or "Dev"
 *   [3] Collection-level variables
 *   [4] Variables set by pre-request scripts  ← pm.environment.set() equivalent
 *
 * WHY this order: Users expect that more-specific scopes win over broader ones.
 * A collection's BASE_URL should override the global one. A script's dynamic
 * token should override everything.
 *
 * Resolution is done RIGHT BEFORE the request is sent, not when the user types.
 * WHY: The user should see their raw template strings while editing. Resolving
 * on-send means the URL bar shows "{{BASE_URL}}/users" — which is readable —
 * not "https://api.example.com/users" — which loses context about what the variable is.
 */

function resolveVariables(template, ...scopeChain) {
  // Build merged variable map from all scopes in priority order
  const vars = scopeChain
    .flat()
    .filter(v => v.enabled)
    .reduce((map, v) => {
      map[v.key] = v.value   // later entries win (priority order)
      return map
    }, {})

  // Replace all {{varName}} occurrences
  // WHY regex approach over template literals: we want to handle nested
  // objects and report unresolved variables to the user as warnings,
  // not silently pass "{{UNDEFINED}}" to the server.
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim()
    if (trimmed in vars) return vars[trimmed]

    // WHY warn instead of throw: an unresolved variable might be intentional
    // (the user wants to send the literal string). We report it but proceed.
    console.warn(`[kurai] Unresolved variable: {{${trimmed}}}`)
    return match   // return original if not found
  })
}
```

---

## 7. The Event Bus (how files communicate)

```js
/**
 * events.js
 *
 * WHO I AM: A simple pub/sub event bus. I am how every module in Kurai
 * communicates without importing each other.
 *
 * WHY this matters: Without an event bus, request.js would need to import
 * ui.js to trigger a UI update. That creates circular dependencies and tight
 * coupling. With the bus:
 *   - request.js emits  'response:received'
 *   - viewer.js listens 'response:received' and renders
 *   - Neither knows the other exists.
 *
 * This is the Observer pattern. It is how every production frontend is structured.
 *
 * CANONICAL EVENTS (all events Kurai emits):
 *   request:changed       — any field in currentRequest was modified
 *   request:sending       — user clicked Send, request is in flight
 *   response:received     — proxy returned a response (success or HTTP error)
 *   response:error        — network/proxy error (not an HTTP error code)
 *   collection:updated    — a collection was created, renamed, or deleted
 *   environment:changed   — active environment switched or variable edited
 *   history:updated       — new entry added to history
 *   ui:loading            — loading spinner should show/hide
 *   ui:theme              — theme changed
 */

const events = (() => {
  const listeners = {}

  return {
    on:   (event, fn) => { (listeners[event] ||= []).push(fn) },
    off:  (event, fn) => { listeners[event] = (listeners[event] || []).filter(f => f !== fn) },
    emit: (event, data) => { (listeners[event] || []).forEach(fn => fn(data)) },
    once: (event, fn) => {
      const wrapper = (data) => { fn(data); events.off(event, wrapper) }
      events.on(event, wrapper)
    }
  }
})()
```

---

## 8. API Routes Design

All server routes follow this contract:

```
Method  Path                         Purpose
──────────────────────────────────────────────────────────
POST    /api/proxy                   Forward request to target server
GET     /api/collections             List all collections
POST    /api/collections             Create collection
GET     /api/collections/:id         Get single collection
PUT     /api/collections/:id         Replace collection
PATCH   /api/collections/:id         Update collection fields
DELETE  /api/collections/:id         Delete collection
GET     /api/environments            List all environments
POST    /api/environments            Create environment
PUT     /api/environments/:id        Replace environment
DELETE  /api/environments/:id        Delete environment
GET     /api/history                 Get request history (last 50)
DELETE  /api/history                 Clear history
GET     /health                      Health check (used by Docker, k8s, load balancers)
```

Every route handler follows this pattern:

```js
/**
 * POST /api/proxy
 *
 * The entry point for all proxied requests.
 *
 * Validates the incoming payload with Zod before touching it.
 * Delegates to proxyEngine.forwardRequest() for actual work.
 * Returns a consistent envelope so the client always knows the shape.
 *
 * Response envelope:
 * {
 *   ok: true,
 *   data: { status, statusText, headers, body, time, size }
 * }
 * OR
 * {
 *   ok: false,
 *   error: { code, message }
 * }
 *
 * WHY consistent envelope over raw HTTP status codes:
 * A 404 from the target server is NOT an error from Kurai's perspective —
 * it's valid data the developer needs to see. We always return 200 from our
 * proxy route and put the target's status inside `data.status`.
 * Only Kurai-level errors (invalid payload, SSRF blocked, timeout) use
 * non-200 status codes from our server.
 */
router.post('/proxy', validate(proxySchema), asyncHandler(async (req, res) => {
  const result = await proxyEngine.forwardRequest(req.body)
  res.json({ ok: true, data: result })
}))
```

---

## 9. Security Model

Kurai is a tool that forwards arbitrary HTTP requests. This makes it a security-sensitive surface. Every decision must account for this.

### 9.1 SSRF (Server-Side Request Forgery)

Without protection, a user could send: `GET http://169.254.169.254/latest/meta-data/` (AWS metadata endpoint) and exfiltrate cloud credentials through Kurai's proxy.

```js
// proxyEngine.js
// Block all private/loopback/metadata IP ranges before forwarding
const BLOCKED_RANGES = [
  /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
  /^127\./, /^::1$/, /^localhost$/i,
  /^169\.254\./,   // link-local (AWS metadata, Azure IMDS)
  /^0\.0\.0\.0$/
]
```

### 9.2 Secret masking

Variables marked `secret: true` are:
- Masked in the UI as `••••••••` with a reveal toggle
- Stripped from collection exports (never appear in exported JSON)
- Never logged by the server (even in debug mode)
- Never stored in history

### 9.3 Rate limiting (proxy route only)

```js
// rateLimit.js
// WHY proxy route specifically: the proxy can be used to hammer external APIs.
// If Kurai is hosted publicly, a single user could use it as a DDoS amplifier.
// Limit: 100 proxy requests per IP per minute.
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Slow down.' } }
})
```

### 9.4 Header sanitization

```js
// WHY we strip these specific headers before forwarding:
// - Host: must be set to the target host, not Kurai's host
// - Connection: hop-by-hop header, not forwarded in HTTP/1.1 proxies
// - Transfer-Encoding: already handled by fetch()
// - Cookie: would forward Kurai's own session cookies to target — security hole
const STRIP_HEADERS = ['host', 'connection', 'transfer-encoding', 'cookie']
```

---

## 10. Docker & Distribution

### 10.1 Dockerfile (multi-stage)

```dockerfile
# ── Stage 1: Dependencies ──────────────────────────────────────────────────
# WHY separate stage: keeps node_modules out of the final image.
# The production image gets only the output, not the build tooling.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production image ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# WHY non-root user: running as root in a container is a security vulnerability.
# If the process is compromised, root in the container maps to root on the host.
RUN addgroup -S kurai && adduser -S kurai -G kurai

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# WHY EXPOSE is documentation, not a firewall rule:
# The container still needs -p 3000:3000 at runtime. EXPOSE tells humans
# and tooling (Docker Desktop, k8s) what port the service listens on.
EXPOSE 3000

USER kurai
CMD ["node", "server/index.js"]
```

### 10.2 docker-compose.yml (one-command setup)

```yaml
# docker-compose.yml
#
# Run with: docker compose up
# This gives you Kurai + Postgres + Redis in one command.
# For local dev with just file storage: docker compose up kurai

version: "3.9"

services:
  kurai:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - STORAGE_BACKEND=postgres   # file | postgres | redis
      - DATABASE_URL=postgresql://kurai:kurai@postgres:5432/kurai
      - REDIS_URL=redis://redis:6379
      - RATE_LIMIT_ENABLED=true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kurai
      POSTGRES_USER: kurai
      POSTGRES_PASSWORD: kurai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kurai"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### 10.3 CLI entry (npx kurai)

```js
#!/usr/bin/env node
/**
 * cli/kurai.js
 *
 * This file is the entry point for `npx kurai` and the installed `kurai` command.
 *
 * What it does:
 *  1. Parses CLI flags (--port, --no-open, --storage)
 *  2. Starts the Express server as a child process
 *  3. Waits for the server to be healthy (/health ping loop)
 *  4. Opens the browser to localhost:{port}
 *
 * WHY open browser automatically: Kurai's UX promise is "one command, browser opens."
 * Developers should not need to remember a URL. If --no-open is passed, skip this.
 */
```

### 10.4 kurai.config.yaml (project-local config)

```yaml
# .kurai/kurai.config.yaml
# This file is committed to the developer's project repository.
# It configures Kurai's behavior for this specific project.

version: 1

server:
  port: 3000                    # port to bind to
  open: true                    # open browser on start

storage:
  backend: file                 # file | postgres
  path: .kurai/data             # for file backend

proxy:
  timeout: 30000                # ms — per-request timeout
  maxResponseSize: 52428800     # bytes — 50MB cap
  allowPrivateIPs: false        # true only for local API dev (adds security warning)

# IDE Integration — Layer 4
ide:
  autoDetect: true              # scan package.json to detect framework
  framework: express            # express | fastapi | django | spring | null
  routeFile: src/routes         # where to look for route definitions

# Environments to auto-load (overrides manual env setup)
# These point to .env files in the project
environments:
  - name: Development
    envFile: .env.development
  - name: Production
    envFile: .env.production
    readOnly: true              # prod vars visible but not editable in UI
```

---

## 11. Storage Backend Abstraction

The storage layer is designed to be swapped without changing any route handler:

```js
/**
 * storageService.js
 *
 * I am the abstract storage interface. All routes call me. I delegate to the
 * appropriate adapter based on config.STORAGE_BACKEND.
 *
 * WHY abstraction here: Kurai ships with file-based storage (zero setup, works
 * offline). As a SaaS product, it needs Postgres. Teams need shared storage.
 * By hiding the backend behind this interface, the route handlers never change
 * when the storage backend changes. Only the adapter changes.
 *
 * Interface every adapter must implement:
 *   collections.list()
 *   collections.get(id)
 *   collections.create(data)
 *   collections.update(id, data)
 *   collections.delete(id)
 *   environments.list()
 *   ... same pattern
 */

const adapters = {
  file:     () => require('./adapters/fileAdapter'),
  postgres: () => require('./adapters/postgresAdapter'),
}

const adapter = adapters[config.STORAGE_BACKEND]?.()
if (!adapter) throw new Error(`Unknown storage backend: ${config.STORAGE_BACKEND}`)

module.exports = adapter
```

---

## 12. Scaling to Billions — The Architecture Progression

Kurai is designed to grow through these phases without rewriting:

### Phase 1 — Local tool (hackathon → personal)
```
Developer's machine
└── node server/index.js
    ├── /api/proxy     (proxies requests)
    └── /static        (serves client files)
    Storage: JSON files on disk
```

### Phase 2 — Team tool (shared instance)
```
Single VPS / cloud VM
└── Kurai (Node.js, PM2 cluster mode)
    └── Postgres (collections, environments)
    └── Redis (history, sessions)
    Auth: simple API key per workspace
```

### Phase 3 — SaaS product (hundreds of thousands of users)
```
Load Balancer (NGINX / AWS ALB)
├── Kurai API cluster (Node.js, stateless, horizontal scale)
│   └── Each instance reads config from Redis
├── Postgres (primary + read replicas per region)
├── Redis Cluster (sessions, rate limiting, pub/sub)
└── CDN (client static files — HTML/CSS/JS never change per deploy)

WHY stateless API servers: Every request can hit any instance.
State lives in Postgres + Redis, not in-process.
Horizontal scaling = add more instances, no coordination needed.
```

### Phase 4 — Enterprise / billions (Postman territory)
```
Multi-region active-active
├── Region: US-East
│   ├── API cluster (auto-scaling group)
│   ├── Postgres primary
│   └── Redis cluster
├── Region: EU-West (GDPR isolation)
│   ├── API cluster
│   ├── Postgres replica (promotes to primary on US failure)
│   └── Redis cluster
└── Global CDN for static assets + edge caching of collection reads

Key additions at this scale:
- Workspace isolation (multi-tenant data model)
- Audit logging (every request proxied, every collection change)
- SOC2 compliance (encryption at rest, access controls)
- CLI runner for CI/CD (kurai run collection.json --env prod --reporter junit)
- IDE extensions (VS Code, JetBrains) using kurai.config.yaml as source of truth
```

---

## 13. Comment Standard (the engineering contract)

Every file, every function, every non-obvious decision must be commented at the right level. This is what makes the codebase self-explanatory:

### File-level header (every file, no exceptions)

```js
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [filename.js]
 *
 * WHO I AM:    One sentence. My identity in the system.
 * WHAT I OWN:  What data or behavior this file is responsible for.
 * WHAT I DON'T: What this file explicitly delegates elsewhere (prevents bloat).
 * WHO CALLS ME: Which other files/events trigger this file's code.
 * EVENTS I EMIT: (if applicable) What events I publish on the event bus.
 *
 * ARCHITECTURE NOTE: (if this file represents a key design decision)
 * Explain why this file exists as a separate module, not as part of another.
 * ─────────────────────────────────────────────────────────────────────────────
 */
```

### Function-level JSDoc

```js
/**
 * resolveVariables — replaces {{token}} placeholders in a template string.
 *
 * WHY this exists as its own function:
 *   Variable resolution happens in three places: URL, headers, and body.
 *   Centralizing it here means one fix propagates everywhere.
 *
 * @param {string} template     — raw string, may contain {{varName}} tokens
 * @param {...Array} scopes     — variable arrays in ascending priority order
 * @returns {string}            — resolved string
 * @throws  never               — unresolved vars are warned, not thrown
 *
 * @example
 *   resolveVariables('{{BASE_URL}}/users', globalVars, envVars)
 *   // → 'https://api.example.com/users'
 */
```

### Inline WHY comments

```js
// WHY: We use AbortController instead of a per-request timeout option on fetch()
// because fetch()'s timeout option is not in the Node.js fetch spec yet (as of Node 20).
// AbortController is the portable solution across runtimes.
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), timeout)
```

### Constants with context

```js
// Maximum response body size the proxy will buffer.
// WHY 50MB: Balances memory safety with real-world API responses.
// Most APIs return < 1MB. 50MB covers edge cases like bulk data exports.
// Above this, we stream directly to disk (future feature — Layer 3).
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024
```

---

## 14. The .env.example Standard

Every environment variable must be documented:

```bash
# ─────────────────────────────────────────────────────
# Kurai Environment Variables
# Copy this file to .env and fill in values.
# Never commit .env to version control.
# ─────────────────────────────────────────────────────

# Server
PORT=3000                         # Port the Express server listens on
NODE_ENV=development              # development | production | test

# Storage backend
# file     = JSON files on disk (default, zero setup, single-user)
# postgres = Postgres database (recommended for teams and SaaS)
STORAGE_BACKEND=file

# Required if STORAGE_BACKEND=postgres
DATABASE_URL=                     # postgresql://user:pass@host:port/db

# Redis (optional — enables rate limiting + session caching at scale)
REDIS_URL=                        # redis://host:6379

# Proxy security
PROXY_TIMEOUT_MS=30000            # Max ms to wait for target server response
PROXY_MAX_RESPONSE_BYTES=52428800 # 50MB — max response body to buffer
PROXY_ALLOW_PRIVATE_IPS=false     # DANGER: only true for local API dev

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000        # Window size in ms
RATE_LIMIT_MAX_REQUESTS=100       # Max requests per IP per window

# Authentication (Phase 2+)
AUTH_ENABLED=false                # false = open (dev mode), true = require API key
AUTH_SECRET=                      # Secret for signing session tokens (min 32 chars)
```

---

## 15. What to Build in What Order

Execute in this sequence. Each step produces something runnable.

```
Step 1 — Skeleton         index.html + server/index.js → page loads, server responds /health
Step 2 — Proxy            POST /api/proxy → can forward a hardcoded GET request
Step 3 — Builder UI       Method selector + URL input + Send button → calls proxy
Step 4 — Response Viewer  Status badge + body display with syntax highlight
Step 5 — State + Events   state.js + events.js → UI reacts to state changes
Step 6 — Headers/Params   Tab UI + key-value rows → sent with request
Step 7 — Body             JSON/raw body editor → sent with POST/PUT
Step 8 — Environments     {{variable}} resolution + env selector dropdown
Step 9 — Collections      Sidebar + save/load requests → /api/collections CRUD
Step 10 — History         Last 50 requests, click to restore
Step 11 — Auth helpers    Bearer/Basic auth tab → auto-inserts headers
Step 12 — Pre/Post scripts Script sandbox → pm.environment.set() equivalent
Step 13 — Docker          Dockerfile + compose → `docker compose up` works
Step 14 — CLI             npx kurai → opens browser automatically
Step 15 — Polish          Dark theme, keyboard shortcuts, import/export
```

Never skip a step to add a feature from a later step. A broken Step 3 with Step 9 added is not impressive. A working Step 5 is.
```