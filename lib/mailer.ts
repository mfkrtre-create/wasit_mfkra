import "server-only";

import nodemailer from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function hasSmtpConfig() {
  return Boolean(readEnv("SMTP_HOST") && readEnv("SMTP_PORT") && readEnv("SMTP_USER") && readEnv("SMTP_PASS") && readEnv("SMTP_FROM"));
}

export async function sendMail(input: MailInput) {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: readEnv("SMTP_HOST"),
    port: Number(readEnv("SMTP_PORT")),
    secure: readEnv("SMTP_SECURE") === "true",
    auth: {
      user: readEnv("SMTP_USER"),
      pass: readEnv("SMTP_PASS"),
    },
  });

  await transporter.sendMail({
    from: readEnv("SMTP_FROM"),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
