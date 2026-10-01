/**
 * Toast Notification & Undo Manager
 */
import { state } from '../state.js';

let toastTimeout = null;

export const toast = {
  show(message, options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }

    container.innerHTML = `
      <span class="toast-message">${message}</span>
      ${options.canUndo ? `<button id="toast-undo-action" class="toast-undo-btn">Undo</button>` : ''}
    `;

    container.classList.add('active');

    if (options.canUndo) {
      const undoBtn = document.getElementById('toast-undo-action');
      if (undoBtn) {
        undoBtn.onclick = () => {
          state.undoDelete();
          this.dismiss();
          this.show('Task restored', { canUndo: false });
        };
      }
    }

    const duration = options.duration || 5000;
    toastTimeout = setTimeout(() => {
      this.dismiss();
    }, duration);
  },

  dismiss() {
    const container = document.getElementById('toast-container');
    if (container) {
      container.classList.remove('active');
    }
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }
};
