/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/services/storageService.js]
 *
 * WHO I AM:    The abstract storage interface selector.
 * WHAT I OWN:  Dynamically routing calls to either the File storage adapter
 *              or Postgres storage adapter depending on the application configuration.
 * WHAT I DON'T: Any storage adapter implementations.
 * WHO CALLS ME: API Route handlers (server/routes/collections.js, etc.).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import config from '../config.js';
import fileAdapter from '../storage/adapters/fileAdapter.js';
import postgresAdapter from '../storage/adapters/postgresAdapter.js';

const adapters = {
  file: fileAdapter,
  postgres: postgresAdapter
};

const storageService = adapters[config.storageBackend];
if (!storageService) {
  throw new Error(`Unknown storage backend: ${config.storageBackend}`);
}

export default storageService;
