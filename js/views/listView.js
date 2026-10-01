/**
 * List View Renderer
 * Dense list with drag-and-drop reordering, inline creation, and nested subtasks
 */
import { state } from '../state.js';
import { parseNaturalLanguage } from '../parser.js';
import { toast } from '../components/toast.js';

let draggedTaskId = null;

export function renderListView(container) {
  const tasks = state.getFilteredTasks();

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg class="icon" style="width:24px;height:24px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
        </div>
        <div class="empty-state-title">No tasks found</div>
        <div class="empty-state-desc">You're all caught up! Create a new task or press <kbd>Q</kbd> to quickly capture ideas.</div>
        <button id="empty-state-add-btn" class="empty-state-btn">
          <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Task
        </button>
      </div>
      <div id="inline-add-container"></div>
    `;

    document.getElementById('empty-state-add-btn')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('TRIGGER_QUICK_ADD'));
    });
    renderInlineAddRow(document.getElementById('inline-add-container'));
    return;
  }

  // Render Tasks
  let html = `<div class="task-list" id="task-list-root">`;

  tasks.forEach((task, index) => {
    const isFocused = index === state.focusedTaskIndex;
    const isCompleted = task.status === 'done';
    const project = state.getProject(task.projectId);
    const subtasks = task.subtasks || [];
    const completedSubs = subtasks.filter(s => s.completed).length;

    html += `
      <div class="task-item-wrapper" data-task-id="${task.id}">
        <div class="task-item ${isCompleted ? 'completed' : ''} ${isFocused ? 'keyboard-focused' : ''}" 
             data-task-id="${task.id}" 
             data-index="${index}"
             draggable="true">
          
          <!-- Drag Handle -->
          <div class="drag-handle" title="Drag to reorder">
            <svg class="icon" viewBox="0 0 24 24" style="width:12px;height:12px;">
              <circle cx="9" cy="6" r="1.5"></circle><circle cx="15" cy="6" r="1.5"></circle>
              <circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle>
              <circle cx="9" cy="18" r="1.5"></circle><circle cx="15" cy="18" r="1.5"></circle>
            </svg>
          </div>

          <!-- Rounded-Square Checkbox -->
          <div class="task-checkbox-container">
            <button class="task-checkbox-btn priority-${task.priority || 'p4'}" data-task-id="${task.id}" aria-label="Toggle task completion">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>

          <!-- Content Title -->
          <div class="task-content">
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>

          <!-- Badges & Metadata -->
          <div class="task-badges">
            ${subtasks.length > 0 ? `
              <span class="task-badge-pill subtask-badge" title="${completedSubs}/${subtasks.length} subtasks completed">
                <svg class="icon" style="width:11px;height:11px;" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                ${completedSubs}/${subtasks.length}
              </span>
            ` : ''}

            ${task.dueDate ? renderDatePill(task.dueDate) : ''}

            ${task.priority && task.priority !== 'p4' ? `
              <span class="task-badge-pill priority-pill ${task.priority}">
                <span class="priority-dot ${task.priority}"></span>
                ${task.priority.toUpperCase()}
              </span>
            ` : ''}

            ${project && !state.currentView.startsWith('project:') ? `
              <span class="task-badge-pill" title="Project: ${escapeHtml(project.name)}">
                <span class="project-color-dot" style="background-color: ${project.color};"></span>
                ${escapeHtml(project.name)}
              </span>
            ` : ''}

            ${(task.tags || []).slice(0, 2).map(tag => `
              <span class="task-badge-pill" style="color: var(--text-muted);">#${escapeHtml(tag)}</span>
            `).join('')}
          </div>

          <!-- Hover Actions -->
          <div class="task-actions">
            <button class="action-btn open-drawer-btn" data-task-id="${task.id}" title="Edit details (Enter / E)">
              <svg class="icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="action-btn delete-btn" data-task-id="${task.id}" title="Delete task (Backspace)">
              <svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <!-- Nested Subtasks Tree preview -->
        ${subtasks.length > 0 && !isCompleted ? `
          <div class="nested-subtasks-tree">
            ${subtasks.map((sub, sIdx) => `
              <div class="nested-subtask-item ${sub.completed ? 'completed' : ''}">
                <button class="task-checkbox-btn inline-sub-btn" style="width:14px;height:14px;" data-task-id="${task.id}" data-sub-idx="${sIdx}">
                  <svg viewBox="0 0 24 24" style="width:9px;height:9px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <span>${escapeHtml(sub.title)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  html += `</div>`;
  html += `<div id="inline-add-container"></div>`;

  container.innerHTML = html;

  // Bind Task Events
  bindListEvents(container);

  // Render Inline Add Row
  renderInlineAddRow(document.getElementById('inline-add-container'));
}

function renderDatePill(dueDateStr) {
  const d = new Date(dueDateStr);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dueDayStr = dueDateStr.slice(0, 10);

  let label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  let className = 'date-pill';

  if (dueDayStr < todayStr) {
    label = `Overdue · ${label}`;
    className += ' overdue';
  } else if (dueDayStr === todayStr) {
    label = 'Today';
    className += ' today';
  }

  return `
    <span class="task-badge-pill ${className}">
      <svg class="icon" style="width:10px;height:10px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      ${label}
    </span>
  `;
}

function bindListEvents(container) {
  // Checkbox toggles
  container.querySelectorAll('.task-checkbox-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-id');
      if (taskId) {
        state.toggleTaskCompletion(taskId);
      }
    });
  });

  // Inline subtask checkbox toggles
  container.querySelectorAll('.inline-sub-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-id');
      const sIdx = parseInt(btn.getAttribute('data-sub-idx'), 10);
      const task = state.tasks.find(t => t.id === taskId);
      if (task && task.subtasks && task.subtasks[sIdx]) {
        task.subtasks[sIdx].completed = !task.subtasks[sIdx].completed;
        state.updateTask(taskId, { subtasks: task.subtasks });
      }
    });
  });

  // Clicking a row opens task drawer
  container.querySelectorAll('.task-item').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox-container') || e.target.closest('.task-actions') || e.target.closest('.drag-handle')) {
        return;
      }
      const taskId = row.getAttribute('data-task-id');
      state.notify('OPEN_TASK_DRAWER', taskId);
    });

    // Drag and Drop reordering
    row.addEventListener('dragstart', (e) => {
      draggedTaskId = row.getAttribute('data-task-id');
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedTaskId);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      draggedTaskId = null;
      document.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      if (offset < rect.height / 2) {
        row.classList.add('drag-over-top');
        row.classList.remove('drag-over-bottom');
      } else {
        row.classList.add('drag-over-bottom');
        row.classList.remove('drag-over-top');
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetId = row.getAttribute('data-task-id');
      if (!draggedTaskId || draggedTaskId === targetId) return;

      const rect = row.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      const position = offset < rect.height / 2 ? 'before' : 'after';

      state.reorderTasks(draggedTaskId, targetId, position);
    });
  });

  // Open drawer buttons
  container.querySelectorAll('.open-drawer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-id');
      state.notify('OPEN_TASK_DRAWER', taskId);
    });
  });

  // Delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-id');
      const deleted = state.deleteTask(taskId);
      toast.show(`Deleted "${deleted.title}"`, { canUndo: true });
    });
  });
}

function renderInlineAddRow(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="inline-add-row" id="inline-add-wrapper">
      <div class="inline-add-icon">
        <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </div>
      <input id="inline-add-input" class="inline-add-input" placeholder="Add task... Press Enter to create (supports tomorrow 3pm !p1 #Work)" />
      <div class="inline-add-hints">
        <span><kbd>Enter</kbd> to save</span>
      </div>
    </div>
    <div id="inline-nlp-chips" class="nlp-chips-container"></div>
  `;

  const input = document.getElementById('inline-add-input');
  const chipsWrap = document.getElementById('inline-nlp-chips');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (!val) {
      chipsWrap.innerHTML = '';
      return;
    }
    const parsed = parseNaturalLanguage(val, state.projects);
    chipsWrap.innerHTML = parsed.chips.map(chip => `
      <span class="badge" style="background:var(--bg-surface);border:1px solid var(--border-strong);">
        ${chip.type === 'priority' ? `<span class="priority-dot ${chip.value}"></span>` : ''}
        ${chip.label}
      </span>
    `).join('');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim();
      const parsed = parseNaturalLanguage(val, state.projects);

      state.addTask({
        title: parsed.cleanTitle || val,
        priority: parsed.priority || 'p4',
        projectId: parsed.projectId || (state.currentView.startsWith('project:') ? state.currentView.replace('project:', '') : 'proj-inbox'),
        dueDate: parsed.dueDate || (state.currentView === 'today' ? new Date().toISOString() : null),
        tags: parsed.tags || []
      });

      input.value = '';
      chipsWrap.innerHTML = '';
      setTimeout(() => input.focus(), 10);
    }
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
