import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  criarSnapshotRelatorioGeral,
  formatDatePtBr,
  RelatorioGeralResultado,
  RelatorioGeralSnapshot,
  SETORES_RELATORIO,
  SetorRelatorio,
} from "@/lib/relatorios/geral-pendencias";

const RELATORIO_GERAL_SNAPSHOT_TIPO = "RELATORIO_GERAL_PENDENCIAS";

const SETOR_LABELS: Record<SetorRelatorio, string> = {
  LOGISTICA: "Logística",
  MEDICINA: "Medicina",
  TREINAMENTO: "Treinamento",
  RH: "RH",
};

const SETOR_COLORS: Record<SetorRelatorio, string> = {
  LOGISTICA: "#1f2937",
  MEDICINA: "#047857",
  TREINAMENTO: "#b45309",
  RH: "#2563eb",
};

export async function readPreviousGeneralReportSnapshot() {
  try {
    const snapshot = await prisma.relatorioSnapshot.findFirst({
      where: { tipo: RELATORIO_GERAL_SNAPSHOT_TIPO },
      orderBy: { dataReferencia: "desc" },
      select: {
        dataReferencia: true,
        dataCorte: true,
        dataFim: true,
        resumo: true,
      },
    });

    if (!snapshot) return null;

    return {
      generatedAt: snapshot.dataReferencia.toISOString(),
      dataCorte: snapshot.dataCorte.toISOString(),
      dataFim: snapshot.dataFim?.toISOString() || null,
      resumo: snapshot.resumo as RelatorioGeralSnapshot["resumo"],
    };
  } catch {
    return null;
  }
}

export async function readGeneralReportSnapshotByDate(date: Date) {
  const localDay = date.toISOString().slice(0, 10);
  const start = new Date(`${localDay}T03:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const snapshot = await prisma.relatorioSnapshot.findFirst({
    where: {
      tipo: RELATORIO_GERAL_SNAPSHOT_TIPO,
      dataReferencia: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { dataReferencia: "desc" },
    select: {
      id: true,
      dataReferencia: true,
      dataCorte: true,
      dataFim: true,
      resumo: true,
      createdAt: true,
    },
  });

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    generatedAt: snapshot.dataReferencia.toISOString(),
    dataCorte: snapshot.dataCorte.toISOString(),
    dataFim: snapshot.dataFim?.toISOString() || null,
    resumo: snapshot.resumo as RelatorioGeralSnapshot["resumo"],
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export async function listGeneralReportSnapshots({
  limit = 30,
  from,
  to,
}: {
  limit?: number;
  from?: Date | null;
  to?: Date | null;
} = {}) {
  const snapshots = await prisma.relatorioSnapshot.findMany({
    where: {
      tipo: RELATORIO_GERAL_SNAPSHOT_TIPO,
      ...(from || to
        ? {
            dataReferencia: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { dataReferencia: "desc" },
    take: Math.min(Math.max(limit, 1), 365),
    select: {
      id: true,
      dataReferencia: true,
      dataCorte: true,
      dataFim: true,
      resumo: true,
      filtros: true,
      createdAt: true,
    },
  });

  return snapshots.map((snapshot) => ({
    id: snapshot.id,
    generatedAt: snapshot.dataReferencia.toISOString(),
    dataCorte: snapshot.dataCorte.toISOString(),
    dataFim: snapshot.dataFim?.toISOString() || null,
    resumo: snapshot.resumo as RelatorioGeralSnapshot["resumo"],
    filtros: snapshot.filtros,
    createdAt: snapshot.createdAt.toISOString(),
  }));
}

export async function saveGeneralReportSnapshot(relatorio: RelatorioGeralResultado) {
  const snapshot = criarSnapshotRelatorioGeral(relatorio);

  await prisma.relatorioSnapshot.create({
    data: {
      tipo: RELATORIO_GERAL_SNAPSHOT_TIPO,
      dataReferencia: new Date(snapshot.generatedAt),
      dataCorte: new Date(snapshot.dataCorte),
      dataFim: snapshot.dataFim ? new Date(snapshot.dataFim) : null,
      resumo: snapshot.resumo as unknown as Prisma.InputJsonValue,
      filtros: {
        incluirCancelados: false,
        dataCorte: snapshot.dataCorte,
        dataFim: snapshot.dataFim,
      },
    },
  });
}

function delta(current: number, previous?: number) {
  if (previous === undefined) return null;
  return current - previous;
}

function formatDelta(value: number | null) {
  if (value === null) return "sem histórico";
  if (value === 0) return "sem alteração";
  return `${value > 0 ? "+" : ""}${value}`;
}

function buildMetricCard(label: string, value: number, deltaValue: number | null, color: string) {
  return `
    <td style="width:33.33%;padding:8px;">
      <div style="border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;padding:16px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;">${label}</div>
        <div style="margin-top:8px;font-size:30px;line-height:1;font-weight:800;color:${color};">${value}</div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">${formatDelta(deltaValue)} vs. envio anterior</div>
      </div>
    </td>`;
}

export function buildGeneralReportEmailHtml({
  relatorio,
  previous,
}: {
  relatorio: RelatorioGeralResultado;
  previous: RelatorioGeralSnapshot | null;
}) {
  const totalPendencias = SETORES_RELATORIO.reduce((sum, setor) => sum + relatorio.resumo.pendencias[setor], 0);
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  const distributionSegments = SETORES_RELATORIO.map((setor) => {
    const value = relatorio.resumo.pendencias[setor];
    if (value <= 0 || totalPendencias <= 0) return "";
    const percent = Math.max(1, Math.round((value / totalPendencias) * 100));
    return `<td width="${percent}%" style="height:14px;background:${SETOR_COLORS[setor]};font-size:0;line-height:0;">&nbsp;</td>`;
  }).join("");

  const distributionLegend = SETORES_RELATORIO.map((setor) => {
    const value = relatorio.resumo.pendencias[setor];
    const percent = totalPendencias > 0 ? Math.round((value / totalPendencias) * 100) : 0;
    return `
      <tr>
        <td style="padding:6px 0;color:#475569;font-size:13px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${SETOR_COLORS[setor]};margin-right:8px;"></span>
          ${SETOR_LABELS[setor]}
        </td>
        <td style="padding:6px 0;text-align:right;font-size:13px;font-weight:700;color:#111827;">${value}</td>
        <td style="padding:6px 0;text-align:right;font-size:13px;color:#64748b;">${percent}%</td>
      </tr>`;
  }).join("");

  const evolutionRows = SETORES_RELATORIO.map((setor) => {
    const value = relatorio.resumo.pendencias[setor];
    const previousValue = previous?.resumo.pendencias[setor];
    const setorDelta = delta(value, previousValue);
    const deltaColor = setorDelta === null || setorDelta === 0 ? "#64748b" : setorDelta > 0 ? "#b45309" : "#047857";
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${SETOR_COLORS[setor]};margin-right:8px;"></span>
          <strong>${SETOR_LABELS[setor]}</strong>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:${deltaColor};">${formatDelta(setorDelta)}</td>
      </tr>`;
  }).join("");

  return `<!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="max-width:760px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="background:#111827;padding:24px 28px;color:#ffffff;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1;">CrewControl</div>
                  <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">Relatório Geral de Pendências</h1>
                  <p style="margin:8px 0 0;color:#cbd5e1;font-size:13px;">Solicitações desde ${formatDatePtBr(relatorio.dataCorte)}. Cancelados desconsiderados. Gerado em ${generatedAt}.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 20px 8px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      ${buildMetricCard("Total de movimentos", relatorio.resumo.total, delta(relatorio.resumo.total, previous?.resumo.total), "#111827")}
                      ${buildMetricCard("Movimentos pendentes", relatorio.resumo.emAberto, delta(relatorio.resumo.emAberto, previous?.resumo.emAberto), "#b45309")}
                      ${buildMetricCard("Movimentos concluídos", relatorio.resumo.concluidos, delta(relatorio.resumo.concluidos, previous?.resumo.concluidos), "#047857")}
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 28px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td valign="top" style="width:320px;padding-right:22px;">
                        <div style="border:1px solid #e5e7eb;border-radius:16px;background:#f8fafc;padding:18px;">
                          <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;">Distribuição</div>
                          <div style="margin-top:8px;font-size:36px;line-height:1;font-weight:800;color:#111827;">${totalPendencias}</div>
                          <div style="margin-top:5px;font-size:13px;color:#64748b;">tarefas pendentes por setor</div>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-collapse:collapse;border-radius:999px;overflow:hidden;background:#e5e7eb;">
                            <tr>${distributionSegments || '<td style="height:14px;background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td>'}</tr>
                          </table>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border-collapse:collapse;">
                            ${distributionLegend}
                          </table>
                        </div>
                      </td>
                      <td valign="top">
                        <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Evolução por setor</h2>
                        <p style="margin:0 0 12px;font-size:13px;line-height:1.45;color:#64748b;">Variação das tarefas pendentes em relação ao envio anterior.</p>
                        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-size:13px;">
                          <thead>
                            <tr style="background:#f8fafc;color:#475569;">
                              <th align="left" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">Setor</th>
                              <th align="right" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">Mudança</th>
                            </tr>
                          </thead>
                          <tbody>${evolutionRows}</tbody>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 26px;">
                  <div style="border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;font-size:13px;line-height:1.55;color:#475569;">
                    Os totais principais representam movimentos. A distribuição por setor representa tarefas pendentes, pois um mesmo movimento pode ter atuação de mais de um setor.
                    O arquivo Excel em anexo contém a base analítica completa para conferência e tratamento operacional.
                    Para receber uma atualização em tempo real fora da programação semanal, responda este e-mail apenas com a palavra <strong>relatório</strong>.
                    ${previous ? `Comparação realizada com o envio de ${formatDatePtBr(previous.generatedAt)}.` : "Este é o primeiro envio com histórico disponível para comparação."}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export function buildGeneralReportEmailText(relatorio: RelatorioGeralResultado, previous: RelatorioGeralSnapshot | null) {
  const linhas = [
    "Relatório Geral de Pendências",
    `Solicitações desde ${formatDatePtBr(relatorio.dataCorte)}. Cancelados desconsiderados.`,
    `Total de movimentos: ${relatorio.resumo.total} (${formatDelta(delta(relatorio.resumo.total, previous?.resumo.total))})`,
    `Movimentos pendentes: ${relatorio.resumo.emAberto} (${formatDelta(delta(relatorio.resumo.emAberto, previous?.resumo.emAberto))})`,
    `Movimentos concluídos: ${relatorio.resumo.concluidos} (${formatDelta(delta(relatorio.resumo.concluidos, previous?.resumo.concluidos))})`,
    "",
    "Tarefas pendentes por setor:",
    ...SETORES_RELATORIO.map((setor) => {
      const value = relatorio.resumo.pendencias[setor];
      return `${SETOR_LABELS[setor]}: ${value} (${formatDelta(delta(value, previous?.resumo.pendencias[setor]))})`;
    }),
    "",
    "Para receber uma atualização em tempo real fora da programação semanal, responda este e-mail apenas com a palavra: relatório",
  ];

  return linhas.join("\n");
}

export function buildGeneralReportSnapshotEmailHtml({
  snapshot,
  requestedDate,
}: {
  snapshot: RelatorioGeralSnapshot;
  requestedDate: string;
}) {
  const totalPendencias = SETORES_RELATORIO.reduce((sum, setor) => sum + snapshot.resumo.pendencias[setor], 0);
  const distributionRows = SETORES_RELATORIO.map((setor) => {
    const value = snapshot.resumo.pendencias[setor];
    const percent = totalPendencias > 0 ? Math.round((value / totalPendencias) * 100) : 0;
    return `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${SETOR_COLORS[setor]};margin-right:8px;"></span>
          <strong>${SETOR_LABELS[setor]}</strong>
        </td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${value}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#64748b;">${percent}%</td>
      </tr>`;
  }).join("");

  return `<!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="background:#111827;padding:24px 28px;color:#ffffff;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1;">CrewControl</div>
                  <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">Snapshot do Relatório Geral</h1>
                  <p style="margin:8px 0 0;color:#cbd5e1;font-size:13px;">Snapshot solicitado para ${requestedDate}. Gerado originalmente em ${formatDatePtBr(snapshot.generatedAt)}.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      ${buildMetricCard("Total de movimentos", snapshot.resumo.total, null, "#111827")}
                      ${buildMetricCard("Movimentos pendentes", snapshot.resumo.emAberto, null, "#b45309")}
                      ${buildMetricCard("Movimentos concluídos", snapshot.resumo.concluidos, null, "#047857")}
                    </tr>
                  </table>
                  <h2 style="margin:18px 0 10px;font-size:16px;color:#111827;">Tarefas pendentes por setor</h2>
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-size:13px;">
                    <thead>
                      <tr style="background:#f8fafc;color:#475569;">
                        <th align="left" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">Setor</th>
                        <th align="right" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">Qtd.</th>
                        <th align="right" style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">%</th>
                      </tr>
                    </thead>
                    <tbody>${distributionRows}</tbody>
                  </table>
                  <div style="margin-top:18px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;font-size:13px;line-height:1.55;color:#475569;">
                    Este e-mail usa o snapshot já gravado para a data solicitada. Para receber o relatório completo atualizado do dia atual, responda com <strong>relatório hoje</strong>.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

export function buildGeneralReportSnapshotEmailText(snapshot: RelatorioGeralSnapshot, requestedDate: string) {
  return [
    `Snapshot do Relatório Geral - ${requestedDate}`,
    `Snapshot gerado originalmente em ${formatDatePtBr(snapshot.generatedAt)}.`,
    `Total de movimentos: ${snapshot.resumo.total}`,
    `Movimentos pendentes: ${snapshot.resumo.emAberto}`,
    `Movimentos concluídos: ${snapshot.resumo.concluidos}`,
    "",
    "Tarefas pendentes por setor:",
    ...SETORES_RELATORIO.map((setor) => `${SETOR_LABELS[setor]}: ${snapshot.resumo.pendencias[setor]}`),
  ].join("\n");
}

export function buildReportRequestExplanationHtml(message: string) {
  return `<!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:18px;border:1px solid #e2e8f0;">
              <tr>
                <td style="padding:24px 28px;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">CrewControl</div>
                  <h1 style="margin:8px 0 10px;font-size:22px;line-height:1.25;color:#111827;">Não consegui gerar o relatório solicitado</h1>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">${message}</p>
                  <div style="margin-top:16px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;font-size:13px;line-height:1.55;color:#475569;">
                    Exemplos válidos: <strong>relatório hoje</strong>, <strong>relatório ontem</strong> ou <strong>relatório 18/06/2026</strong>.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}
