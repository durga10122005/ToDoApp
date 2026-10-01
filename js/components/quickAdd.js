/**
 * Quick Add Modal & Natural Language Input Component
 */
import { state } from '../state.js';
import { parseNaturalLanguage } from '../parser.js';
import { toast } from './toast.js';

export class QuickAddModal {
  constructor() {
    this.modal = document.getElementById('quick-add-modal-backdrop');
    this.titleInput = document.getElementById('quick-add-title');
    this.descInput = document.getElementById('quick-add-desc');
    this.chipsContainer = document.getElementById('quick-add-chips');
    this.projectSelect = document.getElementById('quick-add-project-select');
    this.prioritySelect = document.getElementById('quick-add-priority-select');
    this.dateInput = document.getElementById('quick-add-date');
    this.submitBtn = document.getElementById('quick-add-submit-btn');
    this.closeBtn = document.getElementById('quick-add-close-btn');

    this.parsedResult = null;
    this.init();
  }

  init() {
    if (!this.modal) return;

    // Real-time NLP parsing
    this.titleInput.addEventListener('input', () => {
      this.handleInput();
    });

    // Close on backdrop or Esc
    this.closeBtn.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Keydown in input
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.descInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.submit();
      }
    });

    this.submitBtn.addEventListener('click', () => this.submit());
  }

  open(defaultTitle = '', defaultDate = null) {
    this.populateProjects();
    this.titleInput.value = defaultTitle;
    this.descInput.value = '';
    
    // Set initial project based on current view
    if (state.currentView.startsWith('project:')) {
      const projId = state.currentView.replace('project:', '');
      this.projectSelect.value = projId;
    } else {
      this.projectSelect.value = 'proj-inbox';
    }

    this.prioritySelect.value = 'p4';
    this.dateInput.value = defaultDate ? defaultDate.slice(0, 10) : '';

    this.handleInput();
    this.modal.classList.add('active');
    setTimeout(() => this.titleInput.focus(), 50);
  }

  close() {
    this.modal.classList.remove('active');
    this.titleInput.value = '';
    this.descInput.value = '';
    this.chipsContainer.innerHTML = '';
  }

  populateProjects() {
    this.projectSelect.innerHTML = state.projects.map(p => `
      <option value="${p.id}">${p.icon || '📁'} ${p.name}</option>
    `).join('');
  }

  handleInput() {
    const raw = this.titleInput.value;
    this.parsedResult = parseNaturalLanguage(raw, state.projects);

    // Update Live Chips
    if (this.parsedResult.chips.length === 0) {
      this.chipsContainer.innerHTML = `
        <span style="font-size: 11px; color: var(--text-muted);">
          Tip: Type <code class="font-mono">tomorrow 3pm !p1 #Work @tag</code> for instant parsing
        </span>
      `;
    } else {
      this.chipsContainer.innerHTML = this.parsedResult.chips.map(chip => {
        let colorClass = '';
        if (chip.type === 'priority') colorClass = `priority-${chip.value}`;
        return `
          <span class="badge ${colorClass}" style="background: var(--bg-surface); border: 1px solid var(--border-strong);">
            ${chip.type === 'priority' ? `<span class="priority-dot ${chip.value}"></span>` : ''}
            ${chip.label}
          </span>
        `;
      }).join('');
    }

    // Auto-sync contextual dropdowns if token parsed
    if (this.parsedResult.priority && this.parsedResult.priority !== 'p4') {
      this.prioritySelect.value = this.parsedResult.priority;
    }
    if (this.parsedResult.projectId) {
      this.projectSelect.value = this.parsedResult.projectId;
    }
    if (this.parsedResult.dueDate) {
      this.dateInput.value = this.parsedResult.dueDate.slice(0, 10);
    }
  }

  submit() {
    const rawTitle = this.titleInput.value.trim();
    if (!rawTitle) return;

    const parsed = this.parsedResult || parseNaturalLanguage(rawTitle, state.projects);
    const finalTitle = parsed.cleanTitle || rawTitle;

    // Use explicit selects if manual override, else parsed
    const priority = this.prioritySelect.value || parsed.priority || 'p4';
    const projectId = this.projectSelect.value || parsed.projectId || 'proj-inbox';
    let dueDate = parsed.dueDate;
    if (this.dateInput.value) {
      const explicitDate = new Date(this.dateInput.value + 'T12:00:00');
      dueDate = explicitDate.toISOString();
    }

    const task = state.addTask({
      title: finalTitle,
      description: this.descInput.value.trim(),
      priority,
      projectId,
      dueDate,
      tags: parsed.tags || []
    });

    toast.show(`Task created: "${finalTitle}"`, { canUndo: false });
    this.close();
  }
}
