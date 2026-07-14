# Kurai Architecture Documentation

Welcome to the technical architecture guide for **Kurai (暗い)** — the production-grade, browser-based API testing platform.

---

## Technical Overview

Kurai is designed to run completely client-side in the browser while utilizing a local/remote Node.js proxy to bypass CORS restrictions.

```
┌─────────────────┐        HTTP Request        ┌────────────────┐
│   Browser UI    │ ─────────────────────────> │ Local Node.js  │
│ (localhost:3000)│ <───────────────────────── │  Proxy Server  │
└─────────────────┘        Envelope JSON       └───────┬────────┘
                                                       │
                                                       │ forwards request
                                                       ▼
                                              ┌────────────────┐
                                              │ Target Server  │
                                              │ (e.g. Stripe)  │
                                              └────────────────┘
```

---

## Folder Structure

The repository structure follows the feature-slice design system:

- **`client/`** — Zero-framework client web application (HTML, CSS, JS).
  - **`core/`** — State management (`state.js`) and event bus routing (`eventBus.js`).
  - **`features/`** — Feature folders containing their own Service (logic), Storage (persistence), and View (DOM interaction).
  - **`network/`** — Auth builds and network builders.
  - **`storage/`** — Browser-level data storage interfaces (localStorage, IndexedDB).
  - **`styles/`** — Modular stylesheets separating reset, token, components, layout, and themes.
- **`server/`** — Express server.
  - **`routes/`** — Express routing boundaries for collections, environments, history, health, and proxy calls.
  - **`middleware/`** — Error logging, input checking, rate limiting, and HTTP security policies.
  - **`services/`** — Requests forward engine with SSRF checker and script sandboxing runner.
  - **`storage/`** — Local database adapters.
- **`docker/`** — Deployment and compose files.
- **`cli/`** — Command-line launcher tool.
- **`.kurai/`** — Local workspace project config.
