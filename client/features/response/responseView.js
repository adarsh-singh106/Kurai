/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/response/responseView.js]
 *
 * WHO I AM:    UI manager for the Response Viewer panel.
 * WHAT I OWN:  Status pills, timing/size chips, the response tab strip
 *              (Body/Headers/Cookies/Test Results + count badges), body render
 *              modes (Pretty/Raw/Preview), cookie parsing, test result rows,
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

/** Last rendered response — source of truth for tab/mode re-renders. */
let lastResponse = null;

/** Active body render mode: 'pretty' | 'raw' | 'preview'. */
let bodyMode = 'pretty';

/** Tab name → pane element id. Preview is a body sub-mode, not a tab. */
const PANES = {
  body: 'response-body-display',
  headers: 'response-headers-display',
  cookies: 'response-cookies-display',
  tests: 'response-tests-display'
};

/* ── DOM helpers ─────────────────────────────────────────────────────────── */

function els() {
  return {
    status: document.getElementById('response-status'),
    time: document.getElementById('response-time'),
    size: document.getElementById('response-size'),
    body: document.getElementById('response-body-display'),
    headers: document.getElementById('response-headers-display'),
    cookies: document.getElementById('response-cookies-display'),
    tests: document.getElementById('response-tests-display'),
    preview: document.getElementById('response-preview-frame'),
    empty: document.getElementById('response-empty-state'),
    copyBtn: document.getElementById('copy-response-btn'),
    modeTabs: document.getElementById('body-mode-tabs'),
    panel: document.getElementById('response-viewer')
  };
}

function activeTabName() {
  return document.querySelector('.response-tab[data-rtab].active')?.dataset.rtab || 'body';
}

/** Reveal one pane, hide the rest (plus the empty state and preview iframe). */
function setActivePane(name) {
  const { empty, preview, modeTabs, body } = els();
  if (empty) empty.hidden = true;

  for (const [tab, id] of Object.entries(PANES)) {
    const pane = document.getElementById(id);
    if (pane) pane.hidden = tab !== name;
  }

  // Body mode strip only makes sense while looking at the body.
  if (modeTabs) modeTabs.hidden = name !== 'body';

  // Preview replaces the <pre> when selected; otherwise it stays hidden.
  const previewing = name === 'body' && bodyMode === 'preview';
  if (preview) preview.hidden = !previewing;
  if (body && name === 'body') body.hidden = previewing;
}

/** Update one count badge; hide it when there is nothing to count. */
function setBadge(id, text) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = text ?? '';
  badge.hidden = !text;
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

/* ── Renderers (each reads lastResponse) ─────────────────────────────────── */

function isHtmlResponse(response) {
  return (response?.headers?.['content-type'] || '').includes('text/html');
}

/**
 * Find a visualisable array in the response: the body itself, or its `data`
 * field (a very common list-endpoint envelope). Top level only — kept dumb.
 * @returns {Array|null} array of plain objects, or null
 */
function tabularData(response) {
  let json = null;
  try { json = JSON.parse(response?.body); } catch { return null; }
  const candidate = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : null;
  if (!candidate?.length) return null;
  const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  return candidate.every(isPlainObject) ? candidate : null;
}

/** Render an array of objects as a sticky-header table (capped at 200 rows). */
function renderTable(rows) {
  const MAX_ROWS = 200;
  // Column set = union of keys across the first 50 rows.
  const columns = [...new Set(rows.slice(0, 50).flatMap(Object.keys))];
  const cell = (v) => escapeHtml(
    v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  );
  const shown = rows.slice(0, MAX_ROWS);
  // WHY .viz-wrap: the host <pre> uses white-space: pre-wrap, which would
  // render the markup's whitespace as phantom gaps inside the table.
  return `<div class="viz-wrap"><table class="viz-table"><thead><tr>${
    columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')
  }</tr></thead><tbody>${
    shown.map(row => `<tr>${columns.map(c => `<td>${cell(row[c])}</td>`).join('')}</tr>`).join('')
  }</tbody></table>${
    rows.length > MAX_ROWS ? `<div class="viz-truncated">Showing ${MAX_ROWS} of ${rows.length} rows</div>` : ''
  }</div>`;
}

function renderBody() {
  const { body, preview } = els();
  if (!body || !lastResponse) return;

  if (bodyMode === 'raw') {
    body.textContent = lastResponse.body ?? '';
    return;
  }

  if (bodyMode === 'preview') {
    // srcdoc + sandbox: renders the markup with scripts/navigation disabled.
    if (preview) preview.srcdoc = lastResponse.body ?? '';
    return;
  }

  if (bodyMode === 'table') {
    const rows = tabularData(lastResponse);
    if (rows) {
      body.innerHTML = renderTable(rows);
      return;
    }
    // Data shape changed under us — fall through to pretty.
  }

  // 'pretty' — highlight JSON; anything else falls back to plain text.
  try {
    const parsed = JSON.parse(lastResponse.body);
    body.innerHTML = highlightJson(JSON.stringify(parsed, null, 2));
  } catch {
    body.textContent = lastResponse.body ?? '';
  }
}

function renderHeaders() {
  const { headers } = els();
  if (!headers || !lastResponse) return;
  const entries = Object.entries(lastResponse.headers || {});
  headers.innerHTML = entries.length
    ? entries.map(([key, value]) => `
        <div class="response-header-row">
          <span class="response-header-key">${escapeHtml(key)}</span>
          <span class="response-header-value">${escapeHtml(value)}</span>
        </div>`).join('')
    : '<div class="empty-state">No headers returned</div>';
  setBadge('rtab-count-headers', entries.length ? String(entries.length) : null);
}

/** Parse one Set-Cookie string into {name, value, attrs[]}. */
function parseSetCookie(str) {
  const [nameValue, ...attrs] = String(str).split(';');
  const eq = nameValue.indexOf('=');
  return {
    name: eq === -1 ? nameValue.trim() : nameValue.slice(0, eq).trim(),
    value: eq === -1 ? '' : nameValue.slice(eq + 1).trim(),
    attrs: attrs.map(a => a.trim()).filter(Boolean)
  };
}

function renderCookies() {
  const { cookies } = els();
  if (!cookies || !lastResponse) return;
  const list = (lastResponse.setCookies || []).map(parseSetCookie);
  cookies.innerHTML = list.length
    ? list.map(c => `
        <div class="response-header-row">
          <span class="response-header-key">${escapeHtml(c.name)}</span>
          <span class="response-header-value">
            ${escapeHtml(c.value)}
            ${c.attrs.map(a => `<span class="meta-chip cookie-attr">${escapeHtml(a)}</span>`).join('')}
          </span>
        </div>`).join('')
    : '<div class="empty-state">No cookies set by this response</div>';
  setBadge('rtab-count-cookies', list.length ? String(list.length) : null);
}

function renderTests() {
  const { tests } = els();
  if (!tests || !lastResponse) return;
  const results = lastResponse.testResults;

  if (!Array.isArray(results)) {
    tests.innerHTML = `
      <div class="empty-state">
        <span class="empty-title">No tests for this request</span>
        <span>Write assertions in the request's <strong>Tests</strong> tab — they run automatically on send.</span>
      </div>`;
    setBadge('rtab-count-tests', null);
    return;
  }

  const passed = results.filter(r => r.passed).length;
  tests.innerHTML = results.length
    ? results.map(r => `
        <div class="test-result-row ${r.passed ? 'pass' : 'fail'}">
          <span class="test-result-icon" aria-hidden="true">
            ${r.passed
              ? '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8.5l3.5 3.5 7.5-8"/></svg>'
              : '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3.5" y1="3.5" x2="12.5" y2="12.5"/><line x1="12.5" y1="3.5" x2="3.5" y2="12.5"/></svg>'}
          </span>
          <span class="test-result-name">${escapeHtml(r.name)}</span>
          ${r.passed ? '' : `<span class="test-result-error">${escapeHtml(r.error || 'Assertion failed')}</span>`}
        </div>`).join('')
    : '<div class="empty-state">The script ran but declared no tests — use kurai.test(name, fn)</div>';

  const badge = document.getElementById('rtab-count-tests');
  setBadge('rtab-count-tests', results.length ? `${passed}/${results.length}` : null);
  badge?.classList.toggle('fail', passed < results.length);
}

/** Enable/disable the Preview and Visualize mode buttons per response shape. */
function updatePreviewAvailability() {
  const previewBtn = document.querySelector('#body-mode-tabs [data-bmode="preview"]');
  const tableBtn = document.querySelector('#body-mode-tabs [data-bmode="table"]');

  const htmlAvailable = isHtmlResponse(lastResponse);
  if (previewBtn) previewBtn.disabled = !htmlAvailable;

  const tableAvailable = !!tabularData(lastResponse);
  if (tableBtn) tableBtn.disabled = !tableAvailable;

  // If the selected mode no longer applies to this response, fall back.
  if ((bodyMode === 'preview' && !htmlAvailable) ||
      (bodyMode === 'table' && !tableAvailable)) {
    setBodyMode('pretty');
  }
}

function setBodyMode(mode) {
  bodyMode = mode;
  document.querySelectorAll('#body-mode-tabs [data-bmode]').forEach(b => {
    b.classList.toggle('active', b.dataset.bmode === mode);
    b.setAttribute('aria-selected', String(b.dataset.bmode === mode));
  });
  renderBody();
  if (activeTabName() === 'body') setActivePane('body');
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

    // Clear command — resets response panel to the empty state.
    eventBus.on('response:clear', () => {
      lastResponse = null;
      const { status, time, size, body, headers, cookies, tests, empty, copyBtn, modeTabs, preview } = els();
      if (status) status.hidden = true;
      if (time) time.hidden = true;
      if (size) size.hidden = true;
      if (copyBtn) copyBtn.hidden = true;
      if (body) { body.hidden = true; body.innerHTML = ''; }
      if (headers) { headers.hidden = true; headers.innerHTML = ''; }
      if (cookies) { cookies.hidden = true; cookies.innerHTML = ''; }
      if (tests) { tests.hidden = true; tests.innerHTML = ''; }
      if (preview) preview.hidden = true;
      if (modeTabs) modeTabs.hidden = true;
      if (empty) empty.hidden = false;
      setBadge('rtab-count-headers', null);
      setBadge('rtab-count-cookies', null);
      setBadge('rtab-count-tests', null);
    });

    // ── Response view tabs ─────────────────────────────────────────────
    document.querySelectorAll('.response-tab[data-rtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.response-tab[data-rtab]').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        // WHY the empty check: switching tabs before any request should
        // keep showing the empty state, not blank panes.
        const { empty } = els();
        if (empty && !empty.hidden) return;
        setActivePane(btn.dataset.rtab);
      });
    });

    // ── Body render modes (Pretty / Raw / Preview) ─────────────────────
    document.querySelectorAll('#body-mode-tabs [data-bmode]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        setBodyMode(btn.dataset.bmode);
      });
    });

    // ── Copy to clipboard (always the RAW body) ────────────────────────
    const { copyBtn } = els();
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(lastResponse?.body ?? '');
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
    lastResponse = response;
    const { status, time, size, copyBtn } = els();

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

    updatePreviewAvailability();
    renderBody();
    renderHeaders();
    renderCookies();
    renderTests();

    if (copyBtn) copyBtn.hidden = false;
    setActivePane(activeTabName());
  },

  renderError: (error) => {
    lastResponse = null;
    const { status, time, size, body, headers, cookies, tests, copyBtn } = els();

    // Clear stale metadata from any previous success.
    if (status) status.hidden = true;
    if (time) time.hidden = true;
    if (size) size.hidden = true;
    if (copyBtn) copyBtn.hidden = true;
    setBadge('rtab-count-headers', null);
    setBadge('rtab-count-cookies', null);
    setBadge('rtab-count-tests', null);

    // WHY: also wipe the hidden panes — otherwise switching to Headers/
    // Cookies/Tests after an error shows the PREVIOUS response's data.
    if (headers) headers.innerHTML = '<div class="empty-state">Request failed — no headers</div>';
    if (cookies) cookies.innerHTML = '<div class="empty-state">Request failed — no cookies</div>';
    if (tests) tests.innerHTML = '<div class="empty-state">Request failed — tests did not run</div>';

    // Snap back to the body tab so the error is impossible to miss.
    bodyMode = 'pretty';
    document.querySelectorAll('.response-tab[data-rtab]').forEach(b => {
      b.classList.toggle('active', b.dataset.rtab === 'body');
      b.setAttribute('aria-selected', String(b.dataset.rtab === 'body'));
    });

    if (body) {
      body.innerHTML = `
        <div class="response-error-banner">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0;margin-top:2px">
            <circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11.25" r="0.5" fill="currentColor"/>
          </svg>
          <span>${escapeHtml(error?.message || 'Failed to dispatch request')}</span>
        </div>`;
    }
    setActivePane('body');
    // Hide the mode strip — there is no real body to re-render in other modes.
    const { modeTabs } = els();
    if (modeTabs) modeTabs.hidden = true;
  }
};

export default responseView;
