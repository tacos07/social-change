// Tiny server-rendered HTML. No client-side JavaScript at all — the Content
// Security Policy blocks scripts, which keeps the attack surface minimal.
// Every interaction here is a real form submit or a native <details>.
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

// Inline so it costs no extra request and needs no img-src exception.
const GITHUB_MARK = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;

const STEPS = {
  email: '<span class="step__now">Step 1</span> of 2 &middot; verify your email',
  code:  '<span class="step__now">Step 2</span> of 2 &middot; enter the code',
  done:  '<span class="step__now">Verified</span> &middot; one step left',
  error: 'Something went wrong',
};

function layout(body, { step = 'email' } = {}) {
  const repo = config.repoUrl
    ? `<a class="ghlink" href="${esc(config.repoUrl)}" target="_blank" rel="noopener noreferrer"
          aria-label="Read the source code on GitHub">${GITHUB_MARK}</a>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<title>${esc(config.appName)}</title>
<link rel="icon" href="/icon-180.png" type="image/png">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="topbar">
  <span class="brand"><img class="brand__logo" src="/logo.png" width="96" height="69" alt="" aria-hidden="true">${esc(config.appName)}</span>
  ${repo}
</header>
<main class="stage">
  <div class="column">
    <p class="step">${STEPS[step] || STEPS.email}</p>
    ${body}
  </div>
  <p class="assurance">Your email and code are never stored. One-time use only.</p>
</main>
</body>
</html>`;
}

// The allowlist will outgrow a phone screen as institutes are added, so it is
// collapsed by default and scrolls inside itself rather than pushing the form
// below the fold. <details> gives us that with zero script.
function roster() {
  const list = config.institutes;
  if (list.length === 0) return '';

  const rows = list
    .map(
      (i) => `<li class="roster__row">
        <span class="roster__name">${esc(i.name)}</span>
        <span class="roster__domain">@${esc(i.domain)}</span>
      </li>`
    )
    .join('');

  const label = list.length === 1 ? '1 approved domain' : `${list.length} approved domains`;

  return `<details class="roster">
    <summary>
      <span class="roster__chev" aria-hidden="true"></span>
      <span class="roster__count">${esc(label)}</span>
      <span class="roster__toggle" aria-hidden="true"></span>
    </summary>
    <ul class="roster__list">${rows}</ul>
  </details>`;
}

export function emailPage({ error } = {}) {
  const first = config.institutes[0]?.domain || 'example.ac.in';
  return layout(
    `
  <h1>Join the group</h1>
  <p class="sub">Enter an email at one of the approved domains. We send a 6-digit code to confirm it's yours, then hand you the Signal invite.</p>
  ${roster()}
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <form method="POST" action="/request-otp" autocomplete="off">
    <label for="email">Email address</label>
    <input id="email" name="email" type="email" inputmode="email" maxlength="254" required
           autocomplete="email" placeholder="you@${esc(first)}">
    <button type="submit">Send me a code</button>
  </form>`,
    { step: 'email' }
  );
}

export function otpPage({ email, remaining, error } = {}) {
  const minutes = Math.round(config.otpTtlSeconds / 60);
  return layout(
    `
  <h1>Check your inbox</h1>
  <p class="sub">A 6-digit code is on its way to <span class="mono">${esc(maskEmail(email))}</span>. It works for ${esc(minutes)} minute${minutes === 1 ? '' : 's'}.</p>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <form method="POST" action="/verify-otp" autocomplete="off">
    <label for="otp">Verification code</label>
    <input id="otp" name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autofocus
           autocomplete="one-time-code" placeholder="000000">
    <button type="submit">Verify and continue</button>
  </form>
  ${
    Number.isFinite(remaining)
      ? `<p class="hint"><span class="attempts">${esc(remaining)}</span> attempt${remaining === 1 ? '' : 's'} left &middot; <a href="/">use a different email</a></p>`
      : `<p class="hint"><a href="/">Use a different email</a></p>`
  }`,
    { step: 'code' }
  );
}

export function successPage() {
  const minutes = Math.round(config.redirectTtlSeconds / 60);
  return layout(
    `
  <h1>Open Signal to join</h1>
  <p class="sub">The link below opens the group in the Signal app. Get the app ready first and it takes you straight there.</p>
  <ol class="ready">
    <li>Install Signal, if you haven't</li>
    <li>Sign in on this device</li>
    <li>Open the link, then request to join</li>
  </ol>
  <a class="cta" href="/go">Open the Signal group</a>
  <p class="hint only-wide">On a laptop, link Signal Desktop to your phone before opening it. Doing this on your phone is simpler.</p>
  <p class="hint">Works for about ${esc(minutes)} minute${minutes === 1 ? '' : 's'}, in this browser only. An admin approves the last step inside the app.</p>`,
    { step: 'done' }
  );
}

export function errorPage(message) {
  return layout(
    `
  <h1>That didn't work</h1>
  <p class="err" role="alert">${esc(message)}</p>
  <a class="cta" href="/">Start over</a>`,
    { step: 'error' }
  );
}
