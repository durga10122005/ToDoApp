/**
 * Board (Kanban) View Renderer
 * Status columns: To Do, In Progress, Done with drag-and-drop transfer
 */
import { state } from '../state.js';

let draggedCardId = null;

export function renderBoardView(container) {
  const tasks = state.getFilteredTasks();

  const columns = [
    { id: 'todo', title: 'To Do', className: 'todo', status: 'todo' },
    { id: 'inprogress', title: 'In Progress', className: 'inprogress', status: 'inprogress' },
    { id: 'done', title: 'Done', className: 'done', status: 'done' }
  ];

  let html = `<div class="board-container">`;

  columns.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.status);

    html += `
      <div class="board-column" data-status="${col.status}">
        <div class="board-column-header">
          <div class="column-title-wrap">
            <span class="column-status-indicator ${col.className}"></span>
            <span>${col.title}</span>
          </div>
          <span class="column-count">${colTasks.length}</span>
        </div>

        <div class="column-cards-list" data-status="${col.status}">
          ${colTasks.map(task => {
            const project = state.getProject(task.projectId);
            const subtasks = task.subtasks || [];
            const completedSubs = subtasks.filter(s => s.completed).length;

            return `
              <div class="kanban-card ${task.status === 'done' ? 'completed' : ''}" 
                   draggable="true" 
                   data-task-id="${task.id}">
                <div class="card-top">
                  <span class="card-title">${escapeHtml(task.title)}</span>
                  ${task.priority && task.priority !== 'p4' ? `
                    <span class="priority-dot ${task.priority}" title="${task.priority.toUpperCase()}"></span>
                  ` : ''}
                </div>

                <div class="card-footer">
                  <div class="card-footer-left">
                    ${task.dueDate ? `
                      <span class="task-badge-pill date-pill" style="font-size:10px;">
                        ${new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    ` : ''}
                    ${subtasks.length > 0 ? `
                      <span class="task-badge-pill" style="font-size:10px; color:var(--text-muted);">
                        ${completedSubs}/${subtasks.length}
                      </span>
                    ` : ''}
                  </div>
                  ${project ? `
                    <span class="task-badge-pill" style="font-size:10px;">
                      <span class="project-color-dot" style="background-color: ${project.color}; width:6px; height:6px;"></span>
                      ${escapeHtml(project.name)}
                    </span>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button class="card-add-btn" data-status="${col.status}">
          <svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Task
        </button>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  bindBoardEvents(container);
}

function bindBoardEvents(container) {
  // Clicking card opens task drawer
  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', () => {
      const taskId = card.getAttribute('data-task-id');
      state.notify('OPEN_TASK_DRAWER', taskId);
    });

    // Drag start
    card.addEventListener('dragstart', (e) => {
      draggedCardId = card.getAttribute('data-task-id');
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedCardId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      draggedCardId = null;
      container.querySelectorAll('.board-column').forEach(col => col.classList.remove('drag-over'));
    });
  });

  // Drop targets: columns
  container.querySelectorAll('.board-column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const targetStatus = col.getAttribute('data-status');
      if (draggedCardId && targetStatus) {
        state.updateTask(draggedCardId, { status: targetStatus });
      }
    });
  });

  // Add task in column
  container.querySelectorAll('.card-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      const newTask = state.addTask({
        title: 'New Task',
        status: status || 'todo',
        priority: 'p4'
      });
      state.notify('OPEN_TASK_DRAWER', newTask.id);
    });
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
