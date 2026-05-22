import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TipoSolicitacaoKey =
  | "ALOCACAO"
  | "REMANEJAMENTO"
  | "DESLIGAMENTO"
  | "VINCULO_ADICIONAL"
  | "DESVINCULO_ADICIONAL";

const TIPOS_SOLICITACAO: TipoSolicitacaoKey[] = [
  "ALOCACAO",
  "REMANEJAMENTO",
  "DESLIGAMENTO",
  "VINCULO_ADICIONAL",
  "DESVINCULO_ADICIONAL",
];

const STATUS_PRESTSERV_ATENDIMENTO_LOGISTICA = new Set([
  "EM VALIDACAO",
  "EM ANALISE",
  "EM_ANALISE",
  "VALIDADO",
  "INVALIDADO",
  "REPROVADO",
  "REJEITADO",
]);

type EventoPerformance = {
  dataEvento: Date;
  usuarioId: number;
  usuario: string;
  matricula: string;
  setorTarefa: string;
  tipoSolicitacao: TipoSolicitacaoKey | null;
  tempoHoras: number | null;
};

function normalizeText(value?: string | null) {
  return (value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectSetor(value?: string | null) {
  const v = normalizeText(value);
  if (!v) return "";
  if (v.includes("TREIN")) return "TREINAMENTO";
  if (v.includes("MEDIC")) return "MEDICINA";
  if (
    v.includes("RECURSOS") ||
    v.includes("HUMANOS") ||
    v.includes(" RH") ||
    v === "RH"
  ) {
    return "RH";
  }
  return v;
}

function isSetorLogistica(setorNormalizado: string) {
  return setorNormalizado.includes("LOGIST");
}

function isEquipeLogistica(value?: string | null) {
  return normalizeText(value).includes("LOGIST");
}

function matchesSetorFilter(setorNormalizado: string, setorFiltro: string | null) {
  if (!setorFiltro) return true;
  if (setorFiltro === "LOGISTICA") return isSetorLogistica(setorNormalizado);
  return setorNormalizado === setorFiltro || setorNormalizado.includes(setorFiltro);
}

function getDateRange(searchParams: URLSearchParams) {
  const startDateRaw = searchParams.get("startDate");
  const endDateRaw = searchParams.get("endDate");

  const startDate = startDateRaw
    ? new Date(`${startDateRaw}T00:00:00.000Z`)
    : undefined;
  const endDate = endDateRaw ? new Date(`${endDateRaw}T23:59:59.999Z`) : undefined;

  return {
    startDate:
      startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
    endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
  };
}

function getTipoKey(value?: string | null): TipoSolicitacaoKey | null {
  const normalized = normalizeText(value) as TipoSolicitacaoKey;
  return TIPOS_SOLICITACAO.includes(normalized) ? normalized : null;
}

function buildResponse({
  eventos,
  startDate,
  endDate,
  setorFiltro,
  filtroSetores,
  filtroTodos,
}: {
  eventos: EventoPerformance[];
  startDate?: Date;
  endDate?: Date;
  setorFiltro: string | null;
  filtroSetores: boolean;
  filtroTodos: boolean;
}) {
  type Aggregate = {
    usuarioId: number;
    usuario: string;
    matricula: string;
    setorTarefa: string;
    totalAtuacoes: number;
    temposHoras: number[];
    primeiraAtuacao: Date | null;
    ultimaAtuacao: Date | null;
    porTipo: Record<TipoSolicitacaoKey, number>;
  };

  type UserAggregate = {
    usuarioId: number;
    usuario: string;
    matricula: string;
    totalAtuacoes: number;
    temposHoras: number[];
  };

  const tabelaMap = new Map<string, Aggregate>();
  const usuarioMap = new Map<number, UserAggregate>();
  const serieDiariaMap = new Map<string, number>();
  const tiposMap = new Map<TipoSolicitacaoKey, number>();
  const setoresMap = new Map<string, number>();
  const opcoesSetor = new Set<string>();

  for (const tipo of TIPOS_SOLICITACAO) {
    tiposMap.set(tipo, 0);
  }

  for (const evento of eventos) {
    opcoesSetor.add(evento.setorTarefa);

    const chaveTabela = `${evento.usuarioId}-${evento.setorTarefa}`;
    const itemTabela = tabelaMap.get(chaveTabela) || {
      usuarioId: evento.usuarioId,
      usuario: evento.usuario,
      matricula: evento.matricula,
      setorTarefa: evento.setorTarefa,
      totalAtuacoes: 0,
      temposHoras: [],
      primeiraAtuacao: null,
      ultimaAtuacao: null,
      porTipo: {
        ALOCACAO: 0,
        REMANEJAMENTO: 0,
        DESLIGAMENTO: 0,
        VINCULO_ADICIONAL: 0,
        DESVINCULO_ADICIONAL: 0,
      },
    };

    itemTabela.totalAtuacoes += 1;
    if (evento.tempoHoras !== null) itemTabela.temposHoras.push(evento.tempoHoras);
    if (!itemTabela.primeiraAtuacao || itemTabela.primeiraAtuacao > evento.dataEvento) {
      itemTabela.primeiraAtuacao = evento.dataEvento;
    }
    if (!itemTabela.ultimaAtuacao || itemTabela.ultimaAtuacao < evento.dataEvento) {
      itemTabela.ultimaAtuacao = evento.dataEvento;
    }
    if (evento.tipoSolicitacao) {
      itemTabela.porTipo[evento.tipoSolicitacao] += 1;
      tiposMap.set(
        evento.tipoSolicitacao,
        (tiposMap.get(evento.tipoSolicitacao) || 0) + 1,
      );
    }
    tabelaMap.set(chaveTabela, itemTabela);

    const itemUsuario = usuarioMap.get(evento.usuarioId) || {
      usuarioId: evento.usuarioId,
      usuario: evento.usuario,
      matricula: evento.matricula,
      totalAtuacoes: 0,
      temposHoras: [],
    };
    itemUsuario.totalAtuacoes += 1;
    if (evento.tempoHoras !== null) itemUsuario.temposHoras.push(evento.tempoHoras);
    usuarioMap.set(evento.usuarioId, itemUsuario);

    const dia = evento.dataEvento.toISOString().slice(0, 10);
    serieDiariaMap.set(dia, (serieDiariaMap.get(dia) || 0) + 1);
    setoresMap.set(evento.setorTarefa, (setoresMap.get(evento.setorTarefa) || 0) + 1);
  }

  const tabela = Array.from(tabelaMap.values())
    .map((item) => {
      const tempoTotalHoras = item.temposHoras.reduce((acc, h) => acc + h, 0);
      const mediaTempoHoras = item.temposHoras.length
        ? tempoTotalHoras / item.temposHoras.length
        : 0;
      return {
        usuarioId: item.usuarioId,
        usuario: item.usuario,
        matricula: item.matricula,
        setorTarefa: item.setorTarefa,
        totalAtuacoes: item.totalAtuacoes,
        alocacao: item.porTipo.ALOCACAO,
        remanejamento: item.porTipo.REMANEJAMENTO,
        desligamento: item.porTipo.DESLIGAMENTO,
        vinculoAdicional: item.porTipo.VINCULO_ADICIONAL,
        desvinculoAdicional: item.porTipo.DESVINCULO_ADICIONAL,
        tempoTotalHoras: Number(tempoTotalHoras.toFixed(2)),
        mediaTempoHoras: Number(mediaTempoHoras.toFixed(2)),
        primeiraAtuacao: item.primeiraAtuacao?.toISOString() || null,
        ultimaAtuacao: item.ultimaAtuacao?.toISOString() || null,
      };
    })
    .sort((a, b) => b.totalAtuacoes - a.totalAtuacoes);

  const atuacoesPorUsuario = Array.from(usuarioMap.values())
    .map((item) => ({
      usuarioId: item.usuarioId,
      usuario: item.usuario,
      matricula: item.matricula,
      total: item.totalAtuacoes,
    }))
    .sort((a, b) => b.total - a.total);

  const tempoMedioPorUsuario = Array.from(usuarioMap.values())
    .map((item) => {
      const media = item.temposHoras.length
        ? item.temposHoras.reduce((acc, h) => acc + h, 0) / item.temposHoras.length
        : 0;
      return {
        usuarioId: item.usuarioId,
        usuario: item.usuario,
        matricula: item.matricula,
        mediaHoras: Number(media.toFixed(2)),
      };
    })
    .sort((a, b) => b.mediaHoras - a.mediaHoras);

  const atuacoesPorTipo = TIPOS_SOLICITACAO.map((tipo) => ({
    tipo,
    total: tiposMap.get(tipo) || 0,
  }));

  const atuacoesPorSetor = Array.from(setoresMap.entries())
    .map(([setor, total]) => ({ setor, total }))
    .sort((a, b) => b.total - a.total);

  const serieDiaria = Array.from(serieDiariaMap.entries())
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const tempoGeralValores = tabela.map((item) => item.mediaTempoHoras);
  const tempoMedioHorasGeral = tempoGeralValores.length
    ? tempoGeralValores.reduce((acc, h) => acc + h, 0) / tempoGeralValores.length
    : 0;

  return {
    periodo: {
      inicio: startDate?.toISOString() || null,
      fim: endDate?.toISOString() || null,
    },
    filtros: {
      setor: setorFiltro,
      modoSetor: filtroSetores ? "SETORES" : filtroTodos ? "TODOS" : "EXATO",
    },
    resumo: {
      totalAtuacoes: tabela.reduce((acc, item) => acc + item.totalAtuacoes, 0),
      totalUsuarios: new Set(tabela.map((item) => item.usuarioId)).size,
      totalSetores: new Set(tabela.map((item) => item.setorTarefa)).size,
      tempoMedioHorasGeral: Number(tempoMedioHorasGeral.toFixed(2)),
    },
    opcoes: {
      setores: Array.from(opcoesSetor).sort((a, b) => a.localeCompare(b)),
    },
    graficos: {
      atuacoesPorUsuario,
      tempoMedioPorUsuario,
      atuacoesPorTipo,
      atuacoesPorSetor,
      serieDiaria,
    },
    tabela,
  };
}

async function carregarEventosSetores({
  startDate,
  endDate,
  setorFiltro,
  filtroSetores,
}: {
  startDate?: Date;
  endDate?: Date;
  setorFiltro: string | null;
  filtroSetores: boolean;
}): Promise<EventoPerformance[]> {
  const whereDataEvento: { gte?: Date; lte?: Date } = {};
  if (startDate) whereDataEvento.gte = startDate;
  if (endDate) whereDataEvento.lte = endDate;

  const eventos = await prisma.tarefaStatusEvento.findMany({
    where: {
      usuarioResponsavelId: { not: null },
      statusNovo: { in: ["CONCLUIDO", "CONCLUIDA"] },
      ...(startDate || endDate ? { dataEvento: whereDataEvento } : {}),
    },
    select: {
      dataEvento: true,
      tarefaId: true,
      usuarioResponsavelId: true,
    },
    orderBy: { dataEvento: "asc" },
  });

  const tarefaIds = Array.from(new Set(eventos.map((e) => e.tarefaId).filter(Boolean)));
  const usuarioIds = Array.from(
    new Set(
      eventos
        .map((e) => e.usuarioResponsavelId)
        .filter((id): id is number => typeof id === "number"),
    ),
  );

  const [tarefas, usuarios] = await Promise.all([
    tarefaIds.length
      ? prisma.tarefaRemanejamento.findMany({
          where: { id: { in: tarefaIds } },
          select: {
            id: true,
            tipo: true,
            responsavel: true,
            dataCriacao: true,
            dataConclusao: true,
            setor: { select: { nome: true } },
            remanejamentoFuncionario: {
              select: {
                solicitacao: {
                  select: {
                    tipo: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    usuarioIds.length
      ? prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: {
            id: true,
            funcionario: {
              select: {
                nome: true,
                matricula: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const tarefaById = new Map(tarefas.map((t) => [t.id, t]));
  const usuarioById = new Map(usuarios.map((u) => [u.id, u]));
  const saida: EventoPerformance[] = [];

  for (const evento of eventos) {
    if (!evento.usuarioResponsavelId) continue;
    const tarefa = tarefaById.get(evento.tarefaId);
    if (!tarefa) continue;

    const setorTarefa = tarefa.setor?.nome || detectSetor(tarefa.responsavel) || "NAO INFORMADO";
    const setorNormalizado = normalizeText(setorTarefa);

    if (filtroSetores && isSetorLogistica(setorNormalizado)) continue;
    if (!matchesSetorFilter(setorNormalizado, setorFiltro)) continue;

    const usuario = usuarioById.get(evento.usuarioResponsavelId);
    const conclusao = tarefa.dataConclusao || evento.dataEvento;
    const criacao = tarefa.dataCriacao;
    const tempoHoras = criacao
      ? Math.max(0, (conclusao.getTime() - criacao.getTime()) / 1000 / 60 / 60)
      : null;

    saida.push({
      dataEvento: evento.dataEvento,
      usuarioId: evento.usuarioResponsavelId,
      usuario: usuario?.funcionario?.nome || `Usuario #${evento.usuarioResponsavelId}`,
      matricula: usuario?.funcionario?.matricula || "-",
      setorTarefa,
      tipoSolicitacao: getTipoKey(tarefa.remanejamentoFuncionario?.solicitacao?.tipo),
      tempoHoras,
    });
  }

  return saida;
}

async function carregarEventosLogistica({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
}): Promise<EventoPerformance[]> {
  const whereDataAcao: { gte?: Date; lte?: Date } = {};
  if (startDate) whereDataAcao.gte = startDate;
  if (endDate) whereDataAcao.lte = endDate;

  const historicos = await prisma.historicoRemanejamento.findMany({
    where: {
      remanejamentoFuncionarioId: { not: null },
      usuarioResponsavelId: { not: null },
      ...(startDate || endDate ? { dataAcao: whereDataAcao } : {}),
    },
    select: {
      remanejamentoFuncionarioId: true,
      dataAcao: true,
      tipoAcao: true,
      entidade: true,
      campoAlterado: true,
      valorNovo: true,
      descricaoAcao: true,
      usuarioResponsavelId: true,
      usuario: {
        select: {
          id: true,
          funcionario: { select: { nome: true, matricula: true } },
          equipe: { select: { nome: true } },
        },
      },
      equipe: { select: { nome: true } },
    },
    orderBy: { dataAcao: "asc" },
  });

  const historicosRelevantes = historicos.filter((h) => {
    if (!h.remanejamentoFuncionarioId || !h.usuarioResponsavelId || !h.dataAcao) return false;

    const campo = normalizeText(h.campoAlterado);
    const valorNovo = normalizeText(h.valorNovo);
    const descricaoAcao = normalizeText(h.descricaoAcao);
    const usuarioEquipeAtualLogistica = isEquipeLogistica(h.usuario?.equipe?.nome);

    // Regra solicitada: considerar somente usuários que atualmente pertencem
    // aos grupos da logística (equipe atual do usuário).
    if (!usuarioEquipeAtualLogistica) return false;

    // Logística deve refletir apenas decisões reais de atendimento no fluxo
    // (aprovação, reprovação e envio para análise), excluindo ruído automático.
    const acaoAtendimentoFluxo =
      campo === "STATUSPRESTSERV" &&
      STATUS_PRESTSERV_ATENDIMENTO_LOGISTICA.has(valorNovo);
    const eventoAutomatico =
      descricaoAcao.includes("AUTOMAT") || descricaoAcao.includes("SINCRONIZ");

    return acaoAtendimentoFluxo && !eventoAutomatico;
  });

  const remanejamentoIds = Array.from(
    new Set(
      historicosRelevantes
        .map((h) => h.remanejamentoFuncionarioId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const remanejamentos = remanejamentoIds.length
    ? await prisma.remanejamentoFuncionario.findMany({
        where: { id: { in: remanejamentoIds } },
        select: {
          id: true,
          solicitacao: { select: { tipo: true } },
        },
      })
    : [];

  const remanejamentoById = new Map(remanejamentos.map((r) => [r.id, r]));
  const atendimentoPorUsuarioRemanejamento = new Map<
    string,
    {
      remId: string;
      usuarioId: number;
      usuario: string;
      matricula: string;
      primeiraAcao: Date;
      ultimaAcao: Date;
    }
  >();

  for (const historico of historicosRelevantes) {
    const remId = historico.remanejamentoFuncionarioId;
    const usuarioId = historico.usuarioResponsavelId;
    if (!remId || !usuarioId || !historico.dataAcao) continue;

    const remanejamento = remanejamentoById.get(remId);
    if (!remanejamento) continue;

    const chave = `${remId}|${usuarioId}`;
    const dataAtual = new Date(historico.dataAcao);
    const atual = atendimentoPorUsuarioRemanejamento.get(chave);

    if (!atual) {
      atendimentoPorUsuarioRemanejamento.set(chave, {
        remId,
        usuarioId,
        usuario: historico.usuario?.funcionario?.nome || `Usuario #${usuarioId}`,
        matricula: historico.usuario?.funcionario?.matricula || "-",
        primeiraAcao: dataAtual,
        ultimaAcao: dataAtual,
      });
      continue;
    }

    if (dataAtual < atual.primeiraAcao) atual.primeiraAcao = dataAtual;
    if (dataAtual > atual.ultimaAcao) atual.ultimaAcao = dataAtual;
  }

  return Array.from(atendimentoPorUsuarioRemanejamento.values()).map((item) => {
    const remanejamento = remanejamentoById.get(item.remId);
    const tempoHoras = Math.max(
      0,
      (item.ultimaAcao.getTime() - item.primeiraAcao.getTime()) / 1000 / 60 / 60,
    );

    return {
      dataEvento: item.primeiraAcao,
      usuarioId: item.usuarioId,
      usuario: item.usuario,
      matricula: item.matricula,
      setorTarefa: "LOGISTICA",
      tipoSolicitacao: getTipoKey(remanejamento?.solicitacao?.tipo),
      tempoHoras,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = getDateRange(searchParams);
    const setorParam = normalizeText(searchParams.get("setor"));
    const filtroSetores = setorParam === "SETORES";
    const filtroTodos = setorParam === "TODOS";
    const setorFiltro = !setorParam ? "LOGISTICA" : filtroSetores || filtroTodos ? null : setorParam;

    const eventos =
      setorFiltro === "LOGISTICA"
        ? await carregarEventosLogistica({ startDate, endDate })
        : await carregarEventosSetores({
            startDate,
            endDate,
            setorFiltro,
            filtroSetores,
          });

    return NextResponse.json(
      buildResponse({
        eventos,
        startDate,
        endDate,
        setorFiltro,
        filtroSetores,
        filtroTodos,
      }),
    );
  } catch (error) {
    console.error("Erro ao gerar desempenho de usuarios:", error);
    return NextResponse.json(
      { error: "Erro ao gerar dados de desempenho de usuários" },
      { status: 500 },
    );
  }
}
