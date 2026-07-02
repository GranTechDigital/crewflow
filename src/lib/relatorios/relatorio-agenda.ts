import { prisma } from "@/lib/prisma";
import { GENERAL_PENDING_REPORT_KEY } from "@/lib/relatorios/relatorio-destinatarios";

export type ReportFrequency = "daily" | "weekly" | "monthly";

export type ReportScheduleConfig = {
  reportKey: string;
  active: boolean;
  frequency: ReportFrequency;
  weekdays: number[];
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  sendEmail: boolean;
  saveSnapshot: boolean;
  lastRunKey: string | null;
  lastRunAt: Date | null;
  lastSnapshotKey: string | null;
  lastSnapshotAt: Date | null;
};

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_TIME_OF_DAY = "17:30";
const DEFAULT_WEEKDAY = 5;

function normalizeFrequency(value?: string | null): ReportFrequency {
  return value === "daily" || value === "monthly" || value === "weekly" ? value : "weekly";
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [DEFAULT_WEEKDAY];
  const weekdays = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  return weekdays.length > 0 ? [...new Set(weekdays)] : [DEFAULT_WEEKDAY];
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
  if (schedule.frequency === "monthly") {
    const day = schedule.dayOfMonth || 1;
    return now.day === day;
  }
  return false;
}

export function getScheduleRunKey(schedule: ReportScheduleConfig, now = new Date()) {
  const parts = getLocalParts(now, schedule.timezone);
  if (schedule.frequency === "monthly") return `${parts.monthKey}-${String(schedule.dayOfMonth || 1).padStart(2, "0")}`;
  return parts.dateKey;
}

export function isScheduleDue(schedule: ReportScheduleConfig, now = new Date()) {
  if (!schedule.active) return false;

  const parts = getLocalParts(now, schedule.timezone);
  const runKey = getScheduleRunKey(schedule, now);

  return (
    schedule.sendEmail &&
    schedule.lastRunKey !== runKey &&
    isScheduledDay(schedule, parts) &&
    hasReachedTime(parts, schedule.timeOfDay)
  );
}

export function isDefaultSnapshotDue(schedule: ReportScheduleConfig, now = new Date()) {
  if (!schedule.active) return false;
  const parts = getLocalParts(now, schedule.timezone);
  return schedule.saveSnapshot && schedule.lastSnapshotKey !== parts.dateKey && hasReachedTime(parts, schedule.timeOfDay);
}

export function serializeSchedule(schedule: ReportScheduleConfig) {
  return {
    reportKey: schedule.reportKey,
    active: schedule.active,
    frequency: schedule.frequency,
    weekdays: schedule.weekdays,
    dayOfMonth: schedule.dayOfMonth,
    timeOfDay: schedule.timeOfDay,
    timezone: schedule.timezone,
    sendEmail: schedule.sendEmail,
    saveSnapshot: schedule.saveSnapshot,
    lastRunKey: schedule.lastRunKey,
    lastRunAt: schedule.lastRunAt,
    lastSnapshotKey: schedule.lastSnapshotKey,
    lastSnapshotAt: schedule.lastSnapshotAt,
  };
}

export async function getGeneralReportSchedule(): Promise<ReportScheduleConfig> {
  const schedule = await prisma.relatorioAgenda.findUnique({
    where: { reportKey: GENERAL_PENDING_REPORT_KEY },
  });

  if (!schedule) {
    return {
      reportKey: GENERAL_PENDING_REPORT_KEY,
      active: true,
      frequency: "weekly",
      weekdays: [DEFAULT_WEEKDAY],
      dayOfMonth: null,
      timeOfDay: DEFAULT_TIME_OF_DAY,
      timezone: DEFAULT_TIMEZONE,
      sendEmail: true,
      saveSnapshot: true,
      lastRunKey: null,
      lastRunAt: null,
      lastSnapshotKey: null,
      lastSnapshotAt: null,
    };
  }

  return {
    reportKey: schedule.reportKey,
    active: schedule.active,
    frequency: normalizeFrequency(schedule.frequency),
    weekdays: normalizeWeekdays(schedule.weekdays),
    dayOfMonth: schedule.dayOfMonth,
    timeOfDay: normalizeTimeOfDay(schedule.timeOfDay),
    timezone: schedule.timezone || DEFAULT_TIMEZONE,
    sendEmail: schedule.sendEmail,
    saveSnapshot: schedule.saveSnapshot,
    lastRunKey: schedule.lastRunKey,
    lastRunAt: schedule.lastRunAt,
    lastSnapshotKey: schedule.lastSnapshotKey,
    lastSnapshotAt: schedule.lastSnapshotAt,
  };
}

export async function upsertGeneralReportSchedule({
  data,
  updatedBy,
}: {
  data: Partial<ReportScheduleConfig>;
  updatedBy?: string | null;
}) {
  const frequency = normalizeFrequency(data.frequency);
  const payload = {
    active: data.active !== false,
    frequency,
    weekdays: frequency === "weekly" ? normalizeWeekdays(data.weekdays) : undefined,
    dayOfMonth: frequency === "monthly" ? normalizeDayOfMonth(data.dayOfMonth) || 1 : null,
    timeOfDay: normalizeTimeOfDay(data.timeOfDay),
    timezone: data.timezone || DEFAULT_TIMEZONE,
    sendEmail: data.sendEmail !== false,
    saveSnapshot: data.saveSnapshot !== false,
    updatedBy,
  };

  return prisma.relatorioAgenda.upsert({
    where: { reportKey: GENERAL_PENDING_REPORT_KEY },
    create: {
      reportKey: GENERAL_PENDING_REPORT_KEY,
      ...payload,
      createdBy: updatedBy,
    },
    update: payload,
  });
}

export async function markGeneralReportScheduleEmailRun(runKey: string) {
  await prisma.relatorioAgenda.upsert({
    where: { reportKey: GENERAL_PENDING_REPORT_KEY },
    create: {
      reportKey: GENERAL_PENDING_REPORT_KEY,
      lastRunKey: runKey,
      lastRunAt: new Date(),
    },
    update: {
      lastRunKey: runKey,
      lastRunAt: new Date(),
    },
  });
}

export async function markGeneralReportScheduleSnapshotRun(snapshotKey: string) {
  await prisma.relatorioAgenda.upsert({
    where: { reportKey: GENERAL_PENDING_REPORT_KEY },
    create: {
      reportKey: GENERAL_PENDING_REPORT_KEY,
      lastSnapshotKey: snapshotKey,
      lastSnapshotAt: new Date(),
    },
    update: {
      lastSnapshotKey: snapshotKey,
      lastSnapshotAt: new Date(),
    },
  });
}
