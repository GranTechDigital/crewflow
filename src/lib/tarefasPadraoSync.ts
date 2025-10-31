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
}

export interface SincronizarResultadoItem {
  remanejamentoId: string;
  tarefasCriadas: number;
  setores: string[];
}

export interface SincronizarResultado {
  message: string;
  totalRemanejamentos: number;
  totalTarefasCriadas: number;
  detalhes: SincronizarResultadoItem[];
}

// Função reutilizável para sincronização de tarefas faltantes em remanejamentos com status "ATENDER TAREFAS"
export async function sincronizarTarefasPadrao({ setores: setoresInput, usuarioResponsavel }: SincronizarInput): Promise<SincronizarResultado> {
  const setoresNormalizados: SetorValido[] = [];
  const baseSetores = Array.isArray(setoresInput) && setoresInput.length > 0 ? setoresInput : (SETORES_VALIDOS as unknown as string[]);
  for (const s of baseSetores) {
    const n = normalizarSetor(s);
    if (n) setoresNormalizados.push(n);
  }

  if (setoresNormalizados.length === 0) {
    return {
      message: `Nenhum setor válido informado. Válidos: ${SETORES_VALIDOS.join(", ")}`,
      totalRemanejamentos: 0,
      totalTarefasCriadas: 0,
      detalhes: [],
    };
  }

  const rems = await prisma.remanejamentoFuncionario.findMany({
    where: {
      statusTarefas: "ATENDER TAREFAS",
      statusPrestserv: {
        notIn: ["EM_AVALIACAO", "CONCLUIDO", "CANCELADO"],
      },
    },
    include: {
      funcionario: { select: { id: true, nome: true, matricula: true, funcao: true } },
      solicitacao: { select: { id: true, contratoDestinoId: true, prioridade: true } },
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
  const detalhes: SincronizarResultadoItem[] = [];

  for (const rem of rems) {
    const existentes = new Set<string>(rem.tarefas.map((t) => chaveTarefa(t.tipo, t.responsavel)));
    const tarefasParaCriar: any[] = [];

    // TREINAMENTO via matriz
    if (setoresNormalizados.includes("TREINAMENTO")) {
      const contratoId = rem.solicitacao?.contratoDestinoId || undefined;
      const funcaoNome = rem.funcionario?.funcao || undefined;

      if (contratoId && funcaoNome) {
        const funcao = await prisma.funcao.findFirst({ where: { funcao: funcaoNome } });
        if (funcao) {
          const matriz = await prisma.matrizTreinamento.findMany({
            where: { contratoId, funcaoId: funcao.id, ativo: true, tipoObrigatoriedade: "AP" },
            include: { treinamento: true, contrato: true },
          });

          for (const m of matriz) {
            const tipo = m.treinamento?.treinamento || "";
            const resp = "TREINAMENTO";
            if (!tipo) continue;
            if (existentes.has(chaveTarefa(tipo, resp))) continue;

            const prioridade = (() => {
              const v = (rem.solicitacao?.prioridade || "media").toLowerCase();
              if (v === "baixa") return "BAIXA"; if (v === "media") return "MEDIA"; if (v === "alta") return "ALTA"; if (v === "urgente") return "URGENTE"; return "MEDIA";
            })();

            const descricao = `Treinamento: ${m.treinamento?.treinamento}\nCarga Horária: ${m.treinamento?.cargaHoraria ?? "N/A"}\nValidade: ${m.treinamento?.validadeValor ?? "N/A"} ${m.treinamento?.validadeUnidade ?? ""}\nTipo: ${m.tipoObrigatoriedade}\nContrato: ${m.contrato?.nome ?? "N/A"}`;

            tarefasParaCriar.push({
              remanejamentoFuncionarioId: rem.id,
              tipo,
              descricao,
              responsavel: resp,
              status: "PENDENTE",
              prioridade,
            });
          }
        }
      }
    }

    // RH e MEDICINA via tarefas padrão
    for (const setor of setoresNormalizados) {
      if (setor === "TREINAMENTO") continue;
      const tarefasPadrao = await prisma.tarefaPadrao.findMany({ where: { setor, ativo: true }, select: { tipo: true, descricao: true } });
      for (const t of tarefasPadrao) {
        const tipo = t.tipo;
        const resp = setor;
        if (existentes.has(chaveTarefa(tipo, resp))) continue;
        const prioridade = (() => {
          const v = (rem.solicitacao?.prioridade || "media").toLowerCase();
          if (v === "baixa") return "BAIXA"; if (v === "media") return "MEDIA"; if (v === "alta") return "ALTA"; if (v === "urgente") return "URGENTE"; return "MEDIA";
        })();
        tarefasParaCriar.push({
          remanejamentoFuncionarioId: rem.id,
          tipo,
          descricao: t.descricao,
          responsavel: resp,
          status: "PENDENTE",
          prioridade,
        });
      }
    }

    if (tarefasParaCriar.length > 0) {
      const result = await prisma.tarefaRemanejamento.createMany({ data: tarefasParaCriar });
      totalCriadas += result.count;

      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: rem.solicitacao!.id,
            remanejamentoFuncionarioId: rem.id,
            tipoAcao: "CRIACAO",
            entidade: "TAREFA",
            descricaoAcao: `${result.count} novas tarefas sincronizadas a partir de matriz/pareceres para ${rem.funcionario?.nome} (${rem.funcionario?.matricula}) - Setores: ${setoresNormalizados.join(", ")}`,
            usuarioResponsavel: usuarioResponsavel || "Sistema",
          },
        });
      } catch (e) {
        console.error("Erro ao registrar histórico de sincronização:", e);
      }

      detalhes.push({ remanejamentoId: rem.id, tarefasCriadas: result.count, setores: setoresNormalizados });
    } else {
      detalhes.push({ remanejamentoId: rem.id, tarefasCriadas: 0, setores: setoresNormalizados });
    }
  }

  return {
    message: `Sincronização concluída: ${totalCriadas} tarefas criadas`,
    totalRemanejamentos: rems.length,
    totalTarefasCriadas: totalCriadas,
    detalhes,
  };
}