/**
 * Auth Modal Component
 * Passwordless Social Auth (Google, GitHub, Apple), Magic Link,
 * and Traditional Email + Password with strict policy & breach validation.
 */
import { authClient } from '../auth/authClient.js';
import { state } from '../state.js';
import { toast } from './toast.js';

export class AuthModal {
  constructor() {
    this.modal = document.getElementById('auth-modal-backdrop');
    this.tabMode = 'login'; // 'login' | 'register' | 'magic'
    this.init();
  }

  init() {
    if (!this.modal) return;

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    const closeBtn = document.getElementById('auth-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  open(initialTab = 'login') {
    this.tabMode = initialTab;
    this.render();
    this.modal.classList.add('active');
  }

  close() {
    this.modal.classList.remove('active');
  }

  render() {
    const container = document.getElementById('auth-modal-content');
    if (!container) return;

    container.innerHTML = `
      <div class="auth-header">
        <div class="auth-title">${this.tabMode === 'register' ? 'Create Account' : this.tabMode === 'magic' ? 'Passwordless Sign In' : 'Welcome Back'}</div>
        <div class="auth-subtitle">Sign in to sync your tasks with end-to-end multi-tenant isolation.</div>
      </div>

      <!-- Social / OAuth 2.0 Buttons -->
      <div class="auth-social-group">
        <button class="auth-social-btn" data-provider="google">
          <svg style="width:16px;height:16px;" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"></path><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"></path><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"></path><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"></path></svg>
          <span>Continue with Google</span>
        </button>
        <button class="auth-social-btn" data-provider="github">
          <svg style="width:16px;height:16px;fill:currentColor;" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"></path></svg>
          <span>Continue with GitHub</span>
        </button>
        <button class="auth-social-btn" data-provider="apple">
          <svg style="width:16px;height:16px;fill:currentColor;" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.78 1.06-1.85.94-2.94-.92.04-2.02.61-2.67 1.38-.58.67-1.08 1.77-.94 2.82 1.02.08 2.05-.48 2.67-1.26"></path></svg>
          <span>Continue with Apple</span>
        </button>
      </div>

      <div class="auth-divider">
        <span>OR</span>
      </div>

      <!-- Tab Switcher -->
      <div class="auth-tabs">
        <button class="auth-tab-btn ${this.tabMode === 'login' ? 'active' : ''}" data-tab="login">Sign In</button>
        <button class="auth-tab-btn ${this.tabMode === 'register' ? 'active' : ''}" data-tab="register">Register</button>
        <button class="auth-tab-btn ${this.tabMode === 'magic' ? 'active' : ''}" data-tab="magic">Magic Link</button>
      </div>

      <!-- Error Banner -->
      <div id="auth-error-banner" class="auth-error-box" style="display:none;"></div>

      <!-- Forms Container -->
      <div class="auth-form-body">
        ${this.tabMode === 'magic' ? `
          <div class="auth-field">
            <label>Work or Personal Email</label>
            <input id="auth-magic-email" type="email" class="auth-input" placeholder="name@company.com" autocomplete="email" />
          </div>
          <button id="auth-magic-submit" class="btn-primary auth-submit-btn">Send Magic Link Token</button>
          <div id="magic-token-entry" style="display:none; margin-top:12px;">
            <div class="auth-field">
              <label>Enter 15-Minute One-Time Token</label>
              <input id="auth-magic-token" class="auth-input font-mono" placeholder="Paste verification token..." />
            </div>
            <button id="auth-magic-verify-btn" class="btn-primary auth-submit-btn">Verify &amp; Log In</button>
          </div>
        ` : `
          ${this.tabMode === 'register' ? `
            <div class="auth-field">
              <label>Your Full Name</label>
              <input id="auth-name" type="text" class="auth-input" placeholder="Jane Doe" autocomplete="name" />
            </div>
          ` : ''}
          <div class="auth-field">
            <label>Email Address</label>
            <input id="auth-email" type="email" class="auth-input" placeholder="name@company.com" autocomplete="email" />
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input id="auth-password" type="password" class="auth-input" placeholder="••••••••••••" autocomplete="${this.tabMode === 'register' ? 'new-password' : 'current-password'}" />
          </div>

          ${this.tabMode === 'register' ? `
            <div class="password-policy-checklist" id="policy-checklist">
              <div class="policy-item" id="rule-len"><span>○</span> 10+ characters</div>
              <div class="policy-item" id="rule-upper"><span>○</span> Uppercase letter</div>
              <div class="policy-item" id="rule-lower"><span>○</span> Lowercase letter</div>
              <div class="policy-item" id="rule-num"><span>○</span> Number</div>
              <div class="policy-item" id="rule-sym"><span>○</span> Special symbol</div>
            </div>
          ` : ''}

          <button id="auth-submit-btn" class="btn-primary auth-submit-btn">
            ${this.tabMode === 'register' ? 'Create Account' : 'Sign In with Email'}
          </button>
        `}
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Tab switching
    this.modal.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.tabMode = btn.getAttribute('data-tab');
        this.render();
      });
    });

    // Social Auth Buttons
    this.modal.querySelectorAll('.auth-social-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.getAttribute('data-provider');
        try {
          await authClient.loginOAuth(provider);
          toast.show(`Signed in via ${provider.toUpperCase()}`);
          await state.syncRemoteData();
          this.close();
        } catch (e) {
          this.showError(e.message);
        }
      });
    });

    // Password Policy Real-time Check
    const passwordInput = document.getElementById('auth-password');
    if (passwordInput && this.tabMode === 'register') {
      passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;
        this.updatePolicyItem('rule-len', val.length >= 10);
        this.updatePolicyItem('rule-upper', /[A-Z]/.test(val));
        this.updatePolicyItem('rule-lower', /[a-z]/.test(val));
        this.updatePolicyItem('rule-num', /[0-9]/.test(val));
        this.updatePolicyItem('rule-sym', /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val));
      });
    }

    // Submit Traditional Auth Form
    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name')?.value.trim();

        if (!email || !password) {
          this.showError('Email and password are required');
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Processing...';

          if (this.tabMode === 'register') {
            await authClient.register(email, password, name);
            toast.show('Account created successfully');
          } else {
            await authClient.login(email, password);
            toast.show('Signed in successfully');
          }

          await state.syncRemoteData();
          this.close();
        } catch (e) {
          this.showError(e.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = this.tabMode === 'register' ? 'Create Account' : 'Sign In with Email';
        }
      });
    }

    // Magic Link Request
    const magicSubmit = document.getElementById('auth-magic-submit');
    if (magicSubmit) {
      magicSubmit.addEventListener('click', async () => {
        const email = document.getElementById('auth-magic-email').value.trim();
        if (!email) {
          this.showError('Please enter a valid email address');
          return;
        }

        try {
          magicSubmit.disabled = true;
          const result = await authClient.requestMagicLink(email);
          toast.show('Magic link token generated (expires in 15 mins)');
          
          const entryDiv = document.getElementById('magic-token-entry');
          const tokenInput = document.getElementById('auth-magic-token');
          if (entryDiv && tokenInput) {
            entryDiv.style.display = 'block';
            if (result.demoToken) {
              tokenInput.value = result.demoToken;
            }
          }
        } catch (e) {
          this.showError(e.message);
        } finally {
          magicSubmit.disabled = false;
        }
      });
    }

    // Magic Link Verification
    const magicVerifyBtn = document.getElementById('auth-magic-verify-btn');
    if (magicVerifyBtn) {
      magicVerifyBtn.addEventListener('click', async () => {
        const token = document.getElementById('auth-magic-token').value.trim();
        if (!token) {
          this.showError('Please provide the one-time magic token');
          return;
        }
        try {
          await authClient.verifyMagicLink(token);
          toast.show('Signed in with Magic Link!');
          await state.syncRemoteData();
          this.close();
        } catch (e) {
          this.showError(e.message);
        }
      });
    }
  }

  updatePolicyItem(id, passes) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('pass', passes);
    el.querySelector('span').textContent = passes ? '✓' : '○';
  }

  showError(msg) {
    const banner = document.getElementById('auth-error-banner');
    if (banner) {
      banner.textContent = msg;
      banner.style.display = 'block';
    }
  }
}
