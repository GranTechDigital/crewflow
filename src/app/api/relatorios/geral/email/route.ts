import { NextRequest, NextResponse } from "next/server";
import {
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
    const result = await sendGeneralReportEmail(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao enviar relatório geral por e-mail:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao enviar relatório geral por e-mail.",
      },
      { status: error instanceof Error && error.name === "MissingReportRecipientsError" ? 503 : 500 },
    );
  }
}
