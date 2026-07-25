// Sends the one-time code over Brevo SMTP.
// IMPORTANT: we intentionally never log the recipient address or the code.
import nodemailer from 'nodemailer';
import { secrets, config } from './config.js';

// Dev-only escape hatch: some corporate networks block outbound SMTP entirely,
// which makes the flow untestable locally. With MAIL_TRANSPORT=console the code
// is printed to the terminal instead of emailed. Double-gated — it is ignored
// unless NODE_ENV is explicitly 'development', so production can never use it.
const consoleTransport =
  process.env.NODE_ENV === 'development' && process.env.MAIL_TRANSPORT === 'console';

if (consoleTransport) {
  console.warn('*** MAIL_TRANSPORT=console — codes print to this terminal, no email is sent. DEV ONLY. ***');
}

const transporter = consoleTransport
  ? null
  : nodemailer.createTransport({
      host: secrets.smtpHost,
      port: secrets.smtpPort,
      secure: secrets.smtpPort === 465, // 587 uses STARTTLS
      auth: { user: secrets.smtpUser, pass: secrets.smtpPass },
    });

export async function sendOtp(email, code) {
  const minutes = Math.round(config.otpTtlSeconds / 60);

  if (consoleTransport) {
    console.log(`[dev-mail] code for ${email}: ${code} (valid ${minutes} min)`);
    return;
  }

  try {
    await transporter.sendMail({
      from: secrets.mailFrom,
      to: email,
      subject: `${config.appName} — your one-time code`,
      text:
        `Your verification code is: ${code}\n\n` +
        `It expires in ${minutes} minute(s). Enter it on the page you already have open.\n\n` +
        `If you did not request this, you can safely ignore this email.`,
    });
  } catch (err) {
    console.error('mail send failed', err);
    throw err;
  }
}
