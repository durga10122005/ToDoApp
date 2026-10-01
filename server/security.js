/**
 * Security & Cryptography Engine
 * Handles PBKDF2 hashing, JWT access tokens, refresh tokens, HIBP breach check,
 * CSRF protection, rate limiting, and content sanitization.
 */
import crypto from 'crypto';
import https from 'https';

const JWT_SECRET = process.env.JWT_SECRET || 'linear-notion-enterprise-secret-key-32chars!';
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// 1. Password Policy Validation
export function validatePasswordPolicy(password) {
  const errors = [];
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }
  if (password.length < 10) {
    errors.push('Password must be at least 10 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 2. HaveIBeenPwned Breach Check (k-Anonymity Model)
export async function checkPasswordBreach(password) {
  return new Promise((resolve) => {
    try {
      const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      const options = {
        hostname: 'api.pwnedpasswords.com',
        path: `/range/${prefix}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Enterprise-ToDo-Security-Audit',
          'Add-Padding': 'true'
        },
        timeout: 2500
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const lines = data.split('\r\n');
            for (const line of lines) {
              const [hashSuffix, countStr] = line.split(':');
              if (hashSuffix && hashSuffix.trim() === suffix) {
                const count = parseInt(countStr, 10);
                if (count > 0) {
                  return resolve({ breached: true, count });
                }
              }
            }
          }
          resolve({ breached: false, count: 0 });
        });
      });

      req.on('error', () => {
        // Fallback gracefully if network/API is unavailable
        resolve({ breached: false, count: 0, checked: false });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ breached: false, count: 0, checked: false });
      });

      req.end();
    } catch (e) {
      resolve({ breached: false, count: 0, checked: false });
    }
  });
}

// 3. Cryptographic Password Hashing (PBKDF2 with unique salt)
export function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, storedHash, storedSalt) {
  const hash = crypto.pbkdf2Sync(password, storedSalt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// 4. Short-lived Access Token (JWT HMAC-SHA256)
export function createAccessToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    name: user.name,
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + ACCESS_TOKEN_EXPIRY_MS) / 1000)
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyAccessToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return data;
  } catch (e) {
    return null;
  }
}

// 5. Refresh Token Generation & Hashing
export function generateRefreshToken() {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString() };
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// 6. Anti-CSRF Token Generation
export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

// 7. In-Memory Sliding Window Rate Limiter
class RateLimiter {
  constructor(limit = 5, windowMs = 15 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map(); // ip => [timestamps]
  }

  isLimited(ip) {
    const now = Date.now();
    const timestamps = this.hits.get(ip) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (validTimestamps.length >= this.limit) {
      this.hits.set(ip, validTimestamps);
      return true;
    }

    validTimestamps.push(now);
    this.hits.set(ip, validTimestamps);
    return false;
  }

  reset(ip) {
    this.hits.delete(ip);
  }
}

export const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 mins

// 8. Strict Content Sanitization (XSS Prevention)
export function sanitizeContent(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  return dirty
    // Strip script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip iframe, object, embed, form tags
    .replace(/<\/?(iframe|object|embed|form|input|button|style)[^>]*>/gi, '')
    // Strip inline javascript handlers: onclick, onerror, onload, etc.
    .replace(/ on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    // Strip javascript: and data: URIs in href or src
    .replace(/\b(href|src)\s*=\s*(["']?)\s*(javascript|data):[^"'>\s]*/gi, '$1=$2#');
}

// 9. Standard Security Headers
export function setSecurityHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.pwnedpasswords.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
