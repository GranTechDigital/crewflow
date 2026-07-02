import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GENERAL_PENDING_REPORT_KEY, normalizeReportEmail } from "@/lib/relatorios/relatorio-destinatarios";

export type ReportFrequency = "daily" | "weekly" | "monthly";

export type ReportScheduleConfig = {
  id: number | null;
  reportKey: string;
  name: string;
  active: boolean;
  frequency: ReportFrequency;
  weekdays: number[];
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  sendEmail: boolean;
  saveSnapshot: boolean;
  filters: Prisma.JsonValue | null;
  recipientIds: number[];
  recipients: Array<{
    id: number;
    name: string;
    email: string;
    active: boolean;
    receivesScheduledEmail: boolean;
  }>;
  lastRunKey: string | null;
  lastRunAt: Date | null;
  lastSnapshotKey: string | null;
  lastSnapshotAt: Date | null;
};

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_TIME_OF_DAY = "17:30";
const DEFAULT_WEEKDAY = 5;
const DEFAULT_GENERAL_SCHEDULE_NAME = "Relatório geral semanal";

type ScheduleWithRecipients = Awaited<ReturnType<typeof prisma.relatorioAgenda.findMany>>[number] & {
  destinatarios?: Array<{
    destinatario: {
      id: number;
      name: string;
      email: string;
      active: boolean;
      receivesScheduledEmail: boolean;
    };
  }>;
};

function normalizeFrequency(value?: string | null): ReportFrequency {
  return value === "daily" || value === "monthly" || value === "weekly" ? value : "weekly";
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [DEFAULT_WEEKDAY];
  const weekdays = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  return weekdays.length > 0 ? [...new Set(weekdays)].sort((a, b) => a - b) : [DEFAULT_WEEKDAY];
}

export function normalizeTimeOfDay(value?: string | null) {
  const raw = String(value || DEFAULT_TIME_OF_DAY).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_TIME_OF_DAY;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_TIME_OF_DAY;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeDayOfMonth(value: unknown) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function normalizeScheduleName(value: unknown) {
  const name = String(value || "").trim();
  return name || DEFAULT_GENERAL_SCHEDULE_NAME;
}

function getLocalParts(date: Date, timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const minute = read("minute");
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: utcNoon.getUTCDay(),
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function hasReachedTime(now: ReturnType<typeof getLocalParts>, timeOfDay: string) {
  const [hour, minute] = normalizeTimeOfDay(timeOfDay).split(":").map(Number);
  return now.hour > hour || (now.hour === hour && now.minute >= minute);
}

function isScheduledDay(schedule: ReportScheduleConfig, now: ReturnType<typeof getLocalParts>) {
  if (schedule.frequency === "daily") return true;
  if (schedule.frequency === "weekly") return schedule.weekdays.includes(now.weekday);
  if (schedule.frequency === "monthly") return now.day === (schedule.dayOfMonth || 1);
  return false;
}

function scheduleFromRecord(schedule: ScheduleWithRecipients): ReportScheduleConfig {
  const recipients = (schedule.destinatarios || [])
    .map((item) => item.destinatario)
    .filter(Boolean)
    .map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      email: normalizeReportEmail(recipient.email),
      active: recipient.active,
      receivesScheduledEmail: recipient.receivesScheduledEmail,
    }));

  return {
    id: schedule.id,
    reportKey: schedule.reportKey,
    name: schedule.name || DEFAULT_GENERAL_SCHEDULE_NAME,
    active: schedule.active,
    frequency: normalizeFrequency(schedule.frequency),
    weekdays: normalizeWeekdays(schedule.weekdays),
    dayOfMonth: schedule.dayOfMonth,
    timeOfDay: normalizeTimeOfDay(schedule.timeOfDay),
    timezone: schedule.timezone || DEFAULT_TIMEZONE,
    sendEmail: schedule.sendEmail,
    saveSnapshot: schedule.saveSnapshot,
    filters: schedule.filters ?? null,
    recipientIds: recipients.map((recipient) => recipient.id),
    recipients,
    lastRunKey: schedule.lastRunKey,
    lastRunAt: schedule.lastRunAt,
    lastSnapshotKey: schedule.lastSnapshotKey,
    lastSnapshotAt: schedule.lastSnapshotAt,
  };
}

function buildFallbackGeneralSchedule(): ReportScheduleConfig {
  return {
    id: null,
    reportKey: GENERAL_PENDING_REPORT_KEY,
    name: DEFAULT_GENERAL_SCHEDULE_NAME,
    active: true,
    frequency: "weekly",
    weekdays: [DEFAULT_WEEKDAY],
    dayOfMonth: null,
    timeOfDay: DEFAULT_TIME_OF_DAY,
    timezone: DEFAULT_TIMEZONE,
    sendEmail: true,
    saveSnapshot: true,
    filters: null,
    recipientIds: [],
    recipients: [],
    lastRunKey: null,
    lastRunAt: null,
    lastSnapshotKey: null,
    lastSnapshotAt: null,
  };
}

export function getScheduleRunKey(schedule: ReportScheduleConfig, now = new Date()) {
  const parts = getLocalParts(now, schedule.timezone);
  if (schedule.frequency === "monthly") return `${parts.monthKey}-${String(schedule.dayOfMonth || 1).padStart(2, "0")}`;
  return parts.dateKey;
}

export function getScheduleSnapshotKey(schedule: ReportScheduleConfig, now = new Date()) {
  return getLocalParts(now, schedule.timezone).dateKey;
}

export function isScheduleDue(schedule: ReportScheduleConfig, now = new Date()) {
  if (!schedule.active || !schedule.sendEmail) return false;

  const parts = getLocalParts(now, schedule.timezone);
  const runKey = getScheduleRunKey(schedule, now);

  return schedule.lastRunKey !== runKey && isScheduledDay(schedule, parts) && hasReachedTime(parts, schedule.timeOfDay);
}

export function isSnapshotDue(schedule: ReportScheduleConfig, now = new Date()) {
  if (!schedule.active || !schedule.saveSnapshot) return false;

  const parts = getLocalParts(now, schedule.timezone);
  const snapshotKey = getScheduleSnapshotKey(schedule, now);

  return schedule.lastSnapshotKey !== snapshotKey && isScheduledDay(schedule, parts) && hasReachedTime(parts, schedule.timeOfDay);
}

export function serializeSchedule(schedule: ReportScheduleConfig) {
  return {
    id: schedule.id,
    reportKey: schedule.reportKey,
    name: schedule.name,
    active: schedule.active,
    frequency: schedule.frequency,
    weekdays: schedule.weekdays,
    dayOfMonth: schedule.dayOfMonth,
    timeOfDay: schedule.timeOfDay,
    timezone: schedule.timezone,
    sendEmail: schedule.sendEmail,
    saveSnapshot: schedule.saveSnapshot,
    filters: schedule.filters,
    recipientIds: schedule.recipientIds,
    recipients: schedule.recipients,
    lastRunKey: schedule.lastRunKey,
    lastRunAt: schedule.lastRunAt,
    lastSnapshotKey: schedule.lastSnapshotKey,
    lastSnapshotAt: schedule.lastSnapshotAt,
  };
}

export async function listReportSchedules(reportKey = GENERAL_PENDING_REPORT_KEY) {
  const schedules = await prisma.relatorioAgenda.findMany({
    where: { reportKey },
    include: {
      destinatarios: {
        include: {
          destinatario: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
              receivesScheduledEmail: true,
            },
          },
        },
        orderBy: { destinatario: { name: "asc" } },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
  });

  return schedules.map(scheduleFromRecord);
}

export async function getReportSchedule(id: number) {
  const schedule = await prisma.relatorioAgenda.findUnique({
    where: { id },
    include: {
      destinatarios: {
        include: {
          destinatario: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
              receivesScheduledEmail: true,
            },
          },
        },
      },
    },
  });

  return schedule ? scheduleFromRecord(schedule) : null;
}

export async function listGeneralReportSchedulesWithFallback() {
  const schedules = await listReportSchedules(GENERAL_PENDING_REPORT_KEY);
  return schedules.length > 0 ? schedules : [buildFallbackGeneralSchedule()];
}

export async function upsertReportSchedule({
  id,
  data,
  updatedBy,
}: {
  id?: number | null;
  data: Partial<ReportScheduleConfig>;
  updatedBy?: string | null;
}) {
  const frequency = normalizeFrequency(data.frequency);
  const recipientIds = Array.isArray(data.recipientIds)
    ? [...new Set(data.recipientIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
    : [];
  const reportKey = data.reportKey || GENERAL_PENDING_REPORT_KEY;
  const payload = {
    reportKey,
    name: normalizeScheduleName(data.name),
    active: data.active !== false,
    frequency,
    weekdays: frequency === "weekly" ? normalizeWeekdays(data.weekdays) : Prisma.JsonNull,
    dayOfMonth: frequency === "monthly" ? normalizeDayOfMonth(data.dayOfMonth) || 1 : null,
    timeOfDay: normalizeTimeOfDay(data.timeOfDay),
    timezone: data.timezone || DEFAULT_TIMEZONE,
    sendEmail: data.sendEmail !== false,
    saveSnapshot: data.saveSnapshot !== false,
    filters: (data.filters ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    updatedBy,
  };

  const schedule = await prisma.$transaction(async (tx) => {
    const saved = id
      ? await tx.relatorioAgenda.update({
          where: { id },
          data: payload,
        })
      : await tx.relatorioAgenda.create({
          data: {
            ...payload,
            createdBy: updatedBy,
          },
        });

    await tx.relatorioAgendaDestinatario.deleteMany({ where: { agendaId: saved.id } });
    if (recipientIds.length > 0) {
      const validRecipients = await tx.relatorioDestinatario.findMany({
        where: {
          id: { in: recipientIds },
          reportKey,
        },
        select: { id: true },
      });

      await tx.relatorioAgendaDestinatario.createMany({
        data: validRecipients.map((recipient) => ({
          agendaId: saved.id,
          destinatarioId: recipient.id,
        })),
        skipDuplicates: true,
      });
    }

    return saved;
  });

  return getReportSchedule(schedule.id);
}

export async function deleteReportSchedule(id: number) {
  await prisma.relatorioAgenda.delete({ where: { id } });
}

export async function markReportScheduleEmailRun(schedule: ReportScheduleConfig, runKey: string) {
  if (schedule.id) {
    await prisma.relatorioAgenda.update({
      where: { id: schedule.id },
      data: {
        lastRunKey: runKey,
        lastRunAt: new Date(),
      },
    });
    return;
  }

  await prisma.relatorioAgenda.create({
    data: {
      reportKey: schedule.reportKey,
      name: schedule.name,
      frequency: schedule.frequency,
      weekdays: schedule.weekdays,
      dayOfMonth: schedule.dayOfMonth,
      timeOfDay: schedule.timeOfDay,
      timezone: schedule.timezone,
      sendEmail: schedule.sendEmail,
      saveSnapshot: schedule.saveSnapshot,
      lastRunKey: runKey,
      lastRunAt: new Date(),
    },
  });
}

export async function markReportScheduleSnapshotRun(schedule: ReportScheduleConfig, snapshotKey: string) {
  if (schedule.id) {
    await prisma.relatorioAgenda.update({
      where: { id: schedule.id },
      data: {
        lastSnapshotKey: snapshotKey,
        lastSnapshotAt: new Date(),
      },
    });
    return;
  }

  await prisma.relatorioAgenda.create({
    data: {
      reportKey: schedule.reportKey,
      name: schedule.name,
      frequency: schedule.frequency,
      weekdays: schedule.weekdays,
      dayOfMonth: schedule.dayOfMonth,
      timeOfDay: schedule.timeOfDay,
      timezone: schedule.timezone,
      sendEmail: schedule.sendEmail,
      saveSnapshot: schedule.saveSnapshot,
      lastSnapshotKey: snapshotKey,
      lastSnapshotAt: new Date(),
    },
  });
}
