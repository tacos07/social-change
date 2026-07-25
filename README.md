# signal-join-gate

A tiny, auditable web gate for a **private, anonymous Signal group**. It lets in only people whose **work email** is on your allow-list, using a one-time code — then hands them a **time-limited, browser-bound redirect** to your Signal invite link.

**It stores nothing.** No database, no files, no logging of emails or codes. The Signal link itself is never in this repo — it lives only as an environment variable on the host.

---

## How it works

1. Visitor opens the site → enters their work email.
2. The email domain is checked **on the server** against `allowed_domains` in `config.yml`.
3. A 6-digit code is emailed (Brevo SMTP). Only an HMAC of the code rides along in a signed, `httpOnly` cookie — the code itself is never stored.
4. Visitor enters the code. **Max 3 attempts**, then the code is voided.
5. On success they get a button that works for ~3 minutes **from that browser only**, which `302`-redirects to the Signal invite link.
6. Inside Signal they request to join; you (as admin) approve.

Why browser-bound instead of a shareable short URL: a shareable link could be forwarded to an outsider inside the 3-minute window. Binding it to the verified browser via a signed cookie removes that hole.

---

## Privacy / "we store nothing" — how it's guaranteed

| Data | Where it lives | Persisted? |
|---|---|---|
| Email address | RAM during the request; inside a signed cookie in the visitor's own browser | **No** DB / disk / logs |
| One-time code | Never stored — only an HMAC hash, re-derived to compare | **No** |
| Access grant | Signed cookie, ~3-min expiry, cleared on use | **No** server state |
| Signal link | Environment variable on the host only | **Not in the repo** |

The mailer deliberately does not log recipients. Application logs contain no email addresses or codes.

---

## Security posture

- Server-authoritative validation (browser checks are cosmetic only).
- Constant-time comparison for codes and token signatures.
- Signed, `httpOnly`, `SameSite=Strict` cookies; short expiries.
- Strict Content-Security-Policy: **no client-side JavaScript**, same-origin styles only.
- `helmet` security headers + HSTS.
- Per-IP rate limit on code requests (anti email-bombing).
- Minimal, well-known dependencies (small attack surface).
- Generic error messages (never reveal which check failed).

### How a code is protected

Guessing a code is bounded by three independent limits, each enforced on the
server:

- **Entropy.** The code is drawn from a cryptographically secure source across
  the full six-digit range: a one-in-a-million target.
- **A short life.** It stops working ten minutes after it is sent, so an
  attacker's window is measured in minutes, not days.
- **A hard per-IP ceiling.** Verification is capped at ten attempts per quarter
  hour, well above the three tries an honest person needs and far below anything
  useful for guessing. The three-attempt counter shown on screen is the
  courtesy limit; this rate limit is the enforced one.

Codes are bound to the address they were sent to, so one cannot be redeemed
against a different email, and comparison is constant-time so nothing leaks
through response timing.

The link handed out at the end is bound to the browser that earned it and
expires within minutes, so it cannot usefully be forwarded. Membership itself is
still confirmed by an admin inside Signal: the gate decides who is let through,
and Signal's own approval step remains the final word.

---

## Configure

Edit `config.yml` (safe to commit — no secrets):

```yaml
app_name: "Protium Group Access"
repo_url: "https://github.com/<your-user>/signal-join-gate"
allowed_domains:
  - protium.co.in         # add more lines to allow more domains
otp_ttl_seconds: 600
redirect_ttl_seconds: 180
max_attempts: 3
otp_requests_per_15min: 5
```

Secrets go in environment variables — see `.env.example`.

---

## Run locally

```bash
npm install
cp .env.example .env        # then fill in real values
# generate two different secrets:
node -e "console.log(crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,''))"
npm start                   # http://localhost:3000
```

---

## Brevo (free) email setup

1. Create a free Brevo account.
2. Verify a sender address (the one you put in `MAIL_FROM`).
3. Dashboard → **SMTP & API → SMTP** → copy the SMTP **login** and **key** into `SMTP_USER` / `SMTP_PASS`.
4. Host defaults to `smtp-relay.brevo.com:587`.

> Check Brevo's current free-tier daily limit at signup — it's ample for a small group.

---

## Deploy to Render (free, gives you a public URL)

1. Push this repo to GitHub (the `.env` is gitignored — **do not commit real secrets**).
2. Render → **New → Web Service** → connect the repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Add environment variables (from `.env.example`): `SIGNAL_LINK`, `SESSION_SECRET`, `OTP_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `NODE_ENV=production`.
5. Deploy. You'll get a public `https://<name>.onrender.com` URL — share **that**, never the Signal link.

Health check path: `/healthz`.

---

## Operating it

Share the `https://<name>.onrender.com` address. That URL is the front door, and
it is the only one anybody outside needs.

Keep **Group Link → Approve New Members = ON** in Signal. Verification decides
who reaches the door; an admin still confirms every member inside the app, so
joining always takes both.

To change where the door leads, update `SIGNAL_LINK` in Render → the service →
**Environment**, then save. The service restarts on its own and picks it up.

## License

MIT.
