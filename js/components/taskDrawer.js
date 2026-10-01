/**
 * Task Detail Drawer Component
 * Includes Markdown notes, slash commands, nested subtasks, attachments, and activity log
 */
import { state } from '../state.js';
import { toast } from './toast.js';

export class TaskDrawer {
  constructor() {
    this.drawer = document.getElementById('task-drawer');
    this.backdrop = document.getElementById('drawer-backdrop');
    this.taskId = null;
    this.activeTab = 'edit'; // 'edit' or 'preview'
    this.init();
  }

  init() {
    if (!this.drawer) return;

    this.backdrop.addEventListener('click', () => this.close());
    state.subscribe((event, payload) => {
      if (event === 'OPEN_TASK_DRAWER') {
        this.open(payload);
      } else if (event === 'TASK_DELETED' && payload.task.id === this.taskId) {
        this.close();
      }
    });
  }

  open(taskId) {
    this.taskId = taskId;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.render(task);
    this.drawer.classList.add('active');
    this.backdrop.classList.add('active');
  }

  close() {
    this.drawer.classList.remove('active');
    this.backdrop.classList.remove('active');
    this.taskId = null;
  }

  render(task) {
    const project = state.getProject(task.projectId);
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(s => s.completed).length;
    const progressPercent = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

    this.drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-header-left">
          <select id="drawer-status-select" class="meta-select">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>○ To Do</option>
            <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>◐ In Progress</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>✓ Completed</option>
          </select>
          <select id="drawer-priority-select" class="meta-select">
            <option value="p1" ${task.priority === 'p1' ? 'selected' : ''}>P1 Urgent</option>
            <option value="p2" ${task.priority === 'p2' ? 'selected' : ''}>P2 High</option>
            <option value="p3" ${task.priority === 'p3' ? 'selected' : ''}>P3 Medium</option>
            <option value="p4" ${task.priority === 'p4' ? 'selected' : ''}>P4 Low</option>
          </select>
        </div>
        <div class="drawer-header-right">
          <button id="drawer-delete-btn" class="action-btn delete-btn" title="Delete Task (Backspace)">
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <button id="drawer-close-btn" class="action-btn" title="Close (Esc)">
            <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="drawer-body">
        <!-- Title Input -->
        <input id="drawer-title-input" class="drawer-title-input" type="text" value="${escapeHtml(task.title)}" placeholder="Task title..." />

        <!-- Notion-style Property Grid -->
        <div class="drawer-meta-grid">
          <div class="meta-row">
            <span class="meta-label">
              <svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Due Date
            </span>
            <div class="meta-val-control">
              <input id="drawer-due-date-input" type="date" class="meta-select font-mono" value="${task.dueDate ? task.dueDate.slice(0, 10) : ''}" />
              ${task.dueDate ? `<button id="drawer-clear-date-btn" class="action-btn" style="width:20px;height:20px;" title="Clear date">×</button>` : ''}
            </div>
          </div>

          <div class="meta-row">
            <span class="meta-label">
              <svg class="icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Project
            </span>
            <div class="meta-val-control">
              <select id="drawer-project-select" class="meta-select">
                ${state.projects.map(p => `
                  <option value="${p.id}" ${p.id === task.projectId ? 'selected' : ''}>
                    ${p.icon || '📁'} ${escapeHtml(p.name)}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="meta-row">
            <span class="meta-label">
              <svg class="icon" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              Tags
            </span>
            <div class="meta-val-control meta-tags-wrap">
              ${(task.tags || []).map(t => `
                <span class="tag-badge-pill">
                  #${escapeHtml(t)}
                  <span class="tag-remove-btn" data-tag="${t}">×</span>
                </span>
              `).join('')}
              <input id="drawer-new-tag-input" class="tag-add-input" placeholder="+ Tag" />
            </div>
          </div>
        </div>

        <!-- Description with Markdown & Slash Commands -->
        <div>
          <div class="drawer-section-title">
            <span>Description</span>
            <div class="editor-tools-group">
              <button id="editor-tab-edit" class="editor-btn ${this.activeTab === 'edit' ? 'active' : ''}">Edit</button>
              <button id="editor-tab-preview" class="editor-btn ${this.activeTab === 'preview' ? 'active' : ''}">Preview</button>
            </div>
          </div>

          <div class="markdown-editor-container">
            ${this.activeTab === 'edit' ? `
              <textarea id="drawer-description-input" class="drawer-textarea" placeholder="Add rich notes... (type / for commands)">${escapeHtml(task.description || '')}</textarea>
              <div id="drawer-slash-menu" class="slash-menu" style="display: none;">
                <div class="slash-item" data-cmd="todo">
                  <span>☐</span>
                  <span>To-do item</span>
                  <span class="slash-cmd-tag">/todo</span>
                </div>
                <div class="slash-item" data-cmd="bullet">
                  <span>•</span>
                  <span>Bullet list</span>
                  <span class="slash-cmd-tag">/bullet</span>
                </div>
                <div class="slash-item" data-cmd="h2">
                  <span>H2</span>
                  <span>Heading 2</span>
                  <span class="slash-cmd-tag">/h2</span>
                </div>
                <div class="slash-item" data-cmd="code">
                  <span>&lt;/&gt;</span>
                  <span>Code block</span>
                  <span class="slash-cmd-tag">/code</span>
                </div>
                <div class="slash-item" data-cmd="quote">
                  <span>"</span>
                  <span>Quote</span>
                  <span class="slash-cmd-tag">/quote</span>
                </div>
              </div>
            ` : `
              <div class="markdown-preview">${this.renderMarkdown(task.description || '*No description provided.*')}</div>
            `}
          </div>
        </div>

        <!-- Nested Subtasks Checklist -->
        <div>
          <div class="drawer-section-title">
            <span>Subtasks</span>
            <span class="subtasks-progress-label">${completedSubtasks}/${subtasks.length} completed</span>
          </div>

          ${subtasks.length > 0 ? `
            <div class="subtasks-progress-wrap">
              <div class="subtasks-progress-bar">
                <div class="subtasks-progress-fill" style="width: ${progressPercent}%;"></div>
              </div>
            </div>
          ` : ''}

          <div class="drawer-subtasks-list">
            ${subtasks.map((sub, idx) => `
              <div class="drawer-subtask-row ${sub.completed ? 'completed' : ''}" data-idx="${idx}">
                <button class="task-checkbox-btn subtask-check-btn" data-idx="${idx}">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <input class="drawer-subtask-input" type="text" value="${escapeHtml(sub.title)}" data-idx="${idx}" />
                <button class="action-btn subtask-delete-btn" data-idx="${idx}">×</button>
              </div>
            `).join('')}
          </div>

          <input id="drawer-add-subtask-input" class="add-subtask-input" placeholder="+ Add a subtask (press Enter)" />
        </div>

        <!-- Attachments & Links -->
        <div>
          <div class="drawer-section-title">
            <span>Links & Attachments</span>
          </div>
          <div class="attachments-list">
            ${(task.attachments || []).map((att, idx) => `
              <div class="attachment-item">
                <div class="attachment-left">
                  <svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  <a href="${att.url}" target="_blank" rel="noopener noreferrer" class="attachment-link">${escapeHtml(att.title || att.url)}</a>
                </div>
                <button class="action-btn attachment-del-btn" data-idx="${idx}">×</button>
              </div>
            `).join('')}
          </div>
          <div class="add-attachment-row">
            <input id="attachment-title-input" class="attachment-input" placeholder="Label (optional)" />
            <input id="attachment-url-input" class="attachment-input" placeholder="https://..." />
            <button id="add-attachment-btn" class="btn-header">Add</button>
          </div>
        </div>

        <!-- Activity Log / Audit Trail -->
        <div>
          <div class="drawer-section-title">
            <span>Activity Log</span>
          </div>
          <div class="activity-log-list">
            ${(task.activity || []).map(act => `
              <div class="activity-item">
                <div class="activity-bullet"></div>
                <div>
                  <div>${escapeHtml(act.text)}</div>
                  <div class="activity-time">${formatDate(act.timestamp)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(task);
  }

  bindEvents(task) {
    // Close button
    document.getElementById('drawer-close-btn').addEventListener('click', () => this.close());

    // Delete button
    document.getElementById('drawer-delete-btn').addEventListener('click', () => {
      const deleted = state.deleteTask(task.id);
      this.close();
      toast.show(`Deleted "${deleted.title}"`, { canUndo: true });
    });

    // Title edit
    const titleInput = document.getElementById('drawer-title-input');
    titleInput.addEventListener('change', () => {
      state.updateTask(task.id, { title: titleInput.value.trim() || 'Untitled' });
    });

    // Status change
    document.getElementById('drawer-status-select').addEventListener('change', (e) => {
      state.updateTask(task.id, { status: e.target.value });
      this.render(state.tasks.find(t => t.id === task.id));
    });

    // Priority change
    document.getElementById('drawer-priority-select').addEventListener('change', (e) => {
      state.updateTask(task.id, { priority: e.target.value });
    });

    // Project change
    document.getElementById('drawer-project-select').addEventListener('change', (e) => {
      state.updateTask(task.id, { projectId: e.target.value });
    });

    // Due date change
    const dateInput = document.getElementById('drawer-due-date-input');
    dateInput.addEventListener('change', (e) => {
      const val = e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : null;
      state.updateTask(task.id, { dueDate: val });
      this.render(state.tasks.find(t => t.id === task.id));
    });

    const clearDateBtn = document.getElementById('drawer-clear-date-btn');
    if (clearDateBtn) {
      clearDateBtn.addEventListener('click', () => {
        state.updateTask(task.id, { dueDate: null });
        this.render(state.tasks.find(t => t.id === task.id));
      });
    }

    // New Tag Input
    const tagInput = document.getElementById('drawer-new-tag-input');
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tagInput.value.trim()) {
        const clean = tagInput.value.trim().replace(/^[@#]/, '').toLowerCase();
        const currentTags = [...(task.tags || [])];
        if (!currentTags.includes(clean)) {
          currentTags.push(clean);
          state.updateTask(task.id, { tags: currentTags });
          this.render(state.tasks.find(t => t.id === task.id));
        }
      }
    });

    // Remove Tag buttons
    this.drawer.querySelectorAll('.tag-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        const currentTags = (task.tags || []).filter(t => t !== tag);
        state.updateTask(task.id, { tags: currentTags });
        this.render(state.tasks.find(t => t.id === task.id));
      });
    });

    // Tabs Edit / Preview
    const tabEdit = document.getElementById('editor-tab-edit');
    const tabPreview = document.getElementById('editor-tab-preview');
    if (tabEdit && tabPreview) {
      tabEdit.addEventListener('click', () => {
        this.activeTab = 'edit';
        this.render(state.tasks.find(t => t.id === task.id));
      });
      tabPreview.addEventListener('click', () => {
        this.activeTab = 'preview';
        this.render(state.tasks.find(t => t.id === task.id));
      });
    }

    // Description & Slash Commands
    const descTextarea = document.getElementById('drawer-description-input');
    const slashMenu = document.getElementById('drawer-slash-menu');
    if (descTextarea && slashMenu) {
      descTextarea.addEventListener('change', () => {
        state.updateTask(task.id, { description: descTextarea.value });
      });

      descTextarea.addEventListener('input', (e) => {
        const val = descTextarea.value;
        const cursor = descTextarea.selectionStart;
        const lastSlash = val.lastIndexOf('/', cursor);

        if (lastSlash !== -1 && (lastSlash === 0 || val[lastSlash - 1] === '\n' || val[lastSlash - 1] === ' ')) {
          slashMenu.style.display = 'flex';
        } else {
          slashMenu.style.display = 'none';
        }
      });

      slashMenu.querySelectorAll('.slash-item').forEach(item => {
        item.addEventListener('click', () => {
          const cmd = item.getAttribute('data-cmd');
          this.insertSlashCommand(descTextarea, cmd);
          slashMenu.style.display = 'none';
          state.updateTask(task.id, { description: descTextarea.value });
        });
      });
    }

    // Subtasks events
    this.drawer.querySelectorAll('.subtask-check-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const subtasks = [...(task.subtasks || [])];
        if (subtasks[idx]) {
          subtasks[idx].completed = !subtasks[idx].completed;
          state.updateTask(task.id, { subtasks });
          this.render(state.tasks.find(t => t.id === task.id));
        }
      });
    });

    this.drawer.querySelectorAll('.drawer-subtask-input').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.getAttribute('data-idx'), 10);
        const subtasks = [...(task.subtasks || [])];
        if (subtasks[idx]) {
          subtasks[idx].title = input.value.trim() || 'Subtask';
          state.updateTask(task.id, { subtasks });
        }
      });
    });

    this.drawer.querySelectorAll('.subtask-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const subtasks = [...(task.subtasks || [])];
        subtasks.splice(idx, 1);
        state.updateTask(task.id, { subtasks });
        this.render(state.tasks.find(t => t.id === task.id));
      });
    });

    const addSubtaskInput = document.getElementById('drawer-add-subtask-input');
    if (addSubtaskInput) {
      addSubtaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && addSubtaskInput.value.trim()) {
          const subtasks = [...(task.subtasks || [])];
          subtasks.push({
            id: 'sub-' + Date.now(),
            title: addSubtaskInput.value.trim(),
            completed: false
          });
          state.updateTask(task.id, { subtasks });
          this.render(state.tasks.find(t => t.id === task.id));
        }
      });
    }

    // Attachments events
    const addAttBtn = document.getElementById('add-attachment-btn');
    if (addAttBtn) {
      addAttBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('attachment-url-input');
        const titleInput = document.getElementById('attachment-title-input');
        const url = urlInput.value.trim();
        if (url) {
          const attachments = [...(task.attachments || [])];
          attachments.push({
            id: 'att-' + Date.now(),
            title: titleInput.value.trim() || url,
            url
          });
          state.updateTask(task.id, { attachments });
          this.render(state.tasks.find(t => t.id === task.id));
        }
      });
    }

    this.drawer.querySelectorAll('.attachment-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const attachments = [...(task.attachments || [])];
        attachments.splice(idx, 1);
        state.updateTask(task.id, { attachments });
        this.render(state.tasks.find(t => t.id === task.id));
      });
    });
  }

  insertSlashCommand(textarea, cmd) {
    const val = textarea.value;
    const cursor = textarea.selectionStart;
    const lastSlash = val.lastIndexOf('/', cursor);

    let snippet = '';
    if (cmd === 'todo') snippet = '- [ ] ';
    else if (cmd === 'bullet') snippet = '- ';
    else if (cmd === 'h2') snippet = '## ';
    else if (cmd === 'code') snippet = '```javascript\n\n```';
    else if (cmd === 'quote') snippet = '> ';

    const before = val.substring(0, lastSlash);
    const after = val.substring(cursor);
    textarea.value = before + snippet + after;
    textarea.focus();
    const newPos = before.length + snippet.length;
    textarea.setSelectionRange(newPos, newPos);
  }

  renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Code blocks ```code```
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code>${code}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings #, ##, ###
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes > quote
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Checkboxes - [ ] and - [x]
    html = html.replace(/^- \[x\] (.*$)/gim, '<div style="display:flex;gap:6px;align-items:center;">☑ <span style="text-decoration:line-through;color:var(--text-muted);">$1</span></div>');
    html = html.replace(/^- \[ \] (.*$)/gim, '<div style="display:flex;gap:6px;align-items:center;">☐ <span>$1</span></div>');

    // Unordered lists - item
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Paragraph line breaks
    html = html.replace(/\n\n/g, '<p></p>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
