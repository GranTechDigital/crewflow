import { NextRequest, NextResponse } from "next/server";
import { sincronizarContratosWorkerDrake } from "@/lib/integracoes/workerContratos";

export const dynamic = "force-dynamic";

type Payload = {
  matriculas?: string[];
  matricula?: string;
  limit?: number;
  dryRun?: boolean;
  reenfileirarMesmoPayload?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;
    const matriculas = [
      ...(Array.isArray(body.matriculas) ? body.matriculas : []),
      ...(body.matricula ? [body.matricula] : []),
    ]
      .map((matricula) => String(matricula || "").trim())
      .filter(Boolean);

    const resultado = await sincronizarContratosWorkerDrake({
      matriculas,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined,
      dryRun: body.dryRun === true,
      reenfileirarMesmoPayload: body.reenfileirarMesmoPayload === true,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao preparar sincronizacao de contrato dos workers:", error);
    return NextResponse.json(
      { error: "Erro ao preparar sincronizacao de contrato dos workers" },
      { status: 500 },
    );
  }
}
