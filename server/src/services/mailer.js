import logger from "../utils/logger.js";

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Send the password-reset email via Resend's REST API (native fetch — no SDK).
 * Returns true on success, false on failure (so callers can fall back gracefully).
 */
export async function sendPasswordResetEmail(to, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "ChowZilla <onboarding@resend.dev>";

  if (!apiKey) {
    logger.error("RESEND_API_KEY is not set — password reset email not sent");
    return false;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Reset your ChowZilla password",
        html: [
          "<p>Hi,</p>",
          "<p>We received a request to reset your ChowZilla password. Click the link below to choose a new one (it expires in 1 hour):</p>",
          `<p><a href="${resetUrl}">${resetUrl}</a></p>`,
          "<p>If you didn't request this, you can safely ignore this email.</p>",
        ].join(""),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error(`Resend send failed (${res.status}): ${body}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Resend send error", error);
    return false;
  }
}
