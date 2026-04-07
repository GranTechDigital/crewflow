import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const FILTROS_TTL_MS = 10 * 60 * 1000;

type FiltrosPayload = {
  tipos: string[];
  contratos: Array<{ id: number; numero: string; nome: string }>;
  nomes: string[];
  nomeContratos: Record<string, number[]>;
  setoresEscopo: Setor[];
  setores: Setor[];
  prioridades: string[];
  status: string[];
};

type CacheEntry = {
  expiresAt: number;
  payload: FiltrosPayload;
};

type Setor = "RH" | "MEDICINA" | "TREINAMENTO";
const filtrosCache = new Map<string, CacheEntry>();

function parseSetores(searchParams: URLSearchParams): Setor[] {
  const setores = searchParams
    .getAll("setor")
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is Setor =>
      entry === "RH" || entry === "MEDICINA" || entry === "TREINAMENTO",
    );

  return Array.from(new Set(setores));
}

function getCacheKey(setoresEscopo: Setor[]): string {
  if (setoresEscopo.length === 0) return "ALL";
  return [...setoresEscopo].sort().join("|");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setoresSelecionados = parseSetores(searchParams);
    const setoresEscopo: Setor[] =
      setoresSelecionados.length > 0
        ? setoresSelecionados
        : ["RH", "MEDICINA", "TREINAMENTO"];
    const cacheKey = getCacheKey(setoresEscopo);
    const now = Date.now();
    const cached = filtrosCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload);
    }
    if (cached) {
      filtrosCache.delete(cacheKey);
    }

    const [tiposRaw, contratosRaw, nomeVinculosRaw] = await Promise.all([
      prisma.tarefaRemanejamento.findMany({
        where: {
          status: { not: "CANCELADO" },
          remanejamentoFuncionario: {
            statusTarefas: "ATENDER TAREFAS",
          },
        },
        select: { tipo: true },
        distinct: ["tipo"],
        orderBy: { tipo: "asc" },
      }),
      prisma.contrato.findMany({
        select: { id: true, numero: true, nome: true },
        orderBy: { numero: "asc" },
      }),
      prisma.remanejamentoFuncionario.findMany({
        where: {
          statusTarefas: "ATENDER TAREFAS",
          tarefas: {
            some: {
              status: { in: ["PENDENTE", "EM_ANDAMENTO", "REPROVADO"] },
              responsavel: { in: setoresEscopo },
            },
          },
        },
        select: {
          funcionario: {
            select: { nome: true },
          },
          solicitacao: {
            select: {
              contratoOrigemId: true,
              contratoDestinoId: true,
            },
          },
        },
      }),
    ]);

    const nomes = Array.from(
      new Set(
        nomeVinculosRaw
          .map((item) => (item.funcionario?.nome || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    const nomeContratos = nomeVinculosRaw.reduce<Record<string, number[]>>((acc, item) => {
      const nome = (item.funcionario?.nome || "").trim();
      if (!nome) return acc;
      const contratos = [
        item.solicitacao?.contratoOrigemId,
        item.solicitacao?.contratoDestinoId,
      ].filter(
        (id): id is number =>
          typeof id === "number" && Number.isInteger(id) && id > 0,
      );
      if (!acc[nome]) acc[nome] = [];
      acc[nome] = Array.from(new Set([...acc[nome], ...contratos]));
      return acc;
    }, {});

    const payload: FiltrosPayload = {
      tipos: tiposRaw.map((item) => item.tipo).filter(Boolean),
      contratos: contratosRaw,
      nomes,
      nomeContratos,
      setoresEscopo,
      setores: ["RH", "MEDICINA", "TREINAMENTO"],
      prioridades: ["ALTA", "MEDIA", "BAIXA", "Normal"],
      status: ["PENDENTE", "CONCLUIDO", "REPROVADO"],
    };
    filtrosCache.set(cacheKey, {
      expiresAt: now + FILTROS_TTL_MS,
      payload,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erro ao carregar filtros da tarefas v2:", error);
    return NextResponse.json(
      { error: "Erro ao carregar filtros da tarefas v2" },
      { status: 500 },
    );
  }
}
