/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/index.js]
 *
 * WHO I AM:    The entry point of the Kurai Express server.
 * WHAT I OWN:  Bootstrapping the server, wiring up middleware, registering API
 *              routes, binding the HTTP port, and graceful shutdown.
 * WHAT I DON'T: Route handling logic (delegated to server/routes/) or proxy
 *              execution (delegated to server/services/proxyEngine.js).
 * WHO CALLS ME: npm scripts (dev, start) or the CLI bootstrapper (cli/kurai.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import config from './config.js';
import healthRouter from './routes/health.js';
import proxyRouter from './routes/proxy.js';
import collectionsRouter from './routes/collections.js';
import environmentsRouter from './routes/environments.js';
import historyRouter from './routes/history.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger, logger } from './middleware/logger.js';
import { securityMiddleware } from './middleware/security.js';
import { rateLimiter } from './middleware/rateLimit.js';

// WHY __dirname is derived instead of relying on process.cwd():
// `node server/index.js` from the repo root and `kurai start` from anywhere
// must both resolve the client directory correctly.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// WHY trust proxy is set:
// Behind a load balancer / reverse proxy (nginx, Cloud Run, k8s ingress),
// req.ip would otherwise be the LB's address — collapsing all users into one
// rate-limit bucket. rateLimit.js documents that it depends on this setting.
app.set('trust proxy', 1);

// Security and utility middleware
// WHY cors origin comes from config:
// In production only the deployed frontend origin should reach the API;
// a wildcard would let any website drive the proxy from a victim's browser.
app.use(cors({
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true
}));

// WHY a 10mb JSON limit:
// The default 100kb rejects legitimately large request bodies developers
// send through the proxy (file payloads, big GraphQL queries).
app.use(express.json({ limit: '10mb' }));
app.use(securityMiddleware);
app.use(requestLogger);

// Static file serving for the client web app
app.use(express.static(path.join(__dirname, '..', 'client')));

// API Routes
app.use('/health', healthRouter);
app.use('/api/proxy', rateLimiter, proxyRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/environments', environmentsRouter);
app.use('/api/history', historyRouter);

// WHY an explicit API 404:
// Without it, unknown /api/* paths fall through to a text/html Express 404
// page, breaking clients that expect the JSON envelope everywhere.
app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: `No such endpoint: ${req.method} ${req.originalUrl}` }
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = config.port || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
});

// WHY graceful shutdown matters at scale:
// Orchestrators (Docker, k8s) send SIGTERM before killing the container.
// Closing the listener first lets in-flight proxy requests finish instead of
// being severed mid-response; the 10s failsafe prevents a hung request from
// blocking the rollout.
function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    logger.info('All connections closed. Bye.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('Forcing shutdown after 10s grace period.');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
