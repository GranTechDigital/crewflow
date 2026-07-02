import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUtils";
import {
  deleteReportSchedule,
  getReportSchedule,
  listReportSchedules,
  serializeSchedule,
  upsertReportSchedule,
} from "@/lib/relatorios/relatorio-agenda";
import { GENERAL_PENDING_REPORT_KEY } from "@/lib/relatorios/relatorio-destinatarios";

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

function getUpdatedBy(user: Awaited<ReturnType<typeof getUserFromRequest>>) {
  return user?.funcionario?.nome || user?.funcionario?.matricula || null;
}

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const schedules = await listReportSchedules(GENERAL_PENDING_REPORT_KEY);
  return NextResponse.json({
    success: true,
    schedules: schedules.map(serializeSchedule),
    schedule: schedules[0] ? serializeSchedule(schedules[0]) : null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const schedule = await upsertReportSchedule({
    data: {
      ...body,
      reportKey: GENERAL_PENDING_REPORT_KEY,
    },
    updatedBy: getUpdatedBy(auth.user),
  });

  return NextResponse.json({ success: true, schedule: schedule ? serializeSchedule(schedule) : null }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = parseId(body.id);
  const existing = id ? await getReportSchedule(id) : null;

  if (id && !existing) {
    return NextResponse.json({ success: false, message: "Agenda não encontrada." }, { status: 404 });
  }

  const schedule = await upsertReportSchedule({
    id,
    data: {
      ...body,
      reportKey: GENERAL_PENDING_REPORT_KEY,
    },
    updatedBy: getUpdatedBy(auth.user),
  });

  return NextResponse.json({ success: true, schedule: schedule ? serializeSchedule(schedule) : null });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const id = parseId(url.searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ success: false, message: "ID inválido." }, { status: 400 });
  }

  try {
    await deleteReportSchedule(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ success: false, message: "Agenda não encontrada." }, { status: 404 });
    }

    console.error("Erro ao remover agenda de relatório:", error);
    return NextResponse.json({ success: false, message: "Erro ao remover agenda." }, { status: 500 });
  }
}
