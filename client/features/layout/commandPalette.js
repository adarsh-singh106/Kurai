/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/layout/commandPalette.js]
 *
 * WHO I AM:    Command palette (Ctrl+K / ⌘K) — keyboard-first command launcher.
 * WHAT I OWN:  Opening/closing the palette, fuzzy-filtering commands, rendering
 *              results, executing actions on selection, and keyboard navigation
 *              (ArrowUp/Down + Enter).
 * WHAT I DON'T: Styling (→ components.css), state management (→ state.js).
 * WHO CALLS ME: client/main.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import requestService from '../request/requestService.js';
import state from '../../core/state.js';
import eventBus from '../../core/eventBus.js';

/** Currently highlighted index in the results list. */
let activeIndex = 0;

/** Whether the palette is currently open. */
let isOpen = false;

/* ── Command Definitions ─────────────────────────────────────────────────── */

/**
 * Returns the full command list. Rebuilt on each open so environment/collection
 * lists are always current.
 */
function getCommands() {
  const cmds = [
    {
      id: 'send',
      label: 'Send Request',
      shortcut: 'Ctrl+Enter',
      icon: '⚡',
      section: 'Actions',
      action: () => requestService.sendCurrentRequest()
    },
    {
      id: 'focus-url',
      label: 'Focus URL Bar',
      shortcut: 'Ctrl+L',
      icon: '🔗',
      section: 'Navigation',
      action: () => {
        const urlInput = document.getElementById('request-url');
        if (urlInput) { urlInput.focus(); urlInput.select(); }
      }
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Theme (Dark / Light)',
      shortcut: '',
      icon: '🎨',
      section: 'Preferences',
      action: () => {
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.click();
      }
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      shortcut: 'Ctrl+B',
      icon: '📋',
      section: 'Navigation',
      action: () => {
        const btn = document.getElementById('sidebar-toggle-btn');
        if (btn) btn.click();
      }
    },
    {
      id: 'new-request',
      label: 'New Request',
      shortcut: '',
      icon: '✨',
      section: 'Actions',
      action: () => {
        state.setCurrentRequest({
          id: '',
          name: 'New Request',
          method: 'GET',
          url: '',
          params: [],
          headers: [],
          body: { type: 'none', content: '', formData: [] },
          auth: { type: 'inherit' },
          tests: ''
        });
        const urlInput = document.getElementById('request-url');
        if (urlInput) { urlInput.focus(); urlInput.select(); }
      }
    },
    {
      id: 'manage-env',
      label: 'Manage Environments',
      shortcut: '',
      icon: '🌐',
      section: 'Actions',
      action: () => {
        const btn = document.getElementById('env-manage-btn');
        if (btn) btn.click();
      }
    },
    {
      id: 'clear-response',
      label: 'Clear Response',
      shortcut: '',
      icon: '🧹',
      section: 'Actions',
      action: () => eventBus.emit('response:clear')
    },
    {
      id: 'tab-params',
      label: 'Switch to Params Tab',
      shortcut: '',
      icon: '📝',
      section: 'Navigation',
      action: () => clickTab('params')
    },
    {
      id: 'tab-headers',
      label: 'Switch to Headers Tab',
      shortcut: '',
      icon: '📝',
      section: 'Navigation',
      action: () => clickTab('headers')
    },
    {
      id: 'tab-body',
      label: 'Switch to Body Tab',
      shortcut: '',
      icon: '📝',
      section: 'Navigation',
      action: () => clickTab('body')
    },
    {
      id: 'tab-auth',
      label: 'Switch to Auth Tab',
      shortcut: '',
      icon: '🔒',
      section: 'Navigation',
      action: () => clickTab('auth')
    },
    {
      id: 'tab-tests',
      label: 'Switch to Tests Tab',
      shortcut: '',
      icon: '🧪',
      section: 'Navigation',
      action: () => clickTab('tests')
    },
    // HTTP method shortcuts
    ...['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => ({
      id: `method-${m.toLowerCase()}`,
      label: `Set Method → ${m}`,
      shortcut: '',
      icon: '🔀',
      section: 'Method',
      action: () => {
        const select = document.getElementById('request-method');
        if (select) {
          select.value = m;
          select.dataset.method = m;
          select.dispatchEvent(new Event('change'));
        }
      }
    }))
  ];

  // Dynamic: environments
  const envs = state.get('environments') || [];
  envs.forEach(env => {
    cmds.push({
      id: `env-${env.id}`,
      label: `Switch to "${env.name}" environment`,
      shortcut: '',
      icon: '🌐',
      section: 'Environments',
      action: () => {
        state.setActiveEnvironmentId(env.id);
      }
    });
  });

  return cmds;
}

/** Helper: click a request config tab by name. */
function clickTab(name) {
  const btn = document.querySelector(`.request-tabs .tab-btn[data-tab="${name}"]`);
  if (btn) btn.click();
}

/* ── Fuzzy Filter ────────────────────────────────────────────────────────── */

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

function render(filtered) {
  const container = document.getElementById('command-palette-results');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="command-palette-empty">No commands found</div>';
    return;
  }

  // Group by section
  const sections = {};
  filtered.forEach(cmd => {
    if (!sections[cmd.section]) sections[cmd.section] = [];
    sections[cmd.section].push(cmd);
  });

  let html = '';
  let globalIndex = 0;
  for (const [section, cmds] of Object.entries(sections)) {
    html += `<div class="command-palette-section">${section}</div>`;
    cmds.forEach(cmd => {
      const isActive = globalIndex === activeIndex;
      html += `
        <div class="command-palette-item${isActive ? ' active' : ''}"
             data-index="${globalIndex}" data-cmd-id="${cmd.id}">
          <span class="command-palette-item-icon">${cmd.icon}</span>
          <span class="command-palette-item-label">${cmd.label}</span>
          ${cmd.shortcut ? `<kbd class="command-palette-item-shortcut">${cmd.shortcut}</kbd>` : ''}
        </div>`;
      globalIndex++;
    });
  }
  container.innerHTML = html;

  // Click handlers
  container.querySelectorAll('.command-palette-item').forEach(el => {
    el.addEventListener('click', () => {
      const cmdId = el.dataset.cmdId;
      const cmd = filtered.find(c => c.id === cmdId);
      if (cmd) executeAndClose(cmd);
    });
    el.addEventListener('mouseenter', () => {
      activeIndex = parseInt(el.dataset.index, 10);
      updateActiveHighlight(container);
    });
  });
}

function updateActiveHighlight(container) {
  container.querySelectorAll('.command-palette-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.index, 10) === activeIndex);
  });
  // Scroll active into view
  const active = container.querySelector('.command-palette-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

/* ── Open / Close ────────────────────────────────────────────────────────── */

function open() {
  const overlay = document.getElementById('command-palette');
  const input = document.getElementById('command-palette-input');
  if (!overlay || !input) return;

  isOpen = true;
  activeIndex = 0;
  overlay.hidden = false;
  input.value = '';
  input.focus();

  const cmds = getCommands();
  render(cmds);

  // Filter on input
  input.oninput = () => {
    activeIndex = 0;
    const filtered = cmds.filter(c => fuzzyMatch(input.value, c.label + ' ' + c.section));
    render(filtered);
  };

  // Keyboard navigation
  input.onkeydown = (e) => {
    const container = document.getElementById('command-palette-results');
    const items = container?.querySelectorAll('.command-palette-item') || [];
    const count = items.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % count;
      updateActiveHighlight(container);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + count) % count;
      updateActiveHighlight(container);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = items[activeIndex];
      if (active) {
        const cmdId = active.dataset.cmdId;
        const cmd = cmds.find(c => c.id === cmdId);
        if (cmd) executeAndClose(cmd);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}

function close() {
  const overlay = document.getElementById('command-palette');
  if (overlay) overlay.hidden = true;
  isOpen = false;
}

function executeAndClose(cmd) {
  close();
  // Small delay so the palette closes visually before the action
  requestAnimationFrame(() => cmd.action());
}

/* ── Public API ──────────────────────────────────────────────────────────── */

const commandPalette = {
  init: () => {
    // Ctrl+K / ⌘K to open
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) close();
        else open();
      }
      // Ctrl+L / ⌘L to focus URL bar
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        const urlInput = document.getElementById('request-url');
        if (urlInput) { urlInput.focus(); urlInput.select(); }
      }
      // Ctrl+B to toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        const btn = document.getElementById('sidebar-toggle-btn');
        if (btn) btn.click();
      }
      // Escape to close palette
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    });
  },
  open,
  close,
  isOpen: () => isOpen
};

export default commandPalette;
