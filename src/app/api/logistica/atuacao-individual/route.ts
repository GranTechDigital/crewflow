import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUS_PRESTSERV_VALIDOS = new Set([
  "PENDENTE",
  "CRIADO",
  "EM VALIDACAO",
  "EM ANALISE",
  "VALIDADO",
  "INVALIDADO",
  "REPROVADO",
  "REJEITADO",
  "CORRECAO",
  "PENDENTE DE DESLIGAMENTO",
]);

const STATUS_CONCLUSIVOS = new Set(["VALIDADO", "INVALIDADO", "REPROVADO", "REJEITADO"]);
const STATUS_PENDENTES_LOGISTICA = new Set([
  "PENDENTE",
  "CRIADO",
  "EM ANALISE",
  "EM VALIDACAO",
  "CORRECAO",
  "PENDENTE DE DESLIGAMENTO",
]);
const STATUS_DISPONIVEL_LOGISTICA = new Set([
  "PENDENTE",
  "CRIADO",
  "EM ANALISE",
  "EM VALIDACAO",
  "CORRECAO",
  "PENDENTE DE DESLIGAMENTO",
  "SUBMETER RASCUNHO",
]);

function normalizeText(value?: string | null) {
  return (value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isEquipeLogistica(value?: string | null) {
  return normalizeText(value).includes("LOGIST");
}

function percentile95(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length));
  return sorted[index];
}

function dayKeyUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function isBusinessDayUtc(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function countBusinessDaysUtc(start: Date, end: Date) {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cursor <= limit) {
    if (isBusinessDayUtc(cursor)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateRaw = searchParams.get("startDate");
    const endDateRaw = searchParams.get("endDate");
    const startDate = startDateRaw ? new Date(`${startDateRaw}T00:00:00.000Z`) : undefined;
    const endDate = endDateRaw ? new Date(`${endDateRaw}T23:59:59.999Z`) : undefined;

    const historicos = await prisma.historicoRemanejamento.findMany({
      where: {
        remanejamentoFuncionarioId: { not: null },
        usuarioResponsavelId: { not: null },
        ...(startDate || endDate
          ? {
              dataAcao: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      select: {
        dataAcao: true,
        campoAlterado: true,
        valorAnterior: true,
        valorNovo: true,
        descricaoAcao: true,
        remanejamentoFuncionarioId: true,
        usuarioResponsavelId: true,
        usuario: {
          select: {
            funcionario: { select: { nome: true, matricula: true } },
            equipe: { select: { nome: true } },
          },
        },
      },
      orderBy: { dataAcao: "asc" },
    });

    const records = historicos.filter((h) => {
      if (!h.dataAcao || !h.remanejamentoFuncionarioId || !h.usuarioResponsavelId) return false;
      if (!isEquipeLogistica(h.usuario?.equipe?.nome)) return false;
      const campo = normalizeText(h.campoAlterado);
      const novo = normalizeText(h.valorNovo);
      const desc = normalizeText(h.descricaoAcao);
      const isAuto = desc.includes("AUTOMAT") || desc.includes("SINCRONIZ");
      return campo === "STATUSPRESTSERV" && STATUS_PRESTSERV_VALIDOS.has(novo) && !isAuto;
    });

    const remIds = Array.from(
      new Set(records.map((r) => r.remanejamentoFuncionarioId).filter((id): id is string => !!id)),
    );

    const remanejamentos = remIds.length
      ? await prisma.remanejamentoFuncionario.findMany({
          where: { id: { in: remIds } },
          select: {
            id: true,
            statusPrestserv: true,
            updatedAt: true,
            solicitacao: {
              select: {
                tipo: true,
                contratoOrigem: { select: { numero: true } },
                contratoDestino: { select: { numero: true } },
              },
            },
          },
        })
      : [];

    const remById = new Map(remanejamentos.map((r) => [r.id, r]));
    const byUser = new Map<
      number,
      {
        usuarioId: number;
        usuario: string;
        matricula: string;
        actions: Date[];
        total: number;
        rems: Set<string>;
        conclusivos: number;
        mix: Record<string, number>;
        latestTouchedRems: Set<string>;
      }
    >();
    const respostaByUser = new Map<
      number,
      {
        usuarioId: number;
        usuario: string;
        matricula: string;
        temposHoras: number[];
      }
    >();
    const eventosPorRem = new Map<
      string,
      { data: Date; userId: number; usuario: string; matricula: string; statusNovo: string }[]
    >();
    const serieDiariaMap = new Map<string, number>();

    const latestActionByRem = new Map<string, { userId: number; date: Date }>();

    for (const r of records) {
      const userId = r.usuarioResponsavelId!;
      const usuario = r.usuario?.funcionario?.nome || `Usuário #${userId}`;
      const matricula = r.usuario?.funcionario?.matricula || "-";
      const remId = r.remanejamentoFuncionarioId!;
      const rem = remById.get(remId);
      const tipo = rem?.solicitacao?.tipo || "N/A";
      const statusNovo = normalizeText(r.valorNovo);

      const item =
        byUser.get(userId) ||
        {
          usuarioId: userId,
          usuario,
          matricula,
          actions: [],
          total: 0,
          rems: new Set<string>(),
          conclusivos: 0,
          mix: {},
          latestTouchedRems: new Set<string>(),
        };

      item.total += 1;
      item.actions.push(r.dataAcao!);
      item.rems.add(remId);
      item.mix[tipo] = (item.mix[tipo] || 0) + 1;
      if (STATUS_CONCLUSIVOS.has(statusNovo)) item.conclusivos += 1;
      byUser.set(userId, item);

      const day = dayKeyUtc(r.dataAcao!);
      serieDiariaMap.set(day, (serieDiariaMap.get(day) || 0) + 1);

      const latest = latestActionByRem.get(remId);
      if (!latest || r.dataAcao! > latest.date) {
        latestActionByRem.set(remId, { userId, date: r.dataAcao! });
      }

      const list = eventosPorRem.get(remId) || [];
      list.push({
        data: r.dataAcao!,
        userId,
        usuario,
        matricula,
        statusNovo: normalizeText(r.valorNovo),
      });
      eventosPorRem.set(remId, list);
    }

    for (const [remId, latest] of latestActionByRem.entries()) {
      const owner = byUser.get(latest.userId);
      if (owner) owner.latestTouchedRems.add(remId);
    }

    const teamAvgThroughput =
      byUser.size > 0
        ? Array.from(byUser.values()).reduce((acc, u) => acc + u.total, 0) / byUser.size
        : 0;

    for (const [, eventos] of eventosPorRem.entries()) {
      eventos.sort((a, b) => a.data.getTime() - b.data.getTime());
      for (let i = 1; i < eventos.length; i += 1) {
        const prev = eventos[i - 1];
        const cur = eventos[i];
        if (!STATUS_DISPONIVEL_LOGISTICA.has(prev.statusNovo)) continue;
        const tempoHoras = Math.max(0, (cur.data.getTime() - prev.data.getTime()) / 3600000);
        const item =
          respostaByUser.get(cur.userId) || {
            usuarioId: cur.userId,
            usuario: cur.usuario,
            matricula: cur.matricula,
            temposHoras: [],
          };
        item.temposHoras.push(tempoHoras);
        respostaByUser.set(cur.userId, item);
      }
    }

    const now = new Date();
    const minActionDate = records.length ? new Date(records[0].dataAcao!) : now;
    const maxActionDate = records.length ? new Date(records[records.length - 1].dataAcao!) : now;
    const periodStart = startDate || minActionDate;
    const periodEnd = endDate || maxActionDate;
    const totalBusinessDaysPeriod = Math.max(1, countBusinessDaysUtc(periodStart, periodEnd));
    const colaboradores = Array.from(byUser.values())
      .map((u) => {
        const sortedActions = [...u.actions].sort((a, b) => a.getTime() - b.getTime());
        const diffsMinutes: number[] = [];
        for (let i = 1; i < sortedActions.length; i += 1) {
          diffsMinutes.push((sortedActions[i].getTime() - sortedActions[i - 1].getTime()) / 60000);
        }
        const cadenciaMediaMin =
          diffsMinutes.length > 0
            ? diffsMinutes.reduce((acc, v) => acc + v, 0) / diffsMinutes.length
            : 0;

        const activeHours =
          sortedActions.length > 1
            ? Math.max(1 / 60, (sortedActions[sortedActions.length - 1].getTime() - sortedActions[0].getTime()) / 3600000)
            : 1 / 60;

        const produtividadeHoraAtiva = u.total / activeHours;
        const taxaConclusao = u.total > 0 ? (u.conclusivos / u.total) * 100 : 0;
        const toquesPorItem = u.rems.size > 0 ? u.total / u.rems.size : 0;

        const backlogRems = Array.from(u.latestTouchedRems).filter((remId) => {
          const rem = remById.get(remId);
          return STATUS_PENDENTES_LOGISTICA.has(normalizeText(rem?.statusPrestserv));
        });
        const backlogAgesHours = backlogRems
          .map((remId) => {
            const rem = remById.get(remId);
            if (!rem) return 0;
            return Math.max(0, (now.getTime() - rem.updatedAt.getTime()) / 3600000);
          })
          .filter((v) => v >= 0);

        const backlogPessoal = backlogRems.length;
        const agingMedioHoras =
          backlogAgesHours.length > 0
            ? backlogAgesHours.reduce((acc, v) => acc + v, 0) / backlogAgesHours.length
            : 0;
        const agingP95Horas = percentile95(backlogAgesHours);

        const businessDaysWithAction = new Set<string>();
        for (const dt of sortedActions) {
          if (isBusinessDayUtc(dt)) businessDaysWithAction.add(dayKeyUtc(dt));
        }
        const regularidadePct = (businessDaysWithAction.size / totalBusinessDaysPeriod) * 100;

        const eficienciaRelativa = teamAvgThroughput > 0 ? (u.total / teamAvgThroughput) * 100 : 0;

        return {
          usuarioId: u.usuarioId,
          usuario: u.usuario,
          matricula: u.matricula,
          throughputPeriodo: u.total,
          cadenciaMediaMin: Number(cadenciaMediaMin.toFixed(1)),
          produtividadeHoraAtiva: Number(produtividadeHoraAtiva.toFixed(2)),
          mixTrabalho: u.mix,
          taxaConclusaoLogisticaPct: Number(taxaConclusao.toFixed(1)),
          backlogPessoal,
          agingBacklogMedioHoras: Number(agingMedioHoras.toFixed(1)),
          agingBacklogP95Horas: Number(agingP95Horas.toFixed(1)),
          regularidadePct: Number(regularidadePct.toFixed(1)),
          eficienciaRelativaPct: Number(eficienciaRelativa.toFixed(1)),
          toquesPorItem: Number(toquesPorItem.toFixed(2)),
          itensDistintosAtuados: u.rems.size,
        };
      })
      .sort((a, b) => b.throughputPeriodo - a.throughputPeriodo);

    const slaRespostaHoras = 4;
    const tempoRespostaColaboradores = Array.from(respostaByUser.values())
      .map((u) => {
        const sorted = [...u.temposHoras].sort((a, b) => a - b);
        const avg = sorted.length ? sorted.reduce((acc, v) => acc + v, 0) / sorted.length : 0;
        const mediana = sorted.length
          ? sorted.length % 2
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : 0;
        const p95 = percentile95(sorted);
        const dentro = sorted.filter((v) => v <= slaRespostaHoras).length;
        const pctDentro = sorted.length ? (dentro / sorted.length) * 100 : 0;
        return {
          usuarioId: u.usuarioId,
          usuario: u.usuario,
          matricula: u.matricula,
          atendimentosConsiderados: sorted.length,
          tempoMedioHoras: Number(avg.toFixed(2)),
          medianaHoras: Number(mediana.toFixed(2)),
          p95Horas: Number(p95.toFixed(2)),
          slaHoras: slaRespostaHoras,
          percentualDentroSla: Number(pctDentro.toFixed(1)),
        };
      })
      .sort((a, b) => a.tempoMedioHoras - b.tempoMedioHoras);

    const totalResp = tempoRespostaColaboradores.reduce((acc, c) => acc + c.atendimentosConsiderados, 0);
    let totalDentroSla = 0;
    for (const user of respostaByUser.values()) {
      totalDentroSla += user.temposHoras.filter((v) => v <= slaRespostaHoras).length;
    }
    const tempoRespostaResumo = {
      slaHoras: slaRespostaHoras,
      atendimentosConsiderados: totalResp,
      percentualDentroSla: totalResp > 0 ? Number(((totalDentroSla / totalResp) * 100).toFixed(1)) : 0,
    };

    return NextResponse.json({
      periodo: {
        inicio: startDate?.toISOString() || null,
        fim: endDate?.toISOString() || null,
      },
      resumo: {
        totalColaboradores: colaboradores.length,
        throughputTime: colaboradores.reduce((acc, c) => acc + c.throughputPeriodo, 0),
        throughputMedio: Number(teamAvgThroughput.toFixed(1)),
      },
      tempoRespostaResumo,
      tempoRespostaColaboradores,
      serieDiaria: Array.from(serieDiariaMap.entries())
        .map(([data, total]) => ({ data, total }))
        .sort((a, b) => a.data.localeCompare(b.data)),
      colaboradores,
    });
  } catch (error) {
    console.error("Erro ao gerar indicadores de atuação individual:", error);
    return NextResponse.json(
      { error: "Erro ao gerar indicadores de atuação individual" },
      { status: 500 },
    );
  }
}
