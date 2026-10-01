/**
 * Local-First Sync Engine & Conflict Resolution
 * Handles optimistic local mutations, operational sync queue, and LWW resolution.
 */
import { idb } from './indexedDb.js';
import { authClient } from '../auth/authClient.js';
import { toast } from '../components/toast.js';

class SyncEngine {
  constructor() {
    this.status = navigator.onLine ? 'synced' : 'offline';
    this.isSyncing = false;
    this.subscribers = new Set();

    this.init();
  }

  init() {
    window.addEventListener('online', () => {
      this.setStatus('syncing');
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.setStatus('offline');
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.status);
    return () => this.subscribers.delete(callback);
  }

  setStatus(status) {
    this.status = status;
    this.subscribers.forEach(cb => cb(status));
  }

  async queueMutation(type, taskId, data) {
    const mutation = {
      type, // 'CREATE' | 'UPDATE' | 'DELETE'
      taskId,
      data,
      clientUpdatedAt: new Date().toISOString()
    };

    // 1. Enqueue in IndexedDB
    await idb.enqueueMutation(mutation);

    // 2. If online and authenticated, trigger background sync
    if (navigator.onLine && authClient.currentUser) {
      this.flushQueue().catch(err => {
        console.warn('Background sync deferred:', err);
      });
    } else if (!navigator.onLine) {
      this.setStatus('offline');
    }
  }

  async flushQueue() {
    if (this.isSyncing || !navigator.onLine || !authClient.currentUser) {
      return;
    }

    const pending = await idb.getPendingMutations();
    if (!pending || pending.length === 0) {
      this.setStatus('synced');
      return;
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      const payload = {
        mutations: pending.map(p => ({
          type: p.type,
          taskId: p.taskId,
          data: p.data,
          clientUpdatedAt: p.clientUpdatedAt
        }))
      };

      const res = await fetch('/api/tasks/sync', {
        method: 'POST',
        headers: authClient.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        // Clear processed mutations from queue
        const queueIds = pending.map(p => p.queueId);
        await idb.removeMutations(queueIds);

        // Update IndexedDB with latest server tasks
        if (Array.isArray(result.data.tasks)) {
          await idb.clear('tasks');
          await idb.putMany('tasks', result.data.tasks);
        }

        this.setStatus('synced');
      } else {
        this.setStatus('error');
      }
    } catch (e) {
      console.warn('Failed to flush sync queue:', e);
      this.setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      this.isSyncing = false;
    }
  }

  async fetchRemoteTasks() {
    if (!authClient.currentUser || !navigator.onLine) return null;
    try {
      const res = await fetch('/api/tasks', {
        headers: authClient.getAuthHeaders()
      });
      const result = await res.json();
      if (result.success && result.data.tasks) {
        await idb.clear('tasks');
        await idb.putMany('tasks', result.data.tasks);
        return result.data.tasks;
      }
    } catch (e) {
      console.warn('Could not fetch remote tasks, falling back to local IDB', e);
    }
    return null;
  }
}

export const syncEngine = new SyncEngine();
