/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/storage/adapters/fileAdapter.js]
 *
 * WHO I AM:    The JSON-file-on-disk database adapter.
 * WHAT I OWN:  Reading and writing collection, environment, and history JSON files
 *              located in the server storage directory.
 * WHAT I DON'T: SQL query logic or caching adapters.
 * WHO CALLS ME: server/services/storageService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs/promises';
import path from 'path';

// Resolve file paths
const COLLECTIONS_FILE = path.resolve('server/storage/file/collections.json');
const ENVIRONMENTS_FILE = path.resolve('server/storage/file/environments.json');

// Memory buffer for history since it changes rapidly
let _history = [];

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

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const fileAdapter = {
  collections: {
    list: async () => {
      return await readJsonFile(COLLECTIONS_FILE);
    },
    get: async (id) => {
      const items = await readJsonFile(COLLECTIONS_FILE);
      return items.find(item => item.id === id);
    },
    create: async (data) => {
      const items = await readJsonFile(COLLECTIONS_FILE);
      const newItem = { ...data, id: data.id || Math.random().toString(36).substring(2, 9) };
      items.push(newItem);
      await writeJsonFile(COLLECTIONS_FILE, items);
      return newItem;
    },
    update: async (id, data) => {
      const items = await readJsonFile(COLLECTIONS_FILE);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) throw new Error('Collection not found');
      items[index] = { ...items[index], ...data };
      await writeJsonFile(COLLECTIONS_FILE, items);
      return items[index];
    },
    delete: async (id) => {
      const items = await readJsonFile(COLLECTIONS_FILE);
      const filtered = items.filter(item => item.id !== id);
      await writeJsonFile(COLLECTIONS_FILE, filtered);
    }
  },

  environments: {
    list: async () => {
      return await readJsonFile(ENVIRONMENTS_FILE);
    },
    get: async (id) => {
      const items = await readJsonFile(ENVIRONMENTS_FILE);
      return items.find(item => item.id === id);
    },
    create: async (data) => {
      const items = await readJsonFile(ENVIRONMENTS_FILE);
      const newItem = { ...data, id: data.id || Math.random().toString(36).substring(2, 9) };
      items.push(newItem);
      await writeJsonFile(ENVIRONMENTS_FILE, items);
      return newItem;
    },
    update: async (id, data) => {
      const items = await readJsonFile(ENVIRONMENTS_FILE);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) throw new Error('Environment not found');
      items[index] = { ...items[index], ...data };
      await writeJsonFile(ENVIRONMENTS_FILE, items);
      return items[index];
    },
    delete: async (id) => {
      const items = await readJsonFile(ENVIRONMENTS_FILE);
      const filtered = items.filter(item => item.id !== id);
      await writeJsonFile(ENVIRONMENTS_FILE, filtered);
    }
  },

  history: {
    list: async () => {
      return _history;
    },
    add: async (entry) => {
      _history.unshift(entry);
      if (_history.length > 50) {
        _history.pop(); // keep last 50
      }
      return entry;
    },
    clear: async () => {
      _history = [];
    }
  }
};

export default fileAdapter;
