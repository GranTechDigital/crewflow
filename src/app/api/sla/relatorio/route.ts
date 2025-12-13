import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Duracao = { status: string; ms: number };

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

function segmentosTarefa(task: any, eventos: { statusAnterior?: string | null; statusNovo?: string | null; dataEvento: Date | null }[], inicioPadrao: Date, fimPadrao: Date): Duracao[] {
  const evts = ordenarEventos(eventos);
  const inicio = task.dataCriacao || inicioPadrao;
  const fim = task.dataConclusao || fimPadrao;
  const segs: Duracao[] = [];
  let lastTs = inicio;
  let currentStatus = evts.length > 0 ? (evts[0].statusAnterior ?? task.status ?? "PENDENTE") : (task.status ?? "PENDENTE");
  for (const e of evts) {
    const ts = e.dataEvento || fim;
    const ms = msDiff(lastTs, ts);
    if (ms > 0) segs.push({ status: String(currentStatus), ms });
    currentStatus = e.statusNovo ?? currentStatus;
    lastTs = ts;
  }
  const msFinal = msDiff(lastTs, fim);
  if (msFinal > 0) segs.push({ status: String(currentStatus), ms: msFinal });
  return segs;
}

function somar(segs: Duracao[], status: string) {
  return segs.filter((s) => s.status === status).reduce((acc, s) => acc + s.ms, 0);
}

function media(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const diasParam = searchParams.get("dias");
    const dias = diasParam ? parseInt(diasParam, 10) : 90;
    const somenteConcluidos = (searchParams.get("concluidos") || "").toLowerCase() === "true";
    const agora = new Date();
    const inicioJanela = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

    let remanejamentos: any[] = [];
    const whereBase: any = {
      ...(somenteConcluidos
        ? {
            OR: [
              { statusTarefas: { in: ["CONCLUIDO", "CONCLUIDA", "SOLICITAÇÃO CONCLUÍDA", "SOLICITAÇÃO CONCLUIDA"] } },
              { statusTarefas: { contains: "CONCLUID", mode: "insensitive" } },
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
          }),
    };
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
      const whereFallback: any = {
        ...(somenteConcluidos
          ? {
              OR: [
                { statusTarefas: { in: ["CONCLUIDO", "CONCLUIDA", "SOLICITAÇÃO CONCLUÍDA", "SOLICITAÇÃO CONCLUIDA"] } },
                { statusPrestserv: { in: ["VALIDADO", "Validado", "validado"] } },
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
            }),
      };
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
                   WHERE "remanejamentoFuncionarioId" IN (${Prisma.join(remIds)})`
      );
      const tarefaIds = tarefasRows.map((t) => t.id);
      // Eventos de status das tarefas
      const eventos = tarefaIds.length
        ? await prisma.tarefaStatusEvento.findMany({
            where: { tarefaId: { in: tarefaIds } },
            select: { tarefaId: true, statusAnterior: true, statusNovo: true, dataEvento: true },
          })
        : [];
      const eventosMap = new Map<string, any[]>();
      for (const e of eventos) {
        const arr = eventosMap.get(e.tarefaId) || [];
        arr.push({ statusAnterior: e.statusAnterior, statusNovo: e.statusNovo, dataEvento: e.dataEvento });
        eventosMap.set(e.tarefaId, arr);
      }
      // Histórico relacionado às tarefas (com equipe)
      const historicos = tarefaIds.length
        ? await prisma.historicoRemanejamento.findMany({
            where: { tarefaId: { in: tarefaIds } },
            select: { tarefaId: true, descricaoAcao: true, valorNovo: true, dataAcao: true, equipe: { select: { nome: true } } },
            orderBy: { dataAcao: "asc" },
          })
        : [];
      const histMap = new Map<string, any[]>();
      for (const h of historicos) {
        if (!h.tarefaId) continue;
        const key = String(h.tarefaId);
        const arr = histMap.get(key) || [];
        arr.push({ descricaoAcao: h.descricaoAcao, valorNovo: h.valorNovo, dataAcao: h.dataAcao, equipe: h.equipe });
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

    for (const rf of remanejamentos) {
      // Histórico de decisões da logística (Prestserv) — tolerante a variações
      const historicosPrestserv = await prisma.historicoRemanejamento.findMany({
        where: {
          remanejamentoFuncionarioId: rf.id,
          OR: [
            {
              entidade: { equals: 'PRESTSERV', mode: 'insensitive' },
              campoAlterado: { contains: 'status', mode: 'insensitive' },
            },
            {
              entidade: { contains: 'LOGIST', mode: 'insensitive' },
              campoAlterado: { contains: 'prestserv', mode: 'insensitive' },
            },
            {
              entidade: { contains: 'PRESTSERV', mode: 'insensitive' },
              campoAlterado: { contains: 'prestserv', mode: 'insensitive' },
            },
          ],
        },
        select: { valorNovo: true, dataAcao: true },
        orderBy: { dataAcao: 'asc' },
      });
      const normUp = (val: string | null | undefined) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
      const reprovEvents: { setor: string; data: Date | null; source: string; tarefaId?: string | number }[] = [];
      const evtValidado = historicosPrestserv
        .filter((h) => {
          const v = normUp(h.valorNovo);
          return (v.includes('VALIDAD') || v.includes('INVALIDAD') || v.includes('REJEIT')) && !!h.dataAcao;
        })
        .reduce<Date | null>((acc, h) => {
          const d = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!d) return acc;
          return !acc || d > acc ? d : acc;
        }, null);

      const evtValidadoPrimeiro = historicosPrestserv
        .map((h) => ({ v: normUp(h.valorNovo), d: h.dataAcao ? new Date(h.dataAcao) : null }))
        .filter((x) => x.d && x.v === 'VALIDADO')
        .reduce<Date | null>((acc, x) => (!acc || (x.d as Date) < acc ? (x.d as Date) : acc), null);

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
      const tentativeEnd = (
        rf.dataConcluido
          || evtValidadoPrimeiro
          || (rf.dataResposta ? new Date(rf.dataResposta) : null)
          || (rf.dataSubmetido ? new Date(rf.dataSubmetido) : null)
          || rf.updatedAt
          || agora
      ) as Date;
      const totalEnd = (tentativeEnd && totalStart && (tentativeEnd as Date).getTime() <= (totalStart as Date).getTime())
        ? agora
        : tentativeEnd;
      const totalDurMs = msDiff(totalStart, totalEnd);

      const setorDur: Record<string, number> = {};
      const tarefaReprovCount: Record<string, number> = {};
      const temposConclusaoPorSetor: Record<string, number[]> = {};
      let downtimeMsSum = 0;

      const toSetor = (val: string | null | undefined) => {
        const sRaw = (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
        if (!sRaw) return '';
        // TREINAMENTO: abrangencia maior
        if (
          sRaw.includes('TREIN') ||
          sRaw.includes('CAPACIT') ||
          sRaw.includes('CAPACITA') ||
          sRaw.includes('CURSO') ||
          sRaw.includes('INSTRU') ||
          sRaw.includes('CERTIFIC')
        ) return 'TREINAMENTO';
        // MEDICINA: incluir termos comuns do fluxo ocupacional
        if (
          sRaw.includes('MEDIC') ||
          sRaw.includes('SAUDE') ||
          sRaw.includes('ENFERM') ||
          sRaw.includes('AMBULATORIO') ||
          sRaw.includes('ASO') ||
          sRaw.includes('EXAME') ||
          sRaw.includes('MEDICO')
        ) return 'MEDICINA';
        // RH / Departamento Pessoal
        if (
          sRaw.includes('RECURSOS') ||
          sRaw.includes('HUMANOS') ||
          sRaw.includes(' DEPARTAMENTO PESSOAL') ||
          sRaw.includes('DEPARTAMENTO PESSOAL') ||
          sRaw.includes('DP') ||
          sRaw.includes('ADMISS') ||
          sRaw.includes('DOCUMENTACAO RH') ||
          sRaw.includes('DOC RH') ||
          sRaw.includes(' RH') ||
          sRaw === 'RH' ||
          sRaw.includes('RH')
        ) return 'RH';
        return sRaw;
      };
      const deriveSetor = (t: any) => {
        // Não usar relação t.setor; inferir somente por histórico/equipe, responsável, tipo e descrição
        const histNome = (t.historico || []).map((h: any) => h.equipe?.nome).filter(Boolean)[0] as string | undefined;
        const histSet = toSetor(histNome);
        if (histSet === 'RH' || histSet === 'MEDICINA' || histSet === 'TREINAMENTO') return histSet;
        const r = toSetor(t.responsavel);
        if (r === 'RH' || r === 'MEDICINA' || r === 'TREINAMENTO') return r;
        const tipoSet = toSetor(t.tipo);
        if (tipoSet === 'RH' || tipoSet === 'MEDICINA' || tipoSet === 'TREINAMENTO') return tipoSet;
        const descSet = toSetor(t.descricao);
        if (descSet === 'RH' || descSet === 'MEDICINA' || descSet === 'TREINAMENTO') return descSet;
        return 'DESCONHECIDO';
      };

      // Removido filtro rígido de pré-validação para evitar resposta vazia. Filtramos somente no momento de montar a lista porRemanejamento.

      for (const t of rf.tarefas) {
        const segs = segmentosTarefa(t, t.eventosStatus || [], totalStart, totalEnd);
        downtimeMsSum += somar(segs, "PENDENTE");
        const setor = deriveSetor(t);
        setorDur[setor] = (setorDur[setor] || 0) + segs.reduce((acc, s) => acc + s.ms, 0);

      const conclEvt = (t.eventosStatus || []).find((e: any) => e.statusNovo === "CONCLUIDO" || e.statusNovo === "CONCLUIDA");
        const conclDate = conclEvt?.dataEvento
          ? new Date(conclEvt.dataEvento)
          : (t.dataConclusao ? new Date(t.dataConclusao) : null);
        if (conclDate) {
          const durConclusao = msDiff(totalStart, conclDate);
          if (!temposConclusaoPorSetor[setor]) temposConclusaoPorSetor[setor] = [];
          temposConclusaoPorSetor[setor].push(durConclusao);
        }

        const evtsReprov = (t.eventosStatus || []).filter((e: any) => {
          const s = (e.statusNovo || '').toString().toUpperCase();
          return s.includes('REPROV') || s.includes('REJEIT') || s.includes('INVALID');
        });
        const reprovsEvt = evtsReprov.length;
        for (const e of evtsReprov) {
          const d = e.dataEvento ? new Date(e.dataEvento) : null;
          reprovEvents.push({ setor, data: d, source: 'evento', tarefaId: t.id });
        }
        const histReprov = (t.historico || []).filter((h: any) => {
          const vn = (h.valorNovo || '').toString().toUpperCase();
          const desc = (h.descricaoAcao || '').toString().toUpperCase();
          return (
            vn.includes('REPROV') || desc.includes('REPROV') ||
            vn.includes('REJEIT') || desc.includes('REJEIT') ||
            vn.includes('INVALID') || desc.includes('INVALID')
          );
        });
        const reprovsHist = histReprov.length;
        for (const h of histReprov) {
          const d = h.dataAcao ? new Date(h.dataAcao) : null;
          reprovEvents.push({ setor, data: d, source: 'historico', tarefaId: t.id });
        }
        const reprovsStatus = ((rf.tarefas || []).filter((x: any) => {
          const st = (x.status || '').toString().toUpperCase();
          return st.includes('REPROV') || st.includes('REJEIT') || st.includes('INVALID');
        }).length) || 0;
        const reprovs = reprovsEvt + reprovsHist + reprovsStatus;
        if (reprovs > 0) {
          const key = `${setor}|${t.tipo}`;
          tarefaReprovCount[key] = (tarefaReprovCount[key] || 0) + reprovs;
          const tipoKey = t.tipo || 'Não definido';
          reprovPorTipo[tipoKey] = (reprovPorTipo[tipoKey] || 0) + reprovs;
        }

        const setorAgg = porSetor.get(setor) || { setor, qtdTarefas: 0, downtimeMs: 0, conclusoesMs: [] as number[], reprovações: 0 };
        setorAgg.qtdTarefas += 1;
        setorAgg.downtimeMs += somar(segs, "PENDENTE");
        if (conclDate) setorAgg.conclusoesMs.push(msDiff(totalStart, conclDate));
        setorAgg.reprovações += reprovs;
        porSetor.set(setor, setorAgg);
      }

      const tarefasAtivas = (rf.tarefas || []).filter((t: any) => t.status !== "CANCELADO");
      const setores: string[] = Array.from(new Set(tarefasAtivas.map((t: any) => deriveSetor(t)))) as string[];

      const aprovacaoMs = rf.dataSubmetido && rf.dataResposta ? msDiff(new Date(rf.dataSubmetido), new Date(rf.dataResposta)) : 0;
      const todasTarefasConcluidas = tarefasAtivas.length > 0 && tarefasAtivas.every((t: any) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA");
      let fimTarefas: Date | null = null;
      if (todasTarefasConcluidas) {
        for (const t of tarefasAtivas) {
          const d = t.dataConclusao ? new Date(t.dataConclusao) : null;
          if (d && (!fimTarefas || d > fimTarefas)) fimTarefas = d;
        }
      }
      const posConclusaoAteValidadoMs = fimTarefas ? msDiff(fimTarefas, totalEnd) : 0;
      

      // Adiar push para após cálculo de logística

      // Construção da timeline de responsabilidade (Logística ↔ Setores)
      // Objetivo: marcar quem está "com a bola" ao longo do fluxo, para segmentar
      // - Pré-setores: LOGÍSTICA de criação da solicitação até a aprovação inicial
      // - Ciclos: SETORES trabalham até todas as tarefas concluírem; LOGÍSTICA decide
      //   • Se REJEITADO/INVALIDADO: volta para SETORES e repete
      //   • Se VALIDADO: encerra
      const responsabilidadeTimeline: { responsavel: string; inicio: string; fim: string; ms: number; ciclo?: number; tipo?: string }[] = [];
      const ciclos: { inicio: Date; fim: Date }[] = [];
      const intervalosPorSetor: Record<string, { inicio: string; fim: string }> = {};
      const ciclosSetorDurMs: Record<string, number[]> = {};

      // Segmento 0 (pré-setores): LOGÍSTICA da criação da solicitação até a aprovação inicial (dataAprovado)
      // Fonte principal: rf.solicitacao.dataSolicitacao (início) e rf.dataAprovado (fim)
      // Fallback do fim: rf.dataSubmetido, rf.dataResposta ou primeira decisão de Prestserv
      const tCriacaoSolic = rf.solicitacao?.dataSolicitacao
        ? new Date(rf.solicitacao.dataSolicitacao)
        : (rf.createdAt ? new Date(rf.createdAt) : null);
      const tAprovado = rf.dataAprovado ? new Date(rf.dataAprovado) : null;
      const taskStartCandidates: Date[] = [];
      for (const t of tarefasAtivas) {
        if (t.dataCriacao) taskStartCandidates.push(new Date(t.dataCriacao));
      }
      const earliestTaskStart = taskStartCandidates.length ? new Date(Math.min(...taskStartCandidates.map((d) => d.getTime()))) : null;
      const firstPrestservDecision = historicosPrestserv
        .map((h) => ({ v: (h.valorNovo || '').toUpperCase(), d: h.dataAcao ? new Date(h.dataAcao) : null }))
        .filter((x) => x.d && (x.v === 'VALIDADO' || x.v === 'INVALIDADO' || x.v === 'REJEITADO'))
        .reduce<Date | null>((acc, x) => (!acc || (x.d as Date) < acc ? (x.d as Date) : acc), null);
      const preEndFallback = (rf.dataSubmetido ? new Date(rf.dataSubmetido) : null)
        || (rf.dataResposta ? new Date(rf.dataResposta) : null)
        || firstPrestservDecision
        || null;
      let preEndBound: Date | null = null;
      let tipoPre = 'PRE_SETOR_APROVACAO';
      if (tAprovado) {
        preEndBound = tAprovado;
        tipoPre = 'PRE_SETOR_APROVACAO';
      } else if (earliestTaskStart) {
        // Se não há dataAprovado, considerar criação de tarefas como fim do pré-setores
        preEndBound = earliestTaskStart;
        tipoPre = 'PRE_SETOR_APROVACAO_TAREFAS';
      } else if (preEndFallback) {
        preEndBound = preEndFallback;
        tipoPre = 'PRE_SETOR_FALLBACK';
      }
      if (tCriacaoSolic && preEndBound && preEndBound > tCriacaoSolic) {
        const ms = msDiff(tCriacaoSolic, preEndBound);
        responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: tCriacaoSolic.toISOString(), fim: preEndBound.toISOString(), ms, ciclo: 0, tipo: tipoPre });
      }

      // Função utilitária: encontrar momento em que todas as tarefas (não canceladas) estão concluídas após uma data base
      // Critério: primeiro instante em que todas as tarefas não-canceladas estão com status "CONCLUIDO/CONCLUIDA"
      // Usa tanto eventos (tarefaStatusEvento) quanto o campo dataConclusao para tolerar registros antigos
      const allTasksConcludedAfter = (after: Date | null): Date | null => {
        if (!after) return null;
        const tasks = (rf.tarefas || []).filter((t: any) => t.status !== 'CANCELADO');
        if (tasks.length === 0) return after;
        let maxConclusao: Date | null = null;
        for (const t of tasks) {
          // Encontrar primeiro evento CONCLUIDO após a data base
          const evts = ordenarEventos(t.eventosStatus || []);
          const conclEvt = evts.find((e: any) => (e.statusNovo === 'CONCLUIDO' || e.statusNovo === 'CONCLUIDA') && e.dataEvento && new Date(e.dataEvento) >= after);
          const candEvt = conclEvt ? new Date(conclEvt.dataEvento) : null;
          const candConclusao = t.dataConclusao && new Date(t.dataConclusao) >= after ? new Date(t.dataConclusao) : null;
          const candidato = candConclusao && candEvt ? (candConclusao > candEvt ? candConclusao : candEvt) : (candConclusao || candEvt);
          // Se não houver conclusão após a base e a tarefa não está concluída atualmente, então ainda não concluiu
          const statusAtualConcl = t.status === 'CONCLUIDO' || t.status === 'CONCLUIDA';
          if (!candidato && !statusAtualConcl) return null;
          if (candidato && (!maxConclusao || candidato > maxConclusao)) maxConclusao = candidato;
        }
        return maxConclusao || after;
      };

      // Função utilitária: próxima decisão da LOGÍSTICA após um instante
      // Procura em historicosPrestserv por VALIDADO/INVALIDADO/REJEITADO após "after".
      // Fallbacks, na ordem:
      //  1) rf.dataConcluido (equivalente a VALIDADO)
      //  2) Primeiro histórico com VALIDADO após "after"
      //  3) rf.dataResposta após "after" (quando há resposta/decisão fora do histórico)
      //  4) rf.dataSubmetido após "after" (último recurso para registros antigos)
      const nextPrestservDecisionAfter = (after: Date | null): { tipo: string; quando: Date } | null => {
        if (!after) return null;
        const decis = historicosPrestserv.find((h) => {
          const ts = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!ts) return false;
          const v = (h.valorNovo || '').toUpperCase();
          return ts > after && (v === 'VALIDADO' || v === 'INVALIDADO' || v === 'REJEITADO');
        });
        if (!decis) {
          // Fallback: preferir data de conclusão como VALIDADO
          if (rf.dataConcluido && new Date(rf.dataConcluido) > after) {
            return { tipo: 'VALIDADO', quando: new Date(rf.dataConcluido) };
          }
          // Ou primeira data em que statusPrestserv ficou VALIDADO
          const validadoDepois = historicosPrestserv.find((h) => {
            const ts = h.dataAcao ? new Date(h.dataAcao) : null;
            const v = (h.valorNovo || '').toUpperCase();
            return ts && ts > after && v === 'VALIDADO';
          });
          if (validadoDepois) {
            return { tipo: 'VALIDADO', quando: new Date(validadoDepois.dataAcao!) };
          }
          // dataResposta como decisão
          if (rf.dataResposta && new Date(rf.dataResposta) > after) {
            return { tipo: 'RESPOSTA', quando: new Date(rf.dataResposta) };
          }
          // dataSubmetido como último recurso
          if (rf.dataSubmetido && new Date(rf.dataSubmetido) > after) {
            return { tipo: 'SUBMETIDO', quando: new Date(rf.dataSubmetido) };
          }
          return null;
        }
        return { tipo: (decis.valorNovo || '').toUpperCase(), quando: new Date(decis.dataAcao!) };
      };

      // Ciclos: após aprovação inicial, SETORES trabalham até concluir; então LOGÍSTICA decide;
      // se INVALIDADO/REJEITADO, SETORES retomam; se VALIDADO, encerra.
      // Início dos ciclos setoriais: idealmente após aprovação; se não houver, usar fim do pré-setores calculado
      let cicloStart = preEndBound || tAprovado || tCriacaoSolic;
      const maxIter = 10; // segurança para evitar loops
      for (let i = 0; i < maxIter; i++) {
        const tConclTudo = allTasksConcludedAfter(cicloStart || null);
        if (!tConclTudo) break; // ainda não concluiu tudo
        // Registrar ciclo de SETORES: do início do ciclo até todas as tarefas concluírem
        ciclos.push({ inicio: cicloStart as Date, fim: tConclTudo as Date });
        // LOGÍSTICA assume de tConclTudo até próxima decisão (inclui reprovação/invalidade/validação)
        const decisao = nextPrestservDecisionAfter(tConclTudo);
        if (decisao) {
          const ms = msDiff(tConclTudo, decisao.quando);
          if (ms > 0) {
            const cicloIdx = ciclos.length; // ciclo recém adicionado
            responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: tConclTudo.toISOString(), fim: decisao.quando.toISOString(), ms, ciclo: cicloIdx, tipo: decisao.tipo });
          }
          if (decisao.tipo === 'VALIDADO') {
            break; // encerrado
          } else if (decisao.tipo === 'INVALIDADO' || decisao.tipo === 'REJEITADO') {
            // volta para os setores: novo ciclo inicia na decisão
            cicloStart = decisao.quando;
            continue;
          } else {
            // Sem classificação clara, encerra tentativa
            break;
          }
        } else {
          // Sem decisão registrada; se há dataConcluido e é após, já encerra
          if (rf.dataConcluido && new Date(rf.dataConcluido) >= (tConclTudo as Date)) {
            const ms = msDiff(tConclTudo as Date, new Date(rf.dataConcluido));
            if (ms > 0) {
              const cicloIdx = ciclos.length; // ciclo recém adicionado
              responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: (tConclTudo as Date).toISOString(), fim: new Date(rf.dataConcluido).toISOString(), ms, ciclo: cicloIdx, tipo: 'VALIDADO' });
            }
          }
          break;
        }
      }

      // Fallback: se não foi possível detectar ciclos válidos, considerar ciclo único do remanejamento completo
      if (ciclos.length === 0) {
        const inicioFallback = totalStart as Date;
        const fimFallback = totalEnd as Date;
        if (fimFallback && inicioFallback && fimFallback > inicioFallback) {
          ciclos.push({ inicio: inicioFallback, fim: fimFallback });
        }
      }

      // Fallback adicional de logística: entre dataSubmetido e resposta/validado/concluído
      if (responsabilidadeTimeline.length === 0) {
        const sub = rf.dataSubmetido ? new Date(rf.dataSubmetido) : null;
        const resp = rf.dataResposta ? new Date(rf.dataResposta) : null;
        const concl = rf.dataConcluido ? new Date(rf.dataConcluido) : null;
        const endLog = concl || evtValidadoPrimeiro || (totalEnd as Date);
        if (sub && endLog && endLog > sub) {
          const ms = msDiff(sub, endLog);
          if (ms > 0) responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: sub.toISOString(), fim: endLog.toISOString(), ms, ciclo: 0, tipo: 'FALLBACK_SUB_RESP_VALIDADO' });
        }
      }

      const downtimePorSetor: Record<string, number> = {};
      const segmentosPorSetor: Record<string, { inicio: string; fim: string; ms: number; ciclo?: number }[]> = {};
      for (const setor of setores) downtimePorSetor[setor] = 0;

      // Calcular atuação por setor dentro de cada ciclo, com fallback proporcional por contagem de tarefas se eventos forem insuficientes
      for (let ci = 0; ci < ciclos.length; ci++) {
        const ciclo = ciclos[ci];
        const cicloDur = msDiff(ciclo.inicio, ciclo.fim);
        const medidosPorSetor: Record<string, number> = {};
        const contagemPorSetor: Record<string, number> = {};
        const displayIntervalBySetor: Record<string, { inicio: Date; fim: Date }> = {};

      for (const setor of setores) {
          const tsSetor = tarefasAtivas.filter((t: any) => deriveSetor(t) === setor);
          contagemPorSetor[setor] = tsSetor.length;
          if (tsSetor.length === 0) continue;

          const inicioCandidates: Date[] = [];
          const fimCandidates: Date[] = [];
          for (const t of tsSetor) {
            if (t.dataCriacao) inicioCandidates.push(new Date(t.dataCriacao));
            for (const e of (t.eventosStatus || [])) {
              if (e.statusNovo === 'REPROVADO' && e.dataEvento) inicioCandidates.push(new Date(e.dataEvento));
              if ((e.statusNovo === 'CONCLUIDO' || e.statusNovo === 'CONCLUIDA') && e.dataEvento) fimCandidates.push(new Date(e.dataEvento));
            }
            if (t.dataConclusao) fimCandidates.push(new Date(t.dataConclusao));
          }

          const inicioSetorRaw = inicioCandidates.length ? new Date(Math.min(...inicioCandidates.map((d) => d.getTime()))) : ciclo.inicio;
          const fimSetorRaw = fimCandidates.length ? new Date(Math.max(...fimCandidates.map((d) => d.getTime()))) : ciclo.fim;
          const inicioSetor = new Date(Math.max(inicioSetorRaw.getTime(), ciclo.inicio.getTime()));
          const fimSetor = new Date(Math.min(fimSetorRaw.getTime(), ciclo.fim.getTime()));
          const ms = msDiff(inicioSetor, fimSetor);
          if (ms > 0) medidosPorSetor[setor] = (medidosPorSetor[setor] || 0) + ms;

          // Acumular intervalos de início/fim por setor ao longo dos ciclos (exibir início real se anterior ao ciclo)
          const displayInicio = inicioSetorRaw < ciclo.inicio ? inicioSetorRaw : inicioSetor;
          const displayFim = fimSetor;
          if (displayFim >= displayInicio) {
            displayIntervalBySetor[setor] = { inicio: displayInicio, fim: displayFim };
            const existente = intervalosPorSetor[setor];
            if (!existente) {
              intervalosPorSetor[setor] = { inicio: displayInicio.toISOString(), fim: displayFim.toISOString() };
            } else {
              const atualInicio = new Date(existente.inicio);
              const atualFim = new Date(existente.fim);
              const novoInicio = displayInicio < atualInicio ? displayInicio : atualInicio;
              const novoFim = displayFim > atualFim ? displayFim : atualFim;
              intervalosPorSetor[setor] = { inicio: novoInicio.toISOString(), fim: novoFim.toISOString() };
            }
          }
        }

        const somaMedida = Object.values(medidosPorSetor).reduce((a, b) => a + b, 0);
        const somaContagem = Object.values(contagemPorSetor).reduce((a, b) => a + b, 0);
        const eventosInsuficientes = somaMedida < cicloDur * 0.1; // menos de 10% do ciclo coberto por eventos

        for (const setor of setores) {
          const msFinal = eventosInsuficientes
            ? (somaContagem > 0 ? Math.round(cicloDur * (contagemPorSetor[setor] / somaContagem)) : 0)
            : (medidosPorSetor[setor] || 0);
          if (msFinal > 0) {
            downtimePorSetor[setor] = (downtimePorSetor[setor] || 0) + msFinal;
            if (!ciclosSetorDurMs[setor]) ciclosSetorDurMs[setor] = [];
            ciclosSetorDurMs[setor].push(msFinal);
            const interval = displayIntervalBySetor[setor];
            if (interval) {
              if (!segmentosPorSetor[setor]) segmentosPorSetor[setor] = [];
              segmentosPorSetor[setor].push({ inicio: interval.inicio.toISOString(), fim: interval.fim.toISOString(), ms: msFinal, ciclo: ci + 1 });
            }
          }
        }
      }

      const logisticaMs = responsabilidadeTimeline
        .filter((seg) => seg.responsavel === 'LOGISTICA')
        .reduce((acc, seg) => acc + (seg.ms || 0), 0);
      if (logisticaMs > 0) {
        downtimePorSetor['LOGISTICA'] = (downtimePorSetor['LOGISTICA'] || 0) + logisticaMs;
        const ar = agregadosSetorDuracoes.get('LOGISTICA') || [];
        ar.push(logisticaMs);
        agregadosSetorDuracoes.set('LOGISTICA', ar);

        const segsLog = responsabilidadeTimeline.filter((seg) => seg.responsavel === 'LOGISTICA');
        if (segsLog.length > 0) {
          const inicioLog = new Date(Math.min(...segsLog.map((s) => new Date(s.inicio).getTime())));
          const fimLog = new Date(Math.max(...segsLog.map((s) => new Date(s.fim).getTime())));
          intervalosPorSetor['LOGISTICA'] = { inicio: inicioLog.toISOString(), fim: fimLog.toISOString() };
          if (!segmentosPorSetor['LOGISTICA']) segmentosPorSetor['LOGISTICA'] = [];
          for (const seg of segsLog) {
            const cicloValue = (seg as any).ciclo ?? undefined;
            segmentosPorSetor['LOGISTICA'].push({ inicio: seg.inicio, fim: seg.fim, ms: seg.ms, ciclo: cicloValue });
          }
        }
      }

      // Montar tempos médios por setor (somente setores de atuação) e incluir logística
      const temposMediosPorSetor = Object.entries(temposConclusaoPorSetor).map(([setor, arr]) => ({ setor, tempoMedioMs: media(arr as number[]) }));
      const requiredSetores = ['RH', 'MEDICINA', 'TREINAMENTO'];
      const MIN_VALID_MS = 1 * 1000; // mínimo 1 segundo para considerar atuação válida
      const hasAnyValid = requiredSetores.some((set) => {
        const e = temposMediosPorSetor.find((x) => x.setor === set);
        return e && e.tempoMedioMs && e.tempoMedioMs >= MIN_VALID_MS;
      });
      const autoAprovado = (rf.tarefas || []).some((t: any) => {
        const desc = normUp(t.descricao);
        const hasDesc = desc.includes('APROVADAS AUTOMATICAMENTE') || desc.includes('APROVADO AUTOMATICAMENTE');
        const hasHist = (t.historico || []).some((h: any) => {
          const d = normUp(h.descricaoAcao);
          return d.includes('APROVADAS AUTOMATICAMENTE') || d.includes('APROVADO AUTOMATICAMENTE');
        });
        return hasDesc || hasHist;
      });

      const temposMediosPorSetorAug = [
        ...temposMediosPorSetor,
        { setor: 'LOGISTICA', tempoMedioMs: logisticaMs },
      ];

      let duracaoPorSetorMsArr = Object.entries(ciclosSetorDurMs).map(([setor, arr]) => ({ setor, ms: arr.reduce((a, b) => a + b, 0) }));
      const somaDuracaoCiclos = duracaoPorSetorMsArr.reduce((acc, it) => acc + (it.ms || 0), 0);
      const setorDurArr = Object.entries(setorDur).map(([setor, ms]) => ({ setor, ms }));
      if (somaDuracaoCiclos === 0) {
        // Fallback: sem ciclos válidos, usa soma direta dos segmentos por setor
        duracaoPorSetorMsArr = setorDurArr;
        // Também alimentar agregados para cálculo de médias por setor
        for (const { setor, ms } of setorDurArr) {
          if (ms > 0) {
            const ag = agregadosSetorDuracoes.get(setor) || [];
            ag.push(ms);
            agregadosSetorDuracoes.set(setor, ag);
          }
        }
      }
      if (logisticaMs > 0) {
        const hasLogDur = duracaoPorSetorMsArr.find((x) => x.setor === 'LOGISTICA');
        if (!hasLogDur) duracaoPorSetorMsArr.push({ setor: 'LOGISTICA', ms: logisticaMs });
      }
      const totalDuracaoMs = totalDurMs;

      if ((rf.tarefas || []).length > 0) {
        const reprovacoesPorSetor: Record<string, number> = {};
        for (const ev of reprovEvents) {
          const k = (ev.setor || '').toString();
          reprovacoesPorSetor[k] = (reprovacoesPorSetor[k] || 0) + 1;
        }
        porRemanejamento.push({
          remanejamentoId: rf.id,
          solicitacaoId: rf.solicitacaoId,
          funcionario: rf.funcionario,
          totalDurMs: totalDuracaoMs,
          temposMediosPorSetor: temposMediosPorSetorAug,
          periodosPorSetor: Object.entries(intervalosPorSetor).map(([setor, itv]) => ({ setor, inicio: itv.inicio, fim: itv.fim })),
          duracaoPorSetorMs: duracaoPorSetorMsArr,
          responsabilidadeTimeline,
          segmentosPorSetor,
          solicitacaoDataCriacao: rf.solicitacao?.dataSolicitacao ? new Date(rf.solicitacao.dataSolicitacao).toISOString() : null,
          remanejamentoDataConclusao: totalEnd ? new Date(totalEnd).toISOString() : null,
          teveReprovacao: reprovEvents.length > 0,
          reprovacoesPorSetor: Object.entries(reprovacoesPorSetor).map(([setor, count]) => ({ setor, count })),
          reprovEvents: reprovEvents.map((ev) => ({ setor: ev.setor, data: ev.data ? (ev.data as Date).toISOString() : null, source: ev.source, tarefaId: ev.tarefaId })),
        });
      }

      for (const [setor, ms] of Object.entries(downtimePorSetor)) {
        if (ms > 0) {
          const ar = agregadosSetorDuracoes.get(setor) || [];
          ar.push(ms);
          agregadosSetorDuracoes.set(setor, ar);
        }
      }

      const atuacaoPorcentPorSetor = Object.entries(downtimePorSetor).map(([setor, ms]) => ({ setor, porcentagem: totalDurMs > 0 ? (ms / totalDurMs) : 0 }));

      // Removido acúmulo por solicitação (não utilizado na visão por setor)

      if (logisticaMs > 0) {
        const setorAgg = porSetor.get('LOGISTICA') || { setor: 'LOGISTICA', qtdTarefas: 0, downtimeMs: 0, conclusoesMs: [] as number[], reprovações: 0 };
        setorAgg.downtimeMs += logisticaMs;
        setorAgg.conclusoesMs.push(logisticaMs);
        porSetor.set('LOGISTICA', setorAgg);
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Falha ao gerar relatório de SLA", details: message }, { status: 500 });
  }
}