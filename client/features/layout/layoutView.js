/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/layout/layoutView.js]
 *
 * WHO I AM:    Workspace layout manager — draggable panel splitters.
 * WHAT I OWN:  The request/response horizontal splitter, the sidebar width
 *              handle, persisting both sizes, and double-click reset.
 * WHAT I DON'T: Panel content, sidebar collapse toggling (→ main.js).
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * WHY localStorage and not state.js: state deliberately owns no persistence;
 * layout sizes follow the same direct pattern as the theme (kurai.theme).
 */
const RESPONSE_HEIGHT_KEY = 'kurai.layout.responseHeight';
const SIDEBAR_WIDTH_KEY = 'kurai.layout.sidebarWidth';

/** Clamp bounds keep both panels usable at any drag position. */
const RESPONSE_MIN_PX = 200;   // matches .response-viewer-panel min-height
const REQUEST_MIN_PX = 220;    // keeps URL bar + tabs visible above the splitter
const SIDEBAR_MIN_PX = 200;
const SIDEBAR_MAX_PX = 480;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

function readSaved(key) {
  try {
    const value = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function persist(key, value) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(value));
    }
  } catch { /* private mode — sizes just won't persist */ }
}

/* ── Request ↕ Response splitter ─────────────────────────────────────────── */

function initPanelResizer() {
  const resizer = document.getElementById('panel-resizer');
  const mainContent = document.querySelector('.main-content');
  if (!resizer || !mainContent) return;

  const applyHeight = (px) => {
    mainContent.style.setProperty('--response-height', `${px}px`);
  };

  // Restore last size (desktop only — mobile keeps its 50% media query).
  const saved = readSaved(RESPONSE_HEIGHT_KEY);
  if (saved !== null && !isMobile()) applyHeight(saved);

  let dragging = false;

  resizer.addEventListener('pointerdown', (e) => {
    dragging = true;
    resizer.setPointerCapture(e.pointerId);
    resizer.classList.add('dragging');
    mainContent.classList.add('resizing');
  });

  resizer.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = mainContent.getBoundingClientRect();
    // Distance from the pointer to the container's bottom = response height.
    const height = clamp(
      rect.bottom - e.clientY,
      RESPONSE_MIN_PX,
      rect.height - REQUEST_MIN_PX
    );
    applyHeight(height);
  });

  resizer.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    mainContent.classList.remove('resizing');
    const current = parseInt(mainContent.style.getPropertyValue('--response-height'), 10);
    if (Number.isFinite(current)) persist(RESPONSE_HEIGHT_KEY, current);
  });

  // Double-click snaps back to the CSS default (42%).
  resizer.addEventListener('dblclick', () => {
    mainContent.style.removeProperty('--response-height');
    persist(RESPONSE_HEIGHT_KEY, null);
  });
}

/* ── Sidebar width handle ────────────────────────────────────────────────── */

function initSidebarResizer() {
  const handle = document.getElementById('sidebar-resize-handle');
  const sidebar = document.getElementById('sidebar-container');
  if (!handle || !sidebar) return;

  // WHY documentElement: --sidebar-width is declared on :root (layout.css).
  const applyWidth = (px) => {
    document.documentElement.style.setProperty('--sidebar-width', `${px}px`);
  };

  const saved = readSaved(SIDEBAR_WIDTH_KEY);
  if (saved !== null && !isMobile()) applyWidth(saved);

  let dragging = false;

  handle.addEventListener('pointerdown', (e) => {
    if (sidebar.classList.contains('collapsed')) return;
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    sidebar.classList.add('resizing');
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const width = clamp(
      e.clientX - sidebar.getBoundingClientRect().left,
      SIDEBAR_MIN_PX,
      SIDEBAR_MAX_PX
    );
    applyWidth(width);
  });

  handle.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    sidebar.classList.remove('resizing');
    const current = parseInt(
      document.documentElement.style.getPropertyValue('--sidebar-width'), 10
    );
    if (Number.isFinite(current)) persist(SIDEBAR_WIDTH_KEY, current);
  });

  handle.addEventListener('dblclick', () => {
    document.documentElement.style.removeProperty('--sidebar-width');
    persist(SIDEBAR_WIDTH_KEY, null);
  });
}

/* ── View ────────────────────────────────────────────────────────────────── */

const layoutView = {
  init: () => {
    initPanelResizer();
    initSidebarResizer();
  }
};

export default layoutView;
