/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/core/utils.js]
 *
 * WHO I AM:    Small shared helpers for view rendering.
 * WHAT I OWN:  HTML escaping, byte/time formatting, relative timestamps, and
 *              JSON syntax highlighting for the response pane.
 * WHAT I DON'T: State, storage, or network calls.
 * WHO CALLS ME: Feature views (request/response/history) and main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * escapeHtml — neutralises HTML-special characters before innerHTML insertion.
 * WHY: history URLs and response payloads are attacker-controlled strings;
 * without escaping, a response containing <img onerror=…> would execute.
 *
 * @param {*} value — any value; coerced to string
 * @returns {string} HTML-safe string
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * formatBytes — human-readable payload sizes (842 B, 12.4 KB, 1.2 MB).
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * formatDuration — human-readable elapsed time (89 ms, 1.24 s).
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * relativeTime — compact "time ago" labels for history rows.
 *
 * @param {string|number|Date} timestamp
 * @returns {string} e.g. "just now", "5m", "2h", "3d"
 */
export function relativeTime(timestamp) {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * highlightJson — converts a pretty-printed JSON string into HTML with
 * syntax-highlight spans (.json-key/.json-string/.json-number/…).
 *
 * WHY regex over a parser: the input is already the output of
 * JSON.stringify(…, null, 2), so its token shapes are fully predictable —
 * a tokenizer would be overkill for a display-only concern.
 *
 * @param {string} json — pretty-printed JSON text
 * @returns {string} HTML string (input is escaped before span injection)
 */
export function highlightJson(json) {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (match.startsWith('"')) {
        cls = match.endsWith(':') ? 'json-key' : 'json-string';
      } else if (match === 'true' || match === 'false') {
        cls = 'json-boolean';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      // WHY: keep the trailing colon outside the key span so punctuation
      // inherits the default text colour.
      if (cls === 'json-key') {
        const colonIdx = match.lastIndexOf(':');
        const key = match.slice(0, colonIdx);
        return `<span class="json-key">${key}</span>:`;
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

/**
 * showToast — fire-and-forget toast notification in the bottom-right corner.
 *
 * @param {string} message — plain text to display (escaped internally)
 * @param {"success"|"error"|"warning"|"info"} [type="info"]
 * @param {number} [duration=2500] — ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 2500) {
  // WHY single-instance: stacking toasts in a tiny tool is noise — the
  // newest message always wins.
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ── Dialogs ─────────────────────────────────────────────────────────────── */

/**
 * WHY not window.prompt/confirm: they freeze the entire main thread (no
 * animations, no pending fetches painted) and are disabled in some embedded
 * browser contexts. These render the existing .modal-overlay component and
 * resolve a Promise instead.
 */

/** Build the shared overlay + dialog scaffold; returns {overlay, content}. */
function buildModal(titleText) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.setAttribute('role', 'dialog');
  content.setAttribute('aria-modal', 'true');
  if (titleText) {
    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = titleText;
    content.appendChild(title);
  }
  overlay.appendChild(content);
  return { overlay, content };
}

/**
 * promptDialog — Promise-based replacement for window.prompt.
 *
 * @param {string} title — dialog heading
 * @param {{placeholder?: string, value?: string, confirmLabel?: string}} [opts]
 * @returns {Promise<string|null>} trimmed input, or `null` on cancel/Escape
 */
export function promptDialog(title, opts = {}) {
  return new Promise((resolve) => {
    const { overlay, content } = buildModal(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-text';
    input.placeholder = opts.placeholder || '';
    input.value = opts.value || '';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'Cancel';
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = opts.confirmLabel || 'Save';
    actions.append(cancelBtn, okBtn);
    content.append(input, actions);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };
    okBtn.addEventListener('click', () => close(input.value.trim()));
    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim());
      if (e.key === 'Escape') close(null);
    });

    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

/**
 * confirmDialog — Promise-based replacement for window.confirm.
 *
 * @param {string} title — dialog heading
 * @param {{message?: string, confirmLabel?: string, danger?: boolean}} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(title, opts = {}) {
  return new Promise((resolve) => {
    const { overlay, content } = buildModal(title);

    if (opts.message) {
      const msg = document.createElement('p');
      msg.className = 'modal-message';
      msg.textContent = opts.message;
      content.appendChild(msg);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'Cancel';
    const okBtn = document.createElement('button');
    okBtn.className = `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`;
    okBtn.textContent = opts.confirmLabel || 'Confirm';
    actions.append(cancelBtn, okBtn);
    content.appendChild(actions);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };
    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });

    document.body.appendChild(overlay);
    okBtn.focus();
  });
}
