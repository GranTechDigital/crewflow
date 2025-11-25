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
    const agora = new Date();
    const inicioJanela = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      where: {
        OR: [
          { dataConcluido: { gte: inicioJanela } },
          { updatedAt: { gte: inicioJanela } },
        ],
      },
      include: {
        solicitacao: true,
        funcionario: { select: { id: true, nome: true, matricula: true } },
        tarefas: { include: { eventosStatus: true } },
      },
    });

    const porSolicitacao = new Map<number, any>();
    const porSetor = new Map<string, any>();
    const porRemanejamento: any[] = [];

    const tarefasMaisReprovadasGlobal = new Map<string, number>();

    for (const rf of remanejamentos) {
      const totalEnd = rf.dataConcluido || agora;
      const totalStart = rf.dataRascunhoCriado || rf.createdAt;
      const totalDurMs = msDiff(totalStart, totalEnd);

      const setorDur: Record<string, number> = {};
      const tarefaReprovCount: Record<string, number> = {};
      const temposConclusaoPorSetor: Record<string, number[]> = {};
      let downtimeMsSum = 0;

      for (const t of rf.tarefas) {
        const segs = segmentosTarefa(t, t.eventosStatus || [], totalStart, totalEnd);
        downtimeMsSum += somar(segs, "PENDENTE");

        const setor = String(t.responsavel || "DESCONHECIDO");
        setorDur[setor] = (setorDur[setor] || 0) + segs.reduce((acc, s) => acc + s.ms, 0);

        const conclEvt = (t.eventosStatus || []).find((e: any) => e.statusNovo === "CONCLUIDO");
        if (conclEvt) {
          const durConclusao = msDiff(totalStart, conclEvt.dataEvento || totalEnd);
          if (!temposConclusaoPorSetor[setor]) temposConclusaoPorSetor[setor] = [];
          temposConclusaoPorSetor[setor].push(durConclusao);
        }

        const reprovs = (t.eventosStatus || []).filter((e: any) => e.statusNovo === "REPROVADO").length;
        if (reprovs > 0) {
          const key = `${setor}|${t.tipo}`;
          tarefaReprovCount[key] = (tarefaReprovCount[key] || 0) + reprovs;
          tarefasMaisReprovadasGlobal.set(key, (tarefasMaisReprovadasGlobal.get(key) || 0) + reprovs);
        }

        const setorAgg = porSetor.get(setor) || { setor, qtdTarefas: 0, downtimeMs: 0, conclusoesMs: [] as number[], reprovações: 0 };
        setorAgg.qtdTarefas += 1;
        setorAgg.downtimeMs += somar(segs, "PENDENTE");
        if (conclEvt) setorAgg.conclusoesMs.push(msDiff(totalStart, conclEvt.dataEvento || totalEnd));
        setorAgg.reprovações += reprovs;
        porSetor.set(setor, setorAgg);
      }

      const atuacaoPorcentPorSetor = Object.entries(setorDur).map(([setor, ms]) => ({ setor, porcentagem: totalDurMs > 0 ? (ms / totalDurMs) : 0 }));
      const temposMediosPorSetor = Object.entries(temposConclusaoPorSetor).map(([setor, arr]) => ({ setor, tempoMedioMs: media(arr as number[]) }));

      const topReprovadas = Object.entries(tarefaReprovCount)
        .map(([key, count]) => ({ chave: key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      porRemanejamento.push({
        remanejamentoId: rf.id,
        solicitacaoId: rf.solicitacaoId,
        funcionario: rf.funcionario,
        totalDurMs,
        downtimeMs: downtimeMsSum,
        atuacaoPorcentPorSetor,
        temposMediosPorSetor,
        tarefasMaisReprovadas: topReprovadas,
      });

      const solKey = rf.solicitacaoId;
      const solAgg = porSolicitacao.get(solKey) || { solicitacaoId: solKey, remanejamentos: 0, tarefas: 0, downtimeMs: 0, conclusoesMs: [] as number[], reprovações: 0 };
      solAgg.remanejamentos += 1;
      solAgg.tarefas += rf.tarefas.length;
      solAgg.downtimeMs += downtimeMsSum;
      for (const t of rf.tarefas) {
        const conclEvt = (t.eventosStatus || []).find((e: any) => e.statusNovo === "CONCLUIDO");
        if (conclEvt) solAgg.conclusoesMs.push(msDiff(totalStart, conclEvt.dataEvento || totalEnd));
        solAgg.reprovações += (t.eventosStatus || []).filter((e: any) => e.statusNovo === "REPROVADO").length;
      }
      porSolicitacao.set(solKey, solAgg);
    }

    const porSolicitacaoArr = Array.from(porSolicitacao.values()).map((v) => ({
      solicitacaoId: v.solicitacaoId,
      remanejamentos: v.remanejamentos,
      tarefas: v.tarefas,
      downtimeMs: v.downtimeMs,
      tempoMedioConclusaoMs: media(v.conclusoesMs),
      reprovações: v.reprovações,
    }));

    const porSetorArr = Array.from(porSetor.values()).map((s) => ({
      setor: s.setor,
      qtdTarefas: s.qtdTarefas,
      downtimeMs: s.downtimeMs,
      tempoMedioConclusaoMs: media(s.conclusoesMs),
      reprovações: s.reprovações,
    }));

    const topGlobal = Array.from(tarefasMaisReprovadasGlobal.entries())
      .map(([chave, count]) => ({ chave, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      periodoDias: dias,
      porSolicitacao: porSolicitacaoArr,
      porSetor: porSetorArr,
      porRemanejamento,
      globais: {
        tarefasMaisReprovadas: topGlobal,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Falha ao gerar relatório de SLA", details: message }, { status: 500 });
  }
}