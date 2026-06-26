import { NextRequest, NextResponse } from "next/server";
import {
  gerarRelatorioGeralPendencias,
  parseRelatorioEndDate,
  parseRelatorioStartDate,
} from "@/lib/relatorios/geral-pendencias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataInicioFiltro = parseRelatorioStartDate(searchParams.get("inicio"));
    const dataFim = parseRelatorioEndDate(searchParams.get("fim"));
    const relatorio = await gerarRelatorioGeralPendencias({ dataInicioFiltro, dataFim });

    return NextResponse.json(relatorio, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar relatório geral:", error);
    return NextResponse.json(
      { success: false, message: "Erro ao gerar relatório geral." },
      { status: 500 },
    );
  }
}
