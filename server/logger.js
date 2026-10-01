/**
 * Structured Logger with PII Masking
 */

const PII_KEYS = ['password', 'token', 'refreshToken', 'secret', 'authorization', 'cookie'];

export function maskPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => maskPII(item));
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (PII_KEYS.some(k => lowerKey.includes(k))) {
      masked[key] = '[REDACTED]';
    } else if (lowerKey === 'email' && typeof value === 'string') {
      const parts = value.split('@');
      if (parts.length === 2) {
        masked[key] = `${parts[0].charAt(0)}***@${parts[1]}`;
      } else {
        masked[key] = '[REDACTED_EMAIL]';
      }
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskPII(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export const logger = {
  info(message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      meta: maskPII(meta)
    };
    console.log(JSON.stringify(entry));
  },

  warn(message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      meta: maskPII(meta)
    };
    console.warn(JSON.stringify(entry));
  },

  error(message, error = null, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error ? { message: error.message, stack: error.stack } : undefined,
      meta: maskPII(meta)
    };
    console.error(JSON.stringify(entry));
  }
};
