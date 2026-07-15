# Kurai Demo Test Server — Feature Walkthrough

A tiny, self-contained API built for one purpose: **letting you (or a new user) test-drive every Kurai feature in ~10 minutes**, step by step, with real requests and real responses.

No database, no setup — data lives in memory and resets on restart.

> 📸 Screenshot markers like **`[SCREENSHOT 1]`** show exactly where to capture images for the docs. A checklist of all shots is at the [bottom](#-screenshot-checklist).

---

## 1. Setup (do this first!)

### Start the demo API

```bash
node test-server/server.js        # → http://127.0.0.1:5100
```

### Start Kurai — with one important flag

```bash
PROXY_ALLOW_PRIVATE_IPS=true npm run dev
```

On Windows (PowerShell):

```powershell
$env:PROXY_ALLOW_PRIVATE_IPS="true"; npm run dev
```

> ⚠️ **Why the flag?** Kurai's proxy blocks requests to private/loopback IPs by default — that's its SSRF protection, and it's a *feature*, not a bug. But this demo server runs on `127.0.0.1`, which is exactly what that shield blocks. The flag opts out **for local testing only**.
>
> 💡 **Try it without the flag first!** Send any request to `http://127.0.0.1:5100/` and watch Kurai return a clean `SSRF_BLOCKED` error. You just witnessed the security model working. **`[SCREENSHOT 1]`** — *the SSRF_BLOCKED error banner in the response panel. Great for the security section of your docs.*

Open **http://localhost:3000**. You should see the Kurai workspace. **`[SCREENSHOT 2]`** — *the empty workspace with the "Ready when you are" empty state. This is your "first look" hero image.*

### Demo credentials (used throughout)

| What | Value |
|---|---|
| Bearer token | `kurai-demo-token-12345` |
| Basic auth | `kurai` / `demo123` |
| API key | `kurai-key-98765` |

---

## 2. Your first request

1. Leave the method as **GET**.
2. Enter URL: `http://127.0.0.1:5100/`
3. Click **Send** (or press `Ctrl+Enter` — works from anywhere).

You get a JSON welcome message listing every endpoint, with:
- a green **200 OK** status pill,
- the response **time** (ms) and **size**,
- syntax-highlighted JSON.

**`[SCREENSHOT 3]`** — *the full workspace after this request: URL bar, Send button, and the highlighted JSON response with the 200 pill, time, and size chips all visible. This is the money shot for "sending your first request".*

---

## 3. HTTP methods — the full CRUD tour

All against the in-memory users API. Send them **in this order** (later steps build on earlier ones).

### GET — list users

```
GET http://127.0.0.1:5100/api/users
```

### POST — create a user (JSON body)

1. Method → **POST**, URL → `http://127.0.0.1:5100/api/users`
2. **Body** tab → select **JSON**
3. Paste:

```json
{
  "name": "Tim Berners-Lee",
  "email": "tim@example.com",
  "role": "admin"
}
```

4. Send → **201 Created** with the new user (id `4`).

> Kurai sets `Content-Type: application/json` automatically from the body type — you don't need to add the header yourself.

**`[SCREENSHOT 4]`** — *POST with the JSON body editor filled in and the 201 response beside it. Shows body editing + auto content-type in one frame.*

**Validation demo:** send the same POST with an empty body `{}` → **400 Bad Request** with a clear error. Note the orange status pill.

### GET — fetch one user

```
GET http://127.0.0.1:5100/api/users/4
```

Try `/api/users/999` too → **404 Not Found** (red pill).

### PUT — replace the whole user

```
PUT http://127.0.0.1:5100/api/users/4
```

Body (JSON): `{ "name": "Tim BL", "email": "tim@w3.org" }`

### PATCH — partial update

```
PATCH http://127.0.0.1:5100/api/users/4
```

Body (JSON): `{ "role": "member" }` — only that field changes.

### DELETE

```
DELETE http://127.0.0.1:5100/api/users/4
```

### QUERY — the new HTTP method ⭐

`QUERY` is "GET with a body": safe and idempotent like GET, but the query travels in the request body — for filters too complex for a URL. Kurai supports it natively; most clients don't yet.

1. Method → **QUERY** (note its distinct cyan color), URL → `http://127.0.0.1:5100/api/users`
2. Body → **JSON**:

```json
{ "role": "member", "nameContains": "alan" }
```

3. Send → the response proves the filter arrived in the **body**, and returns only Alan Turing.

**`[SCREENSHOT 5]`** — *the QUERY method selected in the dropdown (cyan) with the body filter and the filtered response. This is a differentiator — feature it prominently.*

---

## 4. Query parameters

1. `GET http://127.0.0.1:5100/api/users`
2. **Params** tab → add rows:
   - `page` = `1`
   - `limit` = `2`
   - `role` = `member`
3. Send → paginated, filtered response.

Now **untick** the `role` row (don't delete it!) and resend — the filter disappears from the request but stays in your editor. Note the count bubble on the Params tab.

**`[SCREENSHOT 6]`** — *the Params editor with three rows, one unticked, and the count bubble showing "2". Demonstrates toggle-without-delete.*

---

## 5. Headers

1. `GET http://127.0.0.1:5100/api/echo` — this endpoint mirrors back everything you send.
2. **Headers** tab → add:
   - `X-Powered-By` = `Kurai`
   - `Accept-Language` = `en`
3. Send → find your headers echoed in the response body.

Also click the response **Headers** tab (right side of the response panel) to inspect what the *server* returned.

**`[SCREENSHOT 7]`** — *the response Headers tab open, showing the parsed server headers table.*

---

## 6. Body formats

All four against the demo server:

| Format | Endpoint | What to send |
|---|---|---|
| **JSON** | `POST /api/users` | (done in step 3) |
| **Raw text** | `POST /api/echo` | Body → Text → `Hello API` |
| **x-www-form-urlencoded** | `POST /api/login` | Body → **URL Encoded** → `username` = `kurai`, `password` = `demo123` |
| **Form Data** | `POST /api/register` | Body → **Form Data** → `name` = `Ada`, `plan` = `pro` |

The **login** one matters — a successful login returns:

```json
{ "message": "Login successful", "token": "kurai-demo-token-12345", ... }
```

Keep that token visible; you'll use it in the next two sections. The response also echoes back the `Content-Type` it received — proof Kurai encoded the form correctly.

**`[SCREENSHOT 8]`** — *the URL Encoded body editor with username/password rows and the successful login response containing the token.*

---

## 7. Authentication — all three schemes

Each protected endpoint tells you exactly what it expected when you fail, so **send each one unauthenticated first** — the 401 error is instructive.

### Bearer Token

1. `GET http://127.0.0.1:5100/api/protected/bearer` → Send → **401**, with the expected token in the error.
2. **Auth** tab → Type → **Bearer Token** → paste `kurai-demo-token-12345`
3. Send → **200** `🔓 Bearer auth OK`

**`[SCREENSHOT 9]`** — *the Auth tab with Bearer selected and the 200 unlock response. The before/after 401→200 pair makes a great two-image sequence.*

### Basic Auth

1. `GET http://127.0.0.1:5100/api/protected/basic`
2. Auth → **Basic Auth** → username `kurai`, password `demo123`
3. Send → **200**. Kurai base64-encodes the credentials for you.

### API Key — header or query param

1. `GET http://127.0.0.1:5100/api/protected/apikey`
2. Auth → **API Key** → Key `X-API-Key`, Value `kurai-key-98765`, Add to **Header** → Send → **200**, response says `deliveredVia: X-API-Key header`.
3. Now switch: Key `api_key`, Add to **Query Param** → Send → response says `deliveredVia: api_key query parameter`.

**`[SCREENSHOT 10]`** — *the API Key form with the "Add to" dropdown open showing Header/Query Param options. This dual placement is a feature many clients hide.*

---

## 8. Environment variables

Stop typing `http://127.0.0.1:5100` every time.

1. Click the **gear icon** next to the environment dropdown (top-right header).
2. **New Environment** → name it `Demo Local`.
3. Add variables:
   - `BASE_URL` = `http://127.0.0.1:5100`
   - `TOKEN` = `kurai-demo-token-12345`
4. Close the manager, then pick **Demo Local** in the header dropdown.

**`[SCREENSHOT 11]`** — *the environment manager modal with both variables entered. This is the "environments" doc image.*

Now use them:

- URL: `{{BASE_URL}}/api/protected/bearer`
- Auth → Bearer → token: `{{TOKEN}}`
- Send → **200**. Variables resolve **everywhere** — URL, params, headers, body content, form fields, and auth secrets.

**`[SCREENSHOT 12]`** — *the URL bar showing `{{BASE_URL}}/api/protected/bearer` with a 200 response — proof the variable resolved at send time.*

Switch the dropdown back to **No Environment** and resend — the request now fails because `{{BASE_URL}}` no longer resolves. Environments are live, per-request context.

---

## 9. Collections — save and organize

1. Build any request (e.g. `{{BASE_URL}}/api/users` GET).
2. In the sidebar **Collections** tab → **New Collection** → name it `User APIs`.
3. Hover the collection row → click the **+** icon → name the request `List users` → Save.
4. Repeat for a couple more (e.g. `Login`, `Create user`) — recreate them in the builder, then `+` each into the collection.
5. Click a saved request → the full snapshot (method, URL, params, headers, body, auth) loads back into the builder.

```
User APIs
    ├── List users
    ├── Login
    └── Create user
```

**`[SCREENSHOT 13]`** — *the expanded collection tree in the sidebar with 3 named requests and their method badges. The "organize your work" image.*

Deleting: hover a collection or request row → trash icon → styled confirmation dialog (no browser popups).

---

## 10. History

Click the **History** tab in the sidebar — every request you've sent in this walkthrough is there, newest first, with method badges and relative timestamps.

- **Click any entry** to restore it into the builder.
- **Type in the search box** (e.g. `login`) to filter by URL or method.
- **Clear history** button lives at the bottom of the list.

**`[SCREENSHOT 14]`** — *the History tab after the walkthrough — a rich list of varied methods/URLs with the search box visible. Shows the tool "filling up" with real use.*

---

## 11. Response viewer edge cases

The demo server has simulators for the response-handling features:

### Any status code

```
GET {{BASE_URL}}/api/status/500     → red pill
GET {{BASE_URL}}/api/status/301     → blue pill
GET {{BASE_URL}}/api/status/418     → I'm a teapot 🫖
```

**`[SCREENSHOT 15]`** — *a 500 response showing the red status pill. Pairs with screenshot 3's green pill.*

### Slow responses — watch the loading state

```
GET {{BASE_URL}}/api/slow?ms=3000
```

While in flight: the Send button shows a spinner and a gradient loading bar sweeps the response panel. The timer chip then shows ~3 s.

**`[SCREENSHOT 16]`** — *capture DURING the 3-second wait: spinner in the Send button + loading bar. Shows the app feels alive.*

### Large payloads — watch the size chip

```
GET {{BASE_URL}}/api/large?kb=500
```

The size chip reads ~500 KB and the JSON still renders highlighted.

### Copy button

Any response → the copy icon (top-right of the response panel) copies the pretty-printed body.

---

## 12. Extras to try

- **Theme toggle** (moon/sun icon, top-right) — every panel adapts. **`[SCREENSHOT 17]`** — *the same workspace in light mode. Side-by-side with a dark shot makes a nice docs banner.*
- **Sidebar collapse** (icon top-left) — more room for the response.
- **`POST {{BASE_URL}}/api/reset`** — restore the demo seed data anytime.
- **The request log** — watch the demo server's terminal: every request Kurai sends is printed live with method, path, status, and duration. Useful for verifying *exactly* what arrived.

---

## 📸 Screenshot checklist

| # | Shot | Used for |
|---|---|---|
| 1 | `SSRF_BLOCKED` error banner | Security model docs |
| 2 | Empty workspace ("Ready when you are") | Hero / first look |
| 3 | First GET with 200 pill, time, size, highlighted JSON | "First request" |
| 4 | POST + JSON body editor + 201 response | Body editing |
| 5 | QUERY method (cyan) + body filter + response | ⭐ QUERY differentiator |
| 6 | Params editor, one row unticked, count bubble | Query params |
| 7 | Response Headers tab | Header inspection |
| 8 | URL-encoded login + token response | Body formats |
| 9 | Bearer auth tab + 🔓 200 | Auth |
| 10 | API Key form with Header/Query dropdown open | Auth flexibility |
| 11 | Environment manager modal with variables | Environments |
| 12 | `{{BASE_URL}}` in URL bar + 200 | Variable resolution |
| 13 | Expanded collection tree with 3 requests | Collections |
| 14 | History tab, full list + search | History |
| 15 | 500 red status pill | Status handling |
| 16 | In-flight spinner + loading bar (during `/api/slow`) | Loading UX |
| 17 | Light theme | Theming |

**Capture tips:** use a consistent window size (e.g. 1440×900) for all shots; dark theme for everything except #17; crop to the relevant panel for detail shots (4, 6, 7, 9, 10, 11) but keep full-window for hero shots (2, 3, 5, 13).

---

## Endpoint reference

| Method | Path | Demonstrates |
|---|---|---|
| GET | `/` | First request, welcome + endpoint list |
| GET | `/api/users?page=&limit=&role=` | Query params, pagination |
| GET | `/api/users/:id` | Path lookups, 404s |
| POST | `/api/users` | JSON body, 201, 400 validation |
| PUT | `/api/users/:id` | Full replace |
| PATCH | `/api/users/:id` | Partial update |
| DELETE | `/api/users/:id` | Deletion |
| QUERY | `/api/users` | ⭐ the new HTTP QUERY method |
| POST | `/api/login` | x-www-form-urlencoded (returns the demo token) |
| POST | `/api/register` | Form data |
| GET | `/api/protected/bearer` | Bearer auth |
| GET | `/api/protected/basic` | Basic auth |
| GET | `/api/protected/apikey` | API key (header or `?api_key=`) |
| ALL | `/api/echo` | Echoes method/query/headers/body |
| GET | `/api/status/:code` | Any status code |
| GET | `/api/slow?ms=` | Delay simulator (max 20 s) |
| GET | `/api/large?kb=` | Payload size simulator (max 5 MB) |
| POST | `/api/reset` | Restore seed data |
