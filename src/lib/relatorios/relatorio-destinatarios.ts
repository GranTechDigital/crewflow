import { prisma } from "@/lib/prisma";
import { getReportRecipients } from "@/lib/email/mailer";

export const GENERAL_PENDING_REPORT_KEY = "RELATORIO_GERAL_PENDENCIAS";

export type ReportRecipientMode = "scheduled" | "email_request";

export function normalizeReportEmail(value: string) {
  return value.trim().toLowerCase();
}

function uniqueEmails(emails: string[]) {
  return [...new Set(emails.map(normalizeReportEmail).filter(Boolean))];
}

export async function listReportRecipientEmails(mode: ReportRecipientMode = "scheduled") {
  const where =
    mode === "email_request"
      ? {
          reportKey: GENERAL_PENDING_REPORT_KEY,
          active: true,
          canRequestByEmail: true,
        }
      : {
          reportKey: GENERAL_PENDING_REPORT_KEY,
          active: true,
          receivesScheduledEmail: true,
        };

  const recipients = await prisma.relatorioDestinatario.findMany({
    where,
    select: { email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const emails = uniqueEmails(recipients.map((recipient) => recipient.email));
  if (emails.length > 0) return emails;

  return uniqueEmails(getReportRecipients());
}

export async function resolveReportRecipientEmails({
  requestedRecipients,
  mode = "scheduled",
}: {
  requestedRecipients?: string[];
  mode?: ReportRecipientMode;
}) {
  const allowedRecipients = await listReportRecipientEmails(mode);
  if (!requestedRecipients || requestedRecipients.length === 0) return allowedRecipients;

  const allowed = new Set(allowedRecipients);
  const recipients = uniqueEmails(requestedRecipients);
  const unauthorized = recipients.filter((recipient) => !allowed.has(recipient));

  if (unauthorized.length > 0) {
    const error = new Error(`Destinatário não autorizado para relatório: ${unauthorized.join(", ")}`);
    error.name = "UnauthorizedReportRecipientError";
    throw error;
  }

  return recipients;
}

export async function markReportRecipientsSent(emails: string[]) {
  const normalizedEmails = uniqueEmails(emails);
  if (normalizedEmails.length === 0) return;

  await prisma.relatorioDestinatario.updateMany({
    where: {
      reportKey: GENERAL_PENDING_REPORT_KEY,
      email: { in: normalizedEmails },
    },
    data: {
      lastSentAt: new Date(),
    },
  });
}
