import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids") || "";
    const decoded = decodeURIComponent(idsParam);
    const ids = decoded
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (ids.length === 0) {
      return NextResponse.json({});
    }

    const obs = await prisma.observacaoTarefaRemanejamento.findMany({
      where: { tarefaId: { in: ids } },
      orderBy: { dataModificacao: "desc" },
      select: {
        id: true,
        tarefaId: true,
        texto: true,
        criadoPor: true,
        modificadoPor: true,
        dataCriacao: true,
        dataModificacao: true,
      },
    });

    const result: Record<string, { texto?: string; criadoEm?: string; criadoPor?: string; modificadoEm?: string; modificadoPor?: string }> = {};
    for (const o of obs) {
      if (!result[o.tarefaId!]) {
        result[o.tarefaId!] = {
          texto: o.texto || "",
          criadoEm: o.dataCriacao?.toISOString(),
          criadoPor: o.criadoPor || "",
          modificadoEm: o.dataModificacao?.toISOString(),
          modificadoPor: o.modificadoPor || "",
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((s: any) => typeof s === "string" && s.trim().length > 0) : [];
    if (ids.length === 0) return NextResponse.json({});

    const obs = await prisma.observacaoTarefaRemanejamento.findMany({
      where: { tarefaId: { in: ids } },
      orderBy: { dataModificacao: "desc" },
      select: {
        id: true,
        tarefaId: true,
        texto: true,
        criadoPor: true,
        modificadoPor: true,
        dataCriacao: true,
        dataModificacao: true,
      },
    });

    const result: Record<string, { texto?: string; criadoEm?: string; criadoPor?: string; modificadoEm?: string; modificadoPor?: string }> = {};
    for (const o of obs) {
      if (!result[o.tarefaId!]) {
        result[o.tarefaId!] = {
          texto: o.texto || "",
          criadoEm: o.dataCriacao?.toISOString(),
          criadoPor: o.criadoPor || "",
          modificadoEm: o.dataModificacao?.toISOString(),
          modificadoPor: o.modificadoPor || "",
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
