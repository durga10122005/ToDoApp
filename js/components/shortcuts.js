/**
 * Global Keyboard-First Shortcuts Dispatcher
 */
import { state } from '../state.js';
import { toast } from './toast.js';

export class ShortcutsManager {
  constructor(quickAddModal, commandPalette, taskDrawer) {
    this.quickAddModal = quickAddModal;
    this.commandPalette = commandPalette;
    this.taskDrawer = taskDrawer;
    this.shortcutsModal = document.getElementById('shortcuts-modal-backdrop');

    this.init();
  }

  init() {
    // Shortcuts modal backdrop click & close
    if (this.shortcutsModal) {
      this.shortcutsModal.addEventListener('click', (e) => {
        if (e.target === this.shortcutsModal) this.closeShortcuts();
      });
      const closeBtn = document.getElementById('shortcuts-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeShortcuts());
    }

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  openShortcuts() {
    if (this.shortcutsModal) {
      this.shortcutsModal.classList.add('active');
    }
  }

  closeShortcuts() {
    if (this.shortcutsModal) {
      this.shortcutsModal.classList.remove('active');
    }
  }

  isInputActive() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  handleKeyDown(e) {
    // 1. Command Palette: Cmd/Ctrl + K (Works anywhere)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.commandPalette.open();
      return;
    }

    // 2. Escape: Close open drawers or modals
    if (e.key === 'Escape') {
      if (this.shortcutsModal && this.shortcutsModal.classList.contains('active')) {
        this.closeShortcuts();
        return;
      }
      if (this.commandPalette && this.commandPalette.modal.classList.contains('active')) {
        this.commandPalette.close();
        return;
      }
      if (this.quickAddModal && this.quickAddModal.modal.classList.contains('active')) {
        this.quickAddModal.close();
        return;
      }
      if (this.taskDrawer && this.taskDrawer.taskId) {
        this.taskDrawer.close();
        return;
      }
    }

    // If typing in any input or form control, don't execute single-key shortcuts
    if (this.isInputActive()) {
      return;
    }

    // If modal is active, skip single-letter hotkeys
    const anyModalActive = document.querySelector('.modal-backdrop.active, .drawer-backdrop.active');
    if (anyModalActive) return;

    const visibleTasks = state.getFilteredTasks();
    const currentTask = visibleTasks[state.focusedTaskIndex];

    switch (e.key) {
      // Navigate down: J or ArrowDown
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        if (visibleTasks.length > 0) {
          state.focusedTaskIndex = (state.focusedTaskIndex + 1) % visibleTasks.length;
          this.highlightFocusedTask();
        }
        break;

      // Navigate up: K or ArrowUp
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        if (visibleTasks.length > 0) {
          state.focusedTaskIndex = (state.focusedTaskIndex - 1 + visibleTasks.length) % visibleTasks.length;
          this.highlightFocusedTask();
        }
        break;

      // Toggle completion: Space or X
      case ' ':
      case 'x':
      case 'X':
        e.preventDefault();
        if (currentTask) {
          state.toggleTaskCompletion(currentTask.id);
        }
        break;

      // Open task detail: Enter or E
      case 'Enter':
      case 'e':
      case 'E':
        e.preventDefault();
        if (currentTask) {
          this.taskDrawer.open(currentTask.id);
        }
        break;

      // Cycle priority: P
      case 'p':
      case 'P':
        e.preventDefault();
        if (currentTask) {
          const updated = state.cycleTaskPriority(currentTask.id);
          toast.show(`Priority: ${updated.priority.toUpperCase()}`, { duration: 1500 });
        }
        break;

      // Delete task: Backspace or Delete
      case 'Backspace':
      case 'Delete':
        e.preventDefault();
        if (currentTask) {
          const deleted = state.deleteTask(currentTask.id);
          toast.show(`Deleted "${deleted.title}"`, { canUndo: true });
        }
        break;

      // Quick Add: Q or C
      case 'q':
      case 'Q':
      case 'c':
      case 'C':
        e.preventDefault();
        this.quickAddModal.open();
        break;

      // Toggle Theme: T
      case 't':
      case 'T':
        e.preventDefault();
        state.toggleTheme();
        break;

      // View mode switches: 1 (List), 2 (Board), 3 (Calendar)
      case '1':
        e.preventDefault();
        state.setViewMode('list');
        break;
      case '2':
        e.preventDefault();
        state.setViewMode('board');
        break;
      case '3':
        e.preventDefault();
        state.setViewMode('calendar');
        break;

      // Shortcuts modal: ?
      case '?':
        e.preventDefault();
        this.openShortcuts();
        break;

      // Toggle sidebar: [
      case '[':
        e.preventDefault();
        document.getElementById('app-sidebar').classList.toggle('collapsed');
        break;
    }
  }

  highlightFocusedTask() {
    const rows = document.querySelectorAll('.task-item');
    rows.forEach((row, idx) => {
      row.classList.toggle('keyboard-focused', idx === state.focusedTaskIndex);
      if (idx === state.focusedTaskIndex) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }
}
