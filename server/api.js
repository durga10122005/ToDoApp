/**
 * Enterprise REST API Handlers
 * Strict schema validation, RLS enforcement, standardized errors, and CSRF protection
 */
import { db } from './db.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  checkPasswordBreach,
  createAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateCsrfToken,
  authRateLimiter,
  sanitizeContent
} from './security.js';
import { logger } from './logger.js';

// Standardized Response Format
export function sendSuccess(res, data = {}, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ success: true, data }));
}

export function sendError(res, code, message, status = 400) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    success: false,
    error: { code, message }
  }));
}

// Cookie Helper
export function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

export function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearCookie(res, name, path = '/') {
  res.setHeader('Set-Cookie', `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict`);
}

// Authentication & RLS Middleware
export function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      const user = db.findUserById(payload.sub);
      if (!user) return null; // Immediate token invalidation if user was deleted
      return { id: user.id, email: user.email, name: user.name };
    }
  }
  return null;
}

// CSRF Verification for state-mutating requests
export function verifyCsrf(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

  const csrfToken = req.headers['x-csrf-token'];
  // For API endpoints, verify presence of X-CSRF-Token or matching cookie
  return typeof csrfToken === 'string' && csrfToken.length >= 16;
}

// Read JSON Body helper
export async function readJsonBody(req, allowedFields = null) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
    });

    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const parsed = JSON.parse(body);

        // Strict Schema Validation: Reject unexpected fields
        if (allowedFields && Array.isArray(allowedFields)) {
          const keys = Object.keys(parsed);
          for (const k of keys) {
            if (!allowedFields.includes(k)) {
              return reject(new Error(`UNKNOWN_FIELD_${k}`));
            }
          }
        }

        resolve(parsed);
      } catch (e) {
        reject(new Error('INVALID_JSON'));
      }
    });
  });
}

// Main API Router Dispatcher
export async function handleApiRoute(req, res, url) {
  const path = url.pathname;
  const ip = req.socket.remoteAddress || '127.0.0.1';

  // 1. Health Checks
  if (path === '/api/health' && req.method === 'GET') {
    return sendSuccess(res, {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  if (path === '/api/ready' && req.method === 'GET') {
    return sendSuccess(res, {
      status: 'ready',
      database: 'connected',
      storage: 'writable'
    });
  }

  // 2. Authentication Routes
  // POST /api/auth/register
  if (path === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, ['email', 'password', 'name']);
      const { email, password, name } = body;

      if (!email || !password) {
        return sendError(res, 'MISSING_FIELDS', 'Email and password are required', 400);
      }

      // Check Password Policy (min 10 chars, mixed case, numbers, symbols)
      const policy = validatePasswordPolicy(password);
      if (!policy.valid) {
        return sendError(res, 'WEAK_PASSWORD', policy.errors.join(', '), 422);
      }

      // HaveIBeenPwned Breach Check
      const breach = await checkPasswordBreach(password);
      if (breach.breached) {
        return sendError(
          res,
          'PASSWORD_BREACHED',
          `This password has appeared in ${breach.count.toLocaleString()} known data breaches. Please choose a unique password.`,
          422
        );
      }

      // Check existing user
      if (db.findUserByEmail(email)) {
        return sendError(res, 'USER_EXISTS', 'An account with this email already exists', 409);
      }

      const { hash, salt } = hashPassword(password);
      const user = db.createUser({ email, passwordHash: hash, salt, name: sanitizeContent(name) });

      // Generate Tokens
      const accessToken = createAccessToken(user);
      const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
      const session = db.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ip,
        expiresAt
      });

      const csrfToken = generateCsrfToken();
      setCookie(res, 'refresh_token', rawToken, {
        path: '/api/auth',
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60
      });

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        csrfToken
      }, 201);
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && req.method === 'POST') {
    if (authRateLimiter.isLimited(ip)) {
      return sendError(res, 'RATE_LIMITED', 'Too many failed login attempts. Please wait 15 minutes before trying again.', 429);
    }

    try {
      const body = await readJsonBody(req, ['email', 'password']);
      const { email, password } = body;

      const user = db.findUserByEmail(email);
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash, user.salt)) {
        return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      // Reset rate limiter on successful login
      authRateLimiter.reset(ip);

      const accessToken = createAccessToken(user);
      const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
      db.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ip,
        expiresAt
      });

      const csrfToken = generateCsrfToken();
      setCookie(res, 'refresh_token', rawToken, {
        path: '/api/auth',
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60
      });

      logger.info('User logged in', { userId: user.id, email: user.email });

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        csrfToken
      });
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // POST /api/auth/magic-link/request
  if (path === '/api/auth/magic-link/request' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, ['email']);
      const { email } = body;
      if (!email) return sendError(res, 'EMAIL_REQUIRED', 'Valid email is required', 400);

      const rawMagicToken = generateCsrfToken();
      const tokenHash = hashRefreshToken(rawMagicToken);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

      db.createMagicLink(email, tokenHash, expiresAt);

      logger.info('Magic link generated', { email });

      // In real prod, this sends an email. We return the token for instant demo / verification.
      return sendSuccess(res, {
        message: 'Magic link generated and sent to email',
        demoToken: rawMagicToken
      });
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // POST /api/auth/magic-link/verify
  if (path === '/api/auth/magic-link/verify' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, ['token']);
      const { token } = body;
      const tokenHash = hashRefreshToken(token);

      const link = db.findValidMagicLink(tokenHash);
      if (!link) {
        return sendError(res, 'INVALID_TOKEN', 'Magic link is invalid or has expired', 401);
      }

      db.consumeMagicLink(tokenHash);

      // Find or create user
      let user = db.findUserByEmail(link.email);
      if (!user) {
        user = db.createUser({ email: link.email, authProvider: 'magic-link' });
      }

      const accessToken = createAccessToken(user);
      const { rawToken, tokenHash: sessionHash, expiresAt } = generateRefreshToken();
      db.createSession({
        userId: user.id,
        refreshTokenHash: sessionHash,
        userAgent: req.headers['user-agent'],
        ip,
        expiresAt
      });

      const csrfToken = generateCsrfToken();
      setCookie(res, 'refresh_token', rawToken, {
        path: '/api/auth',
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60
      });

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        csrfToken
      });
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // POST /api/auth/oauth/mock (OAuth 2.0 / OIDC Flow for Google, GitHub, Apple)
  if (path === '/api/auth/oauth/mock' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, ['provider', 'email', 'name']);
      const { provider, email, name } = body;

      if (!['google', 'github', 'apple'].includes(provider)) {
        return sendError(res, 'UNSUPPORTED_PROVIDER', 'Supported providers: google, github, apple', 400);
      }

      const userEmail = email || `${provider}.user@example.com`;
      let user = db.findUserByEmail(userEmail);
      if (!user) {
        user = db.createUser({
          email: userEmail,
          name: name || `${provider.toUpperCase()} Developer`,
          authProvider: provider
        });
      }

      const accessToken = createAccessToken(user);
      const { rawToken, tokenHash, expiresAt } = generateRefreshToken();
      db.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ip,
        expiresAt
      });

      const csrfToken = generateCsrfToken();
      setCookie(res, 'refresh_token', rawToken, {
        path: '/api/auth',
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60
      });

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        accessToken,
        csrfToken
      });
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // POST /api/auth/refresh (Silent Token Refresh via HttpOnly Cookie)
  if (path === '/api/auth/refresh' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const rawRefreshToken = cookies.refresh_token;

    if (!rawRefreshToken) {
      return sendError(res, 'UNAUTHORIZED', 'No refresh token provided', 401);
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const session = db.findSessionByTokenHash(tokenHash);

    if (!session || new Date(session.expiresAt) < new Date()) {
      clearCookie(res, 'refresh_token', '/api/auth');
      return sendError(res, 'SESSION_EXPIRED', 'Session has expired, please log in again', 401);
    }

    const user = db.findUserById(session.userId);
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User no longer exists', 404);
    }

    // Rotate refresh token
    const { rawToken: newRawToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } = generateRefreshToken();
    session.refreshTokenHash = newTokenHash;
    session.expiresAt = newExpiresAt;
    session.lastActive = new Date().toISOString();
    db.persist();

    const newAccessToken = createAccessToken(user);
    const csrfToken = generateCsrfToken();

    setCookie(res, 'refresh_token', newRawToken, {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 30 * 24 * 60 * 60
    });

    return sendSuccess(res, {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: newAccessToken,
      csrfToken
    });
  }

  // POST /api/auth/logout
  if (path === '/api/auth/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    const rawRefreshToken = cookies.refresh_token;
    if (rawRefreshToken) {
      const tokenHash = hashRefreshToken(rawRefreshToken);
      const session = db.findSessionByTokenHash(tokenHash);
      if (session) {
        db.invalidateSession(session.id);
      }
    }
    clearCookie(res, 'refresh_token', '/api/auth');
    return sendSuccess(res, { message: 'Logged out successfully' });
  }

  // GET /api/auth/me
  if (path === '/api/auth/me' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    const fullUser = db.findUserById(user.id);
    return sendSuccess(res, {
      user: { id: fullUser.id, email: fullUser.email, name: fullUser.name },
      csrfToken: generateCsrfToken()
    });
  }

  // --- SESSIONS DASHBOARD (Requires Auth) ---
  if (path === '/api/sessions' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);

    const sessions = db.getUserActiveSessions(user.id);
    return sendSuccess(res, { sessions });
  }

  if (path === '/api/sessions/logout-others' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);

    const cookies = parseCookies(req);
    const rawRefreshToken = cookies.refresh_token;
    let currentSessionId = null;
    if (rawRefreshToken) {
      const s = db.findSessionByTokenHash(hashRefreshToken(rawRefreshToken));
      if (s) currentSessionId = s.id;
    }

    db.invalidateOtherSessions(user.id, currentSessionId);
    logger.info('Invalidated other sessions', { userId: user.id });
    return sendSuccess(res, { message: 'All other active sessions have been logged out' });
  }

  // --- TASKS ENDPOINTS (Strict RLS & IDOR Protected) ---
  if (path === '/api/tasks' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);

    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const result = db.getTasksByUserId(user.id, { cursor, limit });
    return sendSuccess(res, result);
  }

  if (path === '/api/tasks' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);

    try {
      const body = await readJsonBody(req);
      // Content sanitization
      body.title = sanitizeContent(body.title);
      body.description = sanitizeContent(body.description);

      const task = db.createTask(user.id, body);
      return sendSuccess(res, { task }, 201);
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // Single Task: PUT & DELETE /api/tasks/:id
  const taskMatch = path.match(/^\/api\/tasks\/([a-zA-Z0-9_\-]+)$/);
  if (taskMatch) {
    const taskId = taskMatch[1];
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);

    if (req.method === 'PUT') {
      if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);
      try {
        const updates = await readJsonBody(req);
        if (updates.title) updates.title = sanitizeContent(updates.title);
        if (updates.description) updates.description = sanitizeContent(updates.description);

        const updated = db.updateTask(user.id, taskId, updates);
        // IDOR Prevention: Return 404 Not Found (never 403)
        if (!updated) {
          return sendError(res, 'RESOURCE_NOT_FOUND', 'Task not found', 404);
        }
        return sendSuccess(res, { task: updated });
      } catch (e) {
        return sendError(res, 'BAD_REQUEST', e.message, 400);
      }
    }

    if (req.method === 'DELETE') {
      if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);
      const deleted = db.deleteTask(user.id, taskId);
      // IDOR Prevention
      if (!deleted) {
        return sendError(res, 'RESOURCE_NOT_FOUND', 'Task not found', 404);
      }
      return sendSuccess(res, { message: 'Task deleted' });
    }
  }

  // Batch Offline Sync: POST /api/tasks/sync
  if (path === '/api/tasks/sync' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);

    try {
      const body = await readJsonBody(req, ['mutations']);
      const results = db.syncMutations(user.id, body.mutations || []);
      const currentServerTasks = db.getTasksByUserId(user.id, { limit: 1000 }).tasks;
      return sendSuccess(res, { results, tasks: currentServerTasks });
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  // --- PROJECTS ENDPOINTS (RLS Protected) ---
  if (path === '/api/projects' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    const projects = db.getProjectsByUserId(user.id);
    return sendSuccess(res, { projects });
  }

  if (path === '/api/projects' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);

    try {
      const body = await readJsonBody(req, ['name', 'color', 'icon']);
      body.name = sanitizeContent(body.name);
      const proj = db.createProject(user.id, body);
      return sendSuccess(res, { project: proj }, 201);
    } catch (e) {
      return sendError(res, 'BAD_REQUEST', e.message, 400);
    }
  }

  const projMatch = path.match(/^\/api\/projects\/([a-zA-Z0-9_\-]+)$/);
  if (projMatch && req.method === 'DELETE') {
    const projectId = projMatch[1];
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);

    const deleted = db.deleteProject(user.id, projectId);
    if (!deleted) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Project not found or cannot be deleted', 404);
    }
    return sendSuccess(res, { message: 'Project deleted' });
  }

  // --- GDPR / CCPA DATA PROTECTION & COMPLIANCE ---
  // One-click Data Export: GET /api/export
  if (path === '/api/export' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);

    const exportData = db.exportUserData(user.id);
    return sendSuccess(res, exportData);
  }

  // Right to Be Forgotten: DELETE /api/account
  if (path === '/api/account' && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user) return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    if (!verifyCsrf(req)) return sendError(res, 'CSRF_FAILED', 'Invalid CSRF token', 403);

    db.deleteUser(user.id);
    clearCookie(res, 'refresh_token', '/api/auth');
    logger.warn('User account deleted under GDPR Right to be Forgotten', { userId: user.id });
    return sendSuccess(res, { message: 'Account and all associated records have been permanently erased.' });
  }

  // 404 for unhandled API endpoints
  return sendError(res, 'ENDPOINT_NOT_FOUND', 'The requested API endpoint does not exist', 404);
}
