/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/response/responseView.js]
 *
 * WHO I AM:    UI manager for the Response Viewer panel.
 * WHAT I OWN:  Updating status badges, elapsed time texts, response payload sizes,
 *              and formatting JSON bodies for browser display.
 * WHAT I DON'T: Bypassing CORS or writing to disk database logs.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';

const responseView = {
  init: () => {
    eventBus.on('response:received', (response) => {
      responseView.render(response);
    });

    eventBus.on('response:error', (error) => {
      responseView.renderError(error);
    });
  },

  render: (response) => {
    const statusEl = document.getElementById('response-status');
    const timeEl = document.getElementById('response-time');
    const sizeEl = document.getElementById('response-size');
    const bodyEl = document.getElementById('response-body-display');

    if (statusEl) {
      statusEl.textContent = `${response.status} ${response.statusText || ''}`;
      statusEl.className = `badge badge-${response.status >= 200 && response.status < 300 ? 'success' : 'error'}`;
    }

    if (timeEl) timeEl.textContent = `${response.time} ms`;
    if (sizeEl) sizeEl.textContent = `${response.size} bytes`;
    
    if (bodyEl) {
      try {
        // Try pretty printing json
        const parsed = JSON.parse(response.body);
        bodyEl.textContent = JSON.stringify(parsed, null, 2);
      } catch (e) {
        bodyEl.textContent = response.body;
      }
    }
  },

  renderError: (error) => {
    const bodyEl = document.getElementById('response-body-display');
    if (bodyEl) {
      bodyEl.textContent = `Error: ${error.message || 'Failed to dispatch request'}`;
    }
  }
};

export default responseView;
