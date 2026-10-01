/**
 * Command Palette (Cmd/Ctrl + K)
 */
import { state } from '../state.js';

export class CommandPalette {
  constructor(quickAddModal, shortcutsModal) {
    this.quickAddModal = quickAddModal;
    this.shortcutsModal = shortcutsModal;
    this.modal = document.getElementById('palette-modal-backdrop');
    this.input = document.getElementById('palette-input');
    this.listContainer = document.getElementById('palette-list');
    this.selectedIndex = 0;
    this.items = [];

    this.init();
  }

  init() {
    if (!this.modal) return;

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.input.addEventListener('input', () => {
      this.selectedIndex = 0;
      this.render();
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(1, this.items.length);
        this.updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % Math.max(1, this.items.length);
        this.updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  open() {
    this.modal.classList.add('active');
    this.input.value = '';
    this.selectedIndex = 0;
    this.render();
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.modal.classList.remove('active');
    this.input.value = '';
  }

  getCommandList() {
    const q = this.input.value.toLowerCase().trim();
    const list = [];

    // 1. Core Actions
    const actions = [
      {
        id: 'act-new-task',
        category: 'Actions',
        label: 'Create new task',
        icon: '+',
        shortcut: 'Q',
        run: () => {
          this.close();
          this.quickAddModal.open();
        }
      },
      {
        id: 'act-toggle-theme',
        category: 'Actions',
        label: `Switch theme (currently ${state.theme})`,
        icon: '🌓',
        shortcut: 'T',
        run: () => {
          state.toggleTheme();
          this.close();
        }
      },
      {
        id: 'act-view-list',
        category: 'Layout View',
        label: 'Switch to List View',
        icon: '☰',
        shortcut: '1',
        run: () => {
          state.setViewMode('list');
          this.close();
        }
      },
      {
        id: 'act-view-board',
        category: 'Layout View',
        label: 'Switch to Kanban Board View',
        icon: '▥',
        shortcut: '2',
        run: () => {
          state.setViewMode('board');
          this.close();
        }
      },
      {
        id: 'act-view-calendar',
        category: 'Layout View',
        label: 'Switch to Calendar View',
        icon: '📅',
        shortcut: '3',
        run: () => {
          state.setViewMode('calendar');
          this.close();
        }
      },
      {
        id: 'act-shortcuts',
        category: 'Help',
        label: 'Open Keyboard Shortcuts cheat sheet',
        icon: '⌨',
        shortcut: '?',
        run: () => {
          this.close();
          this.shortcutsModal.open();
        }
      }
    ];

    // 2. Navigation Items
    const navigation = [
      { id: 'nav-inbox', category: 'Navigation', label: 'Go to Inbox', icon: '📥', run: () => { state.setCurrentView('inbox'); this.close(); } },
      { id: 'nav-today', category: 'Navigation', label: 'Go to Today', icon: '☀️', run: () => { state.setCurrentView('today'); this.close(); } },
      { id: 'nav-upcoming', category: 'Navigation', label: 'Go to Upcoming', icon: '📆', run: () => { state.setCurrentView('upcoming'); this.close(); } },
      { id: 'nav-completed', category: 'Navigation', label: 'Go to Completed', icon: '✓', run: () => { state.setCurrentView('completed'); this.close(); } }
    ];

    // Projects navigation
    state.projects.forEach(p => {
      navigation.push({
        id: `nav-proj-${p.id}`,
        category: 'Projects',
        label: `Go to project: ${p.name}`,
        icon: p.icon || '📁',
        run: () => {
          state.setCurrentView(`project:${p.id}`);
          this.close();
        }
      });
    });

    // 3. Matching Tasks
    const matchingTasks = state.tasks.filter(t => {
      if (!q) return false;
      return (t.title && t.title.toLowerCase().includes(q)) || (t.description && t.description.toLowerCase().includes(q));
    }).slice(0, 8).map(t => ({
      id: `task-${t.id}`,
      category: 'Tasks',
      label: t.title,
      icon: t.status === 'done' ? '✓' : '○',
      run: () => {
        state.selectedTaskId = t.id;
        state.notify('OPEN_TASK_DRAWER', t.id);
        this.close();
      }
    }));

    const all = [...actions, ...navigation, ...matchingTasks];

    if (!q) return all;

    return all.filter(item => {
      return item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    });
  }

  render() {
    this.items = this.getCommandList();

    if (this.items.length === 0) {
      this.listContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No matching commands or tasks found
        </div>
      `;
      return;
    }

    let currentCat = null;
    let html = '';

    this.items.forEach((item, index) => {
      if (item.category !== currentCat) {
        currentCat = item.category;
        html += `<div class="palette-group-title">${currentCat}</div>`;
      }

      const isSelected = index === this.selectedIndex;
      html += `
        <div class="palette-item ${isSelected ? 'selected' : ''}" data-index="${index}">
          <div class="palette-item-left">
            <span>${item.icon}</span>
            <span>${item.label}</span>
          </div>
          ${item.shortcut ? `<span class="palette-shortcut">${item.shortcut}</span>` : ''}
        </div>
      `;
    });

    this.listContainer.innerHTML = html;

    // Attach click handlers
    this.listContainer.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        if (this.items[idx]) {
          this.items[idx].run();
        }
      });
    });
  }

  updateSelection() {
    const elList = this.listContainer.querySelectorAll('.palette-item');
    elList.forEach((el, idx) => {
      el.classList.toggle('selected', idx === this.selectedIndex);
      if (idx === this.selectedIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  executeSelected() {
    if (this.items[this.selectedIndex]) {
      this.items[this.selectedIndex].run();
    }
  }
}
