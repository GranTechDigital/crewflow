import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logHistorico } from "@/lib/historico";

type IdempotencyCacheEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const IDEMPOTENCY_MAX_ITEMS = 2000;

function getIdempotencyCache() {
  const globalRef = globalThis as unknown as {
    __tarefasConcluirIdempotencyCache?: Map<string, IdempotencyCacheEntry>;
  };
  if (!globalRef.__tarefasConcluirIdempotencyCache) {
    globalRef.__tarefasConcluirIdempotencyCache = new Map();
  }
  return globalRef.__tarefasConcluirIdempotencyCache;
}

function pruneIdempotencyCache(cache: Map<string, IdempotencyCacheEntry>) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > IDEMPOTENCY_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

const normalizarTexto = (valor: unknown) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const normalizarNumeroContrato = (valor: unknown) =>
  String(valor || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");

const ehNr26 = (tipo: unknown) =>
  normalizarTexto(tipo)
    .replace(/[^A-Z0-9]/g, "")
    .includes("NR26");

const ehNr33 = (tipo: unknown) =>
  normalizarTexto(tipo)
    .replace(/[^A-Z0-9]/g, "")
    .includes("NR33");

const tarefaConcluida = (status: string | null | undefined) =>
  status === "CONCLUIDO" || status === "CONCLUIDA";

const casoEspecialNr26Nr33Concluido = (
  tarefas: Array<{ tipo: string; status: string }>,
) => {
  const tarefasAtivas = tarefas.filter((tarefa) => tarefa.status !== "CANCELADO");
  const tarefasNr26 = tarefasAtivas.filter((tarefa) => ehNr26(tarefa.tipo));
  const tarefasNr33 = tarefasAtivas.filter((tarefa) => ehNr33(tarefa.tipo));

  if (tarefasNr26.length === 0 || tarefasNr33.length === 0) {
    return false;
  }

  const nr26Concluidas = tarefasNr26.every((tarefa) =>
    tarefaConcluida(tarefa.status),
  );
  const nr33Concluidas = tarefasNr33.every((tarefa) =>
    tarefaConcluida(tarefa.status),
  );

  return nr26Concluidas && nr33Concluidas;
};

const ehCasoEspecialSantos51Para10 = ({
  tipoSolicitacao,
  contratoOrigemNumero,
  contratoDestinoNumero,
  contratoFuncionarioNumero,
}: {
  tipoSolicitacao: unknown;
  contratoOrigemNumero: unknown;
  contratoDestinoNumero: unknown;
  contratoFuncionarioNumero: unknown;
}) =>
  (normalizarNumeroContrato(contratoFuncionarioNumero) ||
    normalizarNumeroContrato(contratoOrigemNumero)) === "4600679351" &&
  normalizarTexto(tipoSolicitacao).replace(/[^A-Z0-9]/g, "") ===
    "VINCULOADICIONAL" &&
  normalizarNumeroContrato(contratoDestinoNumero) === "4600684010";

// PUT - Concluir tarefa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const idempotencyKey =
      request.headers.get("x-idempotency-key")?.trim() || "";
    const idempotencyCache = getIdempotencyCache();
    pruneIdempotencyCache(idempotencyCache);

    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.body, {
          status: cached.status,
          headers: { "x-idempotency-replayed": "1" },
        });
      }
    }

    const responder = (body: unknown, status = 200) => {
      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          status,
          body,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }
      return NextResponse.json(body, {
        status,
        headers: idempotencyKey ? { "x-idempotency-replayed": "0" } : undefined,
      });
    };

    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);

    // Obter dados do corpo da requisição
    const body = await request.json().catch(() => ({}));
    const { dataVencimento } = body;

    // Buscar a tarefa atual
    const tarefaAtual = await prisma.tarefaRemanejamento.findUnique({
      where: { id },
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        tarefaPadraoId: true,
        treinamentoId: true,
        tipo: true,
        descricao: true,
        responsavel: true,
        status: true,
        dataLimite: true,
        dataVencimento: true,
        dataConclusao: true,
        remanejamentoFuncionario: {
          select: {
            funcionario: {
              select: { id: true, nome: true, matricula: true, funcao: true },
            },
            solicitacaoId: true,
          },
        },
      },
    });

    if (!tarefaAtual) {
      return responder(
        { error: "Tarefa não encontrada" },
        404,
      );
    }

    let exigeValidade = tarefaAtual.responsavel !== "RH";
    if (exigeValidade && tarefaAtual.treinamentoId) {
      try {
        const treino = await prisma.treinamentos.findUnique({
          where: { id: tarefaAtual.treinamentoId },
          select: { validadeValor: true, validadeUnidade: true },
        });
        if (treino) {
          const unidade = (treino.validadeUnidade || "").trim().toLowerCase();
          const valor =
            typeof treino.validadeValor === "number"
              ? treino.validadeValor
              : NaN;
          const isUnico =
            unidade.includes("unico") || unidade.includes("único");
          const isMesZero =
            (unidade.includes("mes") ||
              unidade.includes("mês") ||
              unidade.includes("meses")) &&
            Number.isFinite(valor) &&
            valor <= 0;
          if (isUnico || isMesZero) {
            exigeValidade = false;
          }
        }
      } catch (e) {
        // Em caso de falha ao consultar treinamento, manter regra padrão (exige quando não-RH)
      }
    }

    // Validação: exigir data de vencimento quando aplicável
    if (exigeValidade && !dataVencimento) {
      return responder(
        { error: "Data de vencimento é obrigatória para concluir a tarefa." },
        400,
      );
    }

    // Regra D+30: data de vencimento deve ser >= hoje + 30 dias (exceto RH)
    // Aplicar somente quando a tarefa exige validade
    if (exigeValidade && dataVencimento) {
      const minLocal = new Date();
      minLocal.setHours(0, 0, 0, 0);
      minLocal.setDate(minLocal.getDate() + 30);
      const selected = new Date(dataVencimento);
      selected.setHours(0, 0, 0, 0);
      if (selected.getTime() < minLocal.getTime()) {
        return responder(
          {
            error: "Data de vencimento deve ser pelo menos 30 dias após hoje.",
          },
          400,
        );
      }
    }

    // Idempotência sem chave: evita duplicar efeitos quando a tarefa já está concluída
    // e a data de vencimento enviada é equivalente à persistida.
    if (tarefaConcluida(tarefaAtual.status)) {
      const toDateOnly = (value: string | Date | null | undefined) => {
        if (!value) return "";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "";
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const dataAtual = toDateOnly(tarefaAtual.dataVencimento);
      const dataInformada = toDateOnly(dataVencimento || null);
      const mesmaData = !dataInformada || dataInformada === dataAtual;
      if (mesmaData) {
        return responder({ ...tarefaAtual, idempotent: true });
      }
    }

    // Preparar dados para atualização
    const updateData: {
      status: string;
      dataConclusao: Date;
      dataVencimento?: Date;
    } = {
      status: "CONCLUIDO",
      dataConclusao: new Date(),
    };

    // Adicionar data de vencimento se fornecida
    if (dataVencimento) {
      updateData.dataVencimento = new Date(dataVencimento);
    }

    // Atualizar a tarefa para concluída
    let tarefaAtualizada = await prisma.tarefaRemanejamento.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        remanejamentoFuncionarioId: true,
        tarefaPadraoId: true,
        treinamentoId: true,
        tipo: true,
        descricao: true,
        responsavel: true,
        status: true,
        dataLimite: true,
        dataVencimento: true,
        dataConclusao: true,
        observacoes: true,
        remanejamentoFuncionario: {
          select: {
            funcionario: {
              select: { id: true, nome: true, matricula: true, funcao: true },
            },
            solicitacaoId: true,
          },
        },
      },
    });

    // Registrar no histórico
    try {
      await logHistorico(request, {
        solicitacaoId: tarefaAtualizada.remanejamentoFuncionario.solicitacaoId,
        remanejamentoFuncionarioId: tarefaAtualizada.remanejamentoFuncionarioId,
        tarefaId: tarefaAtualizada.id,
        tipoAcao: "ATUALIZACAO_STATUS",
        entidade: "TAREFA",
        descricaoAcao: `Tarefa "${tarefaAtualizada.tipo}" concluída para ${tarefaAtualizada.remanejamentoFuncionario.funcionario.nome} (${tarefaAtualizada.remanejamentoFuncionario.funcionario.matricula})`,
        campoAlterado: "status",
        valorAnterior: tarefaAtual.status,
        valorNovo: "CONCLUIDO",
      });
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
    }

    try {
      const norm = (s: string | null | undefined) =>
        (s || "")
          .normalize("NFD")
          .replace(/[^A-Za-z0-9\s]/g, "")
          .trim()
          .toUpperCase();
      const detectSetor = (s: string | null | undefined) => {
        const v = norm(s);
        if (!v) return "";
        if (v.includes("TREIN")) return "TREINAMENTO";
        if (v.includes("MEDIC")) return "MEDICINA";
        if (
          v.includes("RECURSOS") ||
          v.includes("HUMANOS") ||
          v.includes(" RH") ||
          v === "RH" ||
          v.includes("RH")
        )
          return "RH";
        return v;
      };
      async function findEquipeIdBySetor(setor: string) {
        const s = norm(setor);
        if (!s) return null;
        if (s === "RH") {
          const e = await prisma.equipe.findFirst({
            where: {
              OR: [
                { nome: { contains: "RH", mode: "insensitive" } },
                { nome: { contains: "RECURSOS", mode: "insensitive" } },
                { nome: { contains: "HUMANOS", mode: "insensitive" } },
              ],
            },
            select: { id: true },
          });
          return e?.id ?? null;
        }
        if (s === "MEDICINA") {
          const e = await prisma.equipe.findFirst({
            where: { nome: { contains: "MEDIC", mode: "insensitive" } },
            select: { id: true },
          });
          return e?.id ?? null;
        }
        if (s === "TREINAMENTO") {
          const e = await prisma.equipe.findFirst({
            where: { nome: { contains: "TREIN", mode: "insensitive" } },
            select: { id: true },
          });
          return e?.id ?? null;
        }
        const e = await prisma.equipe.findFirst({
          where: { nome: { equals: s, mode: "insensitive" } },
          select: { id: true },
        });
        return e?.id ?? null;
      }
      let setorBase = "";
      if (tarefaAtualizada.treinamentoId) setorBase = "TREINAMENTO";
      if (!setorBase && tarefaAtualizada.tarefaPadraoId) {
        const tp = await prisma.tarefaPadrao.findUnique({
          where: { id: tarefaAtualizada.tarefaPadraoId },
          select: { setor: true },
        });
        setorBase = tp?.setor || "";
      }
      if (!setorBase)
        setorBase =
          tarefaAtualizada.responsavel ||
          tarefaAtualizada.tipo ||
          tarefaAtualizada.descricao ||
          "";
      const eqId = await findEquipeIdBySetor(detectSetor(setorBase));
      if (eqId) {
        try {
          tarefaAtualizada = await prisma.tarefaRemanejamento.update({
            where: { id: tarefaAtualizada.id },
            data: { setor: { connect: { id: eqId } } } as any,
            select: {
              id: true,
              remanejamentoFuncionarioId: true,
              tarefaPadraoId: true,
              treinamentoId: true,
              tipo: true,
              descricao: true,
              responsavel: true,
              status: true,
              dataLimite: true,
              dataVencimento: true,
              dataConclusao: true,
              observacoes: true,
              remanejamentoFuncionario: {
                select: {
                  funcionario: {
                    select: {
                      id: true,
                      nome: true,
                      matricula: true,
                      funcao: true,
                    },
                  },
                  solicitacaoId: true,
                },
              },
            },
          });
        } catch {}
      }
      await prisma.tarefaStatusEvento.create({
        data: {
          tarefaId: tarefaAtualizada.id,
          remanejamentoFuncionarioId:
            tarefaAtualizada.remanejamentoFuncionarioId,
          statusAnterior: tarefaAtual.status,
          statusNovo: "CONCLUIDO",
          observacoes: undefined,
          usuarioResponsavelId: usuarioAutenticado?.id ?? undefined,
        },
      });
    } catch (eventoError) {
      console.error(
        "Erro ao registrar evento de status da tarefa:",
        eventoError,
      );
    }

    // Atualizar o status das tarefas do funcionário
    await atualizarStatusTarefasFuncionario(
      tarefaAtual.remanejamentoFuncionarioId,
      usuarioAutenticado?.id,
    );

    return responder(tarefaAtualizada);
  } catch (error) {
    console.error("Erro ao concluir tarefa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

// Função auxiliar para atualizar o status das tarefas do funcionário
async function atualizarStatusTarefasFuncionario(
  remanejamentoFuncionarioId: string,
  usuarioResponsavelId?: number,
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
      tarefas.every(
        (tarefa) =>
          tarefa.status === "CONCLUIDO" ||
          tarefa.status === "CONCLUIDA" ||
          tarefa.status === "CANCELADO",
      );

    // Verificar se existe alguma tarefa de Treinamento ativa (não cancelada)
    const temTreinamentoAtivo = tarefas.some(
      (t) =>
        t.status !== "CANCELADO" &&
        (t.responsavel || "").toUpperCase().includes("TREIN"),
    );

    // Buscar o funcionário do remanejamento com a solicitação
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: remanejamentoFuncionarioId,
        },
        include: {
          solicitacao: {
            select: {
              tipo: true,
              contratoOrigem: { select: { numero: true } },
              contratoDestino: { select: { numero: true } },
            },
          },
          funcionario: {
            select: {
              contrato: { select: { numero: true } },
            },
          },
        },
      });

    if (!remanejamentoFuncionario) {
      console.error(
        "RemanejamentoFuncionario não encontrado:",
        remanejamentoFuncionarioId,
      );
      return;
    }

    const statusAnterior = remanejamentoFuncionario.statusTarefas;
    const casoEspecialSantos51Para10 = ehCasoEspecialSantos51Para10({
      tipoSolicitacao: remanejamentoFuncionario.solicitacao?.tipo,
      contratoOrigemNumero:
        remanejamentoFuncionario.solicitacao?.contratoOrigem?.numero,
      contratoDestinoNumero:
        remanejamentoFuncionario.solicitacao?.contratoDestino?.numero,
      contratoFuncionarioNumero:
        remanejamentoFuncionario.funcionario?.contrato?.numero,
    });

    const casoEspecialConcluido = casoEspecialNr26Nr33Concluido(tarefas);
    let novoStatus: "SUBMETER RASCUNHO" | "ATENDER TAREFAS" =
      casoEspecialSantos51Para10
        ? casoEspecialConcluido
          ? "SUBMETER RASCUNHO"
          : "ATENDER TAREFAS"
        : todasConcluidas
          ? "SUBMETER RASCUNHO"
          : "ATENDER TAREFAS";

    // Regra especial: se fluxo está indo para Logística (SUBMETER RASCUNHO)
    // e Treinamento está 0/0, forçar permanência em Treinamento (ATENDER TAREFAS)
    let aplicarDevolucaoTreinamento = false;
    if (
      novoStatus === "SUBMETER RASCUNHO" &&
      !temTreinamentoAtivo &&
      !casoEspecialSantos51Para10
    ) {
      novoStatus = "ATENDER TAREFAS";
      // Só notificar se houve regressão (estava em Logística e voltou)
      if (statusAnterior === "SUBMETER RASCUNHO") {
        aplicarDevolucaoTreinamento = true;
      }
    }

    const dadosUpdate: Record<string, unknown> = {
      statusTarefas: novoStatus,
    };

    await prisma.remanejamentoFuncionario.update({
      where: {
        id: remanejamentoFuncionarioId,
      },
      data: dadosUpdate,
    });

    // Registrar no histórico a mudança de status das tarefas
    try {
      await logHistorico({} as any, {
        solicitacaoId: remanejamentoFuncionario.solicitacaoId,
        remanejamentoFuncionarioId: remanejamentoFuncionarioId,
        tipoAcao: "ATUALIZACAO_STATUS",
        entidade: "STATUS_TAREFAS",
        descricaoAcao: `Status geral das tarefas atualizado para: ${novoStatus} (via conclusão de tarefa)`,
        campoAlterado: "statusTarefas",
        valorNovo: novoStatus,
      });
    } catch (historicoError) {
      console.error(
        "Erro ao registrar histórico de status das tarefas:",
        historicoError,
      );
    }

    // Quando houver devolução para Treinamento por matriz inexistente, registrar observação
    if (aplicarDevolucaoTreinamento) {
      const textoDevolucao =
        "Devolvido para TREINAMENTO automaticamente: Nenhuma tarefa de treinamento gerada (Matriz inexistente ou vazia). Necessário criar matriz.";
      try {
        const observacaoExistente =
          await prisma.observacaoRemanejamentoFuncionario.findFirst({
            where: {
              remanejamentoFuncionarioId,
              texto: {
                startsWith: textoDevolucao,
              },
            },
            select: { id: true },
          });

        if (!observacaoExistente) {
          await prisma.observacaoRemanejamentoFuncionario.create({
            data: {
              remanejamentoFuncionarioId,
              texto: textoDevolucao,
              criadoPor: "Sistema",
              modificadoPor: "Sistema",
            },
          });
        }
      } catch (e) {
        console.error(
          "Erro ao criar observação de devolução para Treinamento:",
          e,
        );
      }
    }

    // Se todas as tarefas estão concluídas E o Prestserv está aprovado,
    // verificar se todos os funcionários da solicitação estão prontos
    if (
      novoStatus === "SUBMETER RASCUNHO" &&
      remanejamentoFuncionario.statusPrestserv === "APROVADO"
    ) {
      await verificarConclusaoSolicitacao(
        remanejamentoFuncionario.solicitacaoId,
        usuarioResponsavelId,
      );
    }
  } catch (error) {
    console.error("Erro ao atualizar status das tarefas:", error);
  }
}

// Função para verificar se toda a solicitação pode ser marcada como concluída
async function verificarConclusaoSolicitacao(
  solicitacaoId: number,
  usuarioResponsavelId?: number,
) {
  try {
    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId,
      },
    });

    // Verificar se todos os funcionários têm SUBMETER RASCUNHO E Prestserv aprovado
    const todosProntos = funcionarios.every(
      (f) =>
        f.statusTarefas === "SUBMETER RASCUNHO" &&
        f.statusPrestserv === "APROVADO",
    );

    if (todosProntos) {
      // Marcar a solicitação como concluída
      await prisma.solicitacaoRemanejamento.update({
        where: {
          id: solicitacaoId,
        },
        data: {
          status: "CONCLUIDO",
          dataConclusao: new Date(),
          ...(usuarioResponsavelId
            ? {
                atualizadoPorUsuario: { connect: { id: usuarioResponsavelId } },
              }
            : {}),
          ...(usuarioResponsavelId
            ? { concluidoPorUsuario: { connect: { id: usuarioResponsavelId } } }
            : {}),
        },
      });

      console.log(
        `Solicitação de remanejamento ${solicitacaoId} marcada como concluída`,
      );
    }
  } catch (error) {
    console.error("Erro ao verificar conclusão da solicitação:", error);
  }
}
