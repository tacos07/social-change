// Compact, tamper-proof tokens: base64url(json).base64url(hmac-sha256).
// These provide INTEGRITY (nobody can forge or edit the payload) — not secrecy.
// We deliberately never store server-side state; everything travels in a signed,
// httpOnly, short-lived cookie. Restart-proof and database-free.
import crypto from 'node:crypto';
import { secrets } from './config.js';

function mac(body) {
  return crypto.createHmac('sha256', secrets.sessionSecret).update(body).digest('base64url');
}

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(body)}`;
}

export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = mac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp === 'number' && Date.now() > payload.exp) return null;
  return payload;
}
