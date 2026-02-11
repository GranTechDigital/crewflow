import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Duracao = { status: string; ms: number; inicio: Date; fim: Date };

function msDiff(a: Date, b: Date) {
  return Math.max(0, b.getTime() - a.getTime());
}

function ordenarEventos(evts: any[]) {
  return [...evts].sort((a, b) => {
    const ta = a.dataEvento ? a.dataEvento.getTime() : 0;
    const tb = b.dataEvento ? b.dataEvento.getTime() : 0;
    return ta - tb;
  });
}

function segmentosTarefa(
  task: any,
  eventos: {
    statusAnterior?: string | null;
    statusNovo?: string | null;
    dataEvento: Date | null;
  }[],
  inicioPadrao: Date,
  fimPadrao: Date,
): Duracao[] {
  const evts = ordenarEventos(eventos);
  const inicio = task.dataCriacao || inicioPadrao;
  const fim = task.dataConclusao || fimPadrao;
  const segs: Duracao[] = [];
  let lastTs = inicio;
  let currentStatus =
    evts.length > 0
      ? (evts[0].statusAnterior ?? task.status ?? "PENDENTE")
      : (task.status ?? "PENDENTE");
  for (const e of evts) {
    const ts = e.dataEvento || fim;
    const ms = msDiff(lastTs, ts);
    if (ms > 0)
      segs.push({
        status: String(currentStatus),
        ms,
        inicio: lastTs,
        fim: ts,
      });
    currentStatus = e.statusNovo ?? currentStatus;
    lastTs = ts;
  }
  const msFinal = msDiff(lastTs, fim);
  if (msFinal > 0)
    segs.push({
      status: String(currentStatus),
      ms: msFinal,
      inicio: lastTs,
      fim,
    });
  return segs;
}

function somar(segs: Duracao[], status: string) {
  return segs
    .filter((s) => s.status === status)
    .reduce((acc, s) => acc + s.ms, 0);
}

function media(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function isExcludedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toString().toUpperCase().trim();
  // Status solicitados: 11 (pendente de desligamento), 6 (em validação), 12 (em validação)
  // Adicionado tratamento mais permissivo
  return (
    s === "11" ||
    s === "6" ||
    s === "12" ||
    s.includes("PENDENTE DE DESLIGAMENTO") ||
    s.includes("EM VALIDAÇÃO") ||
    s.includes("EM VALIDACAO") ||
    s.includes("EMV ALIDAÇÃO") ||
    s.includes("EMV ALIDACAO")
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const diasParam = searchParams.get("dias");
    const dias = diasParam ? parseInt(diasParam, 10) : 90;
    const somenteConcluidos =
      (searchParams.get("concluidos") || "").toLowerCase() === "true";
    const inicioParam = searchParams.get("inicio");
    const fimParam = searchParams.get("fim");
    const inicioFiltro =
      inicioParam && !Number.isNaN(new Date(inicioParam).getTime())
        ? new Date(inicioParam)
        : null;
    const fimFiltro =
      fimParam && !Number.isNaN(new Date(fimParam).getTime())
        ? new Date(fimParam)
        : null;
    if (inicioParam && !inicioFiltro) {
      return NextResponse.json(
        { error: "Data de início inválida." },
        { status: 400 },
      );
    }
    if (fimParam && !fimFiltro) {
      return NextResponse.json(
        { error: "Data de fim inválida." },
        { status: 400 },
      );
    }
    if (inicioFiltro && fimFiltro && inicioFiltro > fimFiltro) {
      return NextResponse.json(
        { error: "A data de início deve ser menor ou igual à data fim." },
        { status: 400 },
      );
    }
    if (inicioFiltro) inicioFiltro.setHours(0, 0, 0, 0);
    if (fimFiltro) fimFiltro.setHours(23, 59, 59, 999);
    const agora = new Date();
    const inicioJanela = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

    let remanejamentos: any[] = [];
    const whereBase: any = somenteConcluidos
      ? {
          OR: [
            {
              statusTarefas: {
                in: [
                  "CONCLUIDO",
                  "CONCLUIDA",
                  "SOLICITAÇÃO CONCLUÍDA",
                  "SOLICITAÇÃO CONCLUIDA",
                ],
              },
            },
            { statusTarefas: { contains: "CONCLUID", mode: "insensitive" } },
            { statusTarefas: { contains: "SUBMETER", mode: "insensitive" } },
            { statusTarefas: { contains: "RASCUNHO", mode: "insensitive" } },
            { statusPrestserv: { equals: "VALIDADO", mode: "insensitive" } },
          ],
          AND: [
            { statusPrestserv: { not: "CANCELADO" } },
            { statusTarefas: { not: "CANCELADO" } },
          ],
        }
      : {
          OR: [
            { dataConcluido: { gte: inicioJanela } },
            { updatedAt: { gte: inicioJanela } },
          ],
          AND: [
            { statusPrestserv: { not: "CANCELADO" } },
            { statusTarefas: { not: "CANCELADO" } },
          ],
        };
    // Janela de tempo: somente dados de 2026 (com possibilidade de limitar por fim via query)
    const START_2026 = new Date("2026-01-01T00:00:00.000Z");
    const END_2026 = new Date("2026-12-31T23:59:59.999Z");
    const effectiveStart =
      inicioFiltro && inicioFiltro > START_2026 ? inicioFiltro : START_2026;
    const effectiveEnd =
      fimFiltro && fimFiltro < END_2026 ? fimFiltro : END_2026;

    // Filtro temporal abrangente: inclui remanejamentos criados antes de 2026
    // mas com atividade relevante em 2026 (submissão, resposta, aprovação, conclusão, atualização)
    const timeWindowOr = [
      { createdAt: { gte: effectiveStart, lte: effectiveEnd } },
      { dataSubmetido: { gte: effectiveStart, lte: effectiveEnd } },
      { dataResposta: { gte: effectiveStart, lte: effectiveEnd } },
      { dataAprovado: { gte: effectiveStart, lte: effectiveEnd } },
      { dataConcluido: { gte: effectiveStart, lte: effectiveEnd } },
      { updatedAt: { gte: effectiveStart, lte: effectiveEnd } },
    ];

    whereBase.AND = [
      ...(whereBase.AND || []),
      {
        OR: timeWindowOr,
      },
    ];
    // Buscar remanejamentos sem carregar tarefas diretamente (evita coluna ausente em tarefas)
    try {
      remanejamentos = await prisma.remanejamentoFuncionario.findMany({
        where: whereBase,
        include: {
          solicitacao: true,
          funcionario: { select: { id: true, nome: true, matricula: true } },
        },
      });
    } catch {
      const whereFallback: any = somenteConcluidos
        ? {
            OR: [
              {
                statusTarefas: {
                  in: [
                    "CONCLUIDO",
                    "CONCLUIDA",
                    "SOLICITAÇÃO CONCLUÍDA",
                    "SOLICITAÇÃO CONCLUIDA",
                  ],
                },
              },
              {
                statusPrestserv: { in: ["VALIDADO", "Validado", "validado"] },
              },
              {
                statusTarefas: { contains: "SUBMETER", mode: "insensitive" },
              },
              {
                statusTarefas: { contains: "RASCUNHO", mode: "insensitive" },
              },
            ],
            AND: [
              { statusPrestserv: { not: "CANCELADO" } },
              { statusTarefas: { not: "CANCELADO" } },
            ],
          }
        : {
            OR: [
              { dataConcluido: { gte: inicioJanela } },
              { updatedAt: { gte: inicioJanela } },
            ],
            AND: [
              { statusPrestserv: { not: "CANCELADO" } },
              { statusTarefas: { not: "CANCELADO" } },
            ],
          };
      // Aplicar janela de 2026 também no fallback
      whereFallback.AND = [
        ...(whereFallback.AND || []),
        {
          OR: [
            { createdAt: { gte: effectiveStart, lte: effectiveEnd } },
            { dataSubmetido: { gte: effectiveStart, lte: effectiveEnd } },
            { dataResposta: { gte: effectiveStart, lte: effectiveEnd } },
            { dataAprovado: { gte: effectiveStart, lte: effectiveEnd } },
            { dataConcluido: { gte: effectiveStart, lte: effectiveEnd } },
            { updatedAt: { gte: effectiveStart, lte: effectiveEnd } },
          ],
        },
      ];
      remanejamentos = await prisma.remanejamentoFuncionario.findMany({
        where: whereFallback,
        include: {
          solicitacao: true,
          funcionario: { select: { id: true, nome: true, matricula: true } },
        },
      });
    }

    // Carregar tarefas por SQL bruto (selecionando apenas colunas existentes)
    const remIds = remanejamentos.map((r) => r.id);
    const tarefasByRem = new Map<string, any[]>();
    if (remIds.length > 0) {
      const tarefasRows: any[] = await prisma.$queryRaw(
        Prisma.sql`SELECT id, "remanejamentoFuncionarioId", tipo, descricao, responsavel, status, "dataCriacao", "dataConclusao"
                   FROM "TarefaRemanejamento"
                   WHERE "remanejamentoFuncionarioId" IN (${Prisma.join(remIds)})`,
      );
      const tarefaIds = tarefasRows.map((t) => t.id);
      // Eventos de status das tarefas
      const eventos = tarefaIds.length
        ? await prisma.tarefaStatusEvento.findMany({
            where: { tarefaId: { in: tarefaIds } },
            select: {
              tarefaId: true,
              statusAnterior: true,
              statusNovo: true,
              dataEvento: true,
            },
          })
        : [];
      const eventosMap = new Map<string, any[]>();
      for (const e of eventos) {
        const arr = eventosMap.get(e.tarefaId) || [];
        arr.push({
          statusAnterior: e.statusAnterior,
          statusNovo: e.statusNovo,
          dataEvento: e.dataEvento,
        });
        eventosMap.set(e.tarefaId, arr);
      }
      // Histórico relacionado às tarefas (com equipe)
      const historicos = tarefaIds.length
        ? await prisma.historicoRemanejamento.findMany({
            where: { tarefaId: { in: tarefaIds } },
            select: {
              tarefaId: true,
              descricaoAcao: true,
              valorNovo: true,
              dataAcao: true,
              equipe: { select: { nome: true } },
            },
            orderBy: { dataAcao: "asc" },
          })
        : [];
      const histMap = new Map<string, any[]>();
      for (const h of historicos) {
        if (!h.tarefaId) continue;
        const key = String(h.tarefaId);
        const arr = histMap.get(key) || [];
        arr.push({
          descricaoAcao: h.descricaoAcao,
          valorNovo: h.valorNovo,
          dataAcao: h.dataAcao,
          equipe: h.equipe,
        });
        histMap.set(key, arr);
      }
      // Agrupar tarefas por remanejamento e anexar eventos/histórico
      for (const t of tarefasRows) {
        const tFull = {
          ...t,
          eventosStatus: eventosMap.get(t.id) || [],
          historico: histMap.get(t.id) || [],
        };
        const arr = tarefasByRem.get(t.remanejamentoFuncionarioId) || [];
        arr.push(tFull);
        tarefasByRem.set(t.remanejamentoFuncionarioId, arr);
      }
      // Anexar ao array de remanejamentos para fluxo posterior
      for (const rf of remanejamentos) {
        rf.tarefas = tarefasByRem.get(rf.id) || [];
      }
    }

    const porSetor = new Map<string, any>();
    const porRemanejamento: any[] = [];
    const agregadosSetorDuracoes: Map<string, number[]> = new Map();
    const reprovPorTipo: Record<string, number> = {};
    const aprovPorTipo: Record<string, number> = {};

    for (const rf of remanejamentos) {
      // Histórico de decisões da logística (Prestserv) — tolerante a variações
      const historicosPrestserv = await prisma.historicoRemanejamento.findMany({
        where: {
          remanejamentoFuncionarioId: rf.id,
          OR: [
            {
              entidade: { equals: "PRESTSERV", mode: "insensitive" },
              campoAlterado: { contains: "status", mode: "insensitive" },
            },
            {
              entidade: { contains: "LOGIST", mode: "insensitive" },
              campoAlterado: { contains: "prestserv", mode: "insensitive" },
            },
            {
              entidade: { contains: "PRESTSERV", mode: "insensitive" },
              campoAlterado: { contains: "prestserv", mode: "insensitive" },
            },
            {
              campoAlterado: { equals: "statusTarefas", mode: "insensitive" },
            },
            {
              valorNovo: {
                contains: "SUBMETER RASCUNHO",
                mode: "insensitive",
              },
            },
          ],
        },
        select: { valorNovo: true, dataAcao: true, campoAlterado: true },
        orderBy: { dataAcao: "asc" },
      });
      const normUp = (val: string | null | undefined) =>
        (val || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toUpperCase();
      const normUpSpace = (val: string | null | undefined) =>
        normUp(val).replace(/\s+/g, " ").trim();
      const reprovEvents: {
        setor: string;
        data: Date | null;
        source: string;
        tarefaId?: string | number;
        tarefaDescricao?: string | null;
      }[] = [];
      const evtValidado = historicosPrestserv
        .filter((h) => {
          const v = normUp(h.valorNovo);
          return (
            (v.includes("VALIDAD") ||
              v.includes("INVALIDAD") ||
              v.includes("REJEIT")) &&
            !!h.dataAcao
          );
        })
        .reduce<Date | null>((acc, h) => {
          const d = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!d) return acc;
          return !acc || d > acc ? d : acc;
        }, null);

      const evtValidadoPrimeiro = historicosPrestserv
        .map((h) => ({
          v: normUp(h.valorNovo),
          d: h.dataAcao ? new Date(h.dataAcao) : null,
        }))
        .filter((x) => x.d && x.v === "VALIDADO")
        .reduce<Date | null>(
          (acc, x) => (!acc || (x.d as Date) < acc ? (x.d as Date) : acc),
          null,
        );

      // Fim total com fallback robusto para evitar duração zero
      const totalStart = rf.solicitacao?.dataSolicitacao || rf.createdAt;
      // Determinação do fim total (conclusão de fato do remanejamento)
      // Ordem de preferência:
      //  1) rf.dataConcluido (conclusão explícita)
      //  2) Primeiro VALIDADO no histórico (equivalente a conclusão)
      //  3) rf.dataResposta (há casos em que a resposta representa a decisão final)
      //  4) rf.dataSubmetido (último recurso para registros antigos, pouco ideal)
      //  5) rf.updatedAt
      //  6) agora
      const statusTarefasUp = normUpSpace(rf.statusTarefas);
      const isSubmeterRascunho =
        statusTarefasUp.includes("SUBMETER") ||
        statusTarefasUp.includes("RASCUNHO");
      const tentativeEnd = (rf.dataConcluido ||
        evtValidadoPrimeiro ||
        (rf.dataResposta ? new Date(rf.dataResposta) : null) ||
        (isSubmeterRascunho
          ? rf.updatedAt || agora
          : rf.dataSubmetido
            ? new Date(rf.dataSubmetido)
            : null) ||
        rf.updatedAt ||
        agora) as Date;
      const totalEnd =
        tentativeEnd &&
        totalStart &&
        (tentativeEnd as Date).getTime() <= (totalStart as Date).getTime()
          ? agora
          : tentativeEnd;
      const totalDurMs = msDiff(totalStart, totalEnd);

      const setorDur: Record<string, number> = {};
      const exclusoesPorSetor: Record<string, number> = {};
      const tarefaReprovCount: Record<string, number> = {};
      const temposConclusaoPorSetor: Record<string, number[]> = {};
      let downtimeMsSum = 0;

      const toSetor = (val: string | null | undefined) => {
        const sRaw = (val || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toUpperCase();
        if (!sRaw) return "";
        // TREINAMENTO: abrangencia maior
        if (
          sRaw.includes("TREIN") ||
          sRaw.includes("CAPACIT") ||
          sRaw.includes("CAPACITA") ||
          sRaw.includes("CURSO") ||
          sRaw.includes("INSTRU") ||
          sRaw.includes("CERTIFIC")
        )
          return "TREINAMENTO";
        // MEDICINA: incluir termos comuns do fluxo ocupacional
        if (
          sRaw.includes("MEDIC") ||
          sRaw.includes("SAUDE") ||
          sRaw.includes("ENFERM") ||
          sRaw.includes("AMBULATORIO") ||
          sRaw.includes("ASO") ||
          sRaw.includes("EXAME") ||
          sRaw.includes("MEDICO")
        )
          return "MEDICINA";
        // RH / Departamento Pessoal
        if (
          sRaw.includes("RECURSOS") ||
          sRaw.includes("HUMANOS") ||
          sRaw.includes(" DEPARTAMENTO PESSOAL") ||
          sRaw.includes("DEPARTAMENTO PESSOAL") ||
          sRaw.includes("DP") ||
          sRaw.includes("ADMISS") ||
          sRaw.includes("DOCUMENTACAO RH") ||
          sRaw.includes("DOC RH") ||
          sRaw.includes(" RH") ||
          sRaw === "RH" ||
          sRaw.includes("RH")
        )
          return "RH";
        return sRaw;
      };
      const deriveSetor = (t: any) => {
        // Não usar relação t.setor; inferir somente por histórico/equipe, responsável, tipo e descrição
        const histNome = (t.historico || [])
          .map((h: any) => h.equipe?.nome)
          .filter(Boolean)[0] as string | undefined;
        const histSet = toSetor(histNome);
        if (
          histSet === "RH" ||
          histSet === "MEDICINA" ||
          histSet === "TREINAMENTO"
        )
          return histSet;
        const r = toSetor(t.responsavel);
        if (r === "RH" || r === "MEDICINA" || r === "TREINAMENTO") return r;
        const tipoSet = toSetor(t.tipo);
        if (
          tipoSet === "RH" ||
          tipoSet === "MEDICINA" ||
          tipoSet === "TREINAMENTO"
        )
          return tipoSet;
        const descSet = toSetor(t.descricao);
        if (
          descSet === "RH" ||
          descSet === "MEDICINA" ||
          descSet === "TREINAMENTO"
        )
          return descSet;
        return "DESCONHECIDO";
      };

      // Construir timeline de exclusão global baseada no histórico do remanejamento (statusPrestserv)
      const exclusionTimeline: { inicio: number; fim: number }[] = [];
      const histStatus = historicosPrestserv
        .filter((h: any) => h.campoAlterado === "statusPrestserv")
        .sort(
          (a: any, b: any) =>
            new Date(a.dataAcao).getTime() - new Date(b.dataAcao).getTime(),
        );

      if (histStatus.length > 0) {
        let currentStatus = "CRIADO"; // Estado inicial padrão seguro
        // Tentar inferir estado inicial se possível, mas CRIADO é neutro.

        let lastTime = totalStart.getTime();

        for (const h of histStatus) {
          const time = new Date(h.dataAcao).getTime();
          if (time > lastTime) {
            if (isExcludedStatus(currentStatus)) {
              exclusionTimeline.push({ inicio: lastTime, fim: time });
            }
          }
          currentStatus = h.valorNovo || currentStatus;
          lastTime = time;
        }
        // Último intervalo até o fim
        if (lastTime < totalEnd.getTime()) {
          if (isExcludedStatus(currentStatus)) {
            exclusionTimeline.push({
              inicio: lastTime,
              fim: totalEnd.getTime(),
            });
          }
        }
      } else {
        // Se não tem histórico, verifica o status atual do remanejamento
        if (isExcludedStatus(rf.statusPrestserv)) {
          exclusionTimeline.push({
            inicio: totalStart.getTime(),
            fim: totalEnd.getTime(),
          });
        }
      }

      let totalOutrosMs = 0;
      for (const interval of exclusionTimeline) {
        totalOutrosMs += interval.fim - interval.inicio;
      }

      // Removido filtro rígido de pré-validação para evitar resposta vazia. Filtramos somente no momento de montar a lista porRemanejamento.

      for (const t of rf.tarefas) {
        const segs = segmentosTarefa(
          t,
          t.eventosStatus || [],
          totalStart,
          totalEnd,
        );
        downtimeMsSum += somar(segs, "PENDENTE");
        const setor = deriveSetor(t);
        for (const s of segs) {
          let msExcluido = 0;
          const sInicio = s.inicio.getTime();
          const sFim = s.fim.getTime();

          // 1. Se o status da tarefa é excluído, conta tudo
          if (isExcludedStatus(s.status)) {
            msExcluido = s.ms;
          } else {
            // 2. Verifica interseção com exclusão global (statusPrestserv)
            for (const interval of exclusionTimeline) {
              const interInicio = Math.max(sInicio, interval.inicio);
              const interFim = Math.min(sFim, interval.fim);
              if (interFim > interInicio) {
                msExcluido += interFim - interInicio;
              }
            }
            // Limitar ao tamanho do segmento
            if (msExcluido > s.ms) msExcluido = s.ms;
          }

          if (msExcluido > 0) {
            // Não somamos em setorDur["OUTROS"] aqui para evitar duplicação em tarefas paralelas.
            // O valor total de OUTROS será definido por totalOutrosMs.
            exclusoesPorSetor[setor] =
              (exclusoesPorSetor[setor] || 0) + msExcluido;

            const msLiquido = s.ms - msExcluido;
            if (msLiquido > 0) {
              setorDur[setor] = (setorDur[setor] || 0) + msLiquido;
            }
          } else {
            setorDur[setor] = (setorDur[setor] || 0) + s.ms;
          }
        }

        const conclEvt = (t.eventosStatus || []).find(
          (e: any) =>
            e.statusNovo === "CONCLUIDO" || e.statusNovo === "CONCLUIDA",
        );
        const conclDate = conclEvt?.dataEvento
          ? new Date(conclEvt.dataEvento)
          : t.dataConclusao
            ? new Date(t.dataConclusao)
            : null;
        if (conclDate) {
          const durConclusao = msDiff(totalStart, conclDate);
          if (!temposConclusaoPorSetor[setor])
            temposConclusaoPorSetor[setor] = [];
          temposConclusaoPorSetor[setor].push(durConclusao);
        }
        // Contabilizar aprovações (tarefas concluídas) por tipo
        {
          const tipoKey = t.tipo || "Não definido";
          const stUp = (t.status || "").toString().toUpperCase();
          const isConcl =
            !!conclDate ||
            stUp === "CONCLUIDO" ||
            stUp === "CONCLUIDA" ||
            stUp.includes("CONCL");
          if (isConcl) {
            aprovPorTipo[tipoKey] = (aprovPorTipo[tipoKey] || 0) + 1;
          }
        }

        // 1. Filtrar eventos de reprovação (apenas TarefaStatusEvento com statusNovo = "REPROVADO")
        const rawTaskReprovs = (t.eventosStatus || [])
          .filter((e: any) => {
            const s = (e.statusNovo || "").toString().toUpperCase();
            if (s !== "REPROVADO") return false;
            const d = e.dataEvento ? new Date(e.dataEvento) : null;
            if (!d) return false;
            // Contabilizar apenas reprovações dentro da janela 2026 (ou até fim especificado)
            return d >= effectiveStart && d <= effectiveEnd;
          })
          .map((e: any) => ({
            setor,
            data: e.dataEvento ? new Date(e.dataEvento) : null,
            source: "evento",
            tarefaId: t.id,
            tarefaDescricao: t.descricao || t.tipo || null,
          }));

        // 2. Desduplicar eventos locais da tarefa (janela de 5 minutos - 300000ms)
        // REGRA: Apenas para duplicatas da MESMA tarefa (cliques duplos/erros de sistema).
        // Não agrupar reprovações de tarefas diferentes.
        const uniqueTaskReprovs: typeof reprovEvents = [];
        const sortedTaskReprovs = rawTaskReprovs.sort((a: any, b: any) => {
          const ta = a.data ? a.data.getTime() : 0;
          const tb = b.data ? b.data.getTime() : 0;
          return ta - tb;
        });

        for (const ev of sortedTaskReprovs) {
          const exists = uniqueTaskReprovs.find((u) => {
            const t1 = u.data ? u.data.getTime() : 0;
            const t2 = ev.data ? ev.data.getTime() : 0;
            return Math.abs(t2 - t1) < 300000;
          });
          if (!exists) {
            uniqueTaskReprovs.push(ev);
          }
        }

        // 3. Adicionar aos eventos globais do remanejamento
        reprovEvents.push(...uniqueTaskReprovs);

        // 4. Contabilizar
        const reprovs = uniqueTaskReprovs.length;

        if (reprovs > 0) {
          const key = `${setor}|${t.tipo}`;
          tarefaReprovCount[key] = (tarefaReprovCount[key] || 0) + reprovs;
          const tipoKey = t.tipo || "Não definido";
          reprovPorTipo[tipoKey] = (reprovPorTipo[tipoKey] || 0) + reprovs;
        }

        const setorAgg = porSetor.get(setor) || {
          setor,
          qtdTarefas: 0,
          downtimeMs: 0,
          conclusoesMs: [] as number[],
          reprovações: 0,
        };
        setorAgg.qtdTarefas += 1;
        setorAgg.downtimeMs += somar(segs, "PENDENTE");
        if (conclDate)
          setorAgg.conclusoesMs.push(msDiff(totalStart, conclDate));
        setorAgg.reprovações += reprovs;
        porSetor.set(setor, setorAgg);
      }

      setorDur["OUTROS"] = totalOutrosMs;

      const tarefasAtivas = (rf.tarefas || []).filter(
        (t: any) => t.status !== "CANCELADO",
      );
      const setores: string[] = Array.from(
        new Set(tarefasAtivas.map((t: any) => deriveSetor(t))),
      ) as string[];

      const aprovacaoMs =
        rf.dataSubmetido && rf.dataResposta
          ? msDiff(new Date(rf.dataSubmetido), new Date(rf.dataResposta))
          : 0;
      const todasTarefasConcluidas =
        tarefasAtivas.length > 0 &&
        tarefasAtivas.every(
          (t: any) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA",
        );
      let fimTarefas: Date | null = null;
      if (todasTarefasConcluidas) {
        for (const t of tarefasAtivas) {
          const d = t.dataConclusao ? new Date(t.dataConclusao) : null;
          if (d && (!fimTarefas || d > fimTarefas)) fimTarefas = d;
        }
      }
      const posConclusaoAteValidadoMs = fimTarefas
        ? msDiff(fimTarefas, totalEnd)
        : 0;

      // Adiar push para após cálculo de logística

      // Construção da timeline de responsabilidade (Logística ↔ Setores) - FLUXO 5 TEMPOS
      const responsabilidadeTimeline: {
        responsavel: string;
        inicio: string;
        fim: string;
        ms: number;
        ciclo?: number;
        tipo?: string;
        inicioDisplay?: string;
        fimDisplay?: string;
        qtdReprovacoes?: number;
        tarefasReprovadas?: string[];
      }[] = [];
      // Extendemos a tipagem de ciclos para incluir o número do ciclo (2 ou 4)
      const ciclos: { inicio: Date; fim: Date; cicloNum: number }[] = [];
      const intervalosPorSetor: Record<
        string,
        { inicio: string; fim: string }
      > = {};
      const ciclosSetorDurMs: Record<string, number[]> = {};

      const tCriacaoSolic = rf.solicitacao?.dataSolicitacao
        ? new Date(rf.solicitacao.dataSolicitacao)
        : rf.createdAt
          ? new Date(rf.createdAt)
          : null;
      const tAprovado = rf.dataAprovado ? new Date(rf.dataAprovado) : null;

      const taskStartCandidates: Date[] = [];
      for (const t of tarefasAtivas) {
        if (t.dataCriacao) taskStartCandidates.push(new Date(t.dataCriacao));
      }
      const earliestTaskStart = taskStartCandidates.length
        ? new Date(Math.min(...taskStartCandidates.map((d) => d.getTime())))
        : null;

      // 1. Tempo 1: Aprovação Inicial (Logística)
      // Início: Chegada (tCriacaoSolic)
      // Fim: Aprovação (tAprovado)
      let cursor = tCriacaoSolic || earliestTaskStart;
      let t1End = tAprovado || earliestTaskStart;

      // Se não tiver data de aprovação, tenta inferir pelo início das tarefas ou primeira decisão
      if (!t1End && cursor) {
        // Fallback para fim do T1
        t1End = cursor;
      }

      if (cursor && t1End && t1End >= cursor) {
        responsabilidadeTimeline.push({
          responsavel: "LOGISTICA",
          inicio: cursor.toISOString(),
          fim: t1End.toISOString(),
          ms: msDiff(cursor, t1End),
          ciclo: 1,
          tipo: "APROVACAO_INICIAL",
        });
        cursor = t1End;
      } else if (t1End) {
        cursor = t1End;
      }

      // Funções auxiliares
      const allTasksConcludedAfter = (after: Date | null): Date | null => {
        if (!after) return null;
        const tasks = (rf.tarefas || []).filter(
          (t: any) => t.status !== "CANCELADO",
        );
        if (tasks.length === 0) return after;
        let maxConclusao: Date | null = null;
        for (const t of tasks) {
          const evts = ordenarEventos(t.eventosStatus || []);

          // Buscar o PRIMEIRO evento de conclusão após 'after'
          // Isso é crucial para identificar o fim do ciclo atual, e não o fim final da tarefa
          const conclEvt = evts.find(
            (e: any) =>
              (e.statusNovo === "CONCLUIDO" || e.statusNovo === "CONCLUIDA") &&
              e.dataEvento &&
              new Date(e.dataEvento) >= after,
          );

          const candEvt = conclEvt ? new Date(conclEvt.dataEvento) : null;
          const candConclusao =
            t.dataConclusao && new Date(t.dataConclusao) >= after
              ? new Date(t.dataConclusao)
              : null;

          // Prioriza o evento de conclusão (que representa o fim deste ciclo)
          // Só usa dataConclusao (estado final) se não houver evento intermediário
          let candidato: Date | null = null;

          if (candEvt) {
            candidato = candEvt;
          } else if (candConclusao) {
            candidato = candConclusao;
          }

          const isConcl = t.status === "CONCLUIDO" || t.status === "CONCLUIDA";
          // Se não achou candidato e a tarefa não está concluída, então o ciclo não fechou
          if (!candidato && !isConcl) return null;

          // Se a tarefa está concluída mas não achamos candidato > after,
          // pode ser que a conclusão foi antes de 'after'? (Inconsistência ou ciclo anterior)
          // Nesse caso, assumimos 'after' ou ignoramos?
          // Se não achou candidato válido mas a tarefa ta concluida, usamos 'after' como fallback conservador?
          // Não, se não achou candidato > after, significa que para este ciclo novo, a tarefa ainda não terminou (ou terminou no passado).
          // Mas se estamos buscando "quando termina este ciclo", precisamos de uma data futura.
          if (!candidato && isConcl) {
            // Caso estranho: tarefa concluída antes do início do ciclo?
            // Isso pode acontecer se 'after' avançou demais.
            // Vamos manter null para forçar verificação.
            // Mas se ela JÁ estava concluída antes de começar o ciclo (ex: reuso), ela não bloqueia.
            // Se dataConclusao < after, a tarefa "já está pronta".
            if (t.dataConclusao && new Date(t.dataConclusao) < after) {
              // Tarefa já estava pronta, conta como concluída em 'after' (imediato)
              candidato = after;
            } else {
              return null;
            }
          }

          if (candidato && (!maxConclusao || candidato > maxConclusao))
            maxConclusao = candidato;
        }

        return maxConclusao || after;
      };

      const lastTasksConcludedBefore = (before: Date | null): Date | null => {
        if (!before) return null;
        const tasks = (rf.tarefas || []).filter(
          (t: any) => t.status !== "CANCELADO",
        );
        let maxConclusao: Date | null = null;
        for (const t of tasks) {
          const evts = ordenarEventos(t.eventosStatus || []);
          for (const e of evts) {
            if (
              (e.statusNovo === "CONCLUIDO" || e.statusNovo === "CONCLUIDA") &&
              e.dataEvento
            ) {
              const d = new Date(e.dataEvento);
              if (d <= before && (!maxConclusao || d > maxConclusao))
                maxConclusao = d;
            }
          }
          if (t.dataConclusao) {
            const d = new Date(t.dataConclusao);
            if (d <= before && (!maxConclusao || d > maxConclusao))
              maxConclusao = d;
          }
        }
        return maxConclusao;
      };

      const nextPrestservDecisionAfter = (
        after: Date | null,
      ): { tipo: string; quando: Date } | null => {
        if (!after) return null;

        // Buffer de segurança removido para evitar loop infinito em eventos passados
        const searchDate = after;
        const searchReprov = searchDate; // Sem tolerância para trás

        // 1. Candidato via Histórico do Remanejamento (Prestserv/Logística)
        const decisHist = historicosPrestserv.find((h) => {
          const ts = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!ts) return false;
          const v = (h.valorNovo || "").toUpperCase();

          const isReprovTerm =
            v.includes("REPROV") ||
            v.includes("REJEIT") ||
            v.includes("INVALID");

          // Para validação, usamos data estrita. Para reprovação, usamos buffer.
          const minDate = isReprovTerm ? searchReprov : searchDate;

          const isStatus =
            v === "VALIDADO" ||
            v === "INVALIDADO" ||
            v === "REJEITADO" ||
            v === "REPROVADO";

          if (isStatus || isReprovTerm) {
            return ts >= minDate;
          }
          return false;
        });

        // 2. Candidato via Eventos de Reprovação nas Tarefas (Card de Reprovações)
        // Usamos searchReprov para garantir que reprovações ocorridas ligeiramente antes do fim das tarefas (concorrência) sejam pegas
        const decisReprovTask = reprovEvents
          .filter((ev) => ev.data && new Date(ev.data) >= searchReprov)
          .sort((a, b) => {
            const ta = a.data ? new Date(a.data).getTime() : 0;
            const tb = b.data ? new Date(b.data).getTime() : 0;
            return ta - tb;
          })[0];

        // Comparar qual ocorreu primeiro
        let winner: { tipo: string; quando: Date } | null = null;
        const tsHist = decisHist?.dataAcao
          ? new Date(decisHist.dataAcao)
          : null;
        const tsTask = decisReprovTask?.data
          ? new Date(decisReprovTask.data)
          : null;

        if (tsHist && tsTask) {
          if (tsHist <= tsTask) {
            let tipo = (decisHist!.valorNovo || "").toUpperCase();
            if (
              tipo.includes("REPROV") ||
              tipo.includes("REJEIT") ||
              tipo.includes("INVALID")
            ) {
              tipo = "INVALIDADO";
            }
            winner = { tipo, quando: tsHist };
          } else {
            winner = { tipo: "INVALIDADO", quando: tsTask };
          }
        } else if (tsHist) {
          let tipo = (decisHist!.valorNovo || "").toUpperCase();
          if (
            tipo.includes("REPROV") ||
            tipo.includes("REJEIT") ||
            tipo.includes("INVALID")
          ) {
            tipo = "INVALIDADO";
          }
          winner = { tipo, quando: tsHist };
        } else if (tsTask) {
          winner = { tipo: "INVALIDADO", quando: tsTask };
        }

        if (winner) {
          return winner;
        }

        // Fallbacks
        if (rf.dataConcluido && new Date(rf.dataConcluido) > searchDate)
          return { tipo: "VALIDADO", quando: new Date(rf.dataConcluido) };
        const validadoDepois = historicosPrestserv.find((h) => {
          const ts = h.dataAcao ? new Date(h.dataAcao) : null;
          const v = (h.valorNovo || "").toUpperCase();
          return ts && ts > searchDate && v === "VALIDADO";
        });
        if (validadoDepois)
          return {
            tipo: "VALIDADO",
            quando: new Date(validadoDepois.dataAcao!),
          };
        if (rf.dataResposta && new Date(rf.dataResposta) > searchDate)
          return { tipo: "RESPOSTA", quando: new Date(rf.dataResposta) };
        return null;
      };

      const nextSubmitAfter = (after: Date | null): Date | null => {
        if (!after) return null;
        const submit = historicosPrestserv.find((h) => {
          const ts = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!ts) return false;
          const v = normUpSpace(h.valorNovo);
          if (v.includes("SUBMETER RASCUNHO")) {
            return ts >= after;
          }
          return false;
        });
        return submit?.dataAcao ? new Date(submit.dataAcao) : null;
      };
      const lastSubmitBefore = (before: Date | null): Date | null => {
        if (!before) return null;
        let latest: Date | null = null;
        for (const h of historicosPrestserv) {
          if (!h.dataAcao) continue;
          const ts = new Date(h.dataAcao);
          if (ts > before) continue;
          const v = normUpSpace(h.valorNovo);
          if (v.includes("SUBMETER RASCUNHO")) {
            if (!latest || ts > latest) latest = ts;
          }
        }
        return latest;
      };

      // 2. Tempo 2: Execução Pendências (Setores)
      // Do fim do T1 até conclusão das tarefas
      if (cursor) {
        const submitAfterT2 = nextSubmitAfter(cursor);
        let t2End: Date | null = null;
        if (submitAfterT2) {
          const lastBeforeSubmit = lastTasksConcludedBefore(submitAfterT2);
          if (lastBeforeSubmit && lastBeforeSubmit >= cursor) {
            t2End = lastBeforeSubmit;
          } else {
            t2End = submitAfterT2;
          }
          if (t2End > submitAfterT2) t2End = submitAfterT2;
        } else {
          t2End = allTasksConcludedAfter(cursor);
        }
        if (t2End && t2End >= cursor) {
          ciclos.push({ inicio: cursor, fim: t2End, cicloNum: 2 });
          cursor = t2End;
        }
      }

      // Loop: Tempo 3 (Análise Logística) <-> Tempo 4 (Correção Setores)
      // Até validação final (Tempo 5)
      const maxIter = 30;
      for (let i = 0; i < maxIter; i++) {
        if (!cursor) break;

        // Tempo 3: Análise Logística
        // Começa onde parou (fim das tarefas). Vai até decisão.
        const submitAfter = nextSubmitAfter(cursor);
        const submitMissing = isSubmeterRascunho && !submitAfter;
        let hadSubmit = false;
        let decisao = nextPrestservDecisionAfter(cursor);
        const analysisStart = (() => {
          const submitAfter = nextSubmitAfter(cursor);
          if (submitAfter) {
            const lastBeforeSubmit = lastTasksConcludedBefore(submitAfter);
            return lastBeforeSubmit || cursor;
          }
          return lastTasksConcludedBefore(cursor) || cursor;
        })();
        if (submitAfter) {
          const submitTs = submitAfter.getTime();
          const cursorTs = cursor.getTime();
          if (submitTs > cursorTs) {
            hadSubmit = true;
            decisao = nextPrestservDecisionAfter(cursor);
          } else {
            hadSubmit = true;
          }
        } else if (submitMissing) {
          hadSubmit = true;
        }

        if (decisao) {
          const ms = msDiff(analysisStart, decisao.quando);
          // Prefixo para diferenciar Análise inicial de Reanálises
          const prefixoAnalise = i === 0 ? "ANÁLISE" : "REANÁLISE";
          const tipoAnalise = `${prefixoAnalise} (${decisao.tipo})`;

          // Só adiciona ciclo de análise se houver duração (evita linhas vazias/traços)
          // Isso acontece quando um ciclo de correção é estendido até o início do próximo (sem intervalo de análise)
          if (ms > 0 || hadSubmit) {
            responsabilidadeTimeline.push({
              responsavel: "LOGISTICA",
              inicio: analysisStart.toISOString(),
              fim: decisao.quando.toISOString(),
              ms,
              ciclo: 3,
              tipo: tipoAnalise,
              inicioDisplay: analysisStart.toISOString(),
              fimDisplay: decisao.quando.toISOString(),
            });
          }
          cursor = decisao.quando;

          if (
            decisao.tipo === "VALIDADO" ||
            decisao.tipo === "VALIDADO_FINAL"
          ) {
            const submitStart =
              lastSubmitBefore(decisao.quando) || analysisStart;
            const msFinal = msDiff(submitStart, decisao.quando);
            if (msFinal > 0) {
              responsabilidadeTimeline.push({
                inicio: submitStart.toISOString(),
                fim: decisao.quando.toISOString(),
                ms: msFinal,
                ciclo: 5,
                tipo: "VALIDADO_FINAL",
              });
            } else {
              responsabilidadeTimeline.push({
                responsavel: "LOGISTICA",
                inicio: decisao.quando.toISOString(),
                fim: decisao.quando.toISOString(),
                ms: 0,
                ciclo: 5,
                tipo: "VALIDADO_FINAL",
              });
            }
            break;
          } else if (
            decisao.tipo === "INVALIDADO" ||
            decisao.tipo === "REJEITADO" ||
            decisao.tipo === "REPROVADO"
          ) {
            // Tempo 4: Correção (Setores)
            // TENTATIVA 1: Buscar no histórico quando o status saiu de "ATENDER TAREFAS"
            const fimCorrecaoHist = historicosPrestserv.find((h) => {
              const d = h.dataAcao ? new Date(h.dataAcao) : null;
              if (!d || d <= cursor) return false;

              // Verifica se é mudança de status das tarefas para algo que indica fim da correção
              if (
                h.campoAlterado &&
                h.campoAlterado.toLowerCase() === "statustarefas"
              ) {
                const val = (h.valorNovo || "").toUpperCase();
                // O fim da correção é quando sai de "ATENDER TAREFAS" e vai para "SUBMETER RASCUNHO" ou "AGUARDANDO ANALISE"
                if (
                  val.includes("SUBMETER") ||
                  val.includes("RASCUNHO") ||
                  val.includes("AGUARDANDO") ||
                  val.includes("CONCLUI")
                ) {
                  return true;
                }
                return !val.includes("ATENDER TAREFAS");
              }
              return false;
            });

            let t4End = fimCorrecaoHist
              ? new Date(fimCorrecaoHist.dataAcao!)
              : null;

            // TENTATIVA 2: Conclusão das tarefas (Fallback apenas se não houver evento explícito)
            // Se não houver submissão, consideramos o fim da correção como o momento em que a última tarefa foi concluída.
            if (!t4End) {
              const tTasksConcluded = allTasksConcludedAfter(cursor);
              if (tTasksConcluded && tTasksConcluded > cursor) {
                t4End = tTasksConcluded;
              }
            }

            if (t4End) {
              // Se o fim for igual ao início, não houve progresso (ou fallback ativado).
              // Interromper para evitar loop infinito de ciclos vazios.
              if (t4End.getTime() <= cursor.getTime()) break;

              ciclos.push({ inicio: cursor, fim: t4End, cicloNum: 4 });
              cursor = t4End;
              // Continua o loop -> volta para Tempo 3
              continue;
            } else {
              break; // Tarefas de correção em aberto
            }
          } else {
            if (decisao.tipo === "RESPOSTA" || decisao.tipo === "SUBMETIDO") {
              responsabilidadeTimeline.push({
                responsavel: "LOGISTICA",
                inicio: cursor.toISOString(),
                fim: cursor.toISOString(),
                ms: 0,
                ciclo: 5,
                tipo: "VALIDADO_FINAL",
              });
              break;
            }
            break;
          }
        } else {
          // Sem decisão posterior.
          // Verificar se já está concluído (rf.dataConcluido)
          if (rf.dataConcluido && new Date(rf.dataConcluido) >= cursor) {
            const ms = msDiff(analysisStart, new Date(rf.dataConcluido));
            responsabilidadeTimeline.push({
              responsavel: "LOGISTICA",
              inicio: analysisStart.toISOString(),
              fim: new Date(rf.dataConcluido).toISOString(),
              ms,
              ciclo: 3,
              tipo: "VALIDADO",
              inicioDisplay: analysisStart.toISOString(),
              fimDisplay: new Date(rf.dataConcluido).toISOString(),
            });
            responsabilidadeTimeline.push({
              responsavel: "LOGISTICA",
              inicio: new Date(rf.dataConcluido).toISOString(),
              fim: new Date(rf.dataConcluido).toISOString(),
              ms: 0,
              ciclo: 5,
              tipo: "VALIDADO_FINAL",
            });
          } else if (hadSubmit) {
            const fimAnalise =
              isSubmeterRascunho && agora > cursor ? agora : totalEnd;
            if (fimAnalise && (fimAnalise > cursor || hadSubmit)) {
              const prefixoAnalise = i === 0 ? "ANÁLISE" : "REANÁLISE";
              const ms = msDiff(analysisStart, fimAnalise);
              if (ms > 0 || hadSubmit) {
                responsabilidadeTimeline.push({
                  responsavel: "LOGISTICA",
                  inicio: analysisStart.toISOString(),
                  fim: fimAnalise.toISOString(),
                  ms,
                  ciclo: 3,
                  tipo: `${prefixoAnalise} (SEM DECISÃO)`,
                  inicioDisplay: analysisStart.toISOString(),
                  fimDisplay: fimAnalise.toISOString(),
                });
              }
            }
          }
          break;
        }
      }

      // 3. Reordenar e atualizar timeline
      // Adicionar os Ciclos 4 (Correção) na timeline (sem fusão, mantendo granularidade)
      const timelineComCorrecoes = [...responsabilidadeTimeline];

      for (const c of ciclos) {
        if (c.cicloNum === 2) {
          timelineComCorrecoes.push({
            responsavel: "SETORES",
            inicio: c.inicio.toISOString(),
            fim: c.fim.toISOString(),
            ms: msDiff(c.inicio, c.fim),
            ciclo: 2,
            tipo: "EXECUÇÃO DE PENDÊNCIAS",
          });
        }
        if (c.cicloNum === 4) {
          // Identificar setores envolvidos neste ciclo de correção
          const setoresEnvolvidos = new Set<string>();
          const cStart = c.inicio.getTime();
          const cEnd = c.fim.getTime();

          // Buscar setores nos eventos de reprovação que caem neste ciclo (ou gatilho)
          for (const ev of reprovEvents) {
            const t = ev.data ? new Date(ev.data).getTime() : 0;
            // Tolerância de 1 min antes do início (decisão) até o fim do ciclo
            if (t >= cStart - 60000 && t <= cEnd) {
              setoresEnvolvidos.add(ev.setor);
            }
          }

          if (setoresEnvolvidos.size === 0) {
            timelineComCorrecoes.push({
              responsavel: "SETORES", // Será quebrado por setor depois
              inicio: c.inicio.toISOString(),
              fim: c.fim.toISOString(),
              ms: msDiff(c.inicio, c.fim),
              ciclo: 4,
              tipo: "CORREÇÃO DE REPROVAÇÕES",
            });
          } else {
            for (const setor of Array.from(setoresEnvolvidos)) {
              // Calcular fim efetivo para este setor (quando suas tarefas foram concluídas neste ciclo)
              let fimEfetivo = c.inicio;
              const tasksSetor = tarefasAtivas.filter(
                (t: any) => deriveSetor(t) === setor,
              );

              let maxConclusao = cStart;
              let found = false;

              for (const t of tasksSetor) {
                // Verificar eventos de conclusão
                if (t.eventosStatus) {
                  for (const e of t.eventosStatus) {
                    if (
                      (e.statusNovo === "CONCLUIDO" ||
                        e.statusNovo === "CONCLUIDA") &&
                      e.dataEvento
                    ) {
                      const tEvt = new Date(e.dataEvento).getTime();
                      if (tEvt > cStart && tEvt <= cEnd) {
                        if (tEvt > maxConclusao) maxConclusao = tEvt;
                        found = true;
                      }
                    }
                  }
                }
                // Verificar dataConclusao
                if (t.dataConclusao) {
                  const tConc = new Date(t.dataConclusao).getTime();
                  if (tConc > cStart && tConc <= cEnd) {
                    if (tConc > maxConclusao) maxConclusao = tConc;
                    found = true;
                  }
                }
              }

              if (found) fimEfetivo = new Date(maxConclusao);
              else fimEfetivo = c.fim; // Fallback: setor não teve conclusão explícita mas ciclo fechou

              // Garantir que não ultrapasse o fim do ciclo
              if (fimEfetivo > c.fim) fimEfetivo = c.fim;

              // NOVO: Coletar reprovações deste setor neste ciclo
              const reprovacoesNoCiclo = reprovEvents.filter((ev) => {
                if (ev.setor !== setor) return false;
                const t = ev.data ? new Date(ev.data).getTime() : 0;
                // Usar a mesma tolerância de agrupamento: Início do ciclo (-1min) até o Fim do ciclo
                return t >= cStart - 60000 && t <= cEnd;
              });

              const qtdReprovacoes = reprovacoesNoCiclo.length;
              const tarefasReprovadasNomes = reprovacoesNoCiclo.map((ev) => {
                const tarefa = tarefasAtivas.find(
                  (t: any) => t.id === ev.tarefaId,
                );
                return tarefa
                  ? tarefa.tipo || "Tarefa sem nome"
                  : "Desconhecida";
              });
              // Nomes únicos para o tooltip
              const nomesUnicos = Array.from(new Set(tarefasReprovadasNomes));

              timelineComCorrecoes.push({
                responsavel: setor,
                inicio: c.inicio.toISOString(),
                fim: fimEfetivo.toISOString(),
                ms: msDiff(c.inicio, fimEfetivo),
                ciclo: 4,
                tipo: "CORREÇÃO DE REPROVAÇÕES",
                qtdReprovacoes,
                tarefasReprovadas: nomesUnicos,
              });
            }
          }
        }
      }

      const submitEvents = historicosPrestserv
        .filter((h) => normUpSpace(h.valorNovo).includes("SUBMETER RASCUNHO"))
        .map((h) => (h.dataAcao ? new Date(h.dataAcao) : null))
        .filter(Boolean) as Date[];
      for (const ts of submitEvents) {
        const tsIso = ts.toISOString();
        const exists = timelineComCorrecoes.some((seg: any) => {
          if (seg.responsavel !== "LOGISTICA") return false;
          const t = (seg.tipo || "").toUpperCase();
          if (!t.includes("ANÁLISE") && !t.includes("ANALISE")) return false;
          const sTs = seg.inicio ? new Date(seg.inicio).getTime() : 0;
          const eTs = seg.fim ? new Date(seg.fim).getTime() : sTs;
          const min = Math.min(sTs, eTs);
          const max = Math.max(sTs, eTs);
          const cur = ts.getTime();
          return cur >= min && cur <= max;
        });
        if (!exists) {
          timelineComCorrecoes.push({
            responsavel: "LOGISTICA",
            inicio: tsIso,
            fim: tsIso,
            ms: 0,
            ciclo: 3,
            tipo: "ANÁLISE (SUBMETER RASCUNHO)",
          });
        }
      }

      timelineComCorrecoes.sort(
        (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
      );
      responsabilidadeTimeline.length = 0;
      responsabilidadeTimeline.push(...timelineComCorrecoes);

      // Fallback: se não foi possível detectar ciclos válidos
      if (responsabilidadeTimeline.length === 0 && ciclos.length === 0) {
        const inicioFallback = totalStart as Date;
        const fimFallback = totalEnd as Date;
        if (fimFallback && inicioFallback && fimFallback > inicioFallback) {
          responsabilidadeTimeline.push({
            responsavel: "LOGISTICA",
            inicio: inicioFallback.toISOString(),
            fim: fimFallback.toISOString(),
            ms: msDiff(inicioFallback, fimFallback),
            ciclo: 1,
            tipo: "FALLBACK_GERAL",
          });
        }
      }

      const downtimePorSetor: Record<string, number> = {};
      const segmentosPorSetor: Record<
        string,
        {
          inicio: string;
          fim: string;
          ms: number;
          ciclo?: number;
          qtdReprovacoes?: number;
          tarefasReprovadas?: string[];
        }[]
      > = {};
      for (const setor of setores) downtimePorSetor[setor] = 0;

      // Calcular atuação por setor dentro de cada ciclo, com fallback proporcional por contagem de tarefas se eventos forem insuficientes
      for (let ci = 0; ci < ciclos.length; ci++) {
        const ciclo = ciclos[ci];
        const cicloDur = msDiff(ciclo.inicio, ciclo.fim);

        // IDENTIFICAR SETORES RESPONSÁVEIS PELO CICLO 4 (CORREÇÃO)
        // Apenas setores que tiveram evento de reprovação neste período devem contabilizar tempo.
        const setoresResponsaveisCorrection = new Set<string>();
        if (ciclo.cicloNum === 4) {
          const cStart = ciclo.inicio.getTime();
          const cEnd = ciclo.fim.getTime();
          // Tolerância de 1 minuto para pegar o evento gatilho
          const startTol = cStart - 60000;

          for (const ev of reprovEvents) {
            const t = ev.data ? new Date(ev.data).getTime() : 0;
            if (t >= startTol && t <= cEnd) {
              setoresResponsaveisCorrection.add(ev.setor);
            }
          }
        }

        const medidosPorSetor: Record<string, number> = {};
        const contagemPorSetor: Record<string, number> = {};
        const displayIntervalBySetor: Record<
          string,
          { inicio: Date; fim: Date }
        > = {};

        for (const setor of setores) {
          // FILTRO DE RESPONSABILIDADE PARA CICLO 4
          // Se estamos num ciclo de correção, ignoramos setores que não tiveram reprovação vinculada.
          if (
            ciclo.cicloNum === 4 &&
            !setoresResponsaveisCorrection.has(setor)
          ) {
            continue;
          }

          const tsSetor = tarefasAtivas.filter(
            (t: any) => deriveSetor(t) === setor,
          );
          contagemPorSetor[setor] = tsSetor.length;
          if (tsSetor.length === 0) continue;

          const inicioCandidates: Date[] = [];
          const fimCandidates: Date[] = [];
          for (const t of tsSetor) {
            if (t.dataCriacao) inicioCandidates.push(new Date(t.dataCriacao));
            for (const e of t.eventosStatus || []) {
              if (e.statusNovo === "REPROVADO" && e.dataEvento)
                inicioCandidates.push(new Date(e.dataEvento));
              if (
                (e.statusNovo === "CONCLUIDO" ||
                  e.statusNovo === "CONCLUIDA") &&
                e.dataEvento
              )
                fimCandidates.push(new Date(e.dataEvento));
            }
            if (t.dataConclusao) fimCandidates.push(new Date(t.dataConclusao));
          }

          const inicioSetorRaw = inicioCandidates.length
            ? new Date(Math.min(...inicioCandidates.map((d) => d.getTime())))
            : ciclo.inicio;
          const fimSetorRaw = fimCandidates.length
            ? new Date(Math.max(...fimCandidates.map((d) => d.getTime())))
            : ciclo.fim;

          // Ajuste: Para ciclos de setores (2 e 4), o início é o gatilho do ciclo (Aprovação ou Reprovação)
          // Isso captura o tempo de reação + execução.
          const inicioSetor = ciclo.inicio;

          const fimSetor = new Date(
            Math.min(fimSetorRaw.getTime(), ciclo.fim.getTime()),
          );

          const validFim = fimSetor > inicioSetor ? fimSetor : inicioSetor;

          let ms = msDiff(inicioSetor, validFim);

          // Se estamos no Ciclo 4 (Correção) e o setor tem tarefas, assumimos responsabilidade pelo ciclo todo
          // caso não haja eventos explícitos de "nova conclusão" que reduzam o tempo.
          // Isso garante que o tempo de correção apareça no gráfico/tabela.
          if (ciclo.cicloNum === 4 && ms === 0 && tsSetor.length > 0) {
            ms = cicloDur;
          }

          if (ms > 0)
            medidosPorSetor[setor] = (medidosPorSetor[setor] || 0) + ms;

          // Acumular intervalos de início/fim por setor ao longo dos ciclos
          const displayInicio = inicioSetor;
          const displayFim = ms === cicloDur ? ciclo.fim : validFim;

          if (displayFim >= displayInicio) {
            displayIntervalBySetor[setor] = {
              inicio: displayInicio,
              fim: displayFim,
            };
            const existente = intervalosPorSetor[setor];
            if (!existente) {
              intervalosPorSetor[setor] = {
                inicio: displayInicio.toISOString(),
                fim: displayFim.toISOString(),
              };
            } else {
              const atualInicio = new Date(existente.inicio);
              const atualFim = new Date(existente.fim);
              const novoInicio =
                displayInicio < atualInicio ? displayInicio : atualInicio;
              const novoFim = displayFim > atualFim ? displayFim : atualFim;
              intervalosPorSetor[setor] = {
                inicio: novoInicio.toISOString(),
                fim: novoFim.toISOString(),
              };
            }
          }
        }

        const somaMedida = Object.values(medidosPorSetor).reduce(
          (a, b) => a + b,
          0,
        );
        const somaContagem = Object.values(contagemPorSetor).reduce(
          (a, b) => a + b,
          0,
        );
        const eventosInsuficientes = somaMedida < cicloDur * 0.1; // menos de 10% do ciclo coberto por eventos

        for (const setor of setores) {
          const msFinal = eventosInsuficientes
            ? somaContagem > 0
              ? Math.round(cicloDur * (contagemPorSetor[setor] / somaContagem))
              : 0
            : medidosPorSetor[setor] || 0;
          if (msFinal > 0) {
            downtimePorSetor[setor] = (downtimePorSetor[setor] || 0) + msFinal;
            if (!ciclosSetorDurMs[setor]) ciclosSetorDurMs[setor] = [];
            ciclosSetorDurMs[setor].push(msFinal);
            const interval = displayIntervalBySetor[setor];
            if (interval) {
              if (!segmentosPorSetor[setor]) segmentosPorSetor[setor] = [];

              let qtdReprovacoes: number | undefined;
              let tarefasReprovadas: string[] | undefined;

              if (ciclo.cicloNum === 4) {
                const cStart = ciclo.inicio.getTime();
                const cEnd = ciclo.fim.getTime();
                const reprovacoesNoCiclo = reprovEvents.filter((ev) => {
                  if (ev.setor !== setor) return false;
                  const t = ev.data ? new Date(ev.data).getTime() : 0;
                  return t >= cStart - 60000 && t <= cEnd;
                });
                if (reprovacoesNoCiclo.length > 0) {
                  qtdReprovacoes = reprovacoesNoCiclo.length;
                  const nomes = reprovacoesNoCiclo.map((ev) => {
                    const tarefa = tarefasAtivas.find(
                      (t: any) => t.id === ev.tarefaId,
                    );
                    return tarefa
                      ? tarefa.tipo || "Tarefa sem nome"
                      : "Desconhecida";
                  });
                  tarefasReprovadas = Array.from(new Set(nomes));
                }
              }

              segmentosPorSetor[setor].push({
                inicio: interval.inicio.toISOString(),
                fim: interval.fim.toISOString(),
                ms: msFinal,
                ciclo: ciclo.cicloNum,
                tipo:
                  ciclo.cicloNum === 4 ? "CORREÇÃO DE REPROVAÇÕES" : undefined,
                qtdReprovacoes,
                tarefasReprovadas,
              });
            }
          }
        }
      }

      const logisticaMs = responsabilidadeTimeline
        .filter((seg) => seg.responsavel === "LOGISTICA")
        .reduce((acc, seg) => acc + (seg.ms || 0), 0);
      if (logisticaMs > 0) {
        downtimePorSetor["LOGISTICA"] =
          (downtimePorSetor["LOGISTICA"] || 0) + logisticaMs;
        const ar = agregadosSetorDuracoes.get("LOGISTICA") || [];
        ar.push(logisticaMs);
        agregadosSetorDuracoes.set("LOGISTICA", ar);

        const segsLog = responsabilidadeTimeline.filter(
          (seg) => seg.responsavel === "LOGISTICA",
        );
        if (segsLog.length > 0) {
          const inicioLog = new Date(
            Math.min(...segsLog.map((s) => new Date(s.inicio).getTime())),
          );
          const fimLog = new Date(
            Math.max(...segsLog.map((s) => new Date(s.fim).getTime())),
          );
          intervalosPorSetor["LOGISTICA"] = {
            inicio: inicioLog.toISOString(),
            fim: fimLog.toISOString(),
          };
          if (!segmentosPorSetor["LOGISTICA"])
            segmentosPorSetor["LOGISTICA"] = [];
          for (const seg of segsLog) {
            const cicloValue = (seg as any).ciclo ?? undefined;
            segmentosPorSetor["LOGISTICA"].push({
              inicio: seg.inicio,
              fim: seg.fim,
              ms: seg.ms,
              ciclo: cicloValue,
            });
          }
        }
      }

      // Montar tempos médios por setor (somente setores de atuação) e incluir logística
      const temposMediosPorSetor = Object.entries(temposConclusaoPorSetor).map(
        ([setor, arr]) => ({ setor, tempoMedioMs: media(arr as number[]) }),
      );
      const requiredSetores = ["RH", "MEDICINA", "TREINAMENTO"];
      const MIN_VALID_MS = 1 * 1000; // mínimo 1 segundo para considerar atuação válida
      const hasAnyValid = requiredSetores.some((set) => {
        const e = temposMediosPorSetor.find((x) => x.setor === set);
        return e && e.tempoMedioMs && e.tempoMedioMs >= MIN_VALID_MS;
      });
      const autoAprovado = (rf.tarefas || []).some((t: any) => {
        const desc = normUp(t.descricao);
        const hasDesc =
          desc.includes("APROVADAS AUTOMATICAMENTE") ||
          desc.includes("APROVADO AUTOMATICAMENTE");
        const hasHist = (t.historico || []).some((h: any) => {
          const d = normUp(h.descricaoAcao);
          return (
            d.includes("APROVADAS AUTOMATICAMENTE") ||
            d.includes("APROVADO AUTOMATICAMENTE")
          );
        });
        return hasDesc || hasHist;
      });

      const temposMediosPorSetorAug = [
        ...temposMediosPorSetor,
        { setor: "LOGISTICA", tempoMedioMs: logisticaMs },
      ];

      let duracaoPorSetorMsArr = Object.entries(ciclosSetorDurMs).map(
        ([setor, arr]) => {
          const totalCiclo = arr.reduce((a, b) => a + b, 0);
          const desconto = exclusoesPorSetor[setor] || 0;
          // Subtrai o tempo dos status excluídos (11, 6, 12) do tempo calculado pelos ciclos
          return { setor, ms: Math.max(0, totalCiclo - desconto) };
        },
      );

      const somaCiclosOriginal = Object.values(ciclosSetorDurMs)
        .flat()
        .reduce((a, b) => a + b, 0);

      const setorDurArr = Object.entries(setorDur).map(([setor, ms]) => ({
        setor,
        ms,
      }));

      if (somaCiclosOriginal === 0) {
        // Fallback: sem ciclos válidos, usa soma direta dos segmentos por setor
        // setorDurArr já contém a lógica de exclusão (processada no loop inicial)

        // Ajuste OUTROS no fallback: maior valor entre exclusões de tarefas e exclusão global
        const totalExclusoes = Object.values(exclusoesPorSetor).reduce(
          (a, b) => a + b,
          0,
        );
        const valorOutros = Math.max(totalExclusoes, setorDur["OUTROS"] || 0);

        // Se calculamos um valor para OUTROS maior que o existente em setorDurArr, atualizamos
        const outrosIndex = setorDurArr.findIndex((x) => x.setor === "OUTROS");
        if (outrosIndex >= 0) {
          setorDurArr[outrosIndex].ms = valorOutros;
        } else if (valorOutros > 0) {
          setorDurArr.push({ setor: "OUTROS", ms: valorOutros });
        }

        duracaoPorSetorMsArr = setorDurArr;
        // Também alimentar agregados para cálculo de médias por setor
        for (const { setor, ms } of setorDurArr) {
          if (ms > 0) {
            const ag = agregadosSetorDuracoes.get(setor) || [];
            ag.push(ms);
            agregadosSetorDuracoes.set(setor, ag);
          }
        }
      } else {
        // Se houve ciclos, adicionar o tempo excluído ao setor OUTROS
        const totalExclusoes = Object.values(exclusoesPorSetor).reduce(
          (a, b) => a + b,
          0,
        );

        // O valor de OUTROS deve ser o maior entre:
        // 1. A soma das exclusões aplicadas aos setores (totalExclusoes)
        // 2. O tempo total calculado pela timeline global de exclusão (setorDur["OUTROS"])
        const valorOutros = Math.max(totalExclusoes, setorDur["OUTROS"] || 0);

        if (valorOutros > 0) {
          const outrosIdx = duracaoPorSetorMsArr.findIndex(
            (x) => x.setor === "OUTROS",
          );
          if (outrosIdx >= 0) {
            duracaoPorSetorMsArr[outrosIdx].ms = valorOutros;
          } else {
            duracaoPorSetorMsArr.push({ setor: "OUTROS", ms: valorOutros });
          }
        }
      }
      if (logisticaMs > 0) {
        const hasLogDur = duracaoPorSetorMsArr.find(
          (x) => x.setor === "LOGISTICA",
        );
        if (!hasLogDur)
          duracaoPorSetorMsArr.push({ setor: "LOGISTICA", ms: logisticaMs });
      }
      const totalDuracaoMs = totalDurMs;

      if ((rf.tarefas || []).length > 0) {
        const reprovacoesPorSetor: Record<string, number> = {};
        for (const ev of reprovEvents) {
          const k = (ev.setor || "").toString();
          reprovacoesPorSetor[k] = (reprovacoesPorSetor[k] || 0) + 1;
        }
        porRemanejamento.push({
          remanejamentoId: rf.id,
          solicitacaoId: rf.solicitacaoId,
          funcionario: rf.funcionario,
          totalDurMs: totalDuracaoMs,
          temposMediosPorSetor: temposMediosPorSetorAug,
          periodosPorSetor: Object.entries(intervalosPorSetor).map(
            ([setor, itv]) => ({ setor, inicio: itv.inicio, fim: itv.fim }),
          ),
          duracaoPorSetorMs: duracaoPorSetorMsArr,
          responsabilidadeTimeline,
          segmentosPorSetor,
          solicitacaoDataCriacao: rf.solicitacao?.dataSolicitacao
            ? new Date(rf.solicitacao.dataSolicitacao).toISOString()
            : null,
          remanejamentoDataConclusao: totalEnd
            ? new Date(totalEnd).toISOString()
            : null,
          teveReprovacao: reprovEvents.length > 0,
          reprovacoesPorSetor: Object.entries(reprovacoesPorSetor).map(
            ([setor, count]) => ({ setor, count }),
          ),
          reprovEvents: reprovEvents.map((ev) => ({
            setor: ev.setor,
            data: ev.data ? (ev.data as Date).toISOString() : null,
            source: ev.source,
            tarefaId: ev.tarefaId,
            tarefaDescricao: ev.tarefaDescricao || null,
          })),
        });
      }

      // Ajuste de tempos excluídos em downtimePorSetor (para refletir nos agregados globais)
      for (const [setor, msExcluido] of Object.entries(exclusoesPorSetor)) {
        if (msExcluido > 0) {
          if (downtimePorSetor[setor]) {
            downtimePorSetor[setor] = Math.max(
              0,
              downtimePorSetor[setor] - msExcluido,
            );
          }
          // Incrementa OUTROS com o que foi deduzido dos setores
          downtimePorSetor["OUTROS"] =
            (downtimePorSetor["OUTROS"] || 0) + msExcluido;
        }
      }

      // Garantir que OUTROS reflete o tempo global calculado (se maior que a soma das deduções)
      if ((setorDur["OUTROS"] || 0) > (downtimePorSetor["OUTROS"] || 0)) {
        downtimePorSetor["OUTROS"] = setorDur["OUTROS"];
      }

      // Se houver tempo em OUTROS, garantir que existe no mapa global porSetor
      if ((downtimePorSetor["OUTROS"] || 0) > 0) {
        const outMs = downtimePorSetor["OUTROS"];
        const setorAgg = porSetor.get("OUTROS") || {
          setor: "OUTROS",
          qtdTarefas: 0,
          downtimeMs: 0,
          conclusoesMs: [],
          reprovações: 0,
        };
        // Não incrementamos qtdTarefas pois são apenas tempos desviados
        setorAgg.downtimeMs += outMs;
        setorAgg.conclusoesMs.push(outMs);
        porSetor.set("OUTROS", setorAgg);
      }

      for (const [setor, ms] of Object.entries(downtimePorSetor)) {
        if (ms > 0) {
          const ar = agregadosSetorDuracoes.get(setor) || [];
          ar.push(ms);
          agregadosSetorDuracoes.set(setor, ar);
        }
      }

      const atuacaoPorcentPorSetor = Object.entries(downtimePorSetor).map(
        ([setor, ms]) => ({
          setor,
          porcentagem: totalDurMs > 0 ? ms / totalDurMs : 0,
        }),
      );

      // Removido acúmulo por solicitação (não utilizado na visão por setor)

      if (logisticaMs > 0) {
        const setorAgg = porSetor.get("LOGISTICA") || {
          setor: "LOGISTICA",
          qtdTarefas: 0,
          downtimeMs: 0,
          conclusoesMs: [] as number[],
          reprovações: 0,
        };
        setorAgg.downtimeMs += logisticaMs;
        setorAgg.conclusoesMs.push(logisticaMs);
        porSetor.set("LOGISTICA", setorAgg);
      }
    }

    const mediasPorSetorMs: Record<string, number> = {};
    for (const [setor, arr] of agregadosSetorDuracoes.entries()) {
      mediasPorSetorMs[setor] = media(arr);
    }

    const porSetorArr = Array.from(porSetor.values()).map((s) => ({
      setor: s.setor,
      qtdTarefas: s.qtdTarefas,
      duracaoMediaAtuacaoMs: mediasPorSetorMs[s.setor] || 0,
      tempoMedioConclusaoMs: media(s.conclusoesMs),
      reprovacoes: s.reprovações,
    }));

    return NextResponse.json({
      periodoDias: dias,
      porSetor: porSetorArr,
      porRemanejamento,
      reprovacoesPorTipo: reprovPorTipo,
      aprovadasPorTipo: aprovPorTipo,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Falha ao gerar relatório de SLA", details: message },
      { status: 500 },
    );
  }
}
