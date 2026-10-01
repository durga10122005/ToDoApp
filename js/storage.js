/**
 * LocalStorage State & Persistence Manager
 */

const STORAGE_KEYS = {
  TASKS: 'todo_v2_tasks',
  PROJECTS: 'todo_v2_projects',
  SETTINGS: 'todo_v2_settings'
};

const DEFAULT_PROJECTS = [
  { id: 'proj-inbox', name: 'Inbox', color: '#6B7280', icon: '📥', isSystem: true },
  { id: 'proj-eng', name: 'Engineering', color: '#3B82F6', icon: '⚡' },
  { id: 'proj-design', name: 'Design System', color: '#EC4899', icon: '🎨' },
  { id: 'proj-product', name: 'Product Roadmap', color: '#10B981', icon: '🚀' },
  { id: 'proj-personal', name: 'Personal', color: '#F59E0B', icon: '☕' }
];

function getSampleDate(offsetDays = 0, hour = 14) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Audit design tokens for WCAG AAA contrast ratio',
    description: `## Objective\nVerify that all neutral canvas and semantic priority tokens meet high contrast requirements across both **Light** and **Dark** themes.\n\n### Checklist\n- [x] Test P1 Red (#EF4444) on canvas\n- [ ] Test secondary text (#6B7280)\n- [ ] Update border variables in \`variables.css\`\n\n> "Utilitarian elegance requires functional restraint and zero neon gradients."`,
    status: 'inprogress',
    priority: 'p1',
    projectId: 'proj-design',
    tags: ['design', 'a11y'],
    dueDate: getSampleDate(0, 15), // Today
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    completedAt: null,
    subtasks: [
      { id: 'sub-1', title: 'Audit light theme surface contrast', completed: true },
      { id: 'sub-2', title: 'Verify dark mode deep graphite #121214', completed: true },
      { id: 'sub-3', title: 'Test monochrome priority badges', completed: false }
    ],
    attachments: [
      { id: 'att-1', title: 'Design Token Spec', url: 'https://linear.app' }
    ],
    activity: [
      { text: 'Task created', timestamp: new Date(Date.now() - 3600000 * 24).toISOString() },
      { text: 'Priority set to P1', timestamp: new Date(Date.now() - 3600000 * 18).toISOString() },
      { text: 'Moved to In Progress', timestamp: new Date(Date.now() - 3600000 * 4).toISOString() }
    ]
  },
  {
    id: 'task-2',
    title: 'Implement natural language date & priority parser',
    description: `Fast token-based parser for quick task creation.\n\nSupports:\n- \`tomorrow 3pm\`\n- \`!p1\`, \`!p2\`\n- \`#Engineering\`\n- \`@frontend\`\n\n\`\`\`javascript\nconst task = parseNaturalLanguage("Ship v2 release tomorrow 2pm !p1 #Engineering");\n\`\`\``,
    status: 'done',
    priority: 'p2',
    projectId: 'proj-eng',
    tags: ['frontend', 'parser'],
    dueDate: getSampleDate(-1, 10), // Yesterday / Done
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    subtasks: [
      { id: 'sub-4', title: 'Regex pattern matching for relative dates', completed: true },
      { id: 'sub-5', title: 'Priority token extractor', completed: true },
      { id: 'sub-6', title: 'Live preview token chips', completed: true }
    ],
    attachments: [],
    activity: [
      { text: 'Task created', timestamp: new Date(Date.now() - 3600000 * 48).toISOString() },
      { text: 'Completed', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() }
    ]
  },
  {
    id: 'task-3',
    title: 'Draft release notes for Keyboard-First v2.0 update',
    description: `Summarize the new shortcuts:\n- \`J\` / \`K\` row navigation\n- \`Space\` / \`X\` toggle complete\n- \`Cmd/Ctrl + K\` Command Palette\n- \`Q\` Global Quick Add`,
    status: 'todo',
    priority: 'p2',
    projectId: 'proj-product',
    tags: ['release', 'docs'],
    dueDate: getSampleDate(1, 17), // Tomorrow
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    completedAt: null,
    subtasks: [
      { id: 'sub-7', title: 'Capture clean screenshot demos', completed: false },
      { id: 'sub-8', title: 'Document slash command triggers', completed: false }
    ],
    attachments: [],
    activity: [
      { text: 'Task created', timestamp: new Date(Date.now() - 3600000 * 12).toISOString() }
    ]
  },
  {
    id: 'task-4',
    title: 'Review quarterly architecture roadmap with founders',
    description: `Evaluate offline-first sync engine and IndexedDB migration for large project archives.`,
    status: 'todo',
    priority: 'p1',
    projectId: 'proj-product',
    tags: ['strategy'],
    dueDate: getSampleDate(0, 11), // Today
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    completedAt: null,
    subtasks: [],
    attachments: [],
    activity: [
      { text: 'Task created', timestamp: new Date(Date.now() - 3600000 * 5).toISOString() }
    ]
  },
  {
    id: 'task-5',
    title: 'Clean mechanical keyboard & calibrate monitor color profile',
    description: `Routine ergonomics & workspace maintenance.`,
    status: 'todo',
    priority: 'p4',
    projectId: 'proj-personal',
    tags: ['workspace'],
    dueDate: getSampleDate(3, 19),
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    completedAt: null,
    subtasks: [],
    attachments: [],
    activity: [
      { text: 'Task created', timestamp: new Date(Date.now() - 3600000 * 20).toISOString() }
    ]
  }
];

export const storage = {
  getTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (!data) {
        this.saveTasks(DEFAULT_TASKS);
        return DEFAULT_TASKS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load tasks from localStorage', e);
      return DEFAULT_TASKS;
    }
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  },

  getProjects() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (!data) {
        this.saveProjects(DEFAULT_PROJECTS);
        return DEFAULT_PROJECTS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load projects', e);
      return DEFAULT_PROJECTS;
    }
  },

  saveProjects(projects) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects', e);
    }
  },

  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        const defaultSettings = { theme: 'dark', viewMode: 'list', activeNav: 'inbox' };
        this.saveSettings(defaultSettings);
        return defaultSettings;
      }
      return JSON.parse(data);
    } catch (e) {
      return { theme: 'dark', viewMode: 'list', activeNav: 'inbox' };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  exportJSON() {
    const backup = {
      tasks: this.getTasks(),
      projects: this.getProjects(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.tasks)) this.saveTasks(parsed.tasks);
      if (Array.isArray(parsed.projects)) this.saveProjects(parsed.projects);
      if (parsed.settings) this.saveSettings(parsed.settings);
      return true;
    } catch (err) {
      console.error('Import failed', err);
      return false;
    }
  }
};
