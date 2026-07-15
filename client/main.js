/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/main.js]
 *
 * WHO I AM:    The front-end bootstrap sequence module.
 * WHAT I OWN:  Bootstrapping the application: loading state, registering global
 *              events (theme toggle, sidebar tabs, keyboard shortcuts), init-
 *              ializing features, and initiating the primary render.
 * WHAT I DON'T: Any specific styling, routing, or feature implementation.
 * WHO CALLS ME: script tag in client/index.html.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import requestView from './features/request/requestView.js';
import responseView from './features/response/responseView.js';
import collectionView from './features/collections/collectionView.js';
import environmentView, { ACTIVE_ENV_STORAGE_KEY } from './features/environment/environmentView.js';
import historyView from './features/history/historyView.js';
import layoutView from './features/layout/layoutView.js';
import collectionService from './features/collections/collectionService.js';
import environmentStorage from './features/environment/environmentStorage.js';
import historyStorage from './features/history/historyStorage.js';
import requestService from './features/request/requestService.js';
import state from './core/state.js';
import eventBus from './core/eventBus.js';

console.log('[kurai] Initializing boot sequence...');

const THEME_STORAGE_KEY = 'kurai.theme';

/* ── Theme ───────────────────────────────────────────────────────────────── */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch { /* private mode — theme just won't persist */ }
  eventBus.emit('ui:theme', theme);
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch { /* ignore */ }
  if (saved === 'light' || saved === 'dark') applyTheme(saved);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
}

/* ── Sidebar chrome ──────────────────────────────────────────────────────── */

function initSidebar() {
  // Collections ⇄ History section tabs.
  const tabs = document.querySelectorAll('.sidebar-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      document.querySelectorAll('.sidebar-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tab.dataset.panel}-list`);
      });
    });
  });

  // Collapse/expand toggle in the header.
  const sidebar = document.getElementById('sidebar-container');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (sidebar && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      // WHY two classes: ≤768px uses .open (overlay drawer), desktop uses
      // .collapsed (inline shrink) — media queries pick the right one.
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        sidebar.classList.toggle('open');
      } else {
        sidebar.classList.toggle('collapsed');
      }
    });
  }
}

/* ── Keyboard shortcuts ──────────────────────────────────────────────────── */

function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+Enter — send the current request from anywhere.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      requestService.sendCurrentRequest();
    }
  });
}

/* ── Boot ────────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Shell chrome (theme, sidebar, shortcuts)
    initTheme();
    initSidebar();
    initShortcuts();

    // 2. Initialize Views
    requestView.init();
    responseView.init();
    collectionView.init();
    environmentView.init();
    historyView.init();
    layoutView.init();

    console.log('[kurai] Features initialized.');

    // 3. Load Data from Storage
    const collections = await collectionService.loadCollections();
    const environments = await environmentStorage.getAll();
    const historyList = await historyStorage.list();

    // 4. Populate State
    state.setEnvironments(environments);

    // Restore the last active environment (guard against IDs deleted since —
    // setActiveEnvironmentId throws on unknown IDs).
    try {
      const savedEnvId = localStorage.getItem(ACTIVE_ENV_STORAGE_KEY);
      if (savedEnvId && environments.some(e => e.id === savedEnvId)) {
        state.setActiveEnvironmentId(savedEnvId);
      }
    } catch { /* private mode — start with no environment */ }

    // WHY setHistory over addToHistory loop: one event → one render, and
    // reversing shows newest-first when entries were stored sequentially.
    state.setHistory([...historyList].reverse());

    console.log('[kurai] Primary UI rendered successfully.');
  } catch (error) {
    console.error('[kurai] Boot sequence failed:', error);
  }
});
