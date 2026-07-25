// Server-authoritative email checks. The browser's <input type=email> is a
// convenience only; these functions are the real gate.
import { config } from './config.js';

// Conservative single-address pattern (no display names, no lists).
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export function isAllowedDomain(email) {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  return config.allowedDomains.includes(email.slice(at + 1));
}
