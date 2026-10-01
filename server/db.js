/**
 * Multi-Tenant Database Engine with Row-Level Security (RLS) and IDOR Protection
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Schema
const INITIAL_DATA = {
  users: [],
  sessions: [],
  magicLinks: [],
  tasks: [],
  projects: [],
  settings: []
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading db.json, initializing fresh store', e);
    }
    this.persist(INITIAL_DATA);
    return INITIAL_DATA;
  }

  persist(data = this.data) {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_FILE); // Atomic write
    } catch (e) {
      console.error('Error persisting db.json', e);
    }
  }

  // --- USER OPERATIONS ---
  createUser(userData) {
    const user = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: userData.email.toLowerCase().trim(),
      passwordHash: userData.passwordHash || null,
      salt: userData.salt || null,
      name: userData.name || userData.email.split('@')[0],
      authProvider: userData.authProvider || 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.users.push(user);

    // Create default system projects for this user
    this.createDefaultProjects(user.id);

    this.persist();
    return user;
  }

  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email === email.toLowerCase().trim()) || null;
  }

  findUserById(userId) {
    if (!userId) return null;
    return this.data.users.find(u => u.id === userId) || null;
  }

  deleteUser(userId) {
    // Cascading Hard Delete for GDPR "Right to Be Forgotten"
    this.data.users = this.data.users.filter(u => u.id !== userId);
    this.data.sessions = this.data.sessions.filter(s => s.userId !== userId);
    this.data.tasks = this.data.tasks.filter(t => t.userId !== userId);
    this.data.projects = this.data.projects.filter(p => p.userId !== userId);
    this.data.magicLinks = this.data.magicLinks.filter(m => m.userId !== userId);
    this.data.settings = this.data.settings.filter(s => s.userId !== userId);
    this.persist();
    return true;
  }

  // --- SESSION OPERATIONS ---
  createSession({ userId, refreshTokenHash, userAgent, ip, expiresAt }) {
    const parsed = parseUserAgent(userAgent);
    const session = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId,
      refreshTokenHash,
      ip: ip || '127.0.0.1',
      device: parsed.device,
      os: parsed.os,
      browser: parsed.browser,
      lastActive: new Date().toISOString(),
      expiresAt,
      isValid: true
    };
    this.data.sessions.push(session);
    this.persist();
    return session;
  }

  findSessionByTokenHash(refreshTokenHash) {
    return this.data.sessions.find(s => s.refreshTokenHash === refreshTokenHash && s.isValid) || null;
  }

  getUserActiveSessions(userId) {
    return this.data.sessions
      .filter(s => s.userId === userId && s.isValid)
      .map(s => ({
        id: s.id,
        device: s.device,
        os: s.os,
        browser: s.browser,
        ip: s.ip,
        lastActive: s.lastActive,
        isCurrent: false
      }));
  }

  invalidateSession(sessionId) {
    const s = this.data.sessions.find(item => item.id === sessionId);
    if (s) {
      s.isValid = false;
      this.persist();
    }
  }

  invalidateOtherSessions(userId, currentSessionId) {
    this.data.sessions.forEach(s => {
      if (s.userId === userId && s.id !== currentSessionId) {
        s.isValid = false;
      }
    });
    this.persist();
  }

  // --- MAGIC LINKS ---
  createMagicLink(email, tokenHash, expiresAt) {
    const link = {
      id: 'ml_' + Date.now(),
      email: email.toLowerCase().trim(),
      tokenHash,
      expiresAt,
      used: false
    };
    this.data.magicLinks.push(link);
    this.persist();
    return link;
  }

  findValidMagicLink(tokenHash) {
    const now = new Date().toISOString();
    return this.data.magicLinks.find(m => m.tokenHash === tokenHash && !m.used && m.expiresAt > now) || null;
  }

  consumeMagicLink(tokenHash) {
    const link = this.findValidMagicLink(tokenHash);
    if (link) {
      link.used = true;
      this.persist();
      return true;
    }
    return false;
  }

  // --- STRICT ROW-LEVEL SECURITY (RLS) FOR TASKS ---
  createDefaultProjects(userId) {
    const defaults = [
      { id: 'proj-inbox-' + userId, userId, name: 'Inbox', color: '#6B7280', icon: '📥', isSystem: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'proj-eng-' + userId, userId, name: 'Engineering', color: '#3B82F6', icon: '⚡', isSystem: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'proj-design-' + userId, userId, name: 'Design System', color: '#EC4899', icon: '🎨', isSystem: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    this.data.projects.push(...defaults);
  }

  getTasksByUserId(userId, options = {}) {
    // Enforce WHERE user_id = :current_user_id AND is_deleted = false
    let tasks = this.data.tasks.filter(t => t.userId === userId && !t.isDeleted);

    // Keyset/Cursor-based pagination: (user_id, is_deleted, created_at)
    if (options.cursor) {
      tasks = tasks.filter(t => t.createdAt < options.cursor);
    }

    // Sort by created_at desc
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const limit = options.limit || 100;
    const paginated = tasks.slice(0, limit);
    const nextCursor = paginated.length === limit ? paginated[paginated.length - 1].createdAt : null;

    return {
      tasks: paginated,
      nextCursor
    };
  }

  getTaskById(userId, taskId) {
    // IDOR Protection: returns null (404) if task does not belong to user
    const task = this.data.tasks.find(t => t.id === taskId && t.userId === userId && !t.isDeleted);
    return task || null;
  }

  createTask(userId, taskData) {
    const task = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId, // RLS guarantee
      title: taskData.title || 'Untitled',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      priority: taskData.priority || 'p4',
      projectId: taskData.projectId || `proj-inbox-${userId}`,
      tags: taskData.tags || [],
      dueDate: taskData.dueDate || null,
      subtasks: taskData.subtasks || [],
      attachments: taskData.attachments || [],
      activity: taskData.activity || [{ text: 'Task created', timestamp: new Date().toISOString() }],
      createdAt: taskData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: taskData.status === 'done' ? new Date().toISOString() : null,
      version: 1,
      isDeleted: false
    };

    this.data.tasks.push(task);
    this.persist();
    return task;
  }

  updateTask(userId, taskId, updates) {
    // IDOR Protection
    const task = this.getTaskById(userId, taskId);
    if (!task) return null;

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString(),
      version: (task.version || 1) + 1
    });

    if (updates.status === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== 'done') {
      task.completedAt = null;
    }

    this.persist();
    return task;
  }

  deleteTask(userId, taskId) {
    // IDOR Protection: Soft delete
    const task = this.getTaskById(userId, taskId);
    if (!task) return null;

    task.isDeleted = true;
    task.updatedAt = new Date().toISOString();
    this.persist();
    return task;
  }

  // Batch Sync with Conflict Resolution (LWW)
  syncMutations(userId, mutations) {
    const results = [];
    for (const m of mutations) {
      const { type, taskId, data, clientUpdatedAt } = m;

      if (type === 'CREATE') {
        const created = this.createTask(userId, data);
        results.push({ type: 'CREATE', success: true, task: created });
      } else if (type === 'UPDATE') {
        const existing = this.getTaskById(userId, taskId);
        if (!existing) {
          // Task might not exist yet or deleted
          results.push({ type: 'UPDATE', success: false, reason: 'NOT_FOUND' });
          continue;
        }

        // Last-Write-Wins (LWW) check
        const serverTime = new Date(existing.updatedAt).getTime();
        const clientTime = new Date(clientUpdatedAt || 0).getTime();

        if (clientTime >= serverTime) {
          const updated = this.updateTask(userId, taskId, data);
          results.push({ type: 'UPDATE', success: true, task: updated });
        } else {
          // Conflict: Server version is newer; send back latest server task
          results.push({ type: 'UPDATE', success: false, reason: 'CONFLICT_SERVER_NEWER', serverTask: existing });
        }
      } else if (type === 'DELETE') {
        const deleted = this.deleteTask(userId, taskId);
        results.push({ type: 'DELETE', success: !!deleted });
      }
    }

    return results;
  }

  // --- PROJECTS (RLS ENFORCED) ---
  getProjectsByUserId(userId) {
    return this.data.projects.filter(p => p.userId === userId && !p.isDeleted);
  }

  getProjectById(userId, projectId) {
    return this.data.projects.find(p => p.id === projectId && p.userId === userId && !p.isDeleted) || null;
  }

  createProject(userId, projectData) {
    const proj = {
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      name: projectData.name || 'Untitled List',
      color: projectData.color || '#3B82F6',
      icon: projectData.icon || '📁',
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false
    };
    this.data.projects.push(proj);
    this.persist();
    return proj;
  }

  deleteProject(userId, projectId) {
    const proj = this.getProjectById(userId, projectId);
    if (!proj || proj.isSystem) return null;

    proj.isDeleted = true;
    proj.updatedAt = new Date().toISOString();

    // Reassign tasks to user's inbox
    const inbox = this.data.projects.find(p => p.userId === userId && p.isSystem);
    if (inbox) {
      this.data.tasks.forEach(t => {
        if (t.userId === userId && t.projectId === projectId) {
          t.projectId = inbox.id;
          t.updatedAt = new Date().toISOString();
        }
      });
    }

    this.persist();
    return proj;
  }

  // --- GDPR / CCPA DATA EXPORT ---
  exportUserData(userId) {
    const user = this.findUserById(userId);
    if (!user) return null;

    const tasks = this.getTasksByUserId(userId, { limit: 10000 }).tasks;
    const projects = this.getProjectsByUserId(userId);
    const sessions = this.getUserActiveSessions(userId);

    // Generate CSV for tasks
    const csvHeader = 'ID,Title,Status,Priority,Due Date,Created At,Completed At\n';
    const csvRows = tasks.map(t => {
      const cleanTitle = (t.title || '').replace(/"/g, '""');
      return `"${t.id}","${cleanTitle}","${t.status}","${t.priority}","${t.dueDate || ''}","${t.createdAt}","${t.completedAt || ''}"`;
    }).join('\n');

    return {
      json: {
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        tasks,
        projects,
        sessions,
        exportedAt: new Date().toISOString()
      },
      tasksCsv: csvHeader + csvRows
    };
  }
}

function parseUserAgent(ua) {
  if (!ua) return { device: 'Desktop', os: 'Unknown OS', browser: 'Browser' };
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  let device = /Mobile|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop';

  return { device, os, browser };
}

export const db = new Database();
