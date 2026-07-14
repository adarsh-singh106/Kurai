/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/index.js]
 *
 * WHO I AM:    The entry point of the Kurai Express server.
 * WHAT I OWN:  Bootstrapping the server, wiring up middleware, registering API
 *              routes, and binding the HTTP port.
 * WHAT I DON'T: Route handling logic (delegated to server/routes/) or proxy
 *              execution (delegated to server/services/proxyEngine.js).
 * WHO CALLS ME: npm scripts (dev, start) or the CLI bootstrapper (cli/kurai.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import config from './config.js';
import healthRouter from './routes/health.js';
import proxyRouter from './routes/proxy.js';
import collectionsRouter from './routes/collections.js';
import environmentsRouter from './routes/environments.js';
import historyRouter from './routes/history.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { securityMiddleware } from './middleware/security.js';

dotenv.config();

const app = express();

// Security and utility middleware
app.use(cors());
app.use(express.json());
app.use(securityMiddleware);
app.use(requestLogger);

// Static file serving for the client web app
app.use(express.static('client'));

// API Routes
app.use('/health', healthRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/environments', environmentsRouter);
app.use('/api/history', historyRouter);

// Global Error Handler
app.use(errorHandler);

const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`[kurai] Server running on port ${PORT} in ${config.nodeEnv} mode`);
});

export default app;
