/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/response/responseView.js]
 *
 * WHO I AM:    UI manager for the Response Viewer panel.
 * WHAT I OWN:  Updating status pills, elapsed time texts, response payload
 *              sizes, JSON syntax highlighting, the headers table, the
 *              empty/loading/error states, and the copy-to-clipboard button.
 * WHAT I DON'T: Bypassing CORS or writing to disk database logs.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';
import {
  escapeHtml,
  formatBytes,
  formatDuration,
  highlightJson,
  showToast
} from '../../core/utils.js';

/** Raw body text of the last response — kept for the copy button. */
let lastBodyText = '';

/* ── DOM helpers ─────────────────────────────────────────────────────────── */

function els() {
  return {
    status: document.getElementById('response-status'),
    time: document.getElementById('response-time'),
    size: document.getElementById('response-size'),
    body: document.getElementById('response-body-display'),
    headers: document.getElementById('response-headers-display'),
    empty: document.getElementById('response-empty-state'),
    copyBtn: document.getElementById('copy-response-btn'),
    panel: document.getElementById('response-viewer')
  };
}

/** Hide the pre-request empty state and reveal the active response tab. */
function showResponseSurface() {
  const { empty, body, headers } = els();
  if (empty) empty.hidden = true;
  const activeTab = document.querySelector('.response-tab.active')?.dataset.rtab || 'body';
  if (body) body.hidden = activeTab !== 'body';
  if (headers) headers.hidden = activeTab !== 'headers';
}

/** Indeterminate gradient bar across the top of the panel while in flight. */
function setLoadingBar(visible) {
  const { panel } = els();
  if (!panel) return;
  let bar = panel.querySelector('.loading-bar');
  if (visible && !bar) {
    bar = document.createElement('div');
    bar.className = 'loading-bar';
    panel.appendChild(bar);
  } else if (!visible && bar) {
    bar.remove();
  }
}

/* ── View ────────────────────────────────────────────────────────────────── */

const responseView = {
  init: () => {
    eventBus.on('response:received', (response) => {
      // WHY: state.resetState() emits null — treat as "clear panel".
      if (response) responseView.render(response);
    });

    eventBus.on('response:error', (error) => {
      responseView.renderError(error);
    });

    eventBus.on('ui:loading', (isLoading) => {
      setLoadingBar(isLoading);
    });

    // ── Body / Headers view tabs ───────────────────────────────────────
    document.querySelectorAll('.response-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.response-tab').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        const { body, headers, empty } = els();
        // WHY the empty check: switching tabs before any request should
        // keep showing the empty state, not blank panes.
        if (empty && !empty.hidden) return;
        if (body) body.hidden = btn.dataset.rtab !== 'body';
        if (headers) headers.hidden = btn.dataset.rtab !== 'headers';
      });
    });

    // ── Copy to clipboard ──────────────────────────────────────────────
    const { copyBtn } = els();
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(lastBodyText);
          copyBtn.classList.add('copied');
          showToast('Response copied to clipboard', 'success');
          setTimeout(() => copyBtn.classList.remove('copied'), 1200);
        } catch {
          showToast('Copy failed — clipboard unavailable', 'error');
        }
      });
    }
  },

  render: (response) => {
    const { status, time, size, body, headers, copyBtn } = els();

    if (status) {
      const band = Math.floor(response.status / 100);
      const bandClass = band >= 2 && band <= 5 ? `status-${band}xx` : 'status-5xx';
      status.textContent = `${response.status} ${response.statusText || ''}`.trim();
      status.className = `status-pill ${bandClass}`;
      status.hidden = false;
    }

    if (time) {
      time.textContent = formatDuration(response.time);
      time.hidden = false;
    }
    if (size) {
      size.textContent = formatBytes(response.size);
      size.hidden = false;
    }

    if (body) {
      try {
        // Pretty-print + syntax-highlight JSON payloads.
        const parsed = JSON.parse(response.body);
        const pretty = JSON.stringify(parsed, null, 2);
        lastBodyText = pretty;
        body.innerHTML = highlightJson(pretty);
      } catch {
        lastBodyText = response.body ?? '';
        body.textContent = lastBodyText;
      }
    }

    if (headers) {
      const entries = Object.entries(response.headers || {});
      headers.innerHTML = entries.length
        ? entries.map(([key, value]) => `
            <div class="response-header-row">
              <span class="response-header-key">${escapeHtml(key)}</span>
              <span class="response-header-value">${escapeHtml(value)}</span>
            </div>`).join('')
        : '<div class="empty-state">No headers returned</div>';
    }

    if (copyBtn) copyBtn.hidden = false;
    showResponseSurface();
  },

  renderError: (error) => {
    const { status, time, size, body, copyBtn } = els();

    // Clear stale metadata from any previous success.
    if (status) status.hidden = true;
    if (time) time.hidden = true;
    if (size) size.hidden = true;
    if (copyBtn) copyBtn.hidden = true;

    if (body) {
      lastBodyText = '';
      body.innerHTML = `
        <div class="response-error-banner">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0;margin-top:2px">
            <circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11.25" r="0.5" fill="currentColor"/>
          </svg>
          <span>${escapeHtml(error?.message || 'Failed to dispatch request')}</span>
        </div>`;
    }
    showResponseSurface();
  }
};

export default responseView;
