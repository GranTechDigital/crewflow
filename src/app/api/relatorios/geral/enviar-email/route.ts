import { NextRequest, NextResponse } from "next/server";
import {
  createGeneralReportSnapshot,
  GeneralReportRequestBody,
  isReportServiceAuthorized,
  sendGeneralReportEmail,
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
    const body = (await request.json().catch(() => ({}))) as GeneralReportRequestBody;

    if (body.snapshotOnly && !body.dryRun) {
      const relatorio = await createGeneralReportSnapshot(body);
      return NextResponse.json({
        success: true,
        snapshotOnly: true,
        resumo: relatorio.resumo,
      });
    }

    return NextResponse.json(await sendGeneralReportEmail(body));
  } catch (error) {
    console.error("Erro ao processar relatório geral por e-mail:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao processar relatório geral por e-mail.",
      },
      { status: error instanceof Error && error.name === "MissingReportRecipientsError" ? 503 : 500 },
    );
  }
}
