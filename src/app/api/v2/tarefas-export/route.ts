import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTarefaWhere, parseFiltros } from "../tarefas/_filters";

export const dynamic = "force-dynamic";

function normalizeTipoSolicitacao(raw: string | null | undefined): string {
  const tipo = (raw || "REMANEJAMENTO").toUpperCase();
  if (tipo === "ALOCACAO") return "ALOCACAO";
  if (tipo === "DESLIGAMENTO") return "DESLIGAMENTO";
  return "REMANEJAMENTO";
}

function resolveRegime(funcao: string | null | undefined, regime: string | null | undefined): string {
  const regimeBase = (regime || "").trim();
  if (regimeBase) {
    const upper = regimeBase.toUpperCase();
    if (upper.includes("OFF")) return "OFFSHORE";
    if (upper.includes("ON")) return "ONSHORE";
    return regimeBase;
  }

  const funcaoBase = (funcao || "").trim();
  if (!funcaoBase) return "N/A";
  const funcaoUpper = funcaoBase.toUpperCase();
  if (funcaoUpper.includes("OFF")) return "OFFSHORE";
  if (funcaoUpper.includes("ON")) return "ONSHORE";
  return funcaoBase;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const filtros = parseFiltros(searchParams);
    const tarefaWhere = buildTarefaWhere(filtros);

    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: tarefaWhere,
      select: {
        id: true,
        tipo: true,
        descricao: true,
        status: true,
        prioridade: true,
        responsavel: true,
        dataLimite: true,
        dataConclusao: true,
        dataCriacao: true,
        observacoesTarefa: {
          orderBy: { dataCriacao: "desc" },
          take: 1,
          select: {
            texto: true,
          },
        },
        remanejamentoFuncionario: {
          select: {
            funcionario: {
              select: {
                nome: true,
                matricula: true,
                funcao: true,
                contrato: {
                  select: {
                    numero: true,
                  },
                },
                funcaoRef: {
                  select: {
                    regime: true,
                  },
                },
              },
            },
            solicitacao: {
              select: {
                tipo: true,
                contratoOrigemId: true,
                contratoDestinoId: true,
                contratoOrigem: {
                  select: {
                    numero: true,
                  },
                },
                contratoDestino: {
                  select: {
                    numero: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const rows = tarefas.map((tarefa) => {
      const solicitacao = tarefa.remanejamentoFuncionario?.solicitacao;
      const funcionario = tarefa.remanejamentoFuncionario?.funcionario;
      const tipoSolicitacao = normalizeTipoSolicitacao(solicitacao?.tipo);

      const contratoOrigem =
        tipoSolicitacao === "ALOCACAO"
          ? "N/A"
          : solicitacao?.contratoOrigem?.numero ||
            (solicitacao?.contratoOrigemId
              ? `ID ${solicitacao.contratoOrigemId}`
              : funcionario?.contrato?.numero || "N/A");

      const contratoDestino =
        solicitacao?.contratoDestino?.numero ||
        (solicitacao?.contratoDestinoId
          ? `ID ${solicitacao.contratoDestinoId}`
          : tipoSolicitacao === "DESLIGAMENTO"
            ? "SEM DESTINO"
            : "N/A");

      return {
        tipoSolicitacao,
        contratoOrigem,
        contratoDestino,
        regime: resolveRegime(funcionario?.funcao || null, funcionario?.funcaoRef?.regime || null),
        id: tarefa.id,
        tipo: tarefa.tipo || "N/A",
        descricao: tarefa.descricao || "",
        status: tarefa.status || "N/A",
        prioridade: tarefa.prioridade || "N/A",
        dataLimite: tarefa.dataLimite ? new Date(tarefa.dataLimite).toISOString() : null,
        dataConclusao: tarefa.dataConclusao ? new Date(tarefa.dataConclusao).toISOString() : null,
        dataCriacao: tarefa.dataCriacao ? new Date(tarefa.dataCriacao).toISOString() : null,
        funcionario: funcionario?.nome || "N/A",
        matricula: funcionario?.matricula || "N/A",
        funcao: funcionario?.funcao || "N/A",
        setorResponsavel: tarefa.responsavel || "N/A",
        ultimaObservacao: tarefa.observacoesTarefa?.[0]?.texto || "N/A",
      };
    });

    const payload = {
      rows,
      totalRows: rows.length,
      metrics: {
        durationMs: Date.now() - startedAt,
      },
    };

    return NextResponse.json({
      ...payload,
      metrics: {
        ...payload.metrics,
        payloadBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
      },
    });
  } catch (error) {
    console.error("Erro ao exportar tarefas v2:", error);
    return NextResponse.json(
      { error: "Erro interno ao exportar tarefas v2" },
      { status: 500 },
    );
  }
}

