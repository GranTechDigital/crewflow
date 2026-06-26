import { NextRequest, NextResponse } from "next/server";
import { listGeneralReportSnapshots } from "@/lib/relatorios/geral-pendencias-email";
import {
  createGeneralReportSnapshot,
  isReportServiceAuthorized,
} from "@/lib/relatorios/geral-pendencias-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  if (!isReportServiceAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Token de serviço inválido ou não configurado." },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const snapshots = await listGeneralReportSnapshots({
      limit: Number(searchParams.get("limit") || "30"),
      from: parseDateTime(searchParams.get("from")),
      to: parseDateTime(searchParams.get("to")),
    });

    return NextResponse.json(
      { success: true, snapshots },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Erro ao listar snapshots do relatório geral:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Erro ao listar snapshots." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isReportServiceAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Token de serviço inválido ou não configurado." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { inicio?: string; fim?: string };
    const relatorio = await createGeneralReportSnapshot(body);

    return NextResponse.json({
      success: true,
      snapshotOnly: true,
      resumo: relatorio.resumo,
    });
  } catch (error) {
    console.error("Erro ao salvar snapshot do relatório geral:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Erro ao salvar snapshot." },
      { status: 500 },
    );
  }
}
