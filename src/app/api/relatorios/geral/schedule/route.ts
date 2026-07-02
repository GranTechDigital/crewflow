import { NextRequest, NextResponse } from "next/server";
import {
  isReportServiceAuthorized,
  processGeneralReportSchedule,
} from "@/lib/relatorios/geral-pendencias-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isReportServiceAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Token de serviço inválido ou não configurado." },
      { status: 401 },
    );
  }

  try {
    const result = await processGeneralReportSchedule();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Erro ao processar agenda do relatório geral:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao processar agenda do relatório geral.",
      },
      { status: error instanceof Error && error.name === "MissingReportRecipientsError" ? 503 : 500 },
    );
  }
}
