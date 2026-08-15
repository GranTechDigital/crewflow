import { NextRequest, NextResponse } from "next/server";
import { reenfileirarOutboxDrake } from "@/lib/integracoes/outboxDrake";

export const dynamic = "force-dynamic";

type Payload = {
  ambiente?: string;
  outboxId?: number;
  eventoExternoId?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Payload;
    const resultado = await reenfileirarOutboxDrake({
      ambiente: body.ambiente?.trim().toLowerCase() || undefined,
      outboxId: Number.isFinite(Number(body.outboxId)) ? Number(body.outboxId) : undefined,
      eventoExternoId: Number.isFinite(Number(body.eventoExternoId))
        ? Number(body.eventoExternoId)
        : undefined,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao reenfileirar outbox Drake:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao reenfileirar outbox Drake" },
      { status: 500 },
    );
  }
}
