// Email-gated access to a private Signal group.
//
// Flow:
//   GET  /              -> enter your work email
//   POST /request-otp   -> domain check, email a 6-digit code, set signed challenge cookie
//   POST /verify-otp    -> compare code (max N attempts), on success set 3-min access cookie
//   GET  /go            -> if the access cookie is valid, 302 to the Signal link (env secret)
//
// Nothing is written to a database, disk, or logs. All state lives in short-lived,
// signed, httpOnly cookies. The Signal link exists only as an environment variable.
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import url from 'node:url';

import { config, secrets } from './config.js';
import { sign, verify } from './tokens.js';
import { generateOtp, hashOtp, safeEqual } from './otp.js';
import { sendOtp } from './mailer.js';
import { normalizeEmail, isValidEmail, isAllowedDomain } from './validate.js';
import { emailPage, otpPage, successPage, errorPage } from './views.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1); // running behind Render/Fly's proxy
app.disable('x-powered-by');

// Security headers + a strict CSP: no scripts, same-origin styles only.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'none'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
      },
    },
    hsts: { maxAge: 15552000, includeSubDomains: true },
  })
);

app.use(express.urlencoded({ extended: false, limit: '4kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development',
  sameSite: 'strict',
  path: '/',
};

// Anti-abuse: cap how many codes a single IP can request.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.otpRequestsPer15Min,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).send(errorPage('Too many requests. Please wait a few minutes and try again.')),
});

// This limiter, not the on-screen attempt counter, is the enforced bound on
// code guessing. The counter is carried in the client's signed cookie, and a
// stateless server cannot know that a client is re-presenting an earlier copy
// of its own valid cookie — recognising a spent token is server state by
// definition, and this design deliberately keeps none.
//
// So the ceiling that has to hold is requests-per-IP against a 10-minute,
// one-in-a-million code. 10 is comfortably above the 3 tries an honest person
// needs and far below anything useful for guessing.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).send(errorPage('Too many attempts. Please wait a few minutes and try again.')),
});

app.get('/', (req, res) => {
  res.clearCookie('chal', cookieOpts).clearCookie('acc', cookieOpts);
  res.send(emailPage());
});

app.post('/request-otp', otpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);

  // Generic rejection — we don't reveal whether the format or the domain failed.
  if (!isValidEmail(email) || !isAllowedDomain(email)) {
    return res
      .status(400)
      .send(emailPage({ error: 'That address is not eligible. Use an email at one of the approved domains.' }));
  }

  const code = generateOtp();
  const challenge = sign({
    email,
    h: hashOtp(email, code),
    att: 0,
    exp: Date.now() + config.otpTtlSeconds * 1000,
  });

  try {
    await sendOtp(email, code);
  } catch {
    console.error('mail send failed'); // no PII in logs
    return res
      .status(502)
      .send(emailPage({ error: 'Could not send the code right now. Please try again shortly.' }));
  }

  res.cookie('chal', challenge, { ...cookieOpts, maxAge: config.otpTtlSeconds * 1000 });
  res.send(otpPage({ email, remaining: config.maxAttempts }));
});

app.post('/verify-otp', verifyLimiter, (req, res) => {
  const chal = verify(req.cookies.chal);
  if (!chal) {
    return res.status(400).send(emailPage({ error: 'Your code expired. Please request a new one.' }));
  }

  const input = String(req.body.otp || '').trim();
  const matches = /^[0-9]{6}$/.test(input) && safeEqual(hashOtp(chal.email, input), chal.h);

  if (matches) {
    const access = sign({ purpose: 'join', exp: Date.now() + config.redirectTtlSeconds * 1000 });
    res.clearCookie('chal', cookieOpts);
    res.cookie('acc', access, { ...cookieOpts, maxAge: config.redirectTtlSeconds * 1000 });
    return res.send(successPage());
  }

  const att = (chal.att || 0) + 1;
  const remaining = config.maxAttempts - att;
  if (remaining <= 0) {
    res.clearCookie('chal', cookieOpts);
    return res
      .status(400)
      .send(emailPage({ error: 'Too many incorrect attempts. Please request a new code.' }));
  }

  // Re-issue the challenge with the incremented attempt count (same expiry).
  res.cookie('chal', sign({ ...chal, att }), { ...cookieOpts, maxAge: config.otpTtlSeconds * 1000 });
  res.status(400).send(otpPage({ email: chal.email, remaining, error: 'Incorrect code.' }));
});

// The time-limited redirect. Bound to this browser via the signed cookie, so it
// cannot be forwarded as a shareable link. Single use: the cookie is cleared here.
app.get('/go', (req, res) => {
  const acc = verify(req.cookies.acc);
  if (!acc || acc.purpose !== 'join') {
    return res.status(403).send(errorPage('This access link has expired. Please verify again.'));
  }
  res.clearCookie('acc', cookieOpts);
  res.redirect(302, secrets.signalLink);
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.use((req, res) => res.status(404).send(errorPage('Page not found.')));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`signal-join-gate listening on :${port}`));
