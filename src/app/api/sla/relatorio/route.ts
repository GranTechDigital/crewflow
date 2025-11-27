import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      where: {
        ...(somenteConcluidos
          ? {
              OR: [
                { statusTarefas: { in: ["CONCLUIDO", "CONCLUIDA", "SOLICITAÇÃO CONCLUÍDA", "SOLICITAÇÃO CONCLUIDA"] } },
                { statusTarefas: { contains: "CONCLUID", mode: "insensitive" } },
                { statusPrestserv: { equals: "VALIDADO", mode: "insensitive" } },
              ],
            }
          : {
              OR: [
                { dataConcluido: { gte: inicioJanela } },
                { updatedAt: { gte: inicioJanela } },
              ],
            }),
      },
      include: {
        solicitacao: true,
        funcionario: { select: { id: true, nome: true, matricula: true } },
        tarefas: {
          include: {
            eventosStatus: { include: { equipe: true } },
            historico: { include: { equipe: true } },
          },
        },
      },
    });

    const porSetor = new Map<string, any>();
    const porRemanejamento: any[] = [];
    const agregadosSetorDuracoes: Map<string, number[]> = new Map();
    const reprovPorTipo: Record<string, number> = {};

    for (const rf of remanejamentos) {
      // Histórico de decisões da logística (Prestserv)
      const historicosPrestserv = await prisma.historicoRemanejamento.findMany({
        where: {
          remanejamentoFuncionarioId: rf.id,
          entidade: 'PRESTSERV',
          campoAlterado: 'statusPrestserv',
        },
        select: { valorNovo: true, dataAcao: true },
        orderBy: { dataAcao: 'asc' },
      });
      const normUp = (val: string | null | undefined) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
      const evtValidado = historicosPrestserv
        .filter((h) => normUp(h.valorNovo).includes('VALIDADO') && !!h.dataAcao)
        .reduce<Date | null>((acc, h) => {
          const d = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!d) return acc;
          return !acc || d > acc ? d : acc;
        }, null);
      const totalEnd = (rf.dataConcluido
        || evtValidado
        || (rf.dataResposta ? new Date(rf.dataResposta) : null)
        || (rf.dataSubmetido ? new Date(rf.dataSubmetido) : null)
        || rf.updatedAt
        || agora) as Date;
      const totalStart = rf.solicitacao?.dataSolicitacao || rf.createdAt;
      const totalDurMs = msDiff(totalStart, totalEnd);

      const setorDur: Record<string, number> = {};
      const tarefaReprovCount: Record<string, number> = {};
      const temposConclusaoPorSetor: Record<string, number[]> = {};
      let downtimeMsSum = 0;

      const toSetor = (val: string | null | undefined) => {
        const sRaw = (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
        if (!sRaw) return '';
        if (sRaw.includes('TREIN')) return 'TREINAMENTO';
        if (sRaw.includes('CAPACIT')) return 'TREINAMENTO';
        if (sRaw.includes('MEDIC')) return 'MEDICINA';
        if (sRaw.includes('RECURSOS') || sRaw.includes('HUMANOS') || sRaw.includes(' RH') || sRaw === 'RH') return 'RH';
        if (sRaw.includes('RH')) return 'RH';
        return sRaw;
      };
      const deriveSetor = (t: any) => {
        const evNome = (t.eventosStatus || []).map((e: any) => e.equipe?.nome).filter(Boolean)[0] as string | undefined;
        const evSet = toSetor(evNome);
        if (evSet === 'RH' || evSet === 'MEDICINA' || evSet === 'TREINAMENTO') return evSet;
        const histNome = (t.historico || []).map((h: any) => h.equipe?.nome).filter(Boolean)[0] as string | undefined;
        const histSet = toSetor(histNome);
        if (histSet === 'RH' || histSet === 'MEDICINA' || histSet === 'TREINAMENTO') return histSet;
        const r = toSetor(t.responsavel);
        if (r === 'RH' || r === 'MEDICINA' || r === 'TREINAMENTO') return r;
        // Fallback adicional: inferir por tipo/descrição da tarefa
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

        const reprovs = (t.eventosStatus || []).filter((e: any) => e.statusNovo === "REPROVADO").length;
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
      const setores = Array.from(new Set(tarefasAtivas.map((t: any) => deriveSetor(t))));

      const aprovacaoMs = rf.dataSubmetido && rf.dataResposta ? msDiff(new Date(rf.dataSubmetido), new Date(rf.dataResposta)) : 0;
      const todasTarefasConcluidas = tarefasAtivas.length > 0 && tarefasAtivas.every((t: any) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA");
      const fimTarefas = todasTarefasConcluidas
        ? tarefasAtivas.reduce<Date | null>((acc, t: any) => {
            const d = t.dataConclusao ? new Date(t.dataConclusao) : null;
            if (!d) return acc;
            return !acc || d > acc ? d : acc;
          }, null)
        : null;
      const posConclusaoAteValidadoMs = fimTarefas ? msDiff(fimTarefas, totalEnd) : 0;
      

      // Adiar push para após cálculo de logística

      // Construção da timeline de responsabilidade (Logística ↔ Setores)
      const responsabilidadeTimeline: { responsavel: string; inicio: string; fim: string; ms: number }[] = [];
      const ciclos: { inicio: Date; fim: Date }[] = [];
      const intervalosPorSetor: Record<string, { inicio: string; fim: string }> = {};
      const ciclosSetorDurMs: Record<string, number[]> = {};

      // Segmento 0: Logística da criação da solicitação até a aprovação inicial (dataAprovado)
      const tCriacaoSolic = rf.solicitacao?.dataSolicitacao ? new Date(rf.solicitacao.dataSolicitacao) : null;
      const tAprovado = rf.dataAprovado ? new Date(rf.dataAprovado) : null;
      if (tCriacaoSolic && tAprovado && tAprovado > tCriacaoSolic) {
        const ms = msDiff(tCriacaoSolic, tAprovado);
        responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: tCriacaoSolic.toISOString(), fim: tAprovado.toISOString(), ms });
      }

      // Função utilitária: encontrar momento em que todas as tarefas (não canceladas) estão concluídas após uma data base
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

      // Função utilitária: próxima decisão da logística após um instante
      const nextPrestservDecisionAfter = (after: Date | null): { tipo: string; quando: Date } | null => {
        if (!after) return null;
        const decis = historicosPrestserv.find((h) => {
          const ts = h.dataAcao ? new Date(h.dataAcao) : null;
          if (!ts) return false;
          const v = (h.valorNovo || '').toUpperCase();
          return ts > after && (v === 'VALIDADO' || v === 'INVALIDADO' || v === 'REJEITADO');
        });
        if (!decis) {
          // Fallback: se houver dataConcluido e for após, usar
          if (rf.dataConcluido && new Date(rf.dataConcluido) > after) {
            return { tipo: 'VALIDADO', quando: new Date(rf.dataConcluido) };
          }
          // Ou dataResposta (aprovação/resposta) como marco de decisão
          if (rf.dataResposta && new Date(rf.dataResposta) > after) {
            return { tipo: 'RESPOSTA', quando: new Date(rf.dataResposta) };
          }
          return null;
        }
        return { tipo: (decis.valorNovo || '').toUpperCase(), quando: new Date(decis.dataAcao!) };
      };

      // Ciclos: após aprovação inicial, setores trabalham até concluir; então logística decide; se INVALIDADO/REJEITADO, setores retomam, etc.
      let cicloStart = tAprovado || tCriacaoSolic;
      const maxIter = 10; // segurança para evitar loops
      for (let i = 0; i < maxIter; i++) {
        const tConclTudo = allTasksConcludedAfter(cicloStart || null);
        if (!tConclTudo) break; // ainda não concluiu tudo
        // Registrar ciclo de setores: do início do ciclo até todas as tarefas concluírem
        ciclos.push({ inicio: cicloStart as Date, fim: tConclTudo as Date });
        // Logística assume de tConclTudo até próxima decisão
        const decisao = nextPrestservDecisionAfter(tConclTudo);
        if (decisao) {
          const ms = msDiff(tConclTudo, decisao.quando);
          if (ms > 0) responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: tConclTudo.toISOString(), fim: decisao.quando.toISOString(), ms });
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
            if (ms > 0) responsabilidadeTimeline.push({ responsavel: 'LOGISTICA', inicio: (tConclTudo as Date).toISOString(), fim: new Date(rf.dataConcluido).toISOString(), ms });
          }
          break;
        }
      }

      const downtimePorSetor: Record<string, number> = {};
      for (const setor of setores) downtimePorSetor[setor] = 0;

      // Calcular atuação por setor dentro de cada ciclo, com fallback proporcional por contagem de tarefas se eventos forem insuficientes
      for (const ciclo of ciclos) {
        const cicloDur = msDiff(ciclo.inicio, ciclo.fim);
        const medidosPorSetor: Record<string, number> = {};
        const contagemPorSetor: Record<string, number> = {};

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

          // Acumular intervalos de início/fim por setor ao longo dos ciclos
          const existente = intervalosPorSetor[setor];
          if (!existente) {
            intervalosPorSetor[setor] = { inicio: inicioSetor.toISOString(), fim: fimSetor.toISOString() };
          } else {
            const atualInicio = new Date(existente.inicio);
            const atualFim = new Date(existente.fim);
            const novoInicio = inicioSetor < atualInicio ? inicioSetor : atualInicio;
            const novoFim = fimSetor > atualFim ? fimSetor : atualFim;
            intervalosPorSetor[setor] = { inicio: novoInicio.toISOString(), fim: novoFim.toISOString() };
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

        // Determinar início e fim agregados da logística com base na timeline
        const segsLog = responsabilidadeTimeline.filter((seg) => seg.responsavel === 'LOGISTICA');
        if (segsLog.length > 0) {
          const inicioLog = new Date(Math.min(...segsLog.map((s) => new Date(s.inicio).getTime())));
          const fimLog = new Date(Math.max(...segsLog.map((s) => new Date(s.fim).getTime())));
          intervalosPorSetor['LOGISTICA'] = { inicio: inicioLog.toISOString(), fim: fimLog.toISOString() };
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
      if (hasAnyValid && !autoAprovado) {
        porRemanejamento.push({
          remanejamentoId: rf.id,
          solicitacaoId: rf.solicitacaoId,
          funcionario: rf.funcionario,
          totalDurMs: totalDurMs,
          temposMediosPorSetor: temposMediosPorSetorAug,
          periodosPorSetor: Object.entries(intervalosPorSetor).map(([setor, itv]) => ({ setor, inicio: itv.inicio, fim: itv.fim })),
          duracaoPorSetorMs: duracaoPorSetorMsArr,
          solicitacaoDataCriacao: rf.solicitacao?.dataSolicitacao ? new Date(rf.solicitacao.dataSolicitacao).toISOString() : null,
          remanejamentoDataConclusao: totalEnd ? new Date(totalEnd).toISOString() : null,
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
      reprovações: s.reprovações,
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