// One-time-code helpers. The code itself is never stored: we keep only an HMAC
// of it inside the signed challenge cookie, and re-derive to compare.
import crypto from 'node:crypto';
import { secrets } from './config.js';

// 6-digit, cryptographically random (000000–999999).
export function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Bind the hash to the email so a code is only valid for the address it was sent to.
export function hashOtp(email, code) {
  return crypto
    .createHmac('sha256', secrets.otpSecret)
    .update(`${String(email).toLowerCase()}:${code}`)
    .digest('base64url');
}

// Constant-time comparison to avoid timing side-channels.
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
