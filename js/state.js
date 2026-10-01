/**
 * Central State Store & Event Bus
 */
import { storage } from './storage.js';

class StateStore {
  constructor() {
    this.settings = storage.getSettings();
    this.tasks = storage.getTasks();
    this.projects = storage.getProjects();

    this.currentView = this.settings.activeNav || 'inbox';
    this.viewMode = this.settings.viewMode || 'list';
    this.theme = this.settings.theme || 'dark';

    this.searchQuery = '';
    this.filterPriority = 'all';
    this.filterTag = 'all';
    this.sortOption = 'manual';

    this.selectedTaskId = null;
    this.focusedTaskIndex = 0;
    this.lastDeletedTask = null;
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(eventType, payload) {
    this.subscribers.forEach(cb => cb(eventType, payload));
  }

  setTheme(theme) {
    this.theme = theme;
    this.settings.theme = theme;
    storage.saveSettings(this.settings);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify('THEME_CHANGED', theme);
  }

  toggleTheme() {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  setCurrentView(viewId) {
    this.currentView = viewId;
    this.settings.activeNav = viewId;
    storage.saveSettings(this.settings);
    this.focusedTaskIndex = 0;
    this.notify('VIEW_CHANGED', viewId);
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.settings.viewMode = mode;
    storage.saveSettings(this.settings);
    this.notify('VIEW_MODE_CHANGED', mode);
  }

  setSearchQuery(query) {
    this.searchQuery = query;
    this.focusedTaskIndex = 0;
    this.notify('FILTER_CHANGED', { searchQuery: query });
  }

  setFilterPriority(priority) {
    this.filterPriority = priority;
    this.focusedTaskIndex = 0;
    this.notify('FILTER_CHANGED', { filterPriority: priority });
  }

  setFilterTag(tag) {
    this.filterTag = tag;
    this.focusedTaskIndex = 0;
    this.notify('FILTER_CHANGED', { filterTag: tag });
  }

  setSortOption(sort) {
    this.sortOption = sort;
    this.notify('SORT_CHANGED', sort);
  }

  getFilteredTasks() {
    let list = [...this.tasks];

    // 1. Current View Filter
    const todayStr = new Date().toISOString().slice(0, 10);
    if (this.currentView === 'inbox') {
      list = list.filter(t => t.status !== 'done');
    } else if (this.currentView === 'today') {
      list = list.filter(t => {
        if (t.status === 'done') return false;
        if (!t.dueDate) return false;
        const dueStr = t.dueDate.slice(0, 10);
        return dueStr <= todayStr; // includes overdue and today
      });
    } else if (this.currentView === 'upcoming') {
      list = list.filter(t => {
        if (t.status === 'done') return false;
        if (!t.dueDate) return false;
        const dueStr = t.dueDate.slice(0, 10);
        return dueStr > todayStr;
      });
    } else if (this.currentView === 'completed') {
      list = list.filter(t => t.status === 'done');
    } else if (this.currentView.startsWith('project:')) {
      const projId = this.currentView.replace('project:', '');
      list = list.filter(t => t.projectId === projId);
    } else if (this.currentView.startsWith('tag:')) {
      const tagName = this.currentView.replace('tag:', '');
      list = list.filter(t => t.tags && t.tags.includes(tagName));
    }

    // 2. Search Query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(t => {
        const titleMatch = t.title && t.title.toLowerCase().includes(q);
        const descMatch = t.description && t.description.toLowerCase().includes(q);
        const tagMatch = t.tags && t.tags.some(tag => tag.toLowerCase().includes(q));
        return titleMatch || descMatch || tagMatch;
      });
    }

    // 3. Priority Filter
    if (this.filterPriority !== 'all') {
      list = list.filter(t => t.priority === this.filterPriority);
    }

    // 4. Tag Filter
    if (this.filterTag !== 'all') {
      list = list.filter(t => t.tags && t.tags.includes(this.filterTag));
    }

    // 5. Sorting
    if (this.sortOption === 'dueDate') {
      list.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (this.sortOption === 'priority') {
      const order = { p1: 1, p2: 2, p3: 3, p4: 4 };
      list.sort((a, b) => (order[a.priority] || 4) - (order[b.priority] || 4));
    } else if (this.sortOption === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }

  addTask(taskData) {
    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'p4',
      projectId: taskData.projectId || (this.currentView.startsWith('project:') ? this.currentView.replace('project:', '') : 'proj-inbox'),
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      subtasks: taskData.subtasks || [],
      attachments: taskData.attachments || [],
      activity: [
        { text: 'Task created', timestamp: new Date().toISOString() }
      ]
    };

    this.tasks.unshift(newTask);
    storage.saveTasks(this.tasks);
    this.focusedTaskIndex = 0;
    this.notify('TASK_ADDED', newTask);
    return newTask;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;

    // Check status changes to add activity audit
    if (updates.status && updates.status !== task.status) {
      task.activity.unshift({
        text: `Status changed to ${updates.status === 'done' ? 'Completed' : updates.status === 'inprogress' ? 'In Progress' : 'To Do'}`,
        timestamp: new Date().toISOString()
      });
      if (updates.status === 'done') {
        task.completedAt = new Date().toISOString();
      } else {
        task.completedAt = null;
      }
    }

    if (updates.priority && updates.priority !== task.priority) {
      task.activity.unshift({
        text: `Priority changed to ${updates.priority.toUpperCase()}`,
        timestamp: new Date().toISOString()
      });
    }

    Object.assign(task, updates);
    storage.saveTasks(this.tasks);
    this.notify('TASK_UPDATED', task);
    return task;
  }

  toggleTaskCompletion(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    return this.updateTask(taskId, { status: newStatus });
  }

  cycleTaskPriority(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;

    const sequence = ['p4', 'p3', 'p2', 'p1'];
    const currIdx = sequence.indexOf(task.priority || 'p4');
    const nextPriority = sequence[(currIdx + 1) % sequence.length];
    return this.updateTask(taskId, { priority: nextPriority });
  }

  deleteTask(taskId) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return null;

    this.lastDeletedTask = { task: this.tasks[idx], index: idx };
    const [deleted] = this.tasks.splice(idx, 1);
    storage.saveTasks(this.tasks);

    if (this.selectedTaskId === taskId) {
      this.selectedTaskId = null;
    }

    this.notify('TASK_DELETED', { task: deleted, canUndo: true });
    return deleted;
  }

  undoDelete() {
    if (!this.lastDeletedTask) return null;
    const { task, index } = this.lastDeletedTask;
    this.tasks.splice(index, 0, task);
    storage.saveTasks(this.tasks);
    const restored = task;
    this.lastDeletedTask = null;
    this.notify('TASK_RESTORED', restored);
    return restored;
  }

  reorderTasks(draggedId, targetId, position = 'before') {
    const fromIndex = this.tasks.findIndex(t => t.id === draggedId);
    const toIndex = this.tasks.findIndex(t => t.id === targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [moved] = this.tasks.splice(fromIndex, 1);
    const insertIndex = position === 'after' ? toIndex + 1 : toIndex;
    this.tasks.splice(insertIndex, 0, moved);
    storage.saveTasks(this.tasks);
    this.notify('TASKS_REORDERED', { movedId: draggedId });
  }

  addProject(projectData) {
    const newProj = {
      id: 'proj-' + Date.now(),
      name: projectData.name || 'Untitled List',
      color: projectData.color || '#3B82F6',
      icon: projectData.icon || '📁',
      isSystem: false
    };
    this.projects.push(newProj);
    storage.saveProjects(this.projects);
    this.notify('PROJECT_ADDED', newProj);
    return newProj;
  }

  deleteProject(projectId) {
    const idx = this.projects.findIndex(p => p.id === projectId);
    if (idx === -1 || this.projects[idx].isSystem) return;

    this.projects.splice(idx, 1);
    storage.saveProjects(this.projects);

    // Reassign tasks to inbox
    this.tasks.forEach(t => {
      if (t.projectId === projectId) t.projectId = 'proj-inbox';
    });
    storage.saveTasks(this.tasks);

    if (this.currentView === `project:${projectId}`) {
      this.setCurrentView('inbox');
    }
    this.notify('PROJECT_DELETED', projectId);
  }

  getProject(projectId) {
    return this.projects.find(p => p.id === projectId) || { name: 'Inbox', color: '#6B7280', icon: '📥' };
  }

  getAllTags() {
    const tagSet = new Set();
    this.tasks.forEach(t => {
      if (Array.isArray(t.tags)) {
        t.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }

  getTaskCounts() {
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      inbox: this.tasks.filter(t => t.status !== 'done').length,
      today: this.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate.slice(0, 10) <= todayStr).length,
      upcoming: this.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate.slice(0, 10) > todayStr).length,
      completed: this.tasks.filter(t => t.status === 'done').length
    };
  }
}

export const state = new StateStore();
