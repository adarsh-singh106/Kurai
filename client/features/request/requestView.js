/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/request/requestView.js]
 *
 * WHO I AM:    UI manager for the Request Builder panel.
 * WHAT I OWN:  Binding input event listeners to the HTTP method select tag and URL input bar,
 *              dispatching updates to requestState, and listening to Send clicks.
 * WHAT I DON'T: Network proxies or storage files.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import requestState from './requestState.js';
import requestService from './requestService.js';
import eventBus from '../../core/eventBus.js';

const requestView = {
  init: () => {
    const methodSelect = document.getElementById('request-method');
    const urlInput = document.getElementById('request-url');
    const sendBtn = document.getElementById('send-request-btn');

    if (methodSelect) {
      methodSelect.addEventListener('change', (e) => {
        requestState.updateMethod(e.target.value);
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        requestState.updateUrl(e.target.value);
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        requestService.sendCurrentRequest();
      });
    }

    // Sync input states when request changes
    eventBus.on('request:changed', (request) => {
      if (methodSelect) methodSelect.value = request.method;
      if (urlInput) urlInput.value = request.url;
    });
  }
};

export default requestView;
