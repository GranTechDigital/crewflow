import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NovaTarefaRemanejamento } from "@/types/remanejamento-funcionario";
import { logHistorico } from "@/lib/historico";
import { Prisma } from "@prisma/client";

// GET - Listar tarefas de remanejamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const remanejamentoFuncionarioId = searchParams.get(
      "remanejamentoFuncionarioId"
    );
    const responsavel = searchParams.get("responsavel");
    const status = searchParams.get("status");

    const where: Prisma.TarefaRemanejamentoWhereInput = {
      // Não retornar tarefas canceladas
      status: { not: "CANCELADO" },
    };

    if (remanejamentoFuncionarioId) {
      where.remanejamentoFuncionarioId = remanejamentoFuncionarioId;
    }

    if (responsavel) {
      where.responsavel = responsavel;
    }

    if (status) {
      // Mantém filtro adicional de status, mas sempre exclui CANCELADO
      where.status = { equals: status, not: "CANCELADO" } as any;
    }

    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where,
      include: {
        observacoesTarefa: true,
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
                status: true,
                statusPrestserv: true,
                emMigracao: true,
              },
            },
            solicitacao: {
              select: {
                id: true,
                contratoOrigemId: true,
                contratoDestinoId: true,
                contratoOrigem: {
                  select: {
                    id: true,
                    nome: true,
                    numero: true,
                  },
                },
                contratoDestino: {
                  select: {
                    id: true,
                    nome: true,
                    numero: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dataCriacao: "desc" },
    });

    return NextResponse.json(tarefas);
  } catch (error) {
    console.error("Erro ao listar tarefas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar nova tarefa de remanejamento
export async function POST(request: NextRequest) {
  const { getUserFromRequest } = await import("@/utils/authUtils");
  const usuarioAutenticado = await getUserFromRequest(request);
  try {
    const body: NovaTarefaRemanejamento = await request.json();

    const {
      remanejamentoFuncionarioId,
      tipo,
      descricao,
      responsavel,
      prioridade,
      dataLimite,
      dataVencimento,
    } = body;

    // Validações básicas
    if (!remanejamentoFuncionarioId) {
      return NextResponse.json(
        { error: "ID do remanejamento do funcionário é obrigatório" },
        { status: 400 }
      );
    }

    if (!tipo) {
      return NextResponse.json(
        { error: "Tipo da tarefa é obrigatório" },
        { status: 400 }
      );
    }

    if (!responsavel) {
      return NextResponse.json(
        { error: "Responsável é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se o funcionário em remanejamento existe
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: remanejamentoFuncionarioId,
        },
        include: {
          solicitacao: true,
          funcionario: {
            include: {
              uptimeSheets: true,
            },
          },
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 }
      );
    }

    // Validar se é possível reprovar tarefas baseado no status do prestserv
    if (
      remanejamentoFuncionario.statusPrestserv === "EM_AVALIACAO" ||
      remanejamentoFuncionario.statusPrestserv === "CONCLUIDO"
    ) {
      return NextResponse.json(
        {
          error:
            "Não é possível criar novas tarefas quando o prestserv está em avaliação ou concluído",
        },
        { status: 400 }
      );
    }

    // Calcular dataLimite padrão quando não informada: admissão futura +48h; caso contrário, criação +48h
    let defaultDataLimite: Date | undefined = undefined;
    try {
      const now = new Date();
      const sheets = (remanejamentoFuncionario as any)?.funcionario?.uptimeSheets || [];
      let dataAdmissao: Date | null = null;
      if (Array.isArray(sheets) && sheets.length > 0) {
        const sorted = [...sheets].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const found = sorted.find((s: any) => !!s?.dataAdmissao);
        dataAdmissao = found?.dataAdmissao ? new Date(found.dataAdmissao) : null;
      }
      if (dataAdmissao && dataAdmissao.getTime() > now.getTime()) {
        defaultDataLimite = new Date(dataAdmissao.getTime() + 48 * 60 * 60 * 1000);
      } else {
        defaultDataLimite = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      }
    } catch (e) {
      console.warn("Falha ao calcular dataLimite padrão; usando criação +48h.", e);
      defaultDataLimite = new Date(Date.now() + 48 * 60 * 60 * 1000);
    }

    // Derivar equipeId pelo setor
    const norm = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/[^A-Za-z0-9\s]/g, '').trim().toUpperCase();
    const detectSetor = (s: string | null | undefined) => {
      const v = norm(s);
      if (!v) return '';
      if (v.includes('TREIN')) return 'TREINAMENTO';
      if (v.includes('MEDIC')) return 'MEDICINA';
      if (v.includes('RECURSOS') || v.includes('HUMANOS') || v.includes(' RH') || v === 'RH' || v.includes('RH')) return 'RH';
      return v;
    };
    async function findEquipeIdBySetor(setor: string) {
      const s = norm(setor);
      if (!s) return null;
      if (s === 'RH') {
        const e = await prisma.equipe.findFirst({ where: { OR: [{ nome: { contains: 'RH', mode: 'insensitive' } }, { nome: { contains: 'RECURSOS', mode: 'insensitive' } }, { nome: { contains: 'HUMANOS', mode: 'insensitive' } }] }, select: { id: true } });
        return e?.id ?? null;
      }
      if (s === 'MEDICINA') {
        const e = await prisma.equipe.findFirst({ where: { nome: { contains: 'MEDIC', mode: 'insensitive' } }, select: { id: true } });
        return e?.id ?? null;
      }
      if (s === 'TREINAMENTO') {
        const e = await prisma.equipe.findFirst({ where: { nome: { contains: 'TREIN', mode: 'insensitive' } }, select: { id: true } });
        return e?.id ?? null;
      }
      const e = await prisma.equipe.findFirst({ where: { nome: { equals: s, mode: 'insensitive' } }, select: { id: true } });
      return e?.id ?? null;
    }

    const setorIdFromSetor = await findEquipeIdBySetor(detectSetor(responsavel));

    // Criar a tarefa
    const tarefa = await prisma.tarefaRemanejamento.create({
      data: {
        remanejamentoFuncionarioId,
        tipo,
        descricao,
        responsavel,
        prioridade: (() => {
          const base = prioridade || remanejamentoFuncionario.solicitacao?.prioridade || "media";
          const v = base.toString().toLowerCase();
          if (v === "baixa") return "BAIXA";
          if (v === "media" || v === "normal") return "MEDIA";
          if (v === "alta") return "ALTA";
          if (v === "urgente") return "URGENTE";
          return "MEDIA";
        })(),
        dataLimite: dataLimite ? new Date(dataLimite) : defaultDataLimite,
        ...(dataVencimento && { dataVencimento: new Date(dataVencimento) }),
        ...(setorIdFromSetor ? { setorId: setorIdFromSetor } : {}),
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
              },
            },
          },
        },
      },
    });

    // Registrar no histórico
    try {
      await logHistorico(request, {
        solicitacaoId: remanejamentoFuncionario.solicitacaoId!,
        remanejamentoFuncionarioId: remanejamentoFuncionarioId,
        tarefaId: tarefa.id,
        tipoAcao: "CRIACAO",
        entidade: "TAREFA",
        descricaoAcao: `Nova tarefa "${tipo}" criada para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
        observacoes: descricao || undefined,
      })
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
      // Não falha a criação da tarefa se o histórico falhar
    }

    // Atualizar o status das tarefas do funcionário
    await atualizarStatusTarefasFuncionario(
      remanejamentoFuncionarioId,
      usuarioAutenticado?.funcionario?.nome || "Sistema"
    );

    return NextResponse.json(tarefa, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar tarefa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// Função auxiliar para atualizar o status das tarefas do funcionário
async function atualizarStatusTarefasFuncionario(
  remanejamentoFuncionarioId: string,
  usuarioResponsavelNome: string
) {
  try {
    // Buscar todas as tarefas do funcionário
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId,
      },
    });

    // Verificar se todas as tarefas estão concluídas
    // Se não há tarefas, considera como concluído
    const todasConcluidas =
      tarefas.length === 0 ||
      tarefas.every((tarefa) => tarefa.status === "CONCLUIDO");

    // Atualizar o status das tarefas do funcionário
    await prisma.remanejamentoFuncionario.update({
      where: {
        id: remanejamentoFuncionarioId,
      },
      data: {
        statusTarefas: todasConcluidas
          ? "SOLICITAÇÃO CONCLUÍDA"
          : "ATENDER TAREFAS",
      },
    });

    // Atualizar também o responsável atual baseado no novo status
    const remanejamentoAtualizado =
      await prisma.remanejamentoFuncionario.findUnique({
        where: { id: remanejamentoFuncionarioId },
      });

    if (remanejamentoAtualizado) {
      // Registrar no histórico a mudança de status das tarefas
      try {
        await logHistorico({} as any, {
          solicitacaoId: remanejamentoAtualizado.solicitacaoId!,
          remanejamentoFuncionarioId: remanejamentoFuncionarioId,
          tipoAcao: "ATUALIZACAO_STATUS",
          entidade: "STATUS_TAREFAS",
          descricaoAcao: `Status geral das tarefas atualizado para: ${
            todasConcluidas ? "SOLICITAÇÃO CONCLUÍDA" : "ATENDER TAREFAS"
          }`,
          campoAlterado: "statusTarefas",
          valorNovo: todasConcluidas
            ? "SOLICITAÇÃO CONCLUÍDA"
            : "ATENDER TAREFAS",
        })
      } catch (historicoError) {
        console.error(
          "Erro ao registrar histórico de status das tarefas:",
          historicoError
        );
      }
    }
  } catch (error) {
    console.error("Erro ao atualizar status das tarefas:", error);
  }
}
