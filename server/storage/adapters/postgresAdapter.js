/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/storage/adapters/postgresAdapter.js]
 *
 * WHO I AM:    The PostgreSQL database adapter.
 * WHAT I OWN:  Connecting to the SQL database, executing queries, and mapping
 *              results to the unified Collections and Environments schemas.
 * WHAT I DON'T: File-system I/O or local storage backups.
 * WHO CALLS ME: server/services/storageService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// WHY we don't fully implement pg connection pools here yet:
// This adapter is reserved for Layer 3+ deployments when scaling to teams.
// We provide a stub interface that throws warning hints or acts as a template
// so developers can transition seamlessly.
const postgresAdapter = {
  collections: {
    list: async () => {
      console.warn('[postgres-adapter] PG fallback: listing from DB not implemented');
      return [];
    },
    get: async (id) => { return null; },
    create: async (data) => { return data; },
    update: async (id, data) => { return data; },
    delete: async (id) => {}
  },
  environments: {
    list: async () => {
      console.warn('[postgres-adapter] PG fallback: listing from DB not implemented');
      return [];
    },
    get: async (id) => { return null; },
    create: async (data) => { return data; },
    update: async (id, data) => { return data; },
    delete: async (id) => {}
  },
  history: {
    list: async () => { return []; },
    add: async (entry) => { return entry; },
    clear: async () => {}
  }
};

export default postgresAdapter;
