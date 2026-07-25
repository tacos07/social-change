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

### Known limits (audited 2026-07-26)

Two things are deliberately not what they first appear. Both are consequences of
storing nothing, and both are stated here rather than papered over.

**1. "Maximum 3 attempts" is a UX affordance, not an enforced limit.** The
attempt counter travels in the signed `chal` cookie. The signature stops anyone
*editing* it, but nothing stops a client re-sending the original `att=0` cookie
before every guess, which resets the count. Verified by hand: replaying the
first cookie holds the page at "2 attempts left" indefinitely. No stateless
design can fix this, because "this token was already spent" is server state by
definition.

The real ceiling is the per-IP verify rate limit (10 per 15 minutes) against a
one-in-a-million code that expires in 10 minutes. A single IP therefore gets
roughly a 0.001% chance per code. Closing the gap further means either adding
storage, or raising the code to 8 digits.

**2. The `/go` redirect is time-bound, not single-use.** The access cookie is
cleared on the way out, but a client that kept a copy can present it again until
it expires. Same root cause.

Beyond that: the Signal invite itself is permanent and shared. This gate
controls who *learns* it, not what they do afterwards, which is why the weekly
reset ritual below is part of the design rather than an optional extra.

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

## Your weekly reset ritual

Signal has no self-expiring group link, so you rotate it:

1. In Signal: Group → Group Link → **Reset Link**. Copy the new link.
2. In Render → the service → **Environment** → update `SIGNAL_LINK` → save (the service restarts automatically).
3. Done — old links are now dead; the gate points at the new one.

**Strongly recommended:** in Signal, turn **Group Link → Approve New Members = ON**. The gate can't stop someone re-sharing the link after they reach the redirect; admin approval means even a leaked link still needs your yes. This is the real lock.

---

## What this does NOT do

- It can't make Signal itself issue per-user or auto-expiring links (Signal's server doesn't support it). The expiry here is on *our* redirect, not on Signal's link.
- It can't retroactively remove someone who got in — that's a Signal admin action.

## License

MIT.
