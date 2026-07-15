/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/services/scriptSandbox.js]
 *
 * WHO I AM:    An isolated JavaScript runner for pre-request and post-request scripts.
 * WHAT I OWN:  Executing JS snippets in a secure virtual machine sandbox (Node vm module),
 *              populating environment variables, and returning modified state and test results.
 * WHAT I DON'T: Any filesystem changes or direct access to network connections.
 * WHO CALLS ME: Server-side orchestrators before/after sending HTTP requests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import vm from 'vm';

/**
 * runScriptInSandbox — runs user-written scripts safely.
 *
 * WHY we use Node's vm module:
 *   Executing arbitrary user scripts directly in the main server thread
 *   could allow users to access process globals, environments, or make server crashes.
 *   vm creates a clean sandboxed context with restricted access.
 *
 * @param {string} code - raw JS script string to run
 * @param {Object} contextVariables - key-value store of active environment/variables
 * @param {Object|null} response - plain response snapshot exposed to the script:
 *                                 { status, statusText, headers, body, json, time, size }
 * @returns {Object} { variables, testResults }
 */
export function runScriptInSandbox(code, contextVariables = {}, response = null) {
  const variables = { ...contextVariables };
  const testResults = [];

  // Setup the safe sandboxed environment global object
  const sandbox = {
    // Snapshot of the upstream HTTP response — never the live fetch object,
    // so scripts can't reach streams, agents, or anything with I/O.
    response,
    // Kurai environment API (similar to Postman's pm object)
    kurai: {
      variables: {
        get: (key) => variables[key],
        set: (key, val) => { variables[key] = val; }
      },
      test: (name, fn) => {
        try {
          fn();
          testResults.push({ name, passed: true, error: null });
        } catch (error) {
          testResults.push({ name, passed: false, error: error.message });
        }
      },
      expect: (value) => ({
        toBe: (expected) => {
          if (value !== expected) {
            throw new Error(`Expected ${value} to be ${expected}`);
          }
        },
        toEqual: (expected) => {
          if (JSON.stringify(value) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
          }
        },
        toBeLessThan: (expected) => {
          if (!(value < expected)) {
            throw new Error(`Expected ${value} to be less than ${expected}`);
          }
        },
        toBeGreaterThan: (expected) => {
          if (!(value > expected)) {
            throw new Error(`Expected ${value} to be greater than ${expected}`);
          }
        },
        // WHY .includes: covers both strings and arrays with one matcher.
        toContain: (expected) => {
          if (!value || typeof value.includes !== 'function' || !value.includes(expected)) {
            throw new Error(`Expected ${JSON.stringify(value)} to contain ${JSON.stringify(expected)}`);
          }
        }
      })
    },
    console: {
      log: (...args) => console.log('[sandbox-log]', ...args)
    }
  };

  try {
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 1000 }); // 1 second timeout limit
  } catch (error) {
    testResults.push({ name: 'Script Execution', passed: false, error: error.message });
  }

  return { variables, testResults };
}
