"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Tabs, TabItem } from "flowbite-react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

type KPISet = {
  periodoDias: number;
  porSolicitacao: { solicitacaoId: number; remanejamentos: number; tarefas: number; downtimeMs: number; tempoMedioConclusaoMs: number; reprovações: number }[];
  porSetor: { setor: string; qtdTarefas: number; downtimeMs: number; tempoMedioConclusaoMs: number; reprovações: number }[];
  porRemanejamento: { remanejamentoId: string; solicitacaoId: number; funcionario: { id: number; nome: string; matricula: string }; totalDurMs: number; downtimeMs: number; atuacaoPorcentPorSetor: { setor: string; porcentagem: number }[]; temposMediosPorSetor: { setor: string; tempoMedioMs: number }[]; tarefasMaisReprovadas: { chave: string; count: number }[] }[];
  globais: { tarefasMaisReprovadas: { chave: string; count: number }[] };
};

function fmtMs(ms: number) {
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${d}d ${h}h ${m}m`;
}

export default function RelatorioSLA() {
  const [data, setData] = useState<KPISet | null>(null);
  const [dias, setDias] = useState<number>(90);
  const [setorFiltro, setSetorFiltro] = useState<string>("");
  const [solicitacaoFiltro, setSolicitacaoFiltro] = useState<string>("");
  const [funcionarioFiltro, setFuncionarioFiltro] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("dias", String(dias));
      const resp = await fetch(`/api/sla/relatorio?${params.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setData(json as KPISet);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const setoresDisponiveis = useMemo(() => {
    if (!data) return [] as string[];
    return data.porSetor.map((s) => s.setor);
  }, [data]);

  const porSetorFiltrado = useMemo(() => {
    if (!data) return [] as KPISet["porSetor"];
    const base = data.porSetor;
    if (!setorFiltro) return base;
    return base.filter((s) => s.setor.toLowerCase().includes(setorFiltro.toLowerCase()));
  }, [data, setorFiltro]);

  const porRemanejamentoFiltrado = useMemo(() => {
    if (!data) return [] as KPISet["porRemanejamento"];
    let base = data.porRemanejamento;
    if (setorFiltro) {
      base = base.filter((r) => r.atuacaoPorcentPorSetor.some((p) => p.setor.toLowerCase().includes(setorFiltro.toLowerCase())));
    }
    if (solicitacaoFiltro) {
      base = base.filter((r) => String(r.solicitacaoId).includes(solicitacaoFiltro));
    }
    if (funcionarioFiltro) {
      base = base.filter((r) => r.funcionario?.nome?.toLowerCase().includes(funcionarioFiltro.toLowerCase()));
    }
    return base;
  }, [data, setorFiltro, solicitacaoFiltro, funcionarioFiltro]);

  const chartSetorDowntime = useMemo(() => {
    const labels = porSetorFiltrado.map((s) => s.setor);
    const values = porSetorFiltrado.map((s) => Math.round(s.downtimeMs / (60 * 60 * 1000)));
    return {
      labels,
      datasets: [
        {
          label: "Downtime (h)",
          data: values,
          backgroundColor: "rgba(59,130,246,0.6)",
        },
      ],
    };
  }, [porSetorFiltrado]);

  const chartSetorTempoMedio = useMemo(() => {
    const labels = porSetorFiltrado.map((s) => s.setor);
    const values = porSetorFiltrado.map((s) => Math.round(s.tempoMedioConclusaoMs / (60 * 60 * 1000)));
    return {
      labels,
      datasets: [
        {
          label: "Tempo médio p/ concluir (h)",
          data: values,
          backgroundColor: "rgba(34,197,94,0.6)",
        },
      ],
    };
  }, [porSetorFiltrado]);

  const chartTopReprovadas = useMemo(() => {
    const labels = (data?.globais.tarefasMaisReprovadas || []).map((t) => t.chave);
    const values = (data?.globais.tarefasMaisReprovadas || []).map((t) => t.count);
    return {
      labels,
      datasets: [
        {
          label: "Reprovações",
          data: values,
          backgroundColor: "rgba(234,88,12,0.6)",
        },
      ],
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatório SLA</h1>
            <p className="text-gray-600">Visão por solicitação, por setor e por remanejamento</p>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm text-gray-600">Período (dias)</label>
              <input type="number" className="border rounded px-3 py-2 w-28" value={dias} onChange={(e) => setDias(parseInt(e.target.value || "90", 10))} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Setor</label>
              <input type="text" placeholder="Filtrar setor" className="border rounded px-3 py-2 w-44" value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Solicitação</label>
              <input type="text" placeholder="ID" className="border rounded px-3 py-2 w-36" value={solicitacaoFiltro} onChange={(e) => setSolicitacaoFiltro(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Funcionário</label>
              <input type="text" placeholder="Nome" className="border rounded px-3 py-2 w-56" value={funcionarioFiltro} onChange={(e) => setFuncionarioFiltro(e.target.value)} />
            </div>
            <button onClick={carregar} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Atualizar</button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div></div>
        )}
        {error && (
          <div className="text-center py-6 text-red-600">{error}</div>
        )}

        {data && (
          <Tabs aria-label="Visões SLA" variant="fullWidth">
            <TabItem title="Por Setor">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow p-4">
                  <h3 className="text-lg font-semibold mb-2">Downtime por setor (h)</h3>
                  <Bar data={chartSetorDowntime} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <h3 className="text-lg font-semibold mb-2">Tempo médio de conclusão por setor (h)</h3>
                  <Bar data={chartSetorTempoMedio} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
                </div>
              </div>
              <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2">Setor</th>
                      <th className="text-left px-4 py-2">Tarefas</th>
                      <th className="text-left px-4 py-2">Downtime</th>
                      <th className="text-left px-4 py-2">Tempo médio</th>
                      <th className="text-left px-4 py-2">Reprovações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porSetorFiltrado.map((s) => (
                      <tr key={s.setor} className="border-t">
                        <td className="px-4 py-2">{s.setor}</td>
                        <td className="px-4 py-2">{s.qtdTarefas}</td>
                        <td className="px-4 py-2">{fmtMs(s.downtimeMs)}</td>
                        <td className="px-4 py-2">{fmtMs(s.tempoMedioConclusaoMs)}</td>
                        <td className="px-4 py-2">{s.reprovações}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabItem>

            <TabItem title="Por Solicitação">
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2">Solicitação</th>
                      <th className="text-left px-4 py-2">Remanejamentos</th>
                      <th className="text-left px-4 py-2">Tarefas</th>
                      <th className="text-left px-4 py-2">Downtime</th>
                      <th className="text-left px-4 py-2">Tempo médio</th>
                      <th className="text-left px-4 py-2">Reprovações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porSolicitacao.map((s) => (
                      <tr key={s.solicitacaoId} className="border-t">
                        <td className="px-4 py-2">{s.solicitacaoId}</td>
                        <td className="px-4 py-2">{s.remanejamentos}</td>
                        <td className="px-4 py-2">{s.tarefas}</td>
                        <td className="px-4 py-2">{fmtMs(s.downtimeMs)}</td>
                        <td className="px-4 py-2">{fmtMs(s.tempoMedioConclusaoMs)}</td>
                        <td className="px-4 py-2">{s.reprovações}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabItem>

            <TabItem title="Por Remanejamento">
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2">Remanejamento</th>
                      <th className="text-left px-4 py-2">Solicitação</th>
                      <th className="text-left px-4 py-2">Funcionário</th>
                      <th className="text-left px-4 py-2">Duração</th>
                      <th className="text-left px-4 py-2">Downtime</th>
                      <th className="text-left px-4 py-2">Atuação Setores</th>
                      <th className="text-left px-4 py-2">Top Reprovadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porRemanejamentoFiltrado.map((r) => (
                      <tr key={r.remanejamentoId} className="border-t">
                        <td className="px-4 py-2">{r.remanejamentoId}</td>
                        <td className="px-4 py-2">{r.solicitacaoId}</td>
                        <td className="px-4 py-2">{r.funcionario?.nome} ({r.funcionario?.matricula})</td>
                        <td className="px-4 py-2">{fmtMs(r.totalDurMs)}</td>
                        <td className="px-4 py-2">{fmtMs(r.downtimeMs)}</td>
                        <td className="px-4 py-2">
                          {r.atuacaoPorcentPorSetor.map((p) => (
                            <div key={p.setor}>{p.setor}: {(p.porcentagem * 100).toFixed(1)}%</div>
                          ))}
                        </td>
                        <td className="px-4 py-2">
                          {r.tarefasMaisReprovadas.map((t) => (
                            <div key={t.chave}>{t.chave}: {t.count}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabItem>

            <TabItem title="Globais">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow p-4">
                  <h3 className="text-lg font-semibold mb-2">Top tarefas reprovadas</h3>
                  <Bar data={chartTopReprovadas} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                </div>
                <div className="bg-white rounded-xl shadow p-4">
                  <h3 className="text-lg font-semibold mb-2">Setores disponíveis</h3>
                  <div className="flex flex-wrap gap-2">
                    {setoresDisponiveis.map((s) => (
                      <span key={s} className="px-2 py-1 bg-gray-100 text-gray-700 rounded border">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </TabItem>
          </Tabs>
        )}
      </div>
    </div>
  );
}