import nodemailer from "nodemailer";

type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
};

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64Safe(content: Buffer | string) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  let output = "";
  let index = 0;

  for (; index + 2 < buffer.length; index += 3) {
    const value = (buffer[index] << 16) | (buffer[index + 1] << 8) | buffer[index + 2];
    output += BASE64_CHARS[(value >>> 18) & 63];
    output += BASE64_CHARS[(value >>> 12) & 63];
    output += BASE64_CHARS[(value >>> 6) & 63];
    output += BASE64_CHARS[value & 63];
  }

  if (index < buffer.length) {
    const first = buffer[index];
    const second = index + 1 < buffer.length ? buffer[index + 1] : 0;
    const value = (first << 16) | (second << 8);
    output += BASE64_CHARS[(value >>> 18) & 63];
    output += BASE64_CHARS[(value >>> 12) & 63];
    output += index + 1 < buffer.length ? BASE64_CHARS[(value >>> 6) & 63] : "=";
    output += "=";
  }

  return output;
}

function foldBase64(value: string) {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += 76) {
    lines.push(value.slice(index, index + 76));
  }
  return lines.join("\r\n");
}

function encodeMimeWord(value: string) {
  return `=?UTF-8?B?${encodeBase64Safe(value)}?=`;
}

function encodeAddressHeader(value: string | string[]) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function escapeHeaderParam(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, " ");
}

function buildRawMessage({
  from,
  to,
  subject,
  html,
  text,
  attachments,
}: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments: MailAttachment[];
}) {
  const mixedBoundary = `crewcontrol-mixed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const alternativeBoundary = `crewcontrol-alt-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const lines = [
    `From: ${from}`,
    `To: ${encodeAddressHeader(to)}`,
    `Subject: ${encodeMimeWord(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${alternativeBoundary}--`,
    "",
  ];

  for (const attachment of attachments) {
    const filename = escapeHeaderParam(attachment.filename);
    lines.push(
      `--${mixedBoundary}`,
      `${attachment.contentType ? `Content-Type: ${attachment.contentType}` : "Content-Type: application/octet-stream"}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(encodeBase64Safe(attachment.content)),
      "",
    );
  }

  lines.push(`--${mixedBoundary}--`, "");
  return lines.join("\r\n");
}

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

  if (attachments.length > 0) {
    return transporter.sendMail({
      envelope: {
        from: process.env.SMTP_USER,
        to,
      },
      raw: buildRawMessage({ from, to, subject, html, text, attachments }),
    });
  }

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });
}
