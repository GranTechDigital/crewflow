import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";

export const dynamic = "force-dynamic";

type Row = {
  key: string;
  contratoId: number;
  contratoNumero: string;
  contratoNome: string;
  funcaoId: number | null;
  funcao: string;
  regime: string | null;
  origem: "REMANEJAMENTO" | "FUNCIONARIO_ATUAL";
  prioridade: 1 | 2 | 3;
  totalFuncionarios: number;
  totalEmRemanejamento: number;
  totalAprovados: number;
  totalAguardandoAprovacao: number;
  exemplos: {
    remanejamentoId?: string;
    funcionarioId: number;
    nome: string;
    matricula: string;
    statusTarefas?: string | null;
    statusPrestserv?: string | null;
    aprovado?: boolean;
  }[];
};

type Candidate = {
  origem: "REMANEJAMENTO" | "FUNCIONARIO_ATUAL";
  remanejamentoId?: string;
  contrato: { id: number; numero: string; nome: string };
  funcionario: {
    id: number;
    nome: string;
    matricula: string;
    funcao: string | null;
    funcaoId: number | null;
    funcaoRef: { id: number; funcao: string; regime: string } | null;
  };
  statusTarefas?: string | null;
  statusPrestserv?: string | null;
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function keySlug(value?: string | null) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isOffshore(regime?: string | null) {
  return normalizeText(regime).includes("OFFSHORE");
}

function isAprovado(statusTarefas?: string | null) {
  const status = normalizeText(statusTarefas);
  if (!status) return false;
  return ![
    "APROVAR SOLICITACAO",
    "REJEITADO",
    "SOLICITACAO REJEITADA",
    "CANCELADO",
  ].includes(status);
}

function rowKey({
  contratoId,
  funcaoId,
  funcao,
  regime,
}: {
  contratoId: number;
  funcaoId?: number | null;
  funcao: string;
  regime?: string | null;
}) {
  return `${contratoId}:${funcaoId ?? keySlug(funcao)}:${normalizeText(regime)}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Token de autenticação necessário" },
        { status: 401 },
      );
    }

    const remanejamentosRaw = await prisma.remanejamentoFuncionario.findMany({
      where: {
        statusPrestserv: {
          notIn: ["CANCELADO", "CONCLUIDO", "CONCLUÍDO", "VALIDADO"],
        },
        statusTarefas: {
          notIn: ["CANCELADO", "REJEITADO", "SOLICITAÇÃO REJEITADA"],
        },
        solicitacao: {
          contratoDestinoId: { not: null },
        },
      },
      select: {
        id: true,
        statusTarefas: true,
        statusPrestserv: true,
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            funcaoId: true,
            funcaoRef: { select: { id: true, funcao: true, regime: true } },
          },
        },
        solicitacao: {
          select: {
            contratoDestino: {
              select: { id: true, numero: true, nome: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const funcionariosRaw = await prisma.funcionario.findMany({
      where: {
        matricula: { not: "ADMIN001" },
        contratoId: { not: null },
        funcao: { not: null },
      },
      select: {
        id: true,
        nome: true,
        matricula: true,
        funcao: true,
        funcaoId: true,
        status: true,
        dataDemissao: true,
        contrato: { select: { id: true, numero: true, nome: true } },
        funcaoRef: { select: { id: true, funcao: true, regime: true } },
      },
      orderBy: { nome: "asc" },
    });

    const candidates: Candidate[] = [
      ...remanejamentosRaw
        .filter((rem) => {
          const contrato = rem.solicitacao?.contratoDestino;
          return !!contrato && !!rem.funcionario?.funcao;
        })
        .map((rem) => ({
          origem: "REMANEJAMENTO" as const,
          remanejamentoId: rem.id,
          contrato: rem.solicitacao!.contratoDestino!,
          funcionario: rem.funcionario,
          statusTarefas: rem.statusTarefas,
          statusPrestserv: rem.statusPrestserv,
        })),
      ...funcionariosRaw
        .filter((funcionario) => {
          if (!funcionario.contrato || !funcionario.funcao) return false;
          if (funcionario.dataDemissao) return false;
          const status = normalizeText(funcionario.status);
          return !status.includes("DEMIT") && !status.includes("INATIVO");
        })
        .map((funcionario) => ({
          origem: "FUNCIONARIO_ATUAL" as const,
          contrato: funcionario.contrato!,
          funcionario,
          statusTarefas: null,
          statusPrestserv: null,
        })),
    ];

    const contratoIds = Array.from(new Set(candidates.map((c) => c.contrato.id)));
    const funcaoIds = Array.from(
      new Set(
        candidates
          .map((c) => c.funcionario.funcaoId)
          .filter((id): id is number => typeof id === "number"),
      ),
    );
    const funcaoSlugs = Array.from(
      new Set(candidates.map((c) => keySlug(c.funcionario.funcao)).filter(Boolean)),
    );

    const funcoesCompat =
      funcaoIds.length > 0 || funcaoSlugs.length > 0
        ? await prisma.funcao.findMany({
            where: {
              ativo: true,
              OR: [
                ...(funcaoIds.length > 0 ? [{ id: { in: funcaoIds } }] : []),
                ...(funcaoSlugs.length > 0
                  ? [{ funcao_slug: { in: funcaoSlugs } }]
                  : []),
              ],
            },
            select: { id: true, funcao: true, funcao_slug: true, regime: true },
          })
        : [];

    const idsPorSlug = new Map<string, number[]>();
    const regimePorId = new Map<number, string>();
    for (const funcao of funcoesCompat) {
      regimePorId.set(funcao.id, funcao.regime);
      const ids = idsPorSlug.get(funcao.funcao_slug) || [];
      ids.push(funcao.id);
      idsPorSlug.set(funcao.funcao_slug, ids);
    }

    const matrizAtiva = await prisma.matrizTreinamento.findMany({
      where: {
        ativo: true,
        treinamentoId: { not: null },
        tipoObrigatoriedade: { in: ["AP", "RA"] },
        contratoId: { in: contratoIds.length > 0 ? contratoIds : [-1] },
      },
      select: { contratoId: true, funcaoId: true },
    });
    const matrizKeys = new Set(
      matrizAtiva.map((item) => `${item.contratoId}:${item.funcaoId}`),
    );

    const rows = new Map<string, Row>();
    for (const candidate of candidates) {
      const funcaoNome = candidate.funcionario.funcao || "";
      const slug = keySlug(funcaoNome);
      const possibleFuncaoIds = candidate.funcionario.funcaoId
        ? [candidate.funcionario.funcaoId]
        : idsPorSlug.get(slug) || [];
      const temMatriz = possibleFuncaoIds.some((funcaoId) =>
        matrizKeys.has(`${candidate.contrato.id}:${funcaoId}`),
      );
      if (temMatriz) continue;

      const regime =
        candidate.funcionario.funcaoRef?.regime ||
        (candidate.funcionario.funcaoId
          ? regimePorId.get(candidate.funcionario.funcaoId)
          : null) ||
        null;
      const offshore = isOffshore(regime);
      const emRemanejamento = candidate.origem === "REMANEJAMENTO";
      const prioridade: 1 | 2 | 3 =
        offshore && emRemanejamento ? 1 : offshore ? 2 : 3;
      const key = rowKey({
        contratoId: candidate.contrato.id,
        funcaoId: candidate.funcionario.funcaoId,
        funcao: funcaoNome,
        regime,
      });

      const existing =
        rows.get(key) ||
        ({
          key,
          contratoId: candidate.contrato.id,
          contratoNumero: candidate.contrato.numero,
          contratoNome: candidate.contrato.nome,
          funcaoId: candidate.funcionario.funcaoId ?? null,
          funcao: funcaoNome,
          regime,
          origem: candidate.origem,
          prioridade,
          totalFuncionarios: 0,
          totalEmRemanejamento: 0,
          totalAprovados: 0,
          totalAguardandoAprovacao: 0,
          exemplos: [],
        } satisfies Row);

      existing.prioridade = Math.min(existing.prioridade, prioridade) as 1 | 2 | 3;
      if (existing.origem !== "REMANEJAMENTO" && emRemanejamento) {
        existing.origem = "REMANEJAMENTO";
      }
      existing.totalFuncionarios += 1;
      if (emRemanejamento) {
        existing.totalEmRemanejamento += 1;
        if (isAprovado(candidate.statusTarefas)) {
          existing.totalAprovados += 1;
        } else {
          existing.totalAguardandoAprovacao += 1;
        }
      }
      const exemplo = {
        remanejamentoId: candidate.remanejamentoId,
        funcionarioId: candidate.funcionario.id,
        nome: candidate.funcionario.nome,
        matricula: candidate.funcionario.matricula,
        statusTarefas: candidate.statusTarefas,
        statusPrestserv: candidate.statusPrestserv,
        aprovado: emRemanejamento ? isAprovado(candidate.statusTarefas) : undefined,
      };
      if (emRemanejamento) {
        existing.exemplos = [
          exemplo,
          ...existing.exemplos.filter((item) => item.remanejamentoId),
        ].slice(0, 5);
      } else if (existing.totalEmRemanejamento === 0 && existing.exemplos.length < 5) {
        existing.exemplos.push(exemplo);
      }

      rows.set(key, existing);
    }

    const data = Array.from(rows.values())
      .filter((row) => row.totalFuncionarios > 0)
      .sort((a, b) => {
        if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
        if (b.totalEmRemanejamento !== a.totalEmRemanejamento) {
          return b.totalEmRemanejamento - a.totalEmRemanejamento;
        }
        return `${a.contratoNumero} ${a.funcao}`.localeCompare(
          `${b.contratoNumero} ${b.funcao}`,
          "pt-BR",
        );
      });

    return NextResponse.json({
      success: true,
      data,
      resumo: {
        total: data.length,
        offshore: data.filter((row) => isOffshore(row.regime)).length,
        offshoreEmRemanejamento: data.filter(
          (row) => row.prioridade === 1,
        ).length,
        comRemanejamento: data.filter((row) => row.totalEmRemanejamento > 0)
          .length,
        aprovados: data.filter((row) => row.totalAprovados > 0).length,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar funções sem matriz:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao buscar funções sem matriz",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
