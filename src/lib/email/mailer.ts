import nodemailer from "nodemailer";

type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
};

export function getReportRecipients() {
  return (process.env.REPORT_GENERAL_RECIPIENTS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function assertSmtpConfigured() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Configuração SMTP incompleta: ${missing.join(", ")}`);
  }
}

export async function sendHtmlReportMail({
  to,
  subject,
  html,
  text,
  attachments = [],
}: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}) {
  assertSmtpConfigured();

  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || "465");
  const secure =
    process.env.SMTP_SECURE === undefined
      ? port === 465
      : String(process.env.SMTP_SECURE).toLowerCase() === "true";
  const from = process.env.SMTP_FROM || `"CrewControl" <${process.env.SMTP_USER}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: host,
    },
  });

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });
}
