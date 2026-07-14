/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/routes/health.js]
 *
 * WHO I AM:    API route handler for server health checks.
 * WHAT I OWN:  Defining GET /health endpoint.
 * WHAT I DON'T: Heavy logic or data mutation.
 * WHO CALLS ME: Docker, Kubernetes probes, or load balancers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
