import { prisma } from "@/lib/prisma";

const SETORES_VALIDOS = ["RH", "MEDICINA", "TREINAMENTO"] as const;
export type SetorValido = (typeof SETORES_VALIDOS)[number];

function normalizarSetor(setor: string): SetorValido | null {
  const s = (setor || "").toUpperCase();
  return SETORES_VALIDOS.includes(s as SetorValido) ? (s as SetorValido) : null;
}

function chaveTarefa(tipo: string, responsavel: string) {
  return `${responsavel}|${tipo}`.toUpperCase();
}

export interface SincronizarInput {
  setores?: string[]; // ex.: ["TREINAMENTO"], ["RH"], ["MEDICINA"], ou combinação
  usuarioResponsavel?: string; // nome de quem disparou
  usuarioResponsavelId?: number; // id do usuário humano gatilho
  equipeId?: number; // equipe do usuário humano gatilho
  funcionarioIds?: number[]; // opcional: restringe aos remanejamentos destes funcionários
  remanejamentoIds?: string[]; // opcional: restringe pelos IDs de remanejamentoFuncionario
}

export interface SincronizarResultadoItem {
  remanejamentoId: string;
  tarefasCriadas: number;
  tarefasCanceladas?: number;
  setores: string[];
}

export interface SincronizarResultado {
  message: string;
  totalRemanejamentos: number;
  totalTarefasCriadas: number;
  totalTarefasCanceladas?: number;
  detalhes: SincronizarResultadoItem[];
}

// Função reutilizável para sincronização de tarefas faltantes em remanejamentos com status "ATENDER TAREFAS"
export async function sincronizarTarefasPadrao({
  setores: setoresInput,
  usuarioResponsavel,
  usuarioResponsavelId,
  equipeId,
  funcionarioIds,
  remanejamentoIds,
}: SincronizarInput): Promise<SincronizarResultado> {
  const setoresNormalizados: SetorValido[] = [];
  const baseSetores =
    Array.isArray(setoresInput) && setoresInput.length > 0
      ? setoresInput
      : (SETORES_VALIDOS as unknown as string[]);
  for (const s of baseSetores) {
    const n = normalizarSetor(s);
    if (n) setoresNormalizados.push(n);
  }

  if (setoresNormalizados.length === 0) {
    return {
      message: `Nenhum setor válido informado. Válidos: ${SETORES_VALIDOS.join(
        ", "
      )}`,
      totalRemanejamentos: 0,
      totalTarefasCriadas: 0,
      detalhes: [],
    };
  }

  const whereRemanejamentos: any = {
    statusTarefas: { in: ["ATENDER TAREFAS", "SUBMETER RASCUNHO"] },
    statusPrestserv: {
      notIn: ["EM_AVALIACAO", "CONCLUIDO", "CANCELADO"],
    },
  };

  if (Array.isArray(funcionarioIds) && funcionarioIds.length > 0) {
    whereRemanejamentos.funcionarioId = { in: funcionarioIds };
  }

  if (Array.isArray(remanejamentoIds) && remanejamentoIds.length > 0) {
    whereRemanejamentos.id = { in: remanejamentoIds };
  }

  const rems = await prisma.remanejamentoFuncionario.findMany({
    where: whereRemanejamentos,
    include: {
      funcionario: {
        select: { id: true, nome: true, matricula: true, funcao: true },
      },
      solicitacao: {
        select: { id: true, contratoDestinoId: true, prioridade: true },
      },
      tarefas: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (rems.length === 0) {
    return {
      message: "Nenhum remanejamento aberto para sincronizar",
      totalRemanejamentos: 0,
      totalTarefasCriadas: 0,
      detalhes: [],
    };
  }

  let totalCriadas = 0;
  let totalCanceladas = 0;
  const detalhes: SincronizarResultadoItem[] = [];

  for (const rem of rems) {
    const existentes = new Set<string>(
      rem.tarefas.map((t) => chaveTarefa(t.tipo, t.responsavel))
    );
    const existentePorChave = new Map<string, typeof rem.tarefas[number]>(
      rem.tarefas.map((t) => [chaveTarefa(t.tipo, t.responsavel), t])
    );
    const tarefasParaCriar: any[] = [];
    const tarefasParaCancelar: {
      id: string;
      statusAnterior: string;
      responsavel: SetorValido;
    }[] = [];
    const tarefasParaReativar: {
      id: string;
      responsavel: SetorValido;
      statusAnterior: string;
    }[] = [];

    // Helper para identificar equipe por setor
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

    // TREINAMENTO via matriz
    if (setoresNormalizados.includes("TREINAMENTO")) {
      const contratoId = rem.solicitacao?.contratoDestinoId || undefined;
      const funcaoNome = rem.funcionario?.funcao || undefined;

      if (contratoId && funcaoNome) {
        const funcao = await prisma.funcao.findFirst({
          where: { funcao: funcaoNome },
        });
        if (funcao) {
          // Buscar somente treinamentos obrigatórios ativos para criação
          const matrizObrigatoria = await prisma.matrizTreinamento.findMany({
            where: {
              contratoId,
              funcaoId: funcao.id,
              ativo: true,
              tipoObrigatoriedade: "AP",
            },
            include: { treinamento: true, contrato: true },
          });

          // Set de treinamentos mandatórios (chaves) para comparação
          const mandatariosSet = new Set<string>(
            matrizObrigatoria
              .map((m) =>
                chaveTarefa(m.treinamento?.treinamento || "", "TREINAMENTO")
              )
              .filter((k) => !!k.trim())
          );

          // Criar faltantes
          for (const m of matrizObrigatoria) {
            const tipo = m.treinamento?.treinamento || "";
            const resp = "TREINAMENTO";
            if (!tipo) continue;
            const chave = chaveTarefa(tipo, resp);
            if (existentes.has(chave)) {
              const existente = existentePorChave.get(chave);
              if (existente && existente.status === "CANCELADO") {
                tarefasParaReativar.push({
                  id: existente.id,
                  responsavel: "TREINAMENTO",
                  statusAnterior: existente.status,
                });
                continue;
              }
              continue;
            }

            const prioridade = (() => {
              const v = (rem.solicitacao?.prioridade || "media").toLowerCase();
              if (v === "baixa") return "BAIXA";
              if (v === "media") return "MEDIA";
              if (v === "alta") return "ALTA";
              if (v === "urgente") return "URGENTE";
              return "MEDIA";
            })();

            const descricao = `Treinamento: ${
              m.treinamento?.treinamento
            }\nCarga Horária: ${
              m.treinamento?.cargaHoraria ?? "N/A"
            }\nValidade: ${m.treinamento?.validadeValor ?? "N/A"} ${
              m.treinamento?.validadeUnidade ?? ""
            }\nTipo: ${m.tipoObrigatoriedade}\nContrato: ${
              m.contrato?.nome ?? "N/A"
            }`;

            tarefasParaCriar.push({
              remanejamentoFuncionarioId: rem.id,
              tipo,
              descricao,
              responsavel: resp,
              status: "PENDENTE",
              prioridade,
              dataLimite: new Date(Date.now() + 48 * 60 * 60 * 1000),
              setorId: await findEquipeIdBySetor(detectSetor(resp)) ?? undefined,
            });
          }

          // Remover (cancelar) tarefas de treinamento que não são mais obrigatórias
          const tarefasTreinamentoExistentes = rem.tarefas.filter(
            (t) => t.responsavel === "TREINAMENTO"
          );
          for (const t of tarefasTreinamentoExistentes) {
            const chave = chaveTarefa(t.tipo, t.responsavel);
            const deveManter = mandatariosSet.has(chave);
            const podeCancelar =
              t.status !== "CANCELADO" && t.status !== "CONCLUIDO"; // preservar conclusões
            if (!deveManter && podeCancelar) {
              tarefasParaCancelar.push({
                id: t.id,
                statusAnterior: t.status,
                responsavel: "TREINAMENTO",
              });
            }
          }
        }
      }
    }

    // RH e MEDICINA via tarefas padrão (criação faltantes e cancelamento retroativo)
    for (const setor of setoresNormalizados) {
      if (setor === "TREINAMENTO") continue;
      const tarefasPadrao = await prisma.tarefaPadrao.findMany({
        where: { setor, ativo: true },
        select: { tipo: true, descricao: true },
      });

      // Criar faltantes
      for (const t of tarefasPadrao) {
        const tipo = t.tipo;
        const resp = setor;
        const chave = chaveTarefa(tipo, resp);
        if (existentes.has(chave)) {
          const existente = existentePorChave.get(chave);
          if (existente && existente.status === "CANCELADO") {
            tarefasParaReativar.push({
              id: existente.id,
              responsavel: setor,
              statusAnterior: existente.status,
            });
            continue;
          }
          continue;
        }
        const prioridade = (() => {
          const v = (rem.solicitacao?.prioridade || "media").toLowerCase();
          if (v === "baixa") return "BAIXA";
          if (v === "media") return "MEDIA";
          if (v === "alta") return "ALTA";
          if (v === "urgente") return "URGENTE";
          return "MEDIA";
        })();
        tarefasParaCriar.push({
          remanejamentoFuncionarioId: rem.id,
          tipo,
          descricao: t.descricao,
          responsavel: resp,
          status: "PENDENTE",
          prioridade,
          dataLimite: new Date(Date.now() + 48 * 60 * 60 * 1000),
          setorId: await findEquipeIdBySetor(detectSetor(resp)) ?? undefined,
        });
      }

      // Cancelar tarefas do setor que não constam mais nas tarefas padrão ativas
      const mandatariosPadraoSet = new Set<string>(
        tarefasPadrao.map((tp) => chaveTarefa(tp.tipo, setor))
      );
      const tarefasSetorExistentes = rem.tarefas.filter(
        (t) => t.responsavel === setor
      );
      for (const t of tarefasSetorExistentes) {
        const chave = chaveTarefa(t.tipo, t.responsavel);
        const deveManter = mandatariosPadraoSet.has(chave);
        const podeCancelar =
          t.status !== "CANCELADO" && t.status !== "CONCLUIDO";
        if (!deveManter && podeCancelar) {
          tarefasParaCancelar.push({
            id: t.id,
            statusAnterior: t.status,
            responsavel: setor,
          });
        }
      }
    }

    // Aplicar criações
    let criadasCount = 0;
    if (tarefasParaCriar.length > 0) {
      const result = await prisma.tarefaRemanejamento.createMany({
        data: tarefasParaCriar,
        skipDuplicates: true,
      });
      criadasCount = result.count;
      totalCriadas += result.count;

      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: rem.solicitacao!.id,
            remanejamentoFuncionarioId: rem.id,
            tipoAcao: "CRIACAO",
            entidade: "TAREFA",
            descricaoAcao: `${
              result.count
            } novas tarefas sincronizadas a partir de matriz/pareceres para ${
              rem.funcionario?.nome
            } (${
              rem.funcionario?.matricula
            }) - Setores: ${setoresNormalizados.join(", ")}`,
            usuarioResponsavel: usuarioResponsavel || "Sistema",
            usuarioResponsavelId: usuarioResponsavelId,
            equipeId: equipeId,
          },
        });
      } catch (e) {
        console.error("Erro ao registrar histórico de sincronização:", e);
      }
    }

    // Aplicar cancelamentos (TREINAMENTO, RH e MEDICINA)
    let canceladasCount = 0;
    if (tarefasParaCancelar.length > 0) {
      for (const tc of tarefasParaCancelar) {
        try {
          await prisma.tarefaRemanejamento.update({
            where: { id: tc.id },
            data: { status: "CANCELADO" },
          });

          // Observação da tarefa (mensagem contextual por setor)
          try {
            await prisma.observacaoTarefaRemanejamento.create({
              data: {
                tarefaId: tc.id,
                texto:
                  tc.responsavel === "TREINAMENTO"
                    ? "Cancelada automaticamente: treinamento marcado como não obrigatório na matriz"
                    : "Cancelada automaticamente: tarefa padrão desativada/removida",
                criadoPor: usuarioResponsavel || "Sistema",
                modificadoPor: usuarioResponsavel || "Sistema",
              },
            });
          } catch (obsErr) {
            console.error(
              "Erro ao registrar observação de cancelamento:",
              obsErr
            );
          }

          // Histórico (mensagem contextual por setor)
          try {
            await prisma.historicoRemanejamento.create({
              data: {
                solicitacaoId: rem.solicitacao!.id,
                remanejamentoFuncionarioId: rem.id,
                tarefaId: tc.id,
                tipoAcao: "CANCELAMENTO",
                entidade: "TAREFA",
                campoAlterado: "status",
                valorAnterior: tc.statusAnterior,
                valorNovo: "CANCELADO",
                descricaoAcao:
                  tc.responsavel === "TREINAMENTO"
                    ? "Tarefa de TREINAMENTO cancelada por não obrigatoriedade na matriz"
                    : `Tarefa de ${tc.responsavel} cancelada por desativação/remoção nas Tarefas Padrão`,
                usuarioResponsavel: usuarioResponsavel || "Sistema",
                usuarioResponsavelId: usuarioResponsavelId,
                equipeId: equipeId,
              },
            });
          } catch (histErr) {
            console.error(
              "Erro ao registrar histórico de cancelamento:",
              histErr
            );
          }

          canceladasCount += 1;
          totalCanceladas += 1;
        } catch (cancelErr) {
          console.error("Erro ao cancelar tarefa:", cancelErr);
        }
      }
    }

    let reativadasCount = 0;
    if (tarefasParaReativar.length > 0) {
      for (const tr of tarefasParaReativar) {
        try {
          await prisma.tarefaRemanejamento.update({
            where: { id: tr.id },
            data: { status: "PENDENTE", dataConclusao: null },
          });
          try {
            await prisma.observacaoTarefaRemanejamento.create({
              data: {
                tarefaId: tr.id,
                texto:
                  tr.responsavel === "TREINAMENTO"
                    ? "Reativada automaticamente: treinamento voltou a ser obrigatório na matriz"
                    : "Reativada automaticamente: tarefa padrão reativada",
                criadoPor: usuarioResponsavel || "Sistema",
                modificadoPor: usuarioResponsavel || "Sistema",
              },
            });
          } catch {}
          try {
            await prisma.historicoRemanejamento.create({
              data: {
                solicitacaoId: rem.solicitacao!.id,
                remanejamentoFuncionarioId: rem.id,
                tarefaId: tr.id,
                tipoAcao: "REATIVACAO",
                entidade: "TAREFA",
                campoAlterado: "status",
                valorAnterior: tr.statusAnterior,
                valorNovo: "PENDENTE",
                descricaoAcao:
                  tr.responsavel === "TREINAMENTO"
                    ? "Tarefa de TREINAMENTO reativada por obrigatoriedade na matriz"
                    : `Tarefa de ${tr.responsavel} reativada por reativação nas Tarefas Padrão`,
                usuarioResponsavel: usuarioResponsavel || "Sistema",
                usuarioResponsavelId: usuarioResponsavelId,
                equipeId: equipeId,
              },
            });
          } catch {}
          reativadasCount += 1;
        } catch (reatErr) {
          console.error("Erro ao reativar tarefa:", reatErr);
        }
      }
    }

    // Atualizar statusTarefas conforme situação após criação/cancelamento
    try {
      const tarefasAtual = await prisma.tarefaRemanejamento.findMany({
        where: { remanejamentoFuncionarioId: rem.id },
        select: { status: true },
      });
      const semPendentes =
        tarefasAtual.length === 0 ||
        tarefasAtual.every((t) => t.status === "CONCLUIDO" || t.status === "CANCELADO");
      const novoStatus = semPendentes ? "SUBMETER RASCUNHO" : "ATENDER TAREFAS";
      if (rem.statusTarefas !== novoStatus) {
        await prisma.remanejamentoFuncionario.update({
          where: { id: rem.id },
          data: { statusTarefas: novoStatus },
        });
        try {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId: rem.solicitacao!.id,
              remanejamentoFuncionarioId: rem.id,
              tipoAcao: "ATUALIZACAO_STATUS",
              entidade: "STATUS_TAREFAS",
              descricaoAcao: `Status geral das tarefas atualizado para: ${novoStatus} (via sincronização)`,
              campoAlterado: "statusTarefas",
              valorAnterior: rem.statusTarefas,
              valorNovo: novoStatus,
              usuarioResponsavel: usuarioResponsavel || "Sistema",
              usuarioResponsavelId: usuarioResponsavelId,
              equipeId: equipeId,
            },
          });
        } catch {}
      }
    } catch {}

    detalhes.push({
      remanejamentoId: rem.id,
      tarefasCriadas: criadasCount,
      tarefasCanceladas: canceladasCount,
      setores: setoresNormalizados,
    });
  }

  return {
    message: `Sincronização concluída: ${totalCriadas} tarefas criadas, ${totalCanceladas} tarefas canceladas`,
    totalRemanejamentos: rems.length,
    totalTarefasCriadas: totalCriadas,
    totalTarefasCanceladas: totalCanceladas,
    detalhes,
  };
}