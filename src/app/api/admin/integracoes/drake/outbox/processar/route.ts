import { NextRequest, NextResponse } from "next/server";
import { processarOutboxDrake } from "@/lib/integracoes/outboxDrake";

export const dynamic = "force-dynamic";

type Payload = {
  ambiente?: string;
  limit?: number;
  outboxId?: number;
  eventoExternoId?: number;
  dryRun?: boolean;
  reenviarErros?: boolean;
  incluirIgnorados?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;
    const resultado = await processarOutboxDrake({
      ambiente: body.ambiente?.trim().toLowerCase() || undefined,
      limit: body.limit,
      outboxId: Number.isFinite(Number(body.outboxId)) ? Number(body.outboxId) : undefined,
      eventoExternoId: Number.isFinite(Number(body.eventoExternoId))
        ? Number(body.eventoExternoId)
        : undefined,
      dryRun: body.dryRun === true,
      reenviarErros: body.reenviarErros === true,
      incluirIgnorados: body.incluirIgnorados === true,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao processar outbox Drake:", error);
    return NextResponse.json(
      { error: "Erro ao processar outbox Drake" },
      { status: 500 },
    );
  }
}
