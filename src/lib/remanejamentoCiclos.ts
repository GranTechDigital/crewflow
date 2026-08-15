import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sincronizarEventosCadastroExternoSafe } from "@/lib/integracoes/cadastroEventos";

type DbClient = PrismaClient | Prisma.TransactionClient;

type OrigemCiclo = "SISTEMA" | "RECONSTRUIDO" | "MANUAL";
type ConfiancaCiclo = "ALTA" | "MEDIA" | "BAIXA";
type StatusCiclo = "ABERTO" | "CONCLUIDO" | "CANCELADO" | "IGNORADO";
type TipoCiclo =
  | "APROVACAO_SOLICITACAO"
  | "ATENDIMENTO_INICIAL"
  | "AJUSTE_MATRIZ"
  | "CORRECAO_LOGISTICA"
  | "REATENDIMENTO_SETOR"
  | "AVALIACAO_LOGISTICA"
  | "RECONSTRUCAO_HISTORICA";

const SETORES_CADASTRO = ["RH", "MEDICINA", "TREINAMENTO"] as const;
type SetorCadastro = (typeof SETORES_CADASTRO)[number];

const PRAZO_SOLICITACAO_DIAS = 5;
const DIA_EM_MS = 24 * 60 * 60 * 1000;
const GAP_NOVO_LOTE_TAREFAS_DIAS = 7;

const STATUS_TAREFA_FINAL = new Set(["CONCLUIDO", "CONCLUIDA", "CANCELADO"]);
const STATUS_PRESTSERV_INVALIDADO = new Set([
  "INVALIDADO",
  "INVALIDAO",
  "INVALIDADA",
  "REPROVADO",
  "REPROVAR",
  "REJEITADO",
  "CORRECAO",
  "CORREÇÃO",
]);

function normalizeText(input: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeStatusPrestserv(input: unknown): string {
  const raw = normalizeText(input);
  if (raw === "VALIDAO" || raw === "VALIDADA") return "VALIDADO";
  if (raw === "INVALIDAO" || raw === "INVALIDADA") return "INVALIDADO";
  return raw;
}

function isStatusInvalidado(input: unknown): boolean {
  const status = normalizeStatusPrestserv(input);
  return (
    STATUS_PRESTSERV_INVALIDADO.has(status) ||
    status.includes("INVALID") ||
    status.includes("REPROV") ||
    status.includes("REJEIT") ||
    status.includes("CORRE")
  );
}

function detectSetorFromText(input: unknown): SetorCadastro | null {
  const text = normalizeText(input);
  if (!text) return null;
  if (
    text === "RH" ||
    text.includes("RECURSOS HUMANOS") ||
    text.includes("DEPARTAMENTO PESSOAL") ||
    text.includes("ADMISS") ||
    text.includes("DOCUMENTACAO RH") ||
    text.includes("DOC RH")
  ) {
    return "RH";
  }
  if (
    text.includes("MEDIC") ||
    text.includes("SAUDE") ||
    text.includes("ENFERM") ||
    text.includes("AMBULATORIO") ||
    text.includes("ASO") ||
    text.includes("EXAME")
  ) {
    return "MEDICINA";
  }
  if (
    text.includes("TREIN") ||
    text.includes("CAPACIT") ||
    text.includes("CURSO") ||
    text.includes("INSTRU") ||
    text.includes("CERTIFIC")
  ) {
    return "TREINAMENTO";
  }
  return null;
}

function detectSetorTarefa(tarefa: {
  treinamentoId?: number | null;
  responsavel?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  setor?: { nome?: string | null } | null;
}): SetorCadastro | null {
  if (tarefa.treinamentoId) return "TREINAMENTO";
  return (
    detectSetorFromText(tarefa.setor?.nome) ||
    detectSetorFromText(tarefa.responsavel) ||
    detectSetorFromText(tarefa.tipo) ||
    detectSetorFromText(tarefa.descricao)
  );
}

function isTarefaFinal(status: unknown): boolean {
  return STATUS_TAREFA_FINAL.has(normalizeText(status));
}

function isTarefaCancelada(status: unknown): boolean {
  return normalizeText(status) === "CANCELADO";
}

function isTarefaPendenteDeAtuacao(status: unknown): boolean {
  const normalized = normalizeText(status);
  return normalized === "REPROVADO" || !STATUS_TAREFA_FINAL.has(normalized);
}

function maxDate(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

function minDate(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  if (!valid.length) return null;
  return new Date(Math.min(...valid.map((d) => d.getTime())));
}

type TarefaRemanejamentoCarregada = NonNullable<
  Awaited<ReturnType<typeof carregarRemanejamento>>
>["tarefas"][number];

function mapearCicloPorLoteDeCriacao(tarefas: TarefaRemanejamentoCarregada[]) {
  const sorted = [...tarefas].sort(
    (a, b) => a.dataCriacao.getTime() - b.dataCriacao.getTime(),
  );
  const cicloPorTarefa = new Map<string, number>();
  let numeroCiclo = 1;
  let ultimaCriacao: Date | null = null;

  for (const tarefa of sorted) {
    if (
      ultimaCriacao &&
      tarefa.dataCriacao.getTime() - ultimaCriacao.getTime() >
        GAP_NOVO_LOTE_TAREFAS_DIAS * DIA_EM_MS
    ) {
      numeroCiclo += 1;
    }
    cicloPorTarefa.set(tarefa.id, numeroCiclo);
    ultimaCriacao = tarefa.dataCriacao;
  }

  return cicloPorTarefa;
}

function agruparPorNumeroCiclo(
  tarefas: TarefaRemanejamentoCarregada[],
  cicloPorTarefa: Map<string, number>,
) {
  const grupos = new Map<number, TarefaRemanejamentoCarregada[]>();
  for (const tarefa of tarefas) {
    const numeroCiclo = cicloPorTarefa.get(tarefa.id) ?? 1;
    const grupo = grupos.get(numeroCiclo) ?? [];
    grupo.push(tarefa);
    grupos.set(numeroCiclo, grupo);
  }
  return [...grupos.entries()].sort(([a], [b]) => a - b);
}

function inicioTarefas(tarefas: TarefaRemanejamentoCarregada[]) {
  return minDate(tarefas.map((t) => t.dataCriacao));
}

function fimTarefasParaAgrupamento(tarefas: TarefaRemanejamentoCarregada[]) {
  if (!setorConcluido(tarefas)) return null;
  return dataConclusaoSetor(tarefas);
}

function agruparPorNumeroCicloSemSobreposicao(
  tarefas: TarefaRemanejamentoCarregada[],
  cicloPorTarefa: Map<string, number>,
) {
  const grupos = agruparPorNumeroCiclo(tarefas, cicloPorTarefa).map(([numeroCiclo, itens]) => ({
    numeroCiclo,
    tarefas: [...itens],
  }));
  const consolidados: Array<{ numeroCiclo: number; tarefas: TarefaRemanejamentoCarregada[] }> =
    [];

  for (const grupo of grupos) {
    const inicioGrupo = inicioTarefas(grupo.tarefas);
    const anterior = consolidados[consolidados.length - 1];

    if (anterior && inicioGrupo) {
      const fimAnterior = fimTarefasParaAgrupamento(anterior.tarefas);
      if (!fimAnterior || inicioGrupo <= fimAnterior) {
        anterior.tarefas.push(...grupo.tarefas);
        continue;
      }
    }

    consolidados.push(grupo);
  }

  return consolidados.map(({ numeroCiclo, tarefas }) => [numeroCiclo, tarefas] as const);
}

function describeTipoCiclo(tipoCiclo: TipoCiclo, setor: string, numeroCiclo: number) {
  switch (tipoCiclo) {
    case "APROVACAO_SOLICITACAO":
      return {
        tituloCiclo: "Solicitacao e aprovacao",
        descricaoCiclo:
          "Fase desde a criacao da solicitacao ate a aprovacao que libera a geracao das tarefas.",
      };
    case "ATENDIMENTO_INICIAL":
      return {
        tituloCiclo: `Atendimento inicial - ${setor}`,
        descricaoCiclo:
          "Primeiro atendimento do setor apos aprovacao inicial e geracao das tarefas.",
      };
    case "AJUSTE_MATRIZ":
      return {
        tituloCiclo: `Ajuste de matriz - ${setor}`,
        descricaoCiclo:
          "Novo atendimento aberto por criacao, reativacao ou cancelamento de tarefas apos sincronizacao de matriz/tarefas padrao.",
      };
    case "CORRECAO_LOGISTICA":
      return {
        tituloCiclo: `Correcao apos devolucao - ${setor}`,
        descricaoCiclo:
          "Atendimento aberto porque a Logistica devolveu o processo para ajuste do setor.",
      };
    case "REATENDIMENTO_SETOR":
      return {
        tituloCiclo: `Reatendimento do setor - ${setor}`,
        descricaoCiclo:
          "Novo atendimento do setor apos aparecer pendencia posterior a um ciclo ja encerrado.",
      };
    case "AVALIACAO_LOGISTICA":
      return {
        tituloCiclo: `Avaliacao da Logistica - ciclo ${numeroCiclo}`,
        descricaoCiclo:
          "Etapa de avaliacao da Logistica apos os setores concluirem ou resolverem suas pendencias.",
      };
    case "RECONSTRUCAO_HISTORICA":
      return {
        tituloCiclo: `Ciclo reconstruido - ${setor}`,
        descricaoCiclo:
          "Ciclo inferido a partir de dados ja existentes, usado para comparacao e auditoria historica.",
      };
  }
}

function classificarCiclo(data: {
  setor: string;
  numeroCiclo: number;
  origem?: OrigemCiclo;
  motivo?: string | null;
  statusPrestserv?: string | null;
  cicloAnteriorFechado?: boolean;
}): { tipoCiclo: TipoCiclo; tituloCiclo: string; descricaoCiclo: string } {
  let tipoCiclo: TipoCiclo = "ATENDIMENTO_INICIAL";
  const motivo = normalizeText(data.motivo);

  if (data.origem === "RECONSTRUIDO") {
    tipoCiclo = "RECONSTRUCAO_HISTORICA";
  } else if (data.setor === "LOGISTICA") {
    tipoCiclo = "AVALIACAO_LOGISTICA";
  } else if (isStatusInvalidado(data.statusPrestserv)) {
    tipoCiclo = "CORRECAO_LOGISTICA";
  } else if (motivo.includes("MATRIZ") || motivo.includes("TAREFA PADRAO")) {
    tipoCiclo = "AJUSTE_MATRIZ";
  } else if (data.cicloAnteriorFechado || data.numeroCiclo > 1) {
    tipoCiclo = "REATENDIMENTO_SETOR";
  }

  return {
    tipoCiclo,
    ...describeTipoCiclo(tipoCiclo, data.setor, data.numeroCiclo),
  };
}

async function registrarEventoCiclo(
  db: DbClient,
  data: {
    cicloId: string;
    remanejamentoFuncionarioId: string;
    tipo: string;
    dataEvento?: Date;
    origem?: OrigemCiclo;
    dados?: Prisma.InputJsonValue;
    usuarioResponsavelId?: number | null;
    tarefaId?: string | null;
    historicoRemanejamentoId?: number | null;
  },
) {
  return db.remanejamentoCicloEvento.create({
    data: {
      cicloId: data.cicloId,
      remanejamentoFuncionarioId: data.remanejamentoFuncionarioId,
      tipo: data.tipo,
      dataEvento: data.dataEvento ?? new Date(),
      origem: data.origem ?? "SISTEMA",
      dados: data.dados ?? undefined,
      usuarioResponsavelId: data.usuarioResponsavelId ?? undefined,
      tarefaId: data.tarefaId ?? undefined,
      historicoRemanejamentoId: data.historicoRemanejamentoId ?? undefined,
    },
  });
}

async function upsertCiclo(
  db: DbClient,
  data: {
    remanejamentoFuncionarioId: string;
    numeroCiclo: number;
    setor: string;
    inicioAt: Date;
    prazoPrevistoAt?: Date | null;
    tipoCiclo?: TipoCiclo;
    tituloCiclo?: string | null;
    descricaoCiclo?: string | null;
    origem?: OrigemCiclo;
    confianca?: ConfiancaCiclo;
    motivoAbertura?: string;
    usuarioResponsavelId?: number | null;
    tarefaId?: string | null;
  },
) {
  const where = {
    remanejamentoFuncionarioId_numeroCiclo_setor: {
      remanejamentoFuncionarioId: data.remanejamentoFuncionarioId,
      numeroCiclo: data.numeroCiclo,
      setor: data.setor,
    },
  };
  const existente = await db.remanejamentoCiclo.findUnique({ where });

  const ciclo = await db.remanejamentoCiclo.upsert({
    where: {
      remanejamentoFuncionarioId_numeroCiclo_setor: {
        remanejamentoFuncionarioId: data.remanejamentoFuncionarioId,
        numeroCiclo: data.numeroCiclo,
        setor: data.setor,
      },
    },
    create: {
      remanejamentoFuncionarioId: data.remanejamentoFuncionarioId,
      numeroCiclo: data.numeroCiclo,
      setor: data.setor,
      status: "ABERTO",
      tipoCiclo: data.tipoCiclo ?? "ATENDIMENTO_INICIAL",
      tituloCiclo: data.tituloCiclo ?? undefined,
      descricaoCiclo: data.descricaoCiclo ?? undefined,
      origem: data.origem ?? "SISTEMA",
      confianca: data.confianca ?? "ALTA",
      inicioAt: data.inicioAt,
      prazoPrevistoAt: data.prazoPrevistoAt ?? undefined,
      motivoAbertura: data.motivoAbertura,
    },
    update: {
      status: existente?.status === "IGNORADO" ? "ABERTO" : undefined,
      prazoPrevistoAt: data.prazoPrevistoAt ?? undefined,
      tipoCiclo: data.tipoCiclo ?? undefined,
      tituloCiclo: data.tituloCiclo ?? undefined,
      descricaoCiclo: data.descricaoCiclo ?? undefined,
      origem: data.origem ?? undefined,
      confianca: data.confianca ?? undefined,
    },
  });

  if (!existente) {
    await registrarEventoCiclo(db, {
      cicloId: ciclo.id,
      remanejamentoFuncionarioId: data.remanejamentoFuncionarioId,
      tipo: "CICLO_ABERTO",
      dataEvento: data.inicioAt,
      origem: data.origem,
      usuarioResponsavelId: data.usuarioResponsavelId,
      tarefaId: data.tarefaId,
      dados: {
        numeroCiclo: data.numeroCiclo,
        setor: data.setor,
        tipoCiclo: data.tipoCiclo ?? "ATENDIMENTO_INICIAL",
        motivo: data.motivoAbertura ?? null,
      },
    });
  } else if (
    data.prazoPrevistoAt &&
    (!existente.prazoPrevistoAt ||
      existente.prazoPrevistoAt.getTime() !== data.prazoPrevistoAt.getTime())
  ) {
    await registrarEventoCiclo(db, {
      cicloId: ciclo.id,
      remanejamentoFuncionarioId: data.remanejamentoFuncionarioId,
      tipo: "PRAZO_ATUALIZADO",
      dataEvento: new Date(),
      origem: data.origem,
      usuarioResponsavelId: data.usuarioResponsavelId,
      tarefaId: data.tarefaId,
      dados: {
        numeroCiclo: data.numeroCiclo,
        setor: data.setor,
        prazoAnterior: existente.prazoPrevistoAt?.toISOString() ?? null,
        prazoNovo: data.prazoPrevistoAt.toISOString(),
      },
    });
  }

  return ciclo;
}

async function fecharCiclo(
  db: DbClient,
  ciclo: { id: string; remanejamentoFuncionarioId: string; status: string },
  data: {
    conclusaoAt: Date;
    tipoEvento: string;
    motivoFechamento?: string;
    usuarioResponsavelId?: number | null;
    tarefaId?: string | null;
    dados?: Prisma.InputJsonValue;
  },
) {
  if (ciclo.status === "CONCLUIDO" || ciclo.status === "CANCELADO") return;

  await db.remanejamentoCiclo.update({
    where: { id: ciclo.id },
    data: {
      status: "CONCLUIDO",
      conclusaoAt: data.conclusaoAt,
      motivoFechamento: data.motivoFechamento,
    },
  });

  await registrarEventoCiclo(db, {
    cicloId: ciclo.id,
    remanejamentoFuncionarioId: ciclo.remanejamentoFuncionarioId,
    tipo: data.tipoEvento,
    dataEvento: data.conclusaoAt,
    usuarioResponsavelId: data.usuarioResponsavelId,
    tarefaId: data.tarefaId,
    dados: data.dados,
  });
}

async function cancelarCiclosAbertos(
  db: DbClient,
  remanejamentoFuncionarioId: string,
  data: {
    cancelamentoAt?: Date | null;
    usuarioResponsavelId?: number | null;
    motivo?: string;
  } = {},
) {
  const cancelamentoAt = data.cancelamentoAt ?? new Date();
  const ciclos = await db.remanejamentoCiclo.findMany({
    where: {
      remanejamentoFuncionarioId,
      status: "ABERTO",
    },
  });

  for (const ciclo of ciclos) {
    await db.remanejamentoCiclo.update({
      where: { id: ciclo.id },
      data: {
        status: "CANCELADO",
        cancelamentoAt,
        motivoFechamento: data.motivo ?? "Processo cancelado",
      },
    });

    await registrarEventoCiclo(db, {
      cicloId: ciclo.id,
      remanejamentoFuncionarioId,
      tipo: "CICLO_CANCELADO",
      dataEvento: cancelamentoAt,
      usuarioResponsavelId: data.usuarioResponsavelId,
      dados: { motivo: data.motivo ?? null },
    });
  }
}

async function ignorarCicloReconstruido(
  db: DbClient,
  ciclo: {
    id: string;
    status: string;
    origem: string;
  },
  motivo: string,
) {
  if (ciclo.origem !== "RECONSTRUIDO" || ciclo.status === "IGNORADO") return;

  await db.remanejamentoCiclo.update({
    where: { id: ciclo.id },
    data: {
      status: "IGNORADO" satisfies StatusCiclo,
      motivoFechamento: motivo,
    },
  });
}

async function carregarRemanejamento(db: DbClient, remanejamentoFuncionarioId: string) {
  return db.remanejamentoFuncionario.findUnique({
    where: { id: remanejamentoFuncionarioId },
    include: {
      tarefas: {
        include: {
          setor: { select: { nome: true } },
          eventosStatus: {
            orderBy: { dataEvento: "asc" },
            select: {
              statusNovo: true,
              dataEvento: true,
              usuarioResponsavelId: true,
            },
          },
        },
      },
      ciclos: {
        orderBy: [{ numeroCiclo: "asc" }, { createdAt: "asc" }],
      },
      solicitacao: {
        select: {
          id: true,
          tipo: true,
          status: true,
          dataSolicitacao: true,
          dataAprovacao: true,
          dataConclusao: true,
          updatedAt: true,
        },
      },
    },
  });
}

function agruparTarefasPorSetor(
  tarefas: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>["tarefas"],
  options: { incluirCanceladas?: boolean } = {},
) {
  const map = new Map<SetorCadastro, typeof tarefas>();
  for (const setor of SETORES_CADASTRO) map.set(setor, []);
  for (const tarefa of tarefas) {
    if (!options.incluirCanceladas && isTarefaCancelada(tarefa.status)) continue;
    const setor = detectSetorTarefa(tarefa);
    if (!setor) continue;
    map.get(setor)?.push(tarefa);
  }
  return map;
}

function setorConcluido(
  tarefas: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>["tarefas"],
) {
  if (tarefas.length === 0) return false;
  const tarefasAtivas = tarefas.filter((t) => !isTarefaCancelada(t.status));
  return tarefasAtivas.every((t) => isTarefaFinal(t.status));
}

function dataConclusaoSetor(
  tarefas: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>["tarefas"],
) {
  return (
    maxDate(
      tarefas.flatMap((t) => [
        t.dataConclusao,
        ...t.eventosStatus
          .filter((e) => {
            const status = normalizeText(e.statusNovo);
            return status === "CONCLUIDO" || status === "CONCLUIDA" || status === "CANCELADO";
          })
          .map((e) => e.dataEvento),
      ]),
    ) ?? new Date()
  );
}

function prazoSetor(
  tarefas: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>["tarefas"],
) {
  return maxDate(tarefas.map((t) => t.dataLimite));
}

function inicioSetor(
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  tarefas: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>["tarefas"],
  numeroCiclo = 1,
) {
  if (numeroCiclo > 1) return minDate(tarefas.map((t) => t.dataCriacao)) ?? new Date();
  return rem.dataAprovado ?? minDate(tarefas.map((t) => t.dataCriacao)) ?? new Date();
}

function inicioSolicitacao(
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
) {
  return rem.solicitacao?.dataSolicitacao ?? rem.createdAt ?? new Date();
}

function fimSolicitacao(
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
) {
  return (
    rem.dataAprovado ??
    rem.solicitacao?.dataAprovacao ??
    minDate(rem.tarefas.map((t) => t.dataCriacao)) ??
    null
  );
}

function prazoSolicitacao(inicioAt: Date) {
  return new Date(inicioAt.getTime() + PRAZO_SOLICITACAO_DIAS * DIA_EM_MS);
}

async function abrirFaseSolicitacao(
  db: DbClient,
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  options: {
    origem?: OrigemCiclo;
    confianca?: ConfiancaCiclo;
    usuarioResponsavelId?: number | null;
    motivo?: string;
  } = {},
) {
  const inicioAt = inicioSolicitacao(rem);
  const fimAt = fimSolicitacao(rem);
  const origem = options.origem ?? (fimAt ? "RECONSTRUIDO" : "SISTEMA");

  const ciclo = await upsertCiclo(db, {
    remanejamentoFuncionarioId: rem.id,
    numeroCiclo: 0,
    setor: "SOLICITACAO",
    inicioAt,
    prazoPrevistoAt: prazoSolicitacao(inicioAt),
    tipoCiclo: "APROVACAO_SOLICITACAO",
    ...describeTipoCiclo("APROVACAO_SOLICITACAO", "SOLICITACAO", 0),
    origem,
    confianca: options.confianca ?? (origem === "RECONSTRUIDO" ? "MEDIA" : "ALTA"),
    motivoAbertura: options.motivo ?? "Solicitacao criada para remanejamento",
    usuarioResponsavelId: options.usuarioResponsavelId,
  });

  if (fimAt) {
    await fecharCiclo(db, ciclo, {
      conclusaoAt: fimAt,
      tipoEvento: rem.dataAprovado || rem.solicitacao?.dataAprovacao
        ? "SOLICITACAO_APROVADA"
        : "TAREFAS_GERADAS",
      motivoFechamento: "Solicitacao aprovada e liberada para atendimento dos setores",
      usuarioResponsavelId: options.usuarioResponsavelId,
      dados: {
        solicitacaoId: rem.solicitacaoId,
        tipoSolicitacao: rem.solicitacao?.tipo ?? null,
        statusSolicitacao: rem.solicitacao?.status ?? null,
      },
    });
  }
}

async function maiorNumeroCiclo(db: DbClient, remanejamentoFuncionarioId: string) {
  const agg = await db.remanejamentoCiclo.aggregate({
    where: {
      remanejamentoFuncionarioId,
      status: { not: "IGNORADO" },
    },
    _max: { numeroCiclo: true },
  });
  return agg._max.numeroCiclo ?? 0;
}

async function numeroCicloParaAtendimento(
  db: DbClient,
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  setor?: SetorCadastro,
  tarefasSetor: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>["tarefas"] = [],
) {
  const atual = await maiorNumeroCiclo(db, rem.id);
  if (atual === 0) return 1;

  const ciclosAtual = await db.remanejamentoCiclo.findMany({
    where: { remanejamentoFuncionarioId: rem.id, numeroCiclo: atual },
  });
  const temSetorAberto = ciclosAtual.some(
    (c) => c.status === "ABERTO" && SETORES_CADASTRO.includes(c.setor as SetorCadastro),
  );
  if (temSetorAberto) return atual;

  const logisticaAberta = ciclosAtual.find(
    (c) => c.setor === "LOGISTICA" && c.status === "ABERTO",
  );
  if (logisticaAberta && isStatusInvalidado(rem.statusPrestserv)) {
    await fecharCiclo(db, logisticaAberta, {
      conclusaoAt: rem.dataResposta ?? new Date(),
      tipoEvento: "DEVOLVIDO_PARA_SETOR",
      motivoFechamento: "Logistica devolveu para setores",
      dados: { statusPrestserv: rem.statusPrestserv },
    });
    return atual + 1;
  }

  if (logisticaAberta) return atual + 1;

  if (setor && tarefasSetor.some((t) => isTarefaPendenteDeAtuacao(t.status))) {
    const cicloSetorAtual = ciclosAtual.find((c) => c.setor === setor);
    const fimCicloSetor =
      cicloSetorAtual?.conclusaoAt ??
      cicloSetorAtual?.cancelamentoAt ??
      cicloSetorAtual?.updatedAt ??
      null;

    if (
      cicloSetorAtual &&
      cicloSetorAtual.status !== "ABERTO" &&
      fimCicloSetor &&
      tarefasSetor.some((t) => t.dataCriacao > fimCicloSetor)
    ) {
      return atual + 1;
    }
  }

  return atual;
}

async function cicloAnteriorDoSetorFechado(
  db: DbClient,
  remanejamentoFuncionarioId: string,
  numeroCiclo: number,
  setor: SetorCadastro,
) {
  const cicloAnterior = await db.remanejamentoCiclo.findFirst({
    where: {
      remanejamentoFuncionarioId,
      setor,
      numeroCiclo: { lt: numeroCiclo },
    },
    orderBy: { numeroCiclo: "desc" },
  });
  return Boolean(cicloAnterior && cicloAnterior.status !== "ABERTO");
}

async function atualizarConclusaoReconstruida(
  db: DbClient,
  ciclo: {
    id: string;
    origem: string;
  },
  tarefas: TarefaRemanejamentoCarregada[],
) {
  if (ciclo.origem !== "RECONSTRUIDO") return;
  const tarefasAtivas = tarefas.filter((t) => !isTarefaCancelada(t.status));
  const fechouSemPendenciaAtiva = tarefasAtivas.length === 0;
  const inicioAt = minDate(tarefasAtivas.map((t) => t.dataCriacao));

  await db.remanejamentoCiclo.update({
    where: { id: ciclo.id },
    data: {
      status: "CONCLUIDO",
      inicioAt: inicioAt ?? undefined,
      conclusaoAt: dataConclusaoSetor(tarefas),
      cancelamentoAt: null,
      motivoFechamento: fechouSemPendenciaAtiva
        ? "Todas as tarefas do setor foram canceladas ou removidas"
        : "Todas as tarefas ativas do setor foram resolvidas",
    },
  });
}

async function abrirCiclosSetores(
  db: DbClient,
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  options: {
    origem?: OrigemCiclo;
    confianca?: ConfiancaCiclo;
    usuarioResponsavelId?: number | null;
    motivo?: string;
    numeroCiclo?: number;
    incluirSetoresConcluidos?: boolean;
  } = {},
) {
  const tarefasPorSetor = agruparTarefasPorSetor(rem.tarefas, { incluirCanceladas: true });
  const reconstruindoHistorico =
    options.incluirSetoresConcluidos && options.origem === "RECONSTRUIDO";
  const cicloPorTarefa = reconstruindoHistorico
    ? mapearCicloPorLoteDeCriacao(rem.tarefas)
    : null;
  const ciclosEsperados = new Set<string>();

  for (const [setor, tarefas] of tarefasPorSetor.entries()) {
    const grupos = cicloPorTarefa
      ? agruparPorNumeroCicloSemSobreposicao(tarefas, cicloPorTarefa)
      : ([[options.numeroCiclo ?? 0, tarefas]] as Array<
          [number, TarefaRemanejamentoCarregada[]]
        >);

    for (const [numeroCicloLote, tarefasGrupo] of grupos) {
      const tarefasAtivas = tarefasGrupo.filter((t) => !isTarefaCancelada(t.status));
      if (tarefasAtivas.length === 0) continue;

      const numeroCiclo =
        reconstruindoHistorico && numeroCicloLote > 0
          ? numeroCicloLote
          : options.numeroCiclo ??
            (await numeroCicloParaAtendimento(db, rem, setor, tarefasAtivas));
      ciclosEsperados.add(`${numeroCiclo}:${setor}`);

      const precisaAtuar =
        options.incluirSetoresConcluidos ||
        numeroCiclo === 1 ||
        tarefasAtivas.some((t) => isTarefaPendenteDeAtuacao(t.status));
      if (!precisaAtuar) continue;
      const classificacao = classificarCiclo({
        setor,
        numeroCiclo,
        origem: options.origem,
        motivo: options.motivo,
        statusPrestserv: rem.statusPrestserv,
        cicloAnteriorFechado: await cicloAnteriorDoSetorFechado(db, rem.id, numeroCiclo, setor),
      });
      const tarefasReferenciaCiclo =
        numeroCiclo > 1
          ? tarefasAtivas.filter((t) => isTarefaPendenteDeAtuacao(t.status))
          : tarefasAtivas;
      const tarefasParaDatas =
        tarefasReferenciaCiclo.length > 0 ? tarefasReferenciaCiclo : tarefasAtivas;

      const ciclo = await upsertCiclo(db, {
        remanejamentoFuncionarioId: rem.id,
        numeroCiclo,
        setor,
        inicioAt: inicioSetor(rem, tarefasParaDatas, numeroCiclo),
        prazoPrevistoAt: prazoSetor(tarefasParaDatas),
        ...classificacao,
        origem: options.origem,
        confianca: options.confianca,
        motivoAbertura: options.motivo ?? "Atendimento de tarefas do setor",
        usuarioResponsavelId: options.usuarioResponsavelId,
      });

      if (reconstruindoHistorico && setorConcluido(tarefasGrupo)) {
        await atualizarConclusaoReconstruida(db, ciclo, tarefasGrupo);
      }
    }
  }

  if (reconstruindoHistorico) {
    const ciclosSetorReconstruidos = await db.remanejamentoCiclo.findMany({
      where: {
        remanejamentoFuncionarioId: rem.id,
        origem: "RECONSTRUIDO",
        setor: { in: [...SETORES_CADASTRO] },
      },
    });

    for (const ciclo of ciclosSetorReconstruidos) {
      if (ciclosEsperados.has(`${ciclo.numeroCiclo}:${ciclo.setor}`)) continue;
      await ignorarCicloReconstruido(
        db,
        ciclo,
        "Ciclo reconstruido substituido por inferencia mais precisa de lotes de tarefas",
      );
    }
  }
}

async function fecharSetoresConcluidos(
  db: DbClient,
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  usuarioResponsavelId?: number | null,
) {
  const tarefasPorSetor = agruparTarefasPorSetor(rem.tarefas, { incluirCanceladas: true });
  const ciclosAbertos = await db.remanejamentoCiclo.findMany({
    where: {
      remanejamentoFuncionarioId: rem.id,
      status: "ABERTO",
      setor: { in: [...SETORES_CADASTRO] },
    },
  });

  for (const ciclo of ciclosAbertos) {
    const setor = ciclo.setor as SetorCadastro;
    const tarefas = tarefasPorSetor.get(setor) ?? [];
    if (!setorConcluido(tarefas)) continue;
    const tarefasAtivas = tarefas.filter((t) => !isTarefaCancelada(t.status));
    const fechouSemPendenciaAtiva = tarefasAtivas.length === 0;

    await fecharCiclo(db, ciclo, {
      conclusaoAt: dataConclusaoSetor(tarefas),
      tipoEvento: fechouSemPendenciaAtiva
        ? "SETOR_SEM_PENDENCIA_ATIVA"
        : "SETOR_CONCLUIDO",
      motivoFechamento: fechouSemPendenciaAtiva
        ? "Todas as tarefas do setor foram canceladas ou removidas"
        : "Todas as tarefas ativas do setor foram resolvidas",
      usuarioResponsavelId,
      dados: {
        setor,
        totalTarefas: tarefas.length,
        totalTarefasAtivas: tarefasAtivas.length,
        totalTarefasCanceladas: tarefas.length - tarefasAtivas.length,
      },
    });
  }
}

async function reconstruirLogisticasEntreCiclos(
  db: DbClient,
  remanejamentoFuncionarioId: string,
  usuarioResponsavelId?: number | null,
) {
  const maiorCiclo = await maiorNumeroCiclo(db, remanejamentoFuncionarioId);
  if (maiorCiclo <= 1) return;
  const logisticasIntermediariasEsperadas = new Set<number>();

  for (let numeroCiclo = 1; numeroCiclo < maiorCiclo; numeroCiclo += 1) {
    const [ciclosSetor, proximosCiclosSetor] = await Promise.all([
      db.remanejamentoCiclo.findMany({
        where: {
          remanejamentoFuncionarioId,
          numeroCiclo,
          setor: { in: [...SETORES_CADASTRO] },
        },
      }),
      db.remanejamentoCiclo.findMany({
        where: {
          remanejamentoFuncionarioId,
          numeroCiclo: numeroCiclo + 1,
          setor: { in: [...SETORES_CADASTRO] },
        },
      }),
    ]);

    if (ciclosSetor.length === 0 || proximosCiclosSetor.length === 0) continue;
    if (ciclosSetor.some((c) => c.status === "ABERTO")) continue;

    const inicioAt = maxDate(ciclosSetor.map((c) => c.conclusaoAt ?? c.cancelamentoAt));
    const conclusaoAt = minDate(proximosCiclosSetor.map((c) => c.inicioAt));
    if (!inicioAt || !conclusaoAt || conclusaoAt < inicioAt) continue;

    const foiParaLogistica = await db.historicoRemanejamento.findFirst({
      where: {
        remanejamentoFuncionarioId,
        campoAlterado: "statusTarefas",
        valorNovo: "SUBMETER RASCUNHO",
        dataAcao: {
          gte: inicioAt,
          lte: conclusaoAt,
        },
      },
      select: { id: true },
    });
    if (!foiParaLogistica) continue;
    logisticasIntermediariasEsperadas.add(numeroCiclo);

    const classificacao = classificarCiclo({
      setor: "LOGISTICA",
      numeroCiclo,
      origem: "RECONSTRUIDO",
      motivo: "Logistica avaliou ciclo anterior antes de novo lote de tarefas",
    });

    const ciclo = await upsertCiclo(db, {
      remanejamentoFuncionarioId,
      numeroCiclo,
      setor: "LOGISTICA",
      inicioAt,
      prazoPrevistoAt: new Date(inicioAt.getTime() + 7 * DIA_EM_MS),
      ...classificacao,
      origem: "RECONSTRUIDO",
      confianca: "MEDIA",
      motivoAbertura: "Setores concluidos; aguardando avaliacao da Logistica",
      usuarioResponsavelId,
    });

    await db.remanejamentoCiclo.update({
      where: { id: ciclo.id },
      data: {
        status: "CONCLUIDO",
        origem: "RECONSTRUIDO",
        confianca: "MEDIA",
        inicioAt,
        prazoPrevistoAt: new Date(inicioAt.getTime() + 7 * DIA_EM_MS),
        conclusaoAt,
        cancelamentoAt: null,
        motivoFechamento:
          "Novo lote de tarefas abriu reatendimento apos avaliacao da Logistica",
      },
    });
  }

  const logisticasReconstruidas = await db.remanejamentoCiclo.findMany({
    where: {
      remanejamentoFuncionarioId,
      setor: "LOGISTICA",
      origem: "RECONSTRUIDO",
      numeroCiclo: { lt: maiorCiclo },
    },
  });
  for (const ciclo of logisticasReconstruidas) {
    if (logisticasIntermediariasEsperadas.has(ciclo.numeroCiclo)) continue;
    await ignorarCicloReconstruido(
      db,
      ciclo,
      "Logistica intermediaria ignorada por falta de evidencia historica de SUBMETER RASCUNHO entre os lotes",
    );
  }
}

async function corrigirLogisticasOrfas(
  db: DbClient,
  remanejamentoFuncionarioId: string,
  usuarioResponsavelId?: number | null,
) {
  const logisticas = await db.remanejamentoCiclo.findMany({
    where: {
      remanejamentoFuncionarioId,
      setor: "LOGISTICA",
      status: { not: "IGNORADO" },
    },
    orderBy: { numeroCiclo: "asc" },
  });

  for (const logistica of logisticas) {
    const logisticaJaEnviada = await db.integracaoOutbox.findFirst({
      where: {
        cicloId: logistica.id,
        status: { in: ["AGENDADO_SESSAO", "ENVIADO"] },
      },
      select: { id: true },
    });
    if (logisticaJaEnviada) continue;

    const setoresMesmoCiclo = await db.remanejamentoCiclo.findMany({
      where: {
        remanejamentoFuncionarioId,
        numeroCiclo: logistica.numeroCiclo,
        setor: { in: [...SETORES_CADASTRO] },
        status: { not: "IGNORADO" },
      },
    });
    if (setoresMesmoCiclo.length > 0) continue;

    const setoresCandidatos = await db.remanejamentoCiclo.findMany({
      where: {
        remanejamentoFuncionarioId,
        setor: { in: [...SETORES_CADASTRO] },
        status: { not: "IGNORADO" },
        numeroCiclo: { lt: logistica.numeroCiclo },
      },
      orderBy: { numeroCiclo: "desc" },
    });
    const numeroDestino = setoresCandidatos[0]?.numeroCiclo;

    if (!numeroDestino) {
      await ignorarCicloReconstruido(
        db,
        logistica,
        "Logistica reconstruida ignorada por nao haver ciclo de setores correspondente",
      );
      continue;
    }

    const logisticaDestino = await db.remanejamentoCiclo.findUnique({
      where: {
        remanejamentoFuncionarioId_numeroCiclo_setor: {
          remanejamentoFuncionarioId,
          numeroCiclo: numeroDestino,
          setor: "LOGISTICA",
        },
      },
    });

    if (logisticaDestino && logisticaDestino.id !== logistica.id) {
      await ignorarCicloReconstruido(
        db,
        logistica,
        "Logistica reconstruida ignorada por ja existir Logistica no ciclo de setores correspondente",
      );
      continue;
    }

    const setoresDestino = await db.remanejamentoCiclo.findMany({
      where: {
        remanejamentoFuncionarioId,
        numeroCiclo: numeroDestino,
        setor: { in: [...SETORES_CADASTRO] },
        status: { not: "IGNORADO" },
      },
    });
    const inicioAt =
      maxDate(setoresDestino.map((c) => c.conclusaoAt ?? c.cancelamentoAt)) ??
      logistica.inicioAt;

    await db.remanejamentoCiclo.update({
      where: { id: logistica.id },
      data: {
        numeroCiclo: numeroDestino,
        inicioAt,
        prazoPrevistoAt: new Date(inicioAt.getTime() + 7 * DIA_EM_MS),
        motivoAbertura:
          "Logistica realocada para o ciclo de setores correspondente apos saneamento de sobreposicao",
      },
    });

    await registrarEventoCiclo(db, {
      cicloId: logistica.id,
      remanejamentoFuncionarioId,
      tipo: "LOGISTICA_REALOCADA",
      dataEvento: new Date(),
      origem: "RECONSTRUIDO",
      usuarioResponsavelId,
      dados: {
        numeroCicloAnterior: logistica.numeroCiclo,
        numeroCicloNovo: numeroDestino,
        motivo:
          "Ciclo de setor sobreposto foi ignorado; Logistica foi movida para o ciclo valido correspondente.",
      },
    });
  }
}

async function abrirLogisticaSePronto(
  db: DbClient,
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  usuarioResponsavelId?: number | null,
) {
  const statusTarefas = normalizeText(rem.statusTarefas);
  const statusPrestserv = normalizeStatusPrestserv(rem.statusPrestserv);
  const processoEstaNaLogisticaOuFinalizado =
    statusTarefas === "SUBMETER RASCUNHO" ||
    statusTarefas === "CONCLUIDO" ||
    statusPrestserv === "VALIDADO";

  if (!processoEstaNaLogisticaOuFinalizado) return;

  const numeroCiclo = (await maiorNumeroCiclo(db, rem.id)) || 1;
  const ciclosSetor = await db.remanejamentoCiclo.findMany({
    where: {
      remanejamentoFuncionarioId: rem.id,
      numeroCiclo,
      setor: { in: [...SETORES_CADASTRO] },
    },
  });
  if (ciclosSetor.length === 0) return;
  if (ciclosSetor.some((c) => c.status === "ABERTO")) return;

  const fimSetores =
    maxDate(ciclosSetor.map((c) => c.conclusaoAt ?? c.cancelamentoAt)) ??
    rem.updatedAt ??
    new Date();
  const origemLogistica =
    statusTarefas === "SUBMETER RASCUNHO" ? "SISTEMA" : "RECONSTRUIDO";
  const classificacao = classificarCiclo({
    setor: "LOGISTICA",
    numeroCiclo,
    motivo: "Setores concluidos; aguardando avaliacao da Logistica",
    statusPrestserv: rem.statusPrestserv,
    origem: origemLogistica,
  });

  await upsertCiclo(db, {
    remanejamentoFuncionarioId: rem.id,
    numeroCiclo,
    setor: "LOGISTICA",
    inicioAt: fimSetores,
    prazoPrevistoAt: new Date(fimSetores.getTime() + 7 * 24 * 60 * 60 * 1000),
    ...classificacao,
    origem: origemLogistica,
    confianca: origemLogistica === "RECONSTRUIDO" ? "MEDIA" : "ALTA",
    motivoAbertura: "Setores concluidos; aguardando avaliacao da Logistica",
    usuarioResponsavelId,
  });
}

async function fecharLogisticaSeFinal(
  db: DbClient,
  rem: NonNullable<Awaited<ReturnType<typeof carregarRemanejamento>>>,
  usuarioResponsavelId?: number | null,
) {
  const statusPrestserv = normalizeStatusPrestserv(rem.statusPrestserv);
  if (statusPrestserv !== "VALIDADO") return;

  const logisticaAberta = await db.remanejamentoCiclo.findFirst({
    where: {
      remanejamentoFuncionarioId: rem.id,
      setor: "LOGISTICA",
      status: "ABERTO",
    },
    orderBy: { numeroCiclo: "desc" },
  });
  if (!logisticaAberta) return;

  await fecharCiclo(db, logisticaAberta, {
    conclusaoAt: rem.dataConcluido ?? rem.dataResposta ?? new Date(),
    tipoEvento: "PROCESSO_VALIDADO",
    motivoFechamento: "Logistica validou o processo",
    usuarioResponsavelId,
    dados: { statusPrestserv: rem.statusPrestserv },
  });
}

export async function reconciliarCiclosRemanejamento(
  remanejamentoFuncionarioId: string,
  options: {
    db?: DbClient;
    origem?: OrigemCiclo;
    confianca?: ConfiancaCiclo;
    usuarioResponsavelId?: number | null;
    motivo?: string;
  } = {},
) {
  const db = options.db ?? prisma;
  const rem = await carregarRemanejamento(db, remanejamentoFuncionarioId);
  if (!rem) return;

  const statusTarefas = normalizeText(rem.statusTarefas);
  const statusPrestserv = normalizeStatusPrestserv(rem.statusPrestserv);

  await abrirFaseSolicitacao(db, rem, options);

  if (statusTarefas === "CANCELADO" || statusPrestserv === "CANCELADO" || rem.dataCancelado) {
    await cancelarCiclosAbertos(db, rem.id, {
      cancelamentoAt: rem.dataCancelado ?? new Date(),
      usuarioResponsavelId: options.usuarioResponsavelId,
      motivo: options.motivo ?? "Cancelamento detectado na reconciliacao",
    });
    return;
  }

  const temCicloSetor = rem.ciclos.some((c) =>
    SETORES_CADASTRO.includes(c.setor as SetorCadastro),
  );
  const temCicloSetorReconstruido = rem.ciclos.some(
    (c) => c.origem === "RECONSTRUIDO" && SETORES_CADASTRO.includes(c.setor as SetorCadastro),
  );

  if (statusTarefas === "ATENDER TAREFAS") {
    await abrirCiclosSetores(db, rem, options);
  } else if (
    (statusTarefas === "SUBMETER RASCUNHO" ||
      statusPrestserv === "VALIDADO" ||
      isStatusInvalidado(statusPrestserv)) &&
    (!temCicloSetor || temCicloSetorReconstruido)
  ) {
    const numeroCicloReconstruido = (await maiorNumeroCiclo(db, rem.id)) || 1;
    await abrirCiclosSetores(db, rem, {
      ...options,
      origem: options.origem ?? "RECONSTRUIDO",
      confianca: options.confianca ?? "MEDIA",
      numeroCiclo: numeroCicloReconstruido,
      incluirSetoresConcluidos: true,
      motivo:
        options.motivo ??
        "Reconstrucao de setores para processo ja enviado a Logistica",
    });
  }

  await fecharSetoresConcluidos(db, rem, options.usuarioResponsavelId);
  await reconstruirLogisticasEntreCiclos(db, rem.id, options.usuarioResponsavelId);
  await corrigirLogisticasOrfas(db, rem.id, options.usuarioResponsavelId);
  await abrirLogisticaSePronto(db, rem, options.usuarioResponsavelId);
  await fecharLogisticaSeFinal(db, rem, options.usuarioResponsavelId);

  await sincronizarEventosCadastroExternoSafe({
    db,
    remanejamentoFuncionarioId: rem.id,
  });
}

export async function reconciliarCiclosRemanejamentoSafe(
  remanejamentoFuncionarioId: string,
  options: Omit<Parameters<typeof reconciliarCiclosRemanejamento>[1], "db"> = {},
) {
  try {
    await reconciliarCiclosRemanejamento(remanejamentoFuncionarioId, options);
  } catch (error) {
    console.error(
      "Erro ao reconciliar ciclos do remanejamento:",
      remanejamentoFuncionarioId,
      error,
    );
  }
}

export async function reconciliarCiclosPorTarefaSafe(
  tarefaId: string,
  options: Omit<Parameters<typeof reconciliarCiclosRemanejamento>[1], "db"> = {},
) {
  try {
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
      where: { id: tarefaId },
      select: { remanejamentoFuncionarioId: true },
    });
    if (!tarefa) return;
    await reconciliarCiclosRemanejamento(tarefa.remanejamentoFuncionarioId, options);
  } catch (error) {
    console.error("Erro ao reconciliar ciclos pela tarefa:", tarefaId, error);
  }
}
