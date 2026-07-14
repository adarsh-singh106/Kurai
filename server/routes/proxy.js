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

const router = Router();

// Schema or schema-like validation logic (to be parsed by validate middleware)
const proxySchema = {
  url: 'required|string',
  method: 'required|string',
  headers: 'optional|array',
  body: 'optional|object'
};

// WHY we return a standard envelope { ok: true/false, data/error }:
// Targets responding with HTTP errors (e.g. 404 or 500) are not server errors for Kurai;
// the proxy succeeded in getting the response. We wrap this status in the envelope
// so the client receives the data consistently.
router.post('/', validate(proxySchema), async (req, res, next) => {
  try {
    const result = await forwardRequest(req.body);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
