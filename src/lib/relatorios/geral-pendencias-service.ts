import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendHtmlReportMail } from "@/lib/email/mailer";
import {
  criarExcelRelatorioGeralPendencias,
  gerarRelatorioGeralPendencias,
  parseRelatorioEndDate,
  parseRelatorioStartDate,
} from "@/lib/relatorios/geral-pendencias";
import {
  buildGeneralReportSnapshotEmailHtml,
  buildGeneralReportSnapshotEmailText,
  buildGeneralReportEmailHtml,
  buildGeneralReportEmailText,
  buildReportRequestExplanationHtml,
  readGeneralReportSnapshotByDate,
  readPreviousGeneralReportSnapshot,
  saveGeneralReportSnapshot,
} from "@/lib/relatorios/geral-pendencias-email";
import {
  getGeneralReportSchedule,
  getScheduleRunKey,
  isDefaultSnapshotDue,
  isScheduleDue,
  markGeneralReportScheduleEmailRun,
  markGeneralReportScheduleSnapshotRun,
} from "@/lib/relatorios/relatorio-agenda";
import { markReportRecipientsSent, resolveReportRecipientEmails } from "@/lib/relatorios/relatorio-destinatarios";

export type GeneralReportRequestBody = {
  dryRun?: boolean;
  snapshotOnly?: boolean;
  saveSnapshot?: boolean;
  requestedBy?: string;
  recipients?: string[];
  inicio?: string;
  fim?: string;
  requestedDate?: string;
};

export function isReportServiceAuthorized(request: NextRequest) {
  const expectedToken = process.env.RELATORIO_EMAIL_SERVICE_TOKEN;
  if (!expectedToken) return false;

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  return tokenBuffer.length === expectedBuffer.length && timingSafeEqual(tokenBuffer, expectedBuffer);
}

export async function createGeneralReportSnapshot(body: Pick<GeneralReportRequestBody, "inicio" | "fim"> = {}) {
  const dataInicioFiltro = parseRelatorioStartDate(body.inicio);
  const dataFim = parseRelatorioEndDate(body.fim);
  const relatorio = await gerarRelatorioGeralPendencias({ dataInicioFiltro, dataFim });

  await saveGeneralReportSnapshot(relatorio);

  return relatorio;
}

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function toDateKey({ year, month, day }: { year: number; month: number; day: number }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRequestedDate(value?: string) {
  const raw = (value || "").trim().toLowerCase();
  const todayParts = getSaoPauloDateParts();
  const todayKey = toDateKey(todayParts);

  if (!raw || raw === "hoje" || raw === "atual") {
    return {
      kind: "today" as const,
      key: todayKey,
      label: `${String(todayParts.day).padStart(2, "0")}/${String(todayParts.month).padStart(2, "0")}/${todayParts.year}`,
      date: new Date(`${todayKey}T12:00:00.000Z`),
    };
  }

  if (raw === "ontem") {
    const yesterday = new Date(`${todayKey}T12:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const parts = getSaoPauloDateParts(yesterday);
    const key = toDateKey(parts);
    return {
      kind: "past" as const,
      key,
      label: `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`,
      date: new Date(`${key}T12:00:00.000Z`),
    };
  }

  const brMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const day = brMatch ? Number(brMatch[1]) : isoMatch ? Number(isoMatch[3]) : NaN;
  const month = brMatch ? Number(brMatch[2]) : isoMatch ? Number(isoMatch[2]) : NaN;
  const year = brMatch ? Number(brMatch[3]) : isoMatch ? Number(isoMatch[1]) : NaN;

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return { kind: "invalid" as const, message: "A data informada não foi reconhecida." };
  }

  const key = toDateKey({ year, month, day });
  const date = new Date(`${key}T12:00:00.000Z`);
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;

  if (!isValid) {
    return { kind: "invalid" as const, message: "A data informada não é uma data válida." };
  }

  const label = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  if (key === todayKey) return { kind: "today" as const, key, label, date };
  if (key > todayKey) {
    return { kind: "invalid" as const, message: "A data informada está no futuro. Solicite uma data já encerrada ou use relatório hoje." };
  }

  return { kind: "past" as const, key, label, date };
}

async function sendReportRequestExplanationEmail({
  recipients,
  message,
}: {
  recipients: string[];
  message: string;
}) {
  const html = buildReportRequestExplanationHtml(message);
  const info = await sendHtmlReportMail({
    to: recipients,
    subject: "Relatório Geral de Pendências - solicitação não atendida",
    html,
    text: [
      "Não consegui gerar o relatório solicitado.",
      message,
      "",
      "Exemplos válidos: relatório hoje, relatório ontem ou relatório 18/06/2026.",
    ].join("\n"),
  });

  return {
    success: true,
    explanationSent: true,
    message,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

async function sendGeneralReportSnapshotEmail(
  body: GeneralReportRequestBody,
  requestedDate: ReturnType<typeof parseRequestedDate>,
): Promise<unknown> {
  const recipients = await resolveReportRecipientEmails({
    requestedRecipients: body.recipients,
    mode: body.requestedBy ? "email_request" : "scheduled",
  });
  if (recipients.length === 0) {
    const error = new Error("Nenhum destinatário configurado em REPORT_GENERAL_RECIPIENTS.");
    error.name = "MissingReportRecipientsError";
    throw error;
  }

  if (requestedDate.kind === "invalid") {
    if (body.dryRun) {
      return { success: true, dryRun: true, explanation: requestedDate.message };
    }
    return sendReportRequestExplanationEmail({ recipients, message: requestedDate.message });
  }

  if (requestedDate.kind === "today") {
    return sendGeneralReportEmail({ ...body, requestedDate: undefined, saveSnapshot: body.saveSnapshot ?? false });
  }

  const snapshot = await readGeneralReportSnapshotByDate(requestedDate.date);
  if (!snapshot) {
    const message = `Não encontrei snapshot salvo para ${requestedDate.label}. Solicite uma data com snapshot disponível ou use "relatório hoje" para gerar uma versão em tempo real.`;
    if (body.dryRun) {
      return { success: true, dryRun: true, explanation: message };
    }
    return sendReportRequestExplanationEmail({ recipients, message });
  }

  const html = buildGeneralReportSnapshotEmailHtml({ snapshot, requestedDate: requestedDate.label });
  const text = buildGeneralReportSnapshotEmailText(snapshot, requestedDate.label);

  if (body.dryRun) {
    return {
      success: true,
      dryRun: true,
      snapshot: true,
      requestedDate: requestedDate.label,
      resumo: snapshot.resumo,
      html,
    };
  }

  const info = await sendHtmlReportMail({
    to: recipients,
    subject: `Relatório Geral de Pendências - snapshot ${requestedDate.label}`,
    html,
    text,
  });
  await markReportRecipientsSent(recipients);

  return {
    success: true,
    snapshot: true,
    savedSnapshot: false,
    requestedDate: requestedDate.label,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    resumo: snapshot.resumo,
  };
}

export async function sendGeneralReportEmail(body: GeneralReportRequestBody = {}): Promise<unknown> {
  if (body.requestedDate !== undefined) {
    return sendGeneralReportSnapshotEmail(body, parseRequestedDate(body.requestedDate));
  }

  const dataInicioFiltro = parseRelatorioStartDate(body.inicio);
  const dataFim = parseRelatorioEndDate(body.fim);
  const relatorio = await gerarRelatorioGeralPendencias({ dataInicioFiltro, dataFim });
  const previous = await readPreviousGeneralReportSnapshot();
  const html = buildGeneralReportEmailHtml({ relatorio, previous });
  const text = buildGeneralReportEmailText(relatorio, previous);

  if (body.dryRun) {
    return {
      success: true,
      dryRun: true,
      resumo: relatorio.resumo,
      previous: previous?.resumo || null,
      html,
    };
  }

  const recipients = await resolveReportRecipientEmails({
    requestedRecipients: body.recipients,
    mode: body.requestedBy ? "email_request" : "scheduled",
  });
  if (recipients.length === 0) {
    const error = new Error("Nenhum destinatário configurado em REPORT_GENERAL_RECIPIENTS.");
    error.name = "MissingReportRecipientsError";
    throw error;
  }

  const excel = await criarExcelRelatorioGeralPendencias(relatorio);
  const datePart = new Date().toISOString().slice(0, 10);
  const subjectSuffix = body.requestedBy ? " - solicitação em tempo real" : "";
  const info = await sendHtmlReportMail({
    to: recipients,
    subject: `Relatório Geral de Pendências - ${datePart}${subjectSuffix}`,
    html,
    text,
    attachments: [
      {
        filename: `Relatorio_Geral_Pendencias_${datePart}.xlsx`,
        content: excel,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
  await markReportRecipientsSent(recipients);

  if (body.saveSnapshot !== false) {
    await saveGeneralReportSnapshot(relatorio);
  }

  return {
    success: true,
    savedSnapshot: body.saveSnapshot !== false,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    resumo: relatorio.resumo,
  };
}

export async function processGeneralReportSchedule(now = new Date()) {
  const schedule = await getGeneralReportSchedule();
  const runKey = getScheduleRunKey(schedule, now);

  if (isScheduleDue(schedule, now)) {
    const result = await sendGeneralReportEmail({ saveSnapshot: schedule.saveSnapshot });
    await markGeneralReportScheduleEmailRun(runKey);
    if (schedule.saveSnapshot) {
      await markGeneralReportScheduleSnapshotRun(runKey);
    }

    return {
      success: true,
      action: "email_sent",
      runKey,
      schedule,
      result,
    };
  }

  if (isDefaultSnapshotDue(schedule, now)) {
    const relatorio = await createGeneralReportSnapshot();
    await markGeneralReportScheduleSnapshotRun(runKey);

    return {
      success: true,
      action: "snapshot_saved",
      runKey,
      schedule,
      resumo: relatorio.resumo,
    };
  }

  return {
    success: true,
    action: "skipped",
    runKey,
    schedule,
  };
}
