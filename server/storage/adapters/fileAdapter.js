/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/storage/adapters/fileAdapter.js]
 *
 * WHO I AM:    The JSON-file-on-disk database adapter.
 * WHAT I OWN:  Reading and writing collection, environment, and history JSON files
 *              located in the server storage directory — atomically and race-free.
 * WHAT I DON'T: SQL query logic or caching adapters.
 * WHO CALLS ME: server/services/storageService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// WHY paths are anchored to this module instead of process.cwd():
// path.resolve('server/storage/...') breaks the moment the server is started
// from any directory other than the repo root (e.g. via the kurai CLI).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', 'file');
const COLLECTIONS_FILE = path.join(STORAGE_DIR, 'collections.json');
const ENVIRONMENTS_FILE = path.join(STORAGE_DIR, 'environments.json');

// Memory buffer for history since it changes rapidly
const HISTORY_LIMIT = 50;
let _history = [];

/**
 * generateId — collision-resistant ID.
 * WHY not Math.random().toString(36).substring(2, 9):
 *   7 base-36 chars ≈ 36 bits; birthday collisions become likely within a few
 *   thousand records, silently corrupting lookups. randomUUID is guaranteed unique.
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * withFileLock — serialises read-modify-write cycles per file.
 *
 * WHY: Two concurrent POSTs both read the same array, both push, and the
 * second write silently erases the first item. Chaining operations on a
 * per-file promise queue makes each mutation atomic with respect to others
 * in this process.
 */
const fileLocks = new Map();
function withFileLock(filePath, fn) {
  const prev = fileLocks.get(filePath) || Promise.resolve();
  const next = prev.then(fn, fn);
  fileLocks.set(filePath, next);
  return next;
}

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * writeJsonFile — atomic write via temp-file + rename.
 *
 * WHY: A crash or power loss mid-write leaves a truncated, unparseable JSON
 * file, destroying every collection the user saved. rename() on the same
 * volume is atomic, so readers only ever see the old or the new content.
 */
async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/**
 * makeCrud — builds the list/get/create/update/delete surface for one file.
 * WHY a factory: collections and environments were verbatim copies; one
 * implementation means one place to fix bugs.
 */
function makeCrud(filePath, notFoundLabel) {
  return {
    list: () => readJsonFile(filePath),

    get: async (id) => {
      const items = await readJsonFile(filePath);
      return items.find(item => item.id === id);
    },

    create: (data) => withFileLock(filePath, async () => {
      const items = await readJsonFile(filePath);
      const newItem = {
        ...data,
        id: data.id || generateId(),
        createdAt: data.createdAt || new Date().toISOString()
      };
      items.push(newItem);
      await writeJsonFile(filePath, items);
      return newItem;
    }),

    update: (id, data) => withFileLock(filePath, async () => {
      const items = await readJsonFile(filePath);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) {
        const error = new Error(`${notFoundLabel} not found`);
        error.status = 404;
        error.code = 'NOT_FOUND';
        throw error;
      }
      // WHY id is re-pinned after the spread: a payload containing a
      // different `id` must not be able to re-key the record.
      items[index] = { ...items[index], ...data, id, updatedAt: new Date().toISOString() };
      await writeJsonFile(filePath, items);
      return items[index];
    }),

    delete: (id) => withFileLock(filePath, async () => {
      const items = await readJsonFile(filePath);
      const filtered = items.filter(item => item.id !== id);
      await writeJsonFile(filePath, filtered);
    })
  };
}

const fileAdapter = {
  collections: makeCrud(COLLECTIONS_FILE, 'Collection'),
  environments: makeCrud(ENVIRONMENTS_FILE, 'Environment'),

  history: {
    list: async () => {
      return _history;
    },
    add: async (entry) => {
      _history.unshift(entry);
      if (_history.length > HISTORY_LIMIT) {
        _history.length = HISTORY_LIMIT; // keep last 50
      }
      return entry;
    },
    clear: async () => {
      _history = [];
    }
  }
};

export default fileAdapter;
