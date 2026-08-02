import "server-only";

import nodemailer from "nodemailer";
import { assertOtpRecipientAllowed, getEmailDomain } from "@/lib/email-policy";

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function readProviderResponseCode(info: unknown) {
  if (typeof info === "object" && info && "responseCode" in info && typeof info.responseCode === "number") {
    return String(info.responseCode);
  }
  if (typeof info === "object" && info && "response" in info && typeof info.response === "string") {
    return info.response.match(/\b\d{3}\b/)?.[0] ?? "unknown";
  }
  return "unknown";
}

export function hasSmtpConfig() {
  return Boolean(readEnv("SMTP_HOST") && readEnv("SMTP_PORT") && readEnv("SMTP_USER") && readEnv("SMTP_PASS") && readEnv("SMTP_FROM"));
}

export async function sendMail(input: MailInput) {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP is not configured.");
  }

  const recipient = assertOtpRecipientAllowed(input.to);

  const transporter = nodemailer.createTransport({
    host: readEnv("SMTP_HOST"),
    port: Number(readEnv("SMTP_PORT")),
    secure: readEnv("SMTP_SECURE") === "true",
    auth: {
      user: readEnv("SMTP_USER"),
      pass: readEnv("SMTP_PASS"),
    },
  });

  try {
    const info = await transporter.sendMail({
      from: readEnv("SMTP_FROM"),
      to: recipient,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    console.info("mail.delivery", {
      recipientDomain: getEmailDomain(recipient),
      responseCode: readProviderResponseCode(info),
      acceptedCount: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejectedCount: Array.isArray(info.rejected) ? info.rejected.length : 0,
    });
  } catch (error) {
    console.error("mail.delivery_failed", {
      recipientDomain: getEmailDomain(recipient),
      responseCode: readProviderResponseCode(error),
    });
    throw error;
  }
}
