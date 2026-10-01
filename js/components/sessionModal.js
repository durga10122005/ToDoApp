/**
 * Sessions & Compliance Management Modal
 * Active sessions dashboard, global session invalidation, GDPR data export, and account deletion.
 */
import { authClient } from '../auth/authClient.js';
import { toast } from './toast.js';

export class SessionModal {
  constructor() {
    this.modal = document.getElementById('session-modal-backdrop');
    this.init();
  }

  init() {
    if (!this.modal) return;

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    const closeBtn = document.getElementById('session-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  async open() {
    this.modal.classList.add('active');
    await this.render();
  }

  close() {
    this.modal.classList.remove('active');
  }

  async render() {
    const container = document.getElementById('session-modal-content');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted);">
        Loading active sessions...
      </div>
    `;

    try {
      const sessions = await authClient.getActiveSessions();

      container.innerHTML = `
        <div class="session-section">
          <div class="session-section-title">
            <span>Active Sessions (${sessions.length})</span>
            <button id="logout-others-btn" class="btn-header" style="font-size: 11px;">Log out other devices</button>
          </div>
          <div class="sessions-list">
            ${sessions.map((s, idx) => `
              <div class="session-item">
                <div class="session-icon">
                  ${s.device === 'Mobile' ? '📱' : '💻'}
                </div>
                <div class="session-details">
                  <div class="session-name">
                    ${escapeHtml(s.browser)} on ${escapeHtml(s.os)}
                    ${idx === 0 ? '<span class="badge" style="background:var(--p3-bg);color:var(--p3-color);border:none;">Current Device</span>' : ''}
                  </div>
                  <div class="session-meta font-mono">
                    IP: ${escapeHtml(s.ip)} · Last active: ${new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="session-section" style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
          <div class="session-section-title">
            <span>Privacy &amp; GDPR Compliance</span>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="gdpr-export-btn" class="btn-header" style="flex:1; justify-content:center;">
              <svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export My Data (JSON &amp; CSV)
            </button>
            <button id="gdpr-delete-btn" class="btn-header delete-btn" style="flex:1; justify-content:center; color:var(--p1-color);">
              <svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Delete My Account
            </button>
          </div>
        </div>
      `;

      this.bindEvents();
    } catch (e) {
      container.innerHTML = `
        <div style="padding: 20px; color: var(--p1-color); font-size: 13px;">
          Failed to load sessions: ${escapeHtml(e.message)}
        </div>
      `;
    }
  }

  bindEvents() {
    // Log out other sessions
    const logoutOthersBtn = document.getElementById('logout-others-btn');
    if (logoutOthersBtn) {
      logoutOthersBtn.addEventListener('click', async () => {
        try {
          const msg = await authClient.logoutOtherSessions();
          toast.show(msg || 'Logged out of all other devices');
          await this.render();
        } catch (e) {
          toast.show(`Error: ${e.message}`);
        }
      });
    }

    // GDPR Export
    const exportBtn = document.getElementById('gdpr-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const data = await authClient.exportData();

          // Download JSON
          const jsonBlob = new Blob([JSON.stringify(data.json, null, 2)], { type: 'application/json' });
          downloadBlob(jsonBlob, `tasks-export-${new Date().toISOString().slice(0, 10)}.json`);

          // Download CSV
          if (data.tasksCsv) {
            const csvBlob = new Blob([data.tasksCsv], { type: 'text/csv' });
            downloadBlob(csvBlob, `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`);
          }

          toast.show('Export files downloaded (JSON and CSV)');
        } catch (e) {
          toast.show(`Export error: ${e.message}`);
        }
      });
    }

    // GDPR Delete Account
    const deleteBtn = document.getElementById('gdpr-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to permanently delete your account and all associated tasks? This action cannot be undone.')) {
          try {
            await authClient.deleteAccount();
            toast.show('Your account and all data have been permanently erased.');
            this.close();
            window.location.reload();
          } catch (e) {
            toast.show(`Delete error: ${e.message}`);
          }
        }
      });
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
