/**
 * Main Application Orchestrator
 */
import { state } from './state.js';
import { storage } from './storage.js';
import { authClient } from './auth/authClient.js';
import { syncEngine } from './offline/syncEngine.js';

import { QuickAddModal } from './components/quickAdd.js';
import { CommandPalette } from './components/commandPalette.js';
import { TaskDrawer } from './components/taskDrawer.js';
import { ShortcutsManager } from './components/shortcuts.js';
import { AuthModal } from './components/authModal.js';
import { SessionModal } from './components/sessionModal.js';
import { toast } from './components/toast.js';

import { renderListView } from './views/listView.js';
import { renderBoardView } from './views/boardView.js';
import { renderCalendarView } from './views/calendarView.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Modals & Components
  const quickAdd = new QuickAddModal();
  const taskDrawer = new TaskDrawer();
  const authModal = new AuthModal();
  const sessionModal = new SessionModal();

  const shortcutsModal = {
    open: () => shortcutsManager.openShortcuts(),
    close: () => shortcutsManager.closeShortcuts()
  };
  const commandPalette = new CommandPalette(quickAdd, shortcutsModal);
  const shortcutsManager = new ShortcutsManager(quickAdd, commandPalette, taskDrawer);

  // Apply Initial Theme
  document.documentElement.setAttribute('data-theme', state.theme);

  // Bind Sidebar Views Navigation
  bindSidebarNav();

  // Bind Header Layout Tabs (List, Board, Calendar)
  bindLayoutSwitcher();

  // Bind Filter & Sort Controls
  bindFilterAndSort();

  // Bind New Project Modal
  bindNewProjectModal();

  // Bind Auth & Session Profile Buttons
  bindAuthAndSessions(authModal, sessionModal);

  // Bind Sync Status Pill
  bindSyncStatus();

  // Bind Global & Custom Listeners
  bindGlobalEvents(quickAdd, commandPalette, shortcutsManager);

  // Initialize State (IndexedDB + Remote Check)
  await state.init();

  // State Change Subscriber
  state.subscribe((event, payload) => {
    updateViewHeader();
    updateSidebarCounts();
    renderCurrentView();
  });

  // Initial Full Render
  updateViewHeader();
  renderSidebarProjects();
  renderSidebarTags();
  updateSidebarCounts();
  renderCurrentView();
});

function bindAuthAndSessions(authModal, sessionModal) {
  const profileBtn = document.getElementById('user-profile-btn');
  const nameLabel = document.getElementById('user-name-label');
  const avatarEl = document.getElementById('user-avatar');

  const updateProfileUI = (user) => {
    if (user) {
      nameLabel.textContent = user.name || user.email.split('@')[0];
      avatarEl.textContent = (user.name || user.email).charAt(0).toUpperCase();
      avatarEl.style.backgroundColor = 'var(--status-done)';
    } else {
      nameLabel.textContent = 'Sign In';
      avatarEl.textContent = '?';
      avatarEl.style.backgroundColor = 'var(--text-primary)';
    }
  };

  authClient.subscribe((user) => {
    updateProfileUI(user);
    state.syncRemoteData().then(() => {
      renderSidebarProjects();
      renderSidebarTags();
      updateSidebarCounts();
      renderCurrentView();
    });
  });

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      if (authClient.currentUser) {
        sessionModal.open();
      } else {
        authModal.open('login');
      }
    });
  }

  updateProfileUI(authClient.currentUser);
}

function bindSyncStatus() {
  const dot = document.getElementById('sync-status-dot');
  const text = document.getElementById('sync-status-text');

  syncEngine.subscribe((status) => {
    if (!dot || !text) return;
    dot.className = `sync-status-dot ${status}`;
    if (status === 'synced') text.textContent = 'Synced';
    else if (status === 'syncing') text.textContent = 'Syncing...';
    else if (status === 'offline') text.textContent = 'Offline';
    else if (status === 'error') text.textContent = 'Sync Error';
  });
}

function renderCurrentView() {
  const container = document.getElementById('main-content-view');
  if (!container) return;

  if (state.viewMode === 'list') {
    renderListView(container);
  } else if (state.viewMode === 'board') {
    renderBoardView(container);
  } else if (state.viewMode === 'calendar') {
    renderCalendarView(container);
  }
}

function updateViewHeader() {
  const titleEl = document.getElementById('view-text');
  const iconEl = document.getElementById('view-icon');
  if (!titleEl || !iconEl) return;

  if (state.currentView === 'inbox') {
    iconEl.textContent = '📥';
    titleEl.textContent = 'Inbox';
  } else if (state.currentView === 'today') {
    iconEl.textContent = '☀️';
    titleEl.textContent = 'Today';
  } else if (state.currentView === 'upcoming') {
    iconEl.textContent = '📆';
    titleEl.textContent = 'Upcoming';
  } else if (state.currentView === 'completed') {
    iconEl.textContent = '✓';
    titleEl.textContent = 'Completed Archive';
  } else if (state.currentView.startsWith('project:')) {
    const projId = state.currentView.replace('project:', '');
    const proj = state.getProject(projId);
    iconEl.textContent = proj.icon || '📁';
    titleEl.textContent = proj.name;
  } else if (state.currentView.startsWith('tag:')) {
    const tag = state.currentView.replace('tag:', '');
    iconEl.textContent = '#';
    titleEl.textContent = `Tag: ${tag}`;
  }

  // Update layout tabs active states
  document.querySelectorAll('.view-tab-btn').forEach(tab => {
    const mode = tab.getAttribute('data-mode');
    const isActive = mode === state.viewMode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });
}

function updateSidebarCounts() {
  const counts = state.getTaskCounts();
  const inboxEl = document.getElementById('count-inbox');
  const todayEl = document.getElementById('count-today');
  const upEl = document.getElementById('count-upcoming');
  const compEl = document.getElementById('count-completed');

  if (inboxEl) inboxEl.textContent = counts.inbox;
  if (todayEl) todayEl.textContent = counts.today;
  if (upEl) upEl.textContent = counts.upcoming;
  if (compEl) compEl.textContent = counts.completed;

  // Update active state in sidebar items
  document.querySelectorAll('.app-sidebar .nav-item').forEach(item => {
    const v = item.getAttribute('data-view');
    const isAct = v === state.currentView;
    item.classList.toggle('active', isAct);
  });
}

function renderSidebarProjects() {
  const list = document.getElementById('sidebar-projects-list');
  if (!list) return;

  const customProjects = state.projects.filter(p => !p.isSystem);

  list.innerHTML = customProjects.map(p => {
    const count = state.tasks.filter(t => t.projectId === p.id && t.status !== 'done').length;
    const isAct = state.currentView === `project:${p.id}`;

    return `
      <li class="nav-item ${isAct ? 'active' : ''}" data-view="project:${p.id}" role="button" tabindex="0">
        <div class="nav-item-left">
          <span class="project-color-dot" style="background-color: ${p.color};"></span>
          <span>${p.icon || '📁'} ${escapeHtml(p.name)}</span>
        </div>
        <span class="nav-count">${count}</span>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-view');
      state.setCurrentView(v);
    });
  });
}

function renderSidebarTags() {
  const list = document.getElementById('sidebar-tags-list');
  if (!list) return;

  const tags = state.getAllTags();
  if (tags.length === 0) {
    list.innerHTML = `<li style="padding: 4px 8px; font-size: 11px; color: var(--text-muted);">No tags yet</li>`;
    return;
  }

  list.innerHTML = tags.map(tag => {
    const count = state.tasks.filter(t => t.tags && t.tags.includes(tag) && t.status !== 'done').length;
    const isAct = state.currentView === `tag:${tag}`;

    return `
      <li class="nav-item ${isAct ? 'active' : ''}" data-view="tag:${tag}" role="button" tabindex="0">
        <div class="nav-item-left">
          <span style="color: var(--text-muted); font-size: 11px;">#</span>
          <span>${escapeHtml(tag)}</span>
        </div>
        <span class="nav-count">${count}</span>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-view');
      state.setCurrentView(v);
    });
  });
}

function bindSidebarNav() {
  // Navigation item clicks
  document.querySelectorAll('.app-sidebar .nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      state.setCurrentView(view);
    });
  });

  // Sidebar collapse toggle
  const sidebar = document.getElementById('app-sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const expandBtn = document.getElementById('sidebar-expand-btn');

  const toggleSidebar = () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    expandBtn.style.display = isCollapsed ? 'flex' : 'none';
  };

  if (collapseBtn) collapseBtn.addEventListener('click', toggleSidebar);
  if (expandBtn) expandBtn.addEventListener('click', toggleSidebar);

  // Theme button
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => state.toggleTheme());
  }

  // Backup / Export JSON button
  const backupBtn = document.getElementById('backup-btn');
  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      storage.exportJSON();
      toast.show('Backup JSON downloaded successfully');
    });
  }
}

function bindLayoutSwitcher() {
  document.querySelectorAll('.view-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      state.setViewMode(mode);
    });
  });
}

function bindFilterAndSort() {
  // Priority filter chips
  document.querySelectorAll('.filter-chip[data-priority]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-priority]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const priority = chip.getAttribute('data-priority');
      state.setFilterPriority(priority);
    });
  });

  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.setSortOption(e.target.value);
    });
  }
}

function bindNewProjectModal() {
  const modal = document.getElementById('new-project-modal-backdrop');
  const openBtn = document.getElementById('add-project-modal-btn');
  const closeBtn = document.getElementById('new-project-close-btn');
  const cancelBtn = document.getElementById('new-project-cancel-btn');
  const saveBtn = document.getElementById('new-project-save-btn');
  const nameInput = document.getElementById('new-project-name');
  const iconInput = document.getElementById('new-project-icon');
  const colorSelect = document.getElementById('new-project-color');

  if (!modal) return;

  const open = () => {
    modal.classList.add('active');
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 50);
  };

  const close = () => {
    modal.classList.remove('active');
  };

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  const save = () => {
    const name = nameInput.value.trim();
    if (!name) return;

    const newProj = state.addProject({
      name,
      icon: iconInput.value.trim() || '📁',
      color: colorSelect.value
    });

    renderSidebarProjects();
    state.setCurrentView(`project:${newProj.id}`);
    toast.show(`Project "${name}" created`);
    close();
  };

  if (saveBtn) saveBtn.addEventListener('click', save);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
}

function bindGlobalEvents(quickAdd, commandPalette, shortcutsManager) {
  // Sidebar Search button triggers Command Palette
  document.getElementById('sidebar-search-btn')?.addEventListener('click', () => {
    commandPalette.open();
  });

  // Header Quick Add button triggers Quick Add modal
  document.getElementById('header-quick-add-btn')?.addEventListener('click', () => {
    quickAdd.open();
  });

  // Statusbar shortcuts button
  document.getElementById('shortcuts-statusbar-btn')?.addEventListener('click', () => {
    shortcutsManager.openShortcuts();
  });

  // Custom events for quick add triggers
  document.addEventListener('TRIGGER_QUICK_ADD', () => {
    quickAdd.open();
  });

  document.addEventListener('TRIGGER_QUICK_ADD_DATE', (e) => {
    quickAdd.open('', e.detail?.date);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
