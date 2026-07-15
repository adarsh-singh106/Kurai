/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [test-server/server.js]
 *
 * WHO I AM:    A self-contained demo API for test-driving every Kurai feature.
 * WHAT I OWN:  In-memory users/products data, endpoints for every HTTP method
 *              (including QUERY), all three auth schemes, every body format,
 *              header echo, status-code / delay / size simulators.
 * WHAT I DON'T: Anything production. Data resets on restart — by design.
 * WHO CALLS ME: `npm run demo` (or `node test-server/server.js`), then Kurai
 *              pointed at http://127.0.0.1:5100 via the walkthrough in
 *              test-server/README.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express';

const app = express();
const PORT = process.env.DEMO_PORT || 5100;

// Demo credentials — intentionally hardcoded and printed at boot.
const DEMO_TOKEN = 'kurai-demo-token-12345';
const DEMO_USER = 'kurai';
const DEMO_PASS = 'demo123';
const DEMO_API_KEY = 'kurai-key-98765';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Request log — see every request Kurai sends, live ──────────────────── */
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`  ${req.method.padEnd(7)} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

/* ── In-memory data (resets on restart — that's the point) ───────────────── */

let nextId = 4;
let users = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'member' },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com', role: 'member' }
];

const reset = () => {
  nextId = 4;
  users = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' },
    { id: 2, name: 'Alan Turing', email: 'alan@example.com', role: 'member' },
    { id: 3, name: 'Grace Hopper', email: 'grace@example.com', role: 'member' }
  ];
};

/* ── Basics ──────────────────────────────────────────────────────────────── */

// The very first request in the walkthrough.
app.get('/', (req, res) => {
  res.json({
    name: 'Kurai Demo API',
    message: 'It works! You just sent your first request through Kurai. 🎉',
    docs: 'See test-server/README.md for the full feature walkthrough.',
    endpoints: [
      'GET    /api/users?page=&limit=&role=',
      'GET    /api/users/:id',
      'POST   /api/users            (JSON body)',
      'PUT    /api/users/:id        (JSON body)',
      'PATCH  /api/users/:id        (JSON body)',
      'DELETE /api/users/:id',
      'QUERY  /api/users            (the new HTTP QUERY method — filter via body)',
      'POST   /api/login            (x-www-form-urlencoded → returns a token)',
      'POST   /api/register         (form data)',
      'GET    /api/protected/bearer (Bearer token auth)',
      'GET    /api/protected/basic  (Basic auth)',
      'GET    /api/protected/apikey (X-API-Key header OR ?api_key= query)',
      'GET    /api/echo             (echoes method/headers/query/body back)',
      'GET    /api/status/:code     (any status code, e.g. /api/status/404)',
      'GET    /api/slow?ms=2000     (delayed response — watch the timer)',
      'GET    /api/large?kb=100     (big JSON payload — watch the size)',
      'POST   /api/reset            (restore seed data)'
    ]
  });
});

/* ── Users CRUD — methods, query params, JSON bodies ─────────────────────── */

app.get('/api/users', (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 10, 1);
  let list = users;
  if (req.query.role) list = list.filter(u => u.role === req.query.role);
  const start = (page - 1) * limit;
  res.json({
    page, limit, total: list.length,
    data: list.slice(start, start + limit)
  });
});

app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found', id: req.params.id });
  res.json(user);
});

app.post('/api/users', (req, res) => {
  const { name, email, role } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({
      error: 'Validation failed',
      details: 'Both "name" and "email" are required in the JSON body.'
    });
  }
  const user = { id: nextId++, name, email, role: role || 'member' };
  users.push(user);
  res.status(201).json({ message: 'User created', user });
});

app.put('/api/users/:id', (req, res) => {
  const idx = users.findIndex(u => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const { name, email, role } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'PUT replaces the whole user — send name AND email.' });
  }
  users[idx] = { id: users[idx].id, name, email, role: role || 'member' };
  res.json({ message: 'User replaced', user: users[idx] });
});

app.patch('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  Object.assign(user, req.body || {});
  res.json({ message: 'User updated', user });
});

app.delete('/api/users/:id', (req, res) => {
  const idx = users.findIndex(u => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const [removed] = users.splice(idx, 1);
  res.json({ message: 'User deleted', user: removed });
});

/* ── The new HTTP QUERY method ───────────────────────────────────────────── */
// QUERY is "GET with a body": safe, idempotent, but the query lives in the
// request body — ideal for filters too complex for a query string.
// WHY app.all + method check: Express has no app.query() helper (yet).
app.all('/api/users', (req, res, next) => {
  if (req.method !== 'QUERY') return next();
  const { role, nameContains } = req.body || {};
  let result = users;
  if (role) result = result.filter(u => u.role === role);
  if (nameContains) {
    result = result.filter(u => u.name.toLowerCase().includes(String(nameContains).toLowerCase()));
  }
  res.json({
    method: 'QUERY',
    note: 'This filter arrived in the request BODY — impossible with plain GET.',
    filter: req.body,
    matches: result
  });
});

/* ── Body formats: urlencoded + form data ────────────────────────────────── */

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const ct = req.headers['content-type'] || '(none)';
  if (username === DEMO_USER && password === DEMO_PASS) {
    return res.json({
      message: 'Login successful',
      receivedContentType: ct,
      token: DEMO_TOKEN,
      hint: 'Save this token in a Kurai environment variable named TOKEN — the walkthrough shows how.'
    });
  }
  res.status(401).json({
    error: 'Invalid credentials',
    receivedContentType: ct,
    expected: { username: DEMO_USER, password: DEMO_PASS }
  });
});

app.post('/api/register', (req, res) => {
  const fields = req.body || {};
  if (!fields.name) {
    return res.status(400).json({ error: 'Send at least a "name" field via Form Data.' });
  }
  res.status(201).json({
    message: 'Form received',
    receivedContentType: req.headers['content-type'] || '(none)',
    fields
  });
});

/* ── Auth schemes ────────────────────────────────────────────────────────── */

app.get('/api/protected/bearer', (req, res) => {
  const header = req.headers.authorization || '';
  if (header === `Bearer ${DEMO_TOKEN}`) {
    return res.json({ message: '🔓 Bearer auth OK', you: 'are authenticated' });
  }
  res.status(401).json({
    error: 'Missing or wrong Bearer token',
    received: header || '(no Authorization header)',
    expectedToken: DEMO_TOKEN
  });
});

app.get('/api/protected/basic', (req, res) => {
  const header = req.headers.authorization || '';
  const expected = 'Basic ' + Buffer.from(`${DEMO_USER}:${DEMO_PASS}`).toString('base64');
  if (header === expected) {
    return res.json({ message: '🔓 Basic auth OK', user: DEMO_USER });
  }
  res.status(401).json({
    error: 'Missing or wrong Basic credentials',
    received: header || '(no Authorization header)',
    expectedUsername: DEMO_USER,
    expectedPassword: DEMO_PASS
  });
});

app.get('/api/protected/apikey', (req, res) => {
  const viaHeader = req.headers['x-api-key'];
  const viaQuery = req.query.api_key;
  if (viaHeader === DEMO_API_KEY || viaQuery === DEMO_API_KEY) {
    return res.json({
      message: '🔓 API key OK',
      deliveredVia: viaHeader ? 'X-API-Key header' : 'api_key query parameter'
    });
  }
  res.status(401).json({
    error: 'Missing or wrong API key',
    accepts: ['X-API-Key header', '?api_key= query parameter'],
    expectedKey: DEMO_API_KEY
  });
});

/* ── Inspection & simulators ─────────────────────────────────────────────── */

// Echo everything back — the fastest way to see exactly what Kurai sent.
app.all('/api/echo', (req, res) => {
  res.json({
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    headers: req.headers,
    body: req.body ?? null
  });
});

// Sets two cookies — exercises Kurai's response Cookies tab.
app.get('/api/cookies', (req, res) => {
  res.setHeader('Set-Cookie', [
    'session_id=kurai-demo-session; Path=/; HttpOnly; Max-Age=3600',
    'theme=dark; Path=/; SameSite=Lax'
  ]);
  res.json({ message: 'Two cookies set — check the Cookies tab' });
});

// Returns HTML — exercises Kurai's Preview body mode.
app.get('/api/html', (req, res) => {
  res.type('html').send(`<!doctype html>
<html><body style="font-family: sans-serif; padding: 2rem">
  <h1>Kurai Preview demo</h1>
  <p>This HTML renders inside a <strong>sandboxed</strong> iframe.</p>
  <script>document.body.innerHTML = 'If you can read the heading above, scripts were blocked — good.'</script>
</body></html>`);
});

app.get('/api/status/:code', (req, res) => {
  const code = parseInt(req.params.code);
  if (isNaN(code) || code < 200 || code > 599) {
    return res.status(400).json({ error: 'Give me a code between 200 and 599, e.g. /api/status/418' });
  }
  res.status(code).json({ simulatedStatus: code });
});

app.get('/api/slow', (req, res) => {
  const ms = Math.min(parseInt(req.query.ms) || 2000, 20000);
  setTimeout(() => res.json({ message: `Responded after ${ms}ms`, delayMs: ms }), ms);
});

app.get('/api/large', (req, res) => {
  const kb = Math.min(parseInt(req.query.kb) || 100, 5000);
  const rows = [];
  // ~100 bytes per row → kb * 10 rows ≈ kb kilobytes
  for (let i = 0; i < kb * 10; i++) {
    rows.push({ index: i, uuid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, payload: 'x'.repeat(40) });
  }
  res.json({ approxSizeKb: kb, count: rows.length, rows });
});

app.post('/api/reset', (req, res) => {
  reset();
  res.json({ message: 'Seed data restored', users });
});

/* ── Boot ────────────────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  Kurai Demo API running at  http://127.0.0.1:${PORT}            │
│                                                             │
│  Demo credentials (also in test-server/README.md):          │
│    Bearer token : ${DEMO_TOKEN}                 │
│    Basic auth   : ${DEMO_USER} / ${DEMO_PASS}                              │
│    API key      : ${DEMO_API_KEY}                       │
│                                                             │
│  ⚠  Kurai blocks private IPs by default (SSRF protection).  │
│     Run Kurai with PROXY_ALLOW_PRIVATE_IPS=true to test     │
│     against this local server. Details in the README.       │
└─────────────────────────────────────────────────────────────┘`);
});
