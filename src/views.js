// Tiny server-rendered HTML. No client-side JavaScript at all — the Content
// Security Policy blocks scripts, which keeps the attack surface minimal.
// All motion and polish is pure CSS (see public/styles.css).
import { config } from './config.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '••••';
  const shown = user.slice(0, 2);
  return `${shown}${'•'.repeat(Math.max(1, user.length - shown.length))}@${domain}`;
}

function layout(body, { step } = {}) {
  const repo = config.repoUrl
    ? `<a class="repo" href="${esc(config.repoUrl)}" target="_blank" rel="noopener noreferrer">
         <span class="repo__dot"></span>view source
       </a>`
    : '';
  const status =
    step === 'code'
      ? 'code sent'
      : step === 'done'
      ? 'verified'
      : 'private access';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<title>${esc(config.appName)}</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="ambient" aria-hidden="true"></div>
<header class="topbar">
  <span class="brand"><span class="brand__mark" aria-hidden="true"></span>${esc(config.appName)}</span>
  ${repo}
</header>
<main class="stage">
  <section class="panel">
    <p class="panel__status"><span class="pulse" aria-hidden="true"></span>${esc(status)}</p>
    ${body}
  </section>
  <p class="assurance">Your email and code are never stored. One-time use only.</p>
</main>
</body>
</html>`;
}

export function emailPage({ error } = {}) {
  const domains = config.allowedDomains.map((d) => '@' + d).join(', ');
  const first = config.allowedDomains[0] || 'example.com';
  return layout(
    `
  <h1>Step through the door</h1>
  <p class="sub">Access is limited to <span class="hl">${esc(domains)}</span> addresses. We'll send a one-time code to confirm it's yours.</p>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <form method="POST" action="/request-otp" autocomplete="off">
    <label for="email">Work email</label>
    <input id="email" name="email" type="email" inputmode="email" maxlength="254" required
           placeholder="you@${esc(first)}">
    <button type="submit">Email me a code</button>
  </form>`,
    { step: 'email' }
  );
}

export function otpPage({ email, remaining, error } = {}) {
  return layout(
    `
  <h1>Enter your code</h1>
  <p class="sub">A 6-digit code just went to <span class="hl">${esc(maskEmail(email))}</span>.</p>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <form method="POST" action="/verify-otp" autocomplete="off">
    <label for="otp">Verification code</label>
    <input id="otp" name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autofocus
           placeholder="••••••">
    <button type="submit">Verify code</button>
  </form>
  ${Number.isFinite(remaining) ? `<p class="hint">${esc(remaining)} attempt${remaining === 1 ? '' : 's'} left</p>` : ''}
  <p class="hint"><a href="/">Use a different email</a></p>`,
    { step: 'code' }
  );
}

export function successPage() {
  const minutes = Math.round(config.redirectTtlSeconds / 60);
  return layout(
    `
  <h1>You're through.</h1>
  <p class="sub">This works for about ${minutes} minute${minutes === 1 ? '' : 's'}, and only from this browser. Open Signal and request to join. An admin gives the final nod inside the app.</p>
  <a class="cta" href="/go">Open the Signal group<span class="cta__arrow" aria-hidden="true">&rarr;</span></a>`,
    { step: 'done' }
  );
}

export function errorPage(message) {
  return layout(
    `
  <h1>That didn't work</h1>
  <p class="err" role="alert">${esc(message)}</p>
  <a class="cta" href="/">Start over<span class="cta__arrow" aria-hidden="true">&rarr;</span></a>`,
    {}
  );
}
