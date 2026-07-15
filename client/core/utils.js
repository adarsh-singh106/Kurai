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
