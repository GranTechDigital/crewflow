import { prisma } from "@/lib/prisma";

const SETORES_VALIDOS = ["RH", "MEDICINA", "TREINAMENTO"] as const;
export type SetorValido = (typeof SETORES_VALIDOS)[number];

function normalizarSetor(setor: string): SetorValido | null {
  const s = (setor || "").toUpperCase();
  return SETORES_VALIDOS.includes(s as SetorValido) ? (s as SetorValido) : null;
}

// Helpers de setor no escopo do módulo (reutilizados por toda a sincronização)
const norm = (s: string | null | undefined) =>
  (s || "")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .toUpperCase();

const keyTexto = (s: string | null | undefined) =>
  norm(s).replace(/\s+/g, " ").trim();

const keyNumeroContrato = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");

const keySlug = (s: string | null | undefined) =>
  keyTexto(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function ehNr26OuNr33(tipo: string) {
  const v = keyTexto(tipo).replace(/[^A-Z0-9]/g, "");
  return v.includes("NR26") || v.includes("NR33");
}

function ehCasoEspecialSantos51Para10({
  tipoSolicitacao,
  contratoOrigemNumero,
  contratoDestinoNumero,
}: {
  tipoSolicitacao: string | null | undefined;
  contratoOrigemNumero: string | null;
  contratoDestinoNumero: string | null;
}) {
  const tipoNormalizado = keyTexto(tipoSolicitacao).replace(/[^A-Z0-9]/g, "");
  return (
    tipoNormalizado === "VINCULOADICIONAL" &&
    keyNumeroContrato(contratoOrigemNumero) === "4600679351" &&
    keyNumeroContrato(contratoDestinoNumero) === "4600684010"
  );
}

function deveCriarTarefaPadraoParaContrato({
  setor,
  tipo,
  contratoDestinoNumero,
}: {
  setor: SetorValido;
  tipo: string;
  contratoDestinoNumero: string | null;
}) {
  if (setor === "RH" && keyTexto(tipo) === "PLANO DE SAUDE") {
    return keyNumeroContrato(contratoDestinoNumero) === "12345";
  }
  return true;
}

export function detectSetor(
  s: string | null | undefined,
): SetorValido | string {
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
}

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

async function criarObservacaoTarefaSeNaoExistir({
  tarefaId,
  texto,
  autor,
}: {
  tarefaId: string;
  texto: string;
  autor: string;
}) {
  const existente = await prisma.observacaoTarefaRemanejamento.findFirst({
    where: { tarefaId, texto },
    select: { id: true },
  });
  if (existente) return false;
  await prisma.observacaoTarefaRemanejamento.create({
    data: {
      tarefaId,
      texto,
      criadoPor: autor,
      modificadoPor: autor,
    },
  });
  return true;
}

async function criarObservacaoRemanejamentoSeNaoExistir({
  remanejamentoFuncionarioId,
  texto,
  autor,
}: {
  remanejamentoFuncionarioId: string;
  texto: string;
  autor: string;
}) {
  const obsRem = (prisma as any).observacaoRemanejamentoFuncionario;
  if (!obsRem?.findFirst || !obsRem?.create) return false;
  const existente = await obsRem.findFirst({
    where: { remanejamentoFuncionarioId, texto },
    select: { id: true },
  });
  if (existente) return false;
  await obsRem.create({
    data: {
      remanejamentoFuncionarioId,
      texto,
      criadoPor: autor,
      modificadoPor: autor,
    },
  });
  return true;
}

function chaveTarefa(tipo: string, responsavel: string) {
  const det = detectSetor(responsavel);
  const r = (normalizarSetor(det) ||
    String(responsavel || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()) as string;
  const t = String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return `${r}|${t}`;
}

export interface SincronizarInput {
  setores?: string[]; // ex.: ["TREINAMENTO"], ["RH"], ["MEDICINA"], ou combinação
  usuarioResponsavel?: string; // nome de quem disparou
  usuarioResponsavelId?: number; // id do usuário humano gatilho
  equipeId?: number; // equipe do usuário humano gatilho
  funcionarioIds?: number[]; // opcional: restringe aos remanejamentos destes funcionários
  remanejamentoIds?: string[]; // opcional: restringe pelos IDs de remanejamentoFuncionario
  criarFaltantes?: boolean; // se true, cria tarefas faltantes; se false, apenas sincroniza (cancelar/reativar) — default: true
  verbose?: boolean;
}

export interface SincronizarResultadoItem {
  remanejamentoId: string;
  tarefasCriadas: number;
  tarefasCanceladas?: number;
  tarefasReativadas?: number;
  setores: string[];
  itens?: {
    criadasPlan?: {
      tipo: string;
      responsavel: string;
      treinamentoId?: number | null;
      descricao?: string;
      prioridade?: string;
    }[];
    canceladas?: {
      id: string;
      tipo?: string;
      responsavel: string;
      statusAnterior?: string;
      treinamentoId?: number | null;
    }[];
    reativadas?: {
      id: string;
      tipo?: string;
      responsavel: string;
      statusAnterior?: string;
      treinamentoId?: number | null;
    }[];
    alteracoes?: {
      campo: "statusTarefas" | "statusPrestserv" | "observacoesPrestserv";
      de?: string | null;
      para?: string | null;
      observacoes?: string;
    }[];
  };
}

export interface SincronizarResultado {
  message: string;
  totalRemanejamentos: number;
  totalTarefasCriadas: number;
  totalTarefasCanceladas?: number;
  totalTarefasReativadas?: number;
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
  criarFaltantes = true,
  verbose = false,
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
        ", ",
      )}`,
      totalRemanejamentos: 0,
      totalTarefasCriadas: 0,
      detalhes: [],
    };
  }

  const whereRemanejamentos: any = {
    statusTarefas: {
      in: [
        "ATENDER TAREFAS",
        "SUBMETER RASCUNHO",
        "REPROVAR TAREFAS",
        "APROVAR SOLICITAÇÃO",
      ],
    },
    statusPrestserv: {
      notIn: ["EM VALIDAÇÃO", "VALIDADO", "CANCELADO"],
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
        select: {
          id: true,
          nome: true,
          matricula: true,
          funcao: true,
          contratoId: true,
        },
      },
      solicitacao: {
        select: {
          id: true,
          contratoDestinoId: true,
          contratoOrigemId: true,
          prioridade: true,
          tipo: true,
        },
      },
      tarefas: {
        select: {
          id: true,
          tipo: true,
          responsavel: true,
          status: true,
          treinamentoId: true,
          dataCriacao: true,
        },
      },
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
  let totalReativadas = 0;
  const detalhes: SincronizarResultadoItem[] = [];
  const contratoNumeroCache = new Map<number, string | null>();
  const getNumeroContratoPorId = async (id: number | null | undefined) => {
    if (typeof id !== "number") return null;
    if (contratoNumeroCache.has(id)) {
      return contratoNumeroCache.get(id) ?? null;
    }
    const c = await prisma.contrato.findUnique({
      where: { id },
      select: { numero: true },
    });
    const numero = c?.numero ?? null;
    contratoNumeroCache.set(id, numero);
    return numero;
  };

  for (const rem of rems) {
    // Segurança adicional: não alterar tarefas quando o Prestserv está em validação ou validado
    if (
      rem.statusPrestserv === "EM VALIDAÇÃO" ||
      rem.statusPrestserv === "VALIDADO"
    ) {
      continue;
    }
    const existentes = new Set<string>(
      rem.tarefas.map((t) => chaveTarefa(t.tipo, t.responsavel)),
    );
    const existentePorChave = new Map<string, (typeof rem.tarefas)[number]>(
      rem.tarefas.map((t) => [chaveTarefa(t.tipo, t.responsavel), t]),
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
    const criadasPlanResumo: {
      tipo: string;
      responsavel: string;
      treinamentoId?: number | null;
      descricao?: string;
      prioridade?: string;
    }[] = [];
    const canceladasResumo: {
      id: string;
      tipo?: string;
      responsavel: string;
      statusAnterior?: string;
      treinamentoId?: number | null;
    }[] = [];
    const reativadasResumo: {
      id: string;
      tipo?: string;
      responsavel: string;
      statusAnterior?: string;
      treinamentoId?: number | null;
    }[] = [];
    const alteracoesResumo: {
      campo: "statusTarefas" | "statusPrestserv" | "observacoesPrestserv";
      de?: string | null;
      para?: string | null;
      observacoes?: string;
    }[] = [];

    // Helpers estão no escopo do módulo: detectSetor, findEquipeIdBySetor
    const contratoDestinoNumero = await getNumeroContratoPorId(
      rem.solicitacao?.contratoDestinoId ?? null,
    );
    const contratoOrigemNumero = await getNumeroContratoPorId(
      rem.solicitacao?.contratoOrigemId ?? null,
    );
    const casoEspecialSantos51Para10 = ehCasoEspecialSantos51Para10({
      tipoSolicitacao: rem.solicitacao?.tipo,
      contratoOrigemNumero,
      contratoDestinoNumero,
    });
    if (casoEspecialSantos51Para10) {
      for (const t of rem.tarefas) {
        if (ehNr26OuNr33(String(t.tipo || ""))) continue;
        if (
          t.status === "CANCELADO" ||
          t.status === "CONCLUIDO" ||
          t.status === "CONCLUIDA"
        ) {
          continue;
        }
        const setorDet = detectSetor(t.responsavel);
        const setorCancel: SetorValido =
          setorDet === "TREINAMENTO" ||
          setorDet === "MEDICINA" ||
          setorDet === "RH"
            ? (setorDet as SetorValido)
            : "RH";
        tarefasParaCancelar.push({
          id: t.id,
          statusAnterior: t.status,
          responsavel: setorCancel,
        });
      }
    }

    const gruposAll = new Map<string, Array<(typeof rem.tarefas)[number]>>();
    for (const t of rem.tarefas) {
      const key =
        detectSetor(t.responsavel) === "TREINAMENTO"
          ? chaveTarefa(t.tipo, "TREINAMENTO")
          : chaveTarefa(t.tipo, t.responsavel);
      const arr = gruposAll.get(key) || [];
      arr.push(t);
      gruposAll.set(key, arr);
    }
    for (const [key, arr] of gruposAll.entries()) {
      if (arr.length <= 1) continue;
      const concluida =
        arr.find((x) => x.status === "CONCLUIDO" || x.status === "CONCLUIDA") ||
        null;
      const manter =
        concluida ||
        arr
          .slice()
          .sort(
            (a, b) =>
              new Date((a as any).dataCriacao as Date).getTime() -
              new Date((b as any).dataCriacao as Date).getTime(),
          )[0];
      for (const t of arr) {
        if (t.id === manter.id) continue;
        if (
          t.status !== "CANCELADO" &&
          t.status !== "CONCLUIDO" &&
          t.status !== "CONCLUIDA"
        ) {
          const setorDet = detectSetor(t.responsavel);
          const setorCancel =
            setorDet === "TREINAMENTO" ||
            setorDet === "MEDICINA" ||
            setorDet === "RH"
              ? (setorDet as SetorValido)
              : "RH";
          tarefasParaCancelar.push({
            id: t.id,
            statusAnterior: t.status,
            responsavel: setorCancel,
          });
        }
      }
    }

    // TREINAMENTO via matriz
    if (setoresNormalizados.includes("TREINAMENTO")) {
      const contratoId = rem.solicitacao?.contratoDestinoId || undefined;
      const contratoIds: number[] = [];
      if (contratoDestinoNumero) {
        const contratosMesmoNumero = await prisma.contrato.findMany({
          where: { numero: contratoDestinoNumero },
          select: { id: true },
        });
        for (const c of contratosMesmoNumero) {
          if (typeof c.id === "number") contratoIds.push(c.id);
        }
      }
      if (typeof contratoId === "number" && !contratoIds.includes(contratoId)) {
        contratoIds.push(contratoId);
      }
      // Buscar possíveis IDs de função para cobrir casos com múltiplos regimes/duplicidades
      const funcaoIds: number[] = [];
      const funcaoNome = String(rem.funcionario?.funcao || "").trim();
      const funcaoSlug = keySlug(funcaoNome);
      if (funcaoSlug) {
        const funcoes = await prisma.funcao.findMany({
          where: {
            ativo: true,
            OR: [
              { funcao_slug: funcaoSlug },
              { funcao: { equals: funcaoNome, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });
        for (const f of funcoes) {
          if (typeof f.id === "number" && !funcaoIds.includes(f.id)) {
            funcaoIds.push(f.id);
          }
        }
      }
      if (contratoIds.length > 0 && funcaoIds.length > 0) {
        // Buscar somente treinamentos obrigatórios ativos para criação
        const matrizObrigatoriaBruta = await prisma.matrizTreinamento.findMany({
          where: {
            contratoId: { in: contratoIds },
            funcaoId: { in: funcaoIds },
            ativo: true,
          },
          include: { treinamento: true, contrato: true },
        });
        const matrizObrigatoria = casoEspecialSantos51Para10
          ? matrizObrigatoriaBruta.filter((m) =>
              ehNr26OuNr33(String(m.treinamento?.treinamento || "")),
            )
          : matrizObrigatoriaBruta;

        const mandatariosIdSet = new Set<number>(
          matrizObrigatoria
            .map((m) => m.treinamento?.id as number)
            .filter((id) => typeof id === "number"),
        );
        const mandatariosChaveSet = new Set<string>(
          matrizObrigatoria
            .map((m) =>
              chaveTarefa(m.treinamento?.treinamento || "", "TREINAMENTO"),
            )
            .filter((k) => !!k.trim()),
        );

        const existentesTreinoId = new Set<number>(
          rem.tarefas
            .filter(
              (t) =>
                detectSetor(t.responsavel) === "TREINAMENTO" &&
                typeof (t as any).treinamentoId === "number",
            )
            .map((t) => (t as any).treinamentoId as number),
        );
        const novasTreinoIds = new Set<number>();
        const novasChaves = new Set<string>();

        // Criar faltantes
        for (const m of matrizObrigatoria) {
          const tipoObrig = String(m.tipoObrigatoriedade || "")
            .trim()
            .toUpperCase();
          if (!["AP", "RA"].includes(tipoObrig)) continue;
          const tipo = m.treinamento?.treinamento || "";
          const resp = "TREINAMENTO";
          if (!tipo) continue;
          const tid = (m.treinamento?.id ?? null) as number | null;
          const chaveNome = chaveTarefa(tipo, resp);
          if (typeof tid === "number") {
            if (existentesTreinoId.has(tid) || novasTreinoIds.has(tid)) {
              const grupo = rem.tarefas.filter(
                (t) =>
                  t.responsavel === "TREINAMENTO" &&
                  (t as any).treinamentoId === tid,
              );
              const temNaoCancelado = grupo.some(
                (tt) => tt.status !== "CANCELADO",
              );
              if (!temNaoCancelado) {
                const cancelada = grupo.find((tt) => tt.status === "CANCELADO");
                if (cancelada) {
                  tarefasParaReativar.push({
                    id: cancelada.id,
                    responsavel: "TREINAMENTO",
                    statusAnterior: cancelada.status,
                  });
                }
              }
              continue;
            }
            // Se não há tarefa com treinamentoId, mas existe tarefa por chave de nome, converter uma existente para usar o treinamentoId
            if (existentes.has(chaveNome)) {
              const grupoNome = rem.tarefas.filter(
                (t) =>
                  detectSetor(t.responsavel) === "TREINAMENTO" &&
                  chaveTarefa(t.tipo, t.responsavel) === chaveNome,
              );
              if (grupoNome.length > 0) {
                const concluida =
                  grupoNome.find(
                    (x) => x.status === "CONCLUIDO" || x.status === "CONCLUIDA",
                  ) || null;
                const manter =
                  concluida ||
                  grupoNome
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date((a as any).dataCriacao as Date).getTime() -
                        new Date((b as any).dataCriacao as Date).getTime(),
                    )[0];
                for (const t of grupoNome) {
                  if (t.id === manter.id) continue;
                  if (
                    t.status !== "CANCELADO" &&
                    t.status !== "CONCLUIDO" &&
                    t.status !== "CONCLUIDA"
                  ) {
                    tarefasParaCancelar.push({
                      id: t.id,
                      statusAnterior: t.status,
                      responsavel: "TREINAMENTO",
                    });
                    if (verbose) {
                      canceladasResumo.push({
                        id: t.id,
                        tipo: t.tipo,
                        responsavel: "TREINAMENTO",
                        statusAnterior: t.status,
                        treinamentoId: (t as any).treinamentoId as
                          | number
                          | null,
                      });
                    }
                  }
                }
                try {
                  await prisma.tarefaRemanejamento.update({
                    where: { id: manter.id },
                    data: {
                      treinamentoId: tid,
                      descricao: `Treinamento: ${
                        m.treinamento?.treinamento
                      }\nCarga Horária: ${
                        m.treinamento?.cargaHoraria ?? "N/A"
                      }\nValidade: ${m.treinamento?.validadeValor ?? "N/A"} ${
                        m.treinamento?.validadeUnidade ?? ""
                      }\nTipo: ${m.tipoObrigatoriedade}\nContrato: ${
                        m.contrato?.nome ?? "N/A"
                      }`,
                      setorId:
                        (await findEquipeIdBySetor(detectSetor(resp))) ??
                        undefined,
                    },
                  });
                  try {
                    await criarObservacaoTarefaSeNaoExistir({
                      tarefaId: manter.id,
                      texto:
                        "Vinculada automaticamente ao Treinamento (ID) durante sincronização de matriz",
                      autor: usuarioResponsavel || "Sistema",
                    });
                  } catch {}
                  try {
                    await prisma.historicoRemanejamento.create({
                      data: {
                        solicitacaoId: rem.solicitacao!.id,
                        remanejamentoFuncionarioId: rem.id,
                        tarefaId: manter.id,
                        tipoAcao: "ATUALIZACAO",
                        entidade: "TAREFA",
                        campoAlterado: "treinamentoId",
                        valorAnterior: null,
                        valorNovo: String(tid),
                        descricaoAcao:
                          "Tarefa de TREINAMENTO convertida para vínculo por ID do treinamento durante sincronização",
                        usuarioResponsavel: usuarioResponsavel || "Sistema",
                        usuarioResponsavelId: usuarioResponsavelId,
                        equipeId: equipeId,
                      },
                    });
                  } catch {}
                } catch (convErr) {
                  console.error(
                    "Erro ao converter tarefa para treinamentoId:",
                    convErr,
                  );
                }
                continue;
              }
            }
          } else {
            const chave = chaveTarefa(tipo, resp);
            if (existentes.has(chave) || novasChaves.has(chave)) {
              const grupo = rem.tarefas.filter(
                (t) => chaveTarefa(t.tipo, t.responsavel) === chave,
              );
              const temNaoCancelado = grupo.some(
                (tt) => tt.status !== "CANCELADO",
              );
              if (!temNaoCancelado) {
                const cancelada = grupo.find((tt) => tt.status === "CANCELADO");
                if (cancelada) {
                  tarefasParaReativar.push({
                    id: cancelada.id,
                    responsavel: "TREINAMENTO",
                    statusAnterior: cancelada.status,
                  });
                }
              }
              continue;
            }
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
            treinamentoId: typeof tid === "number" ? tid : null,
            tipo,
            descricao,
            responsavel: resp,
            status: "PENDENTE",
            prioridade,
            dataLimite: new Date(Date.now() + 48 * 60 * 60 * 1000),
            setorId:
              (await findEquipeIdBySetor(detectSetor(resp))) ?? undefined,
          });
          if (verbose) {
            criadasPlanResumo.push({
              tipo,
              responsavel: resp,
              treinamentoId: typeof tid === "number" ? tid : null,
              descricao,
              prioridade,
            });
          }
          if (typeof tid === "number") {
            novasTreinoIds.add(tid);
          } else {
            novasChaves.add(chaveTarefa(tipo, resp));
          }
        }

        // Remover (cancelar) tarefas de treinamento que não são mais obrigatórias
        const tarefasTreinamentoExistentes = rem.tarefas.filter(
          (t) => detectSetor(t.responsavel) === "TREINAMENTO",
        );
        for (const t of tarefasTreinamentoExistentes) {
          const tidT = (t as any).treinamentoId as number | null;
          const chave = chaveTarefa(t.tipo, t.responsavel);
          const deveManter =
            (typeof tidT === "number" && mandatariosIdSet.has(tidT)) ||
            mandatariosChaveSet.has(chave);
          const podeCancelar =
            t.status !== "CANCELADO" &&
            t.status !== "CONCLUIDO" &&
            t.status !== "CONCLUIDA";
          if (!deveManter && podeCancelar) {
            tarefasParaCancelar.push({
              id: t.id,
              statusAnterior: t.status,
              responsavel: "TREINAMENTO",
            });
            if (verbose) {
              canceladasResumo.push({
                id: t.id,
                tipo: t.tipo,
                responsavel: "TREINAMENTO",
                statusAnterior: t.status,
                treinamentoId: tidT,
              });
            }
          }
        }

        const grupos = new Map<
          string,
          Array<(typeof tarefasTreinamentoExistentes)[number]>
        >();
        for (const t of tarefasTreinamentoExistentes) {
          const key = chaveTarefa(t.tipo, "TREINAMENTO");
          const arr = grupos.get(key) || [];
          arr.push(t);
          grupos.set(key, arr);
        }
        for (const [key, arr] of grupos.entries()) {
          if (arr.length <= 1) continue;
          const concluida =
            arr.find(
              (x) => x.status === "CONCLUIDO" || x.status === "CONCLUIDA",
            ) || null;
          const manter =
            concluida ||
            arr
              .slice()
              .sort(
                (a, b) =>
                  new Date((a as any).dataCriacao as Date).getTime() -
                  new Date((b as any).dataCriacao as Date).getTime(),
              )[0];
          for (const t of arr) {
            if (t.id === manter.id) continue;
            if (
              t.status !== "CANCELADO" &&
              t.status !== "CONCLUIDO" &&
              t.status !== "CONCLUIDA"
            ) {
              tarefasParaCancelar.push({
                id: t.id,
                statusAnterior: t.status,
                responsavel: "TREINAMENTO",
              });
              if (verbose) {
                canceladasResumo.push({
                  id: t.id,
                  tipo: t.tipo,
                  responsavel: "TREINAMENTO",
                  statusAnterior: t.status,
                  treinamentoId: (t as any).treinamentoId as number | null,
                });
              }
            }
          }
        }
      }
    }

    // RH e MEDICINA via tarefas padrão (criação faltantes e cancelamento retroativo)
    for (const setor of setoresNormalizados) {
      if (setor === "TREINAMENTO") continue;

      // Se for DESLIGAMENTO, não deve criar tarefas padrão de admissão/alocação (RH/MEDICINA)
      if (rem.solicitacao?.tipo === "DESLIGAMENTO") continue;

      const tarefasPadrao = await prisma.tarefaPadrao.findMany({
        where: { setor, ativo: true },
        select: { tipo: true, descricao: true },
      });
      let tarefasPadraoFiltradas = tarefasPadrao.filter((t) =>
        deveCriarTarefaPadraoParaContrato({
          setor,
          tipo: t.tipo,
          contratoDestinoNumero,
        }),
      );
      if (casoEspecialSantos51Para10) {
        tarefasPadraoFiltradas = tarefasPadraoFiltradas.filter((t) =>
          ehNr26OuNr33(t.tipo),
        );
      }

      // Criar faltantes
      for (const t of tarefasPadraoFiltradas) {
        const tipo = t.tipo;
        const resp = setor;
        const chave = chaveTarefa(tipo, resp);
        if (existentes.has(chave)) {
          const grupo = rem.tarefas.filter(
            (tt) => chaveTarefa(tt.tipo, tt.responsavel) === chave,
          );
          const temNaoCancelado = grupo.some((tt) => tt.status !== "CANCELADO");
          if (!temNaoCancelado) {
            const cancelada = grupo.find((tt) => tt.status === "CANCELADO");
            if (cancelada) {
              tarefasParaReativar.push({
                id: cancelada.id,
                responsavel: setor,
                statusAnterior: cancelada.status,
              });
              if (verbose) {
                reativadasResumo.push({
                  id: cancelada.id,
                  tipo: cancelada.tipo,
                  responsavel: setor,
                  statusAnterior: cancelada.status,
                });
              }
            }
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
          setorId: (await findEquipeIdBySetor(detectSetor(resp))) ?? undefined,
        });
        if (verbose) {
          criadasPlanResumo.push({
            tipo,
            responsavel: resp,
            descricao: t.descricao,
            prioridade,
          });
        }
      }

      // Cancelar tarefas do setor que não constam mais nas tarefas padrão ativas
      const mandatariosPadraoSet = new Set<string>(
        tarefasPadraoFiltradas.map((tp) => chaveTarefa(tp.tipo, setor)),
      );
      const tarefasSetorExistentes = rem.tarefas.filter(
        (t) => detectSetor(t.responsavel) === setor,
      );
      for (const t of tarefasSetorExistentes) {
        const chave = chaveTarefa(t.tipo, t.responsavel);
        const deveManter = mandatariosPadraoSet.has(chave);
        const podeCancelar =
          t.status !== "CANCELADO" &&
          t.status !== "CONCLUIDO" &&
          t.status !== "CONCLUIDA";
        if (!deveManter && podeCancelar) {
          tarefasParaCancelar.push({
            id: t.id,
            statusAnterior: t.status,
            responsavel: setor,
          });
          if (verbose) {
            canceladasResumo.push({
              id: t.id,
              tipo: t.tipo,
              responsavel: setor,
              statusAnterior: t.status,
            });
          }
        }
      }
    }

    // Aplicar criações (apenas se habilitado)
    let criadasCount = 0;
    if (criarFaltantes && tarefasParaCriar.length > 0) {
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
    const tarefasParaCancelarUnicas = Array.from(
      new Map(tarefasParaCancelar.map((tc) => [tc.id, tc])).values(),
    );
    if (tarefasParaCancelarUnicas.length > 0) {
      for (const tc of tarefasParaCancelarUnicas) {
        try {
          await prisma.tarefaRemanejamento.update({
            where: { id: tc.id },
            data: { status: "CANCELADO" },
          });

          // Observação da tarefa (mensagem contextual por setor)
          try {
            await criarObservacaoTarefaSeNaoExistir({
              tarefaId: tc.id,
              texto:
                tc.responsavel === "TREINAMENTO"
                  ? "Cancelada automaticamente: treinamento marcado como não obrigatório na matriz"
                  : "Cancelada automaticamente: tarefa padrão desativada/removida",
              autor: usuarioResponsavel || "Sistema",
            });
          } catch (obsErr) {
            console.error(
              "Erro ao registrar observação de cancelamento:",
              obsErr,
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
              histErr,
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
    const cancelIdsSet = new Set<string>(tarefasParaCancelar.map((c) => c.id));
    if (tarefasParaReativar.length > 0) {
      for (const tr of tarefasParaReativar) {
        // Evitar reativar tarefas que também estão agendadas para cancelamento nesta sincronização (idempotência)
        if (cancelIdsSet.has(tr.id)) {
          continue;
        }
        try {
          await prisma.tarefaRemanejamento.update({
            where: { id: tr.id },
            data: { status: "PENDENTE", dataConclusao: null },
          });
          try {
            await criarObservacaoTarefaSeNaoExistir({
              tarefaId: tr.id,
              texto:
                tr.responsavel === "TREINAMENTO"
                  ? "Reativada automaticamente: treinamento voltou a ser obrigatório na matriz"
                  : "Reativada automaticamente: tarefa padrão reativada",
              autor: usuarioResponsavel || "Sistema",
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
    totalReativadas += reativadasCount;

    // Atualizar statusTarefas conforme situação após criação/cancelamento
    try {
      const tarefasAtual = await prisma.tarefaRemanejamento.findMany({
        where: { remanejamentoFuncionarioId: rem.id },
        select: { status: true, responsavel: true, tipo: true },
      });
      const semPendentes =
        tarefasAtual.length === 0 ||
        tarefasAtual.every(
          (t) =>
            t.status === "CONCLUIDO" ||
            t.status === "CONCLUIDA" ||
            t.status === "CANCELADO",
        );

      const possuiNr26Concluida = tarefasAtual.some(
        (t) =>
          t.status !== "CANCELADO" &&
          ehNr26OuNr33(String(t.tipo || "")) &&
          keyTexto(t.tipo)
            .replace(/[^A-Z0-9]/g, "")
            .includes("NR26") &&
          (t.status === "CONCLUIDO" || t.status === "CONCLUIDA"),
      );
      const possuiNr33Concluida = tarefasAtual.some(
        (t) =>
          t.status !== "CANCELADO" &&
          ehNr26OuNr33(String(t.tipo || "")) &&
          keyTexto(t.tipo)
            .replace(/[^A-Z0-9]/g, "")
            .includes("NR33") &&
          (t.status === "CONCLUIDO" || t.status === "CONCLUIDA"),
      );
      let novoStatus = casoEspecialSantos51Para10
        ? possuiNr26Concluida && possuiNr33Concluida
          ? "SUBMETER RASCUNHO"
          : "ATENDER TAREFAS"
        : semPendentes
          ? "SUBMETER RASCUNHO"
          : "ATENDER TAREFAS";
      let aplicarDevolucaoTreinamento = false;

      // Lógica Especial: Se o fluxo está indo para Logística (SUBMETER RASCUNHO)
      // e não houver tarefas de Treinamento ativas (0/0), forçar permanência em Treinamento
      // (ATENDER TAREFAS) para criação/ajuste da matriz.
      if (novoStatus === "SUBMETER RASCUNHO" && !casoEspecialSantos51Para10) {
        const temTreinamentoAtivo = tarefasAtual.some(
          (t) =>
            t.status !== "CANCELADO" &&
            detectSetor(t.responsavel) === "TREINAMENTO",
        );

        if (!temTreinamentoAtivo) {
          novoStatus = "ATENDER TAREFAS";
          // Só aplicar devolução (e gerar observação) se o status ANTERIOR era SUBMETER RASCUNHO.
          // Isso evita loop de observações se o status já estiver corretamente em ATENDER TAREFAS.
          if (rem.statusTarefas === "SUBMETER RASCUNHO") {
            aplicarDevolucaoTreinamento = true;
          }
        }
      }

      if (rem.statusTarefas !== novoStatus) {
        await prisma.remanejamentoFuncionario.update({
          where: { id: rem.id },
          data: { statusTarefas: novoStatus },
        });
        if (verbose) {
          alteracoesResumo.push({
            campo: "statusTarefas",
            de: rem.statusTarefas,
            para: novoStatus,
          });
        }
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

      // Registrar devolução para Treinamento quando aplicável (caso 0/0 de Treinamento)
      if (aplicarDevolucaoTreinamento) {
        const textoDevolucao =
          "Devolvido para TREINAMENTO automaticamente: Nenhuma tarefa de treinamento gerada (Matriz inexistente ou vazia). Necessário criar matriz.";
        let deveRegistrarDevolucao = true;
        try {
          const obsRem = (prisma as any).observacaoRemanejamentoFuncionario;
          if (obsRem?.count) {
            const totalObsExistentes = await obsRem.count({
              where: {
                remanejamentoFuncionarioId: rem.id,
                texto: { contains: textoDevolucao },
              },
            });
            if (totalObsExistentes > 0) deveRegistrarDevolucao = false;
          }
        } catch {}

        if (deveRegistrarDevolucao) {
          try {
            await criarObservacaoRemanejamentoSeNaoExistir({
              remanejamentoFuncionarioId: rem.id,
              texto: textoDevolucao,
              autor: usuarioResponsavel || "Sistema",
            });
          } catch (e) {
            console.error(
              "Erro ao criar observação de devolução para Treinamento (sync):",
              e,
            );
          }
          try {
            await prisma.historicoRemanejamento.create({
              data: {
                solicitacaoId: rem.solicitacao!.id,
                remanejamentoFuncionarioId: rem.id,
                tipoAcao: "ATUALIZACAO_RESPONSAVEL",
                entidade: "RESPONSAVEL_ATUAL",
                descricaoAcao: textoDevolucao,
                campoAlterado: "responsavelAtual",
                valorAnterior: null,
                valorNovo: "TREINAMENTO",
                usuarioResponsavel: usuarioResponsavel || "Sistema",
                usuarioResponsavelId: usuarioResponsavelId,
                equipeId: equipeId,
                observacoes: textoDevolucao,
              },
            });
          } catch {}
        }
      }

      const temPendentes = !semPendentes;
      const houveNovasTarefas = criadasCount > 0 || reativadasCount > 0;

      // Status que só devem ser resetados se houver novas tarefas (para não destravar bloqueios manuais indevidamente)
      const estadosBloqueio = new Set<string>([
        "PENDENTE DE DESLIGAMENTO",
        "DESLIGAMENTO SOLICITADO",
        "SISPAT BLOQUEADO",
      ]);

      let deveResetar = false;

      if (temPendentes) {
        if (rem.statusPrestserv === "CRIADO") {
          deveResetar = false;
        } else if (estadosBloqueio.has(rem.statusPrestserv)) {
          if (houveNovasTarefas) {
            deveResetar = true;
          }
        } else {
          // Para outros status (APROVADO, SUBMETIDO, etc), se tem pendência, reseta
          deveResetar = true;
        }
      }

      if (deveResetar) {
        const motivoReset =
          rem.statusPrestserv === "SEM_CADASTRO"
            ? "devido a tarefas pendentes (correção de inconsistência)"
            : "devido a novas tarefas sincronizadas/reativadas";

        const observacao = `Prestserv resetado para CRIADO ${motivoReset} após sincronização de matriz/tarefas padrão.`;

        // Registrar observação na nova tabela
        try {
          await criarObservacaoRemanejamentoSeNaoExistir({
            remanejamentoFuncionarioId: rem.id,
            texto: observacao,
            autor: usuarioResponsavel || "Sistema",
          });
        } catch (e) {
          console.error("Erro ao criar observação de reset:", e);
        }

        await prisma.remanejamentoFuncionario.update({
          where: { id: rem.id },
          data: {
            statusPrestserv: "CRIADO",
            // Mantemos observacoesPrestserv legado sem alteração para não poluir
          },
        });
        if (verbose) {
          alteracoesResumo.push({
            campo: "statusPrestserv",
            de: rem.statusPrestserv,
            para: "CRIADO",
            observacoes: observacao,
          });
        }
        try {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId: rem.solicitacao!.id,
              remanejamentoFuncionarioId: rem.id,
              tipoAcao: "ATUALIZACAO_STATUS",
              entidade: "STATUS_TAREFAS",
              descricaoAcao: `Prestserv resetado automaticamente para CRIADO: ${motivoReset}.`,
              campoAlterado: "statusPrestserv",
              valorAnterior: rem.statusPrestserv,
              valorNovo: "CRIADO",
              usuarioResponsavel: usuarioResponsavel || "Sistema",
              usuarioResponsavelId: usuarioResponsavelId,
              equipeId: equipeId,
              observacoes: observacao,
            },
          });
        } catch {}
      }

      const invalidadoSet = new Set<string>([
        "INVALIDADO",
        "INVALIDAO",
        "INVALIDADA",
        "CORREÇÃO",
        "CORRECAO",
      ]);
      if (invalidadoSet.has(rem.statusPrestserv)) {
        const tarefasAtualParaCheck = await prisma.tarefaRemanejamento.findMany(
          {
            where: { remanejamentoFuncionarioId: rem.id },
            select: { status: true },
          },
        );
        const temReprovadas = tarefasAtualParaCheck.some(
          (t) => t.status === "REPROVADO",
        );
        if (!temReprovadas) {
          const observacaoCorr =
            "Status 'INVALIDADO' corrigido automaticamente após sincronização: tarefas reprovadas foram removidas/canceladas na matriz/padrão.";

          // Registrar observação na nova tabela
          try {
            await criarObservacaoRemanejamentoSeNaoExistir({
              remanejamentoFuncionarioId: rem.id,
              texto: observacaoCorr,
              autor: usuarioResponsavel || "Sistema",
            });
          } catch (e) {
            console.error("Erro ao criar observação de correção:", e);
          }

          await prisma.remanejamentoFuncionario.update({
            where: { id: rem.id },
            data: {
              statusPrestserv: "CRIADO",
              // Mantemos observacoesPrestserv legado sem alteração
            },
          });
          if (verbose) {
            alteracoesResumo.push({
              campo: "statusPrestserv",
              de: rem.statusPrestserv,
              para: "CRIADO",
              observacoes: observacaoCorr,
            });
            alteracoesResumo.push({
              campo: "observacoesPrestserv",
              de: rem.observacoesPrestserv ?? null,
              para: observacaoCorr,
            });
          }
          try {
            await prisma.historicoRemanejamento.create({
              data: {
                solicitacaoId: rem.solicitacao!.id,
                remanejamentoFuncionarioId: rem.id,
                tipoAcao: "ATUALIZACAO_STATUS",
                entidade: "STATUS_TAREFAS",
                descricaoAcao:
                  "Status 'INVALIDADO' revertido para 'CRIADO' por ausência de tarefas reprovadas/pendentes para setores após sincronização.",
                campoAlterado: "statusPrestserv",
                valorAnterior: "INVALIDADO",
                valorNovo: "CRIADO",
                usuarioResponsavel: usuarioResponsavel || "Sistema",
                usuarioResponsavelId: usuarioResponsavelId,
                equipeId: equipeId,
                observacoes: observacaoCorr,
              },
            });
          } catch {}
        }
      }
    } catch {}

    detalhes.push({
      remanejamentoId: rem.id,
      tarefasCriadas: criadasCount,
      tarefasCanceladas: canceladasCount,
      tarefasReativadas: reativadasCount,
      setores: setoresNormalizados,
      itens: verbose
        ? {
            criadasPlan: criadasPlanResumo,
            canceladas: canceladasResumo,
            reativadas: reativadasResumo,
            alteracoes: alteracoesResumo,
          }
        : undefined,
    });
  }

  const mensagem = criarFaltantes
    ? `Sincronização concluída: ${totalCriadas} criadas, ${totalCanceladas} canceladas, ${totalReativadas} reativadas`
    : `Sincronização concluída: ${totalCanceladas} canceladas, ${totalReativadas} reativadas`;
  return {
    message: mensagem,
    totalRemanejamentos: rems.length,
    totalTarefasCriadas: totalCriadas,
    totalTarefasCanceladas: totalCanceladas,
    totalTarefasReativadas: totalReativadas,
    detalhes,
  };
}
