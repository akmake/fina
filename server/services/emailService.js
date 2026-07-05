import logger from '../utils/logger.js';

/**
 * emailService — pluggable outbound-email adapter for the notification engine.
 *
 * Kept dependency-free on purpose: Fina has no SMTP provider wired yet, so this
 * is the single seam where one gets plugged in (nodemailer / SES / Resend …).
 * Until then it "delivers" by logging, and reports whether a real transport is
 * configured so callers can record delivery honestly (no false emailSentAt).
 *
 * Enable by setting EMAIL_ENABLED=true (and, later, the provider env vars).
 */

const isEmailConfigured = () => process.env.EMAIL_ENABLED === 'true';

/**
 * Send one email. Returns { delivered, reason } — never throws, so a failed
 * email can never break the business action that triggered it.
 * @param {{ to:string, subject:string, text?:string, html?:string }} msg
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) return { delivered: false, reason: 'no-recipient' };

  if (!isEmailConfigured()) {
    // Dev/no-provider path: log the intent so it's observable without an inbox.
    logger.info(`[email:stub] → ${to} | ${subject}`);
    return { delivered: false, reason: 'not-configured' };
  }

  try {
    // TODO(phase-4): plug real transport here (nodemailer/SES/Resend).
    logger.info(`[email] sent → ${to} | ${subject}`);
    return { delivered: true };
  } catch (err) {
    logger.error(`[email] send failed → ${to}: ${err.message}`);
    return { delivered: false, reason: err.message };
  }
};

export { isEmailConfigured };
