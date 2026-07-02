import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUtils";
import {
  getGeneralReportSchedule,
  serializeSchedule,
  upsertGeneralReportSchedule,
} from "@/lib/relatorios/relatorio-agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 }) };
  }

  if (user.equipe?.nome !== "Administração") {
    return { error: NextResponse.json({ success: false, message: "Acesso restrito à Administração." }, { status: 403 }) };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const schedule = await getGeneralReportSchedule();
  return NextResponse.json({ success: true, schedule: serializeSchedule(schedule) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const schedule = await upsertGeneralReportSchedule({
    data: body,
    updatedBy: auth.user.funcionario?.nome || auth.user.funcionario?.matricula || null,
  });

  return NextResponse.json({
    success: true,
    schedule: serializeSchedule({
      reportKey: schedule.reportKey,
      active: schedule.active,
      frequency: schedule.frequency as any,
      weekdays: Array.isArray(schedule.weekdays) ? schedule.weekdays.map(Number) : [5],
      dayOfMonth: schedule.dayOfMonth,
      timeOfDay: schedule.timeOfDay,
      timezone: schedule.timezone,
      sendEmail: schedule.sendEmail,
      saveSnapshot: schedule.saveSnapshot,
      lastRunKey: schedule.lastRunKey,
      lastRunAt: schedule.lastRunAt,
      lastSnapshotKey: schedule.lastSnapshotKey,
      lastSnapshotAt: schedule.lastSnapshotAt,
    }),
  });
}
