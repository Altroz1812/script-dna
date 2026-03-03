/**
 * Web Application Security Utilities
 * Input sanitization, rate limiting, and XSS protection
 */

// ── Input Sanitization ──────────────────────────────────────────────

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/** Escape HTML entities to prevent XSS */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ENTITY_MAP[char] || char);
}

/** Strip all HTML tags from a string */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/** Sanitize user input: trim, strip HTML, limit length */
export function sanitizeInput(input: string, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return stripHtml(input).trim().slice(0, maxLength);
}

/** Sanitize email: lowercase, trim, validate format */
export function sanitizeEmail(email: string): string {
  const cleaned = email.trim().toLowerCase().slice(0, 255);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : '';
}

/** Sanitize phone number: keep only digits, +, -, (, ), spaces */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+\-() ]/g, '').trim().slice(0, 20);
}

/** Sanitize URL: only allow http/https protocols */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

// ── Client-Side Rate Limiting ───────────────────────────────────────

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 30 * 60 * 1000, // 30 minutes lockout
};

/** Check if an action is rate limited. Returns { allowed, retryAfterMs } */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Check lockout
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }

  // Reset window if expired
  if (now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now, lockedUntil: 0 });
    return { allowed: true, retryAfterMs: 0 };
  }

  entry.attempts += 1;

  if (entry.attempts > RATE_LIMIT_CONFIG.maxAttempts) {
    entry.lockedUntil = now + RATE_LIMIT_CONFIG.lockoutMs;
    return { allowed: false, retryAfterMs: RATE_LIMIT_CONFIG.lockoutMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Reset rate limit after successful action */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/** Format retry time for display */
export function formatRetryTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return minutes <= 1 ? 'less than a minute' : `${minutes} minutes`;
}

// ── Password Validation ─────────────────────────────────────────────

export interface PasswordStrength {
  score: number; // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Mix uppercase and lowercase letters');

  if (/\d/.test(password)) score++;
  else suggestions.push('Include at least one number');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else suggestions.push('Add a special character (!@#$%...)');

  // Penalize common patterns
  if (/^(password|123456|qwerty)/i.test(password)) {
    score = Math.max(0, score - 2);
    suggestions.push('Avoid common passwords');
  }

  const labels: PasswordStrength['label'][] = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)], suggestions };
}

// ── CSP Nonce Generator ─────────────────────────────────────────────

let _cspNonce: string | null = null;

export function getCSPNonce(): string {
  if (!_cspNonce) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    _cspNonce = btoa(String.fromCharCode(...array));
  }
  return _cspNonce;
}
