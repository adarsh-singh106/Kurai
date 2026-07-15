/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/routes/proxy.js]
 *
 * WHO I AM:    API route handler for proxied HTTP requests.
 * WHAT I OWN:  Defining the endpoint POST /api/proxy, mapping body parameters
 *              to the proxy engine, and returning unified response envelopes.
 * WHAT I DON'T: The actual network socket connections (delegated to services/proxyEngine.js)
 *              or input schema validation (delegated to middleware/validate.js).
 * WHO CALLS ME: server/index.js (Express app routing).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { forwardRequest } from '../services/proxyEngine.js';
import { runScriptInSandbox } from '../services/scriptSandbox.js';

const router = Router();

// Schema or schema-like validation logic (to be parsed by validate middleware)
// WHY headers is 'object': the client (network/requestBuilder.js) compiles
// headers into a {key: value} map, and proxyEngine iterates Object.entries().
// WHY body is 'string': the client sends body.content verbatim (raw text/JSON).
// WHY script/variables: post-response test scripts (kurai.test/expect) run
// here — the sandbox needs the upstream response, which only this route holds.
const proxySchema = {
  url: 'required|string',
  method: 'required|string',
  headers: 'optional|object',
  body: 'optional|string',
  script: 'optional|string',
  variables: 'optional|object'
};

// WHY we return a standard envelope { ok: true/false, data/error }:
// Targets responding with HTTP errors (e.g. 404 or 500) are not server errors for Kurai;
// the proxy succeeded in getting the response. We wrap this status in the envelope
// so the client receives the data consistently.
router.post('/', validate(proxySchema), async (req, res, next) => {
  try {
    const result = await forwardRequest(req.body);

    // Post-response test script (optional). A script failure must never lose
    // the HTTP response — worst case it becomes a failed "Script Execution" row.
    if (typeof req.body.script === 'string' && req.body.script.trim()) {
      try {
        let json = null;
        try { json = JSON.parse(result.body); } catch { /* not JSON */ }

        const responseContext = {
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: result.body,
          json,
          time: result.time,
          size: result.size
        };
        const { variables, testResults } = runScriptInSandbox(
          req.body.script,
          req.body.variables || {},
          responseContext
        );
        result.testResults = testResults;
        result.variables = variables;
      } catch (error) {
        result.testResults = [{ name: 'Script Execution', passed: false, error: error.message }];
      }
    }

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
