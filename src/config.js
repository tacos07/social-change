// Loads human-editable settings from config.yml (safe to commit) and secrets
// from environment variables (never committed). Fails fast if a secret is missing.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// --- Non-secret settings (config.yml) --------------------------------------
const raw = yaml.load(fs.readFileSync(path.join(root, 'config.yml'), 'utf8')) || {};

// An allowed_domains entry is either a bare domain string or a
// "{ domain, name }" pair. The pair is preferred: on screen, "IIT Kharagpur"
// next to "iitkgp.ac.in" is far harder to misread than "iitkgp" vs "iitk"
// alone. Bare strings still work, so older config files keep loading.
const institutes = (Array.isArray(raw.allowed_domains) ? raw.allowed_domains : [])
  .map((entry) => {
    const isPair = entry !== null && typeof entry === 'object';
    const domain = String(isPair ? entry.domain ?? '' : entry).trim().toLowerCase();
    if (!domain) return null;
    const name = String((isPair ? entry.name : '') || domain).trim();
    return { domain, name };
  })
  .filter(Boolean);

export const config = {
  appName: raw.app_name || 'Private Group Access',
  repoUrl: raw.repo_url || '',
  institutes,
  allowedDomains: institutes.map((i) => i.domain),
  otpTtlSeconds: Number(raw.otp_ttl_seconds || 600),
  redirectTtlSeconds: Number(raw.redirect_ttl_seconds || 180),
  maxAttempts: Number(raw.max_attempts || 3),
  otpRequestsPer15Min: Number(raw.otp_requests_per_15min || 5),
};

if (config.allowedDomains.length === 0) {
  console.error('FATAL: config.yml -> allowed_domains is empty. Add at least one domain.');
  process.exit(1);
}

// --- Secrets (environment only) --------------------------------------------
function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`FATAL: missing required environment variable ${name}`);
    process.exit(1);
  }
  return v.trim();
}

export const secrets = {
  signalLink: required('SIGNAL_LINK'),
  sessionSecret: required('SESSION_SECRET'),
  otpSecret: required('OTP_SECRET'),
  smtpHost: process.env.SMTP_HOST?.trim() || 'smtp-relay.brevo.com',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: required('SMTP_USER'),
  smtpPass: required('SMTP_PASS'),
  mailFrom: required('MAIL_FROM'),
};

// The signing secrets are the crown jewels: a weak one lets an attacker forge a
// "verified" cookie. Refuse to start on anything guessable.
const MIN_SECRET_LEN = 24;
for (const name of ['SESSION_SECRET', 'OTP_SECRET']) {
  if (process.env[name].trim().length < MIN_SECRET_LEN) {
    console.error(`FATAL: ${name} must be at least ${MIN_SECRET_LEN} characters. Generate one with:`);
    console.error(`  node -e "console.log(crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''))"`);
    process.exit(1);
  }
}
if (secrets.sessionSecret === secrets.otpSecret) {
  console.error('FATAL: SESSION_SECRET and OTP_SECRET must be different values.');
  process.exit(1);
}

// The redirect target must be a real https link (never a javascript:/data: footgun).
if (!/^https:\/\//i.test(secrets.signalLink)) {
  console.error('FATAL: SIGNAL_LINK must start with https://');
  process.exit(1);
}

// A signal.group invite lives ENTIRELY in the URL fragment. If a .env value is
// written unquoted, the loader treats "#" as a comment and silently hands us a
// useless "https://signal.group/" — which would still 302, straight to nowhere.
// Refuse to start rather than send people to a dead door.
if (/(^|\.)signal\.group$/i.test(new URL(secrets.signalLink).hostname) && !secrets.signalLink.includes('#')) {
  console.error('FATAL: SIGNAL_LINK has no "#..." invite fragment — it was probably truncated.');
  console.error('  In .env the value MUST be quoted:  SIGNAL_LINK="https://signal.group/#Cj..."');
  process.exit(1);
}
