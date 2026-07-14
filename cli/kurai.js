#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [cli/kurai.js]
 *
 * WHO I AM:    The CLI bootstrapper for Kurai.
 * WHAT I OWN:  Parsing CLI arguments, launching the Express server, polling the
 *              health endpoint, and auto-opening the browser to the web UI.
 * WHAT I DON'T: Serving HTTP files or proxying requests (delegated to server/index.js).
 * WHO CALLS ME: Users executing `npx kurai` or running the global `kurai` command.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { spawn } from 'child_process';
import { exec } from 'child_process';
import path from 'path';

// Parse arguments
const args = process.argv.slice(2);
const portFlagIdx = args.indexOf('--port');
const port = portFlagIdx !== -1 ? args[portFlagIdx + 1] : '3000';
const noOpen = args.includes('--no-open');

const serverPath = path.resolve('server/index.js');

console.log(`[kurai-cli] Starting Kurai server on port ${port}...`);

// Start Express server as a child process
const serverProcess = spawn('node', [serverPath], {
  env: { ...process.env, PORT: port },
  stdio: 'inherit'
});

serverProcess.on('error', (err) => {
  console.error('[kurai-cli] Failed to start server process:', err);
  process.exit(1);
});

// Helper to open the browser across platforms
// WHY: Part of the developer experience (UX) to open browser automatically on launch
function openBrowser(url) {
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${startCmd} ${url}`);
}

// Poll health check route until healthy, then open browser
async function waitAndOpen() {
  const healthUrl = `http://localhost:${port}/health`;
  let attempts = 0;
  const maxAttempts = 10;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const response = await fetch(healthUrl);
      if (response.status === 200) {
        clearInterval(interval);
        console.log(`[kurai-cli] Server is healthy! Opening Kurai at http://localhost:${port}...`);
        if (!noOpen) {
          openBrowser(`http://localhost:${port}`);
        }
      }
    } catch (e) {
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error('[kurai-cli] Server failed to start within timeout window.');
      }
    }
  }, 1000);
}

waitAndOpen();
