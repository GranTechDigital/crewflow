"use client";

import React, { useState, useEffect } from "react";
import {
  SolicitacaoRemanejamento,
  StatusRemanejamento,
  StatusTarefas,
  StatusPrestserv,
} from "@/types/remanejamento-funcionario";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/Toast";

interface FiltrosRemanejamento {
  status?: StatusRemanejamento;
  statusTarefas?: StatusTarefas;
  statusPrestserv?: StatusPrestserv;
}

export default function TabelaRemanejamentos() {
  const [remanejamentos, setRemanejamentos] = useState<
    SolicitacaoRemanejamento[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosRemanejamento>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    fetchRemanejamentos();
  }, [filtros]);

  const fetchRemanejamentos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filtros.status) params.append("status", filtros.status);
      if (filtros.statusTarefas)
        params.append("statusTarefas", filtros.statusTarefas);
      if (filtros.statusPrestserv)
        params.append("statusPrestserv", filtros.statusPrestserv);

      // Definir filtrarProcesso como false para obter todos os remanejamentos
      params.append("filtrarProcesso", "false");

      const response = await fetch(
        `/api/logistica/remanejamentos?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar remanejamentos");
      }

      const data = await response.json();
      setRemanejamentos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      "APROVAR SOLICITAÇÃO": "bg-yellow-100 text-yellow-800",
      "ATENDER TAREFAS": "bg-blue-100 text-blue-800",
      "REPROVAR TAREFAS": "bg-blue-100 text-blue-800",
      "SOLICITAÇÃO CONCLUÍDA": "bg-green-100 text-green-800",
      "SOLICITAÇÃO REJEITADA": "bg-red-100 text-red-800",
      CANCELADO: "bg-red-100 text-red-800",
      "EM VALIDAÇÃO": "bg-blue-100 text-blue-800",
      VALIDADO: "bg-green-100 text-green-800",
      INVALIDADO: "bg-red-100 text-red-800",
    };
    return statusColors[status] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const clearFiltros = () => {
    setFiltros({});
  };

  const getFuncionariosResumo = (funcionarios: any[]) => {
    const pendentes = funcionarios.filter(
      (f) => f.statusTarefas === "ATENDER TAREFAS"
    ).length;
    const concluidos = funcionarios.filter(
      (f) => f.statusTarefas === "SOLICITAÇÃO CONCLUÍDA"
    ).length;
    return { pendentes, concluidos, total: funcionarios.length };
  };

  const gerarTarefasPadrao = async (funcionarioId: string, nome: string) => {
    try {
      const setores = ["RH", "MEDICINA", "TREINAMENTO"];
      const response = await fetch("/api/tarefas/padrao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionarioId, setores, criadoPor: "Sistema" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        showToast(
          errorData.error || "Erro ao reprovar tarefas padrão",
          "error"
        );
        return;
      }
      const result = await response.json();
      showToast(
        result.message || "Tarefas padrão criadas com sucesso!",
        "success"
      );
      fetchRemanejamentos();
    } catch (error) {
      showToast("Erro ao reprovar tarefas padrão", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando remanejamentos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erro</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchRemanejamentos}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Remanejamentos - Tabela
              </h1>
              <p className="text-sm text-gray-600">Versão compacta</p>
            </div>
            <div className="flex space-x-2">
              <Link
                href="/prestserv/remanejamentos/novo"
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                ➕ Nova Solicitação
              </Link>
              <Link
                href="/prestserv/remanejamentos"
                className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                📋 Cards
              </Link>
              <Link
                href="/prestserv/remanejamentos/historico"
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                📋 Histórico
              </Link>
              <Link
                href="/prestserv/dashboard"
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                📊 Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded shadow p-4 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status da Solicitação
              </label>
              <select
                value={filtros.status || ""}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    status:
                      (e.target.value as StatusRemanejamento) || undefined,
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="APROVAR SOLICITAÇÃO">Aprovar Solicitação</option>
                <option value="ATENDER TAREFAS">Atender Tarefas</option>
                <option value="REPROVAR TAREFAS">REPROVAR TAREFAS</option>
                <option value="SOLICITAÇÃO CONCLUÍDA">
                  Solicitação Concluída
                </option>
                <option value="SOLICITAÇÃO REJEITADA">
                  Solicitação Rejeitada
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status das Tarefas
              </label>
              <select
                value={filtros.statusTarefas || ""}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    statusTarefas:
                      (e.target.value as StatusTarefas) || undefined,
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="ATENDER TAREFAS">Atender Tarefas</option>
                <option value="SOLICITAÇÃO CONCLUÍDA">
                  Solicitação Concluída
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status do Prestserv
              </label>
              <select
                value={filtros.statusPrestserv || ""}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    statusPrestserv:
                      (e.target.value as StatusPrestserv) || undefined,
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="APROVAR SOLICITAÇÃO">Aprovar Solicitação</option>
                <option value="ATENDER TAREFAS">Atender Tarefas</option>
                <option value="REPROVAR TAREFAS">REPROVAR TAREFAS</option>
                <option value="SOLICITAÇÃO CONCLUÍDA">
                  Solicitação Concluída
                </option>
                <option value="SOLICITAÇÃO REJEITADA">
                  Solicitação Rejeitada
                </option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex space-x-2">
            <button
              onClick={clearFiltros}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={fetchRemanejamentos}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>

        {/* Tabela de Remanejamentos */}
        <div className="bg-white rounded shadow overflow-hidden">
          {remanejamentos.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-gray-400 text-4xl mb-3">📋</div>
              <h3 className="text-base font-medium text-gray-900 mb-1">
                Nenhum remanejamento encontrado
              </h3>
              <p className="text-sm text-gray-600">
                Não há remanejamentos que correspondam aos filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Solicitação
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contratos
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Funcionários
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {remanejamentos.map((remanejamento) => {
                    const resumo = getFuncionariosResumo(
                      remanejamento.funcionarios
                    );
                    const isExpanded = expandedRows.has(remanejamento.id);

                    return (
                      <React.Fragment key={remanejamento.id}>
                        {/* Linha Principal */}
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center">
                              <button
                                onClick={() => toggleRow(remanejamento.id)}
                                className="mr-1 p-0.5 hover:bg-gray-200 rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="h-3 w-3 text-gray-500" />
                                ) : (
                                  <ChevronRightIcon className="h-3 w-3 text-gray-500" />
                                )}
                              </button>
                              <div>
                                <div className="text-xs font-medium text-gray-900">
                                  #{remanejamento.id}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {remanejamento.solicitante?.nome}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${
                                remanejamento.tipo === "DESLIGAMENTO"
                                  ? "bg-red-100 text-red-800"
                                  : remanejamento.tipo === "ALOCACAO"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {remanejamento.tipo || "REMANEJAMENTO"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs text-gray-900">
                              {remanejamento.tipo === "DESLIGAMENTO" ? (
                                <div className="font-medium">
                                  {remanejamento.contratoOrigem?.nome}
                                </div>
                              ) : (
                                <>
                                  <div className="font-medium">
                                    {remanejamento.contratoOrigem?.nome}
                                  </div>
                                  <div className="text-gray-500">
                                    → {remanejamento.contratoDestino?.nome}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${getStatusColor(
                                remanejamento.status
                              )}`}
                            >
                              {remanejamento.status.replace("_", " ")}
                            </span>
                            {remanejamento.prioridade && (
                              <div className="mt-0.5">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${
                                    remanejamento.prioridade === "Alta"
                                      ? "bg-red-100 text-red-800"
                                      : remanejamento.prioridade === "Media"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {remanejamento.prioridade}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="text-xs text-gray-900">
                              <div className="font-medium">
                                {resumo.total} func.
                              </div>
                              <div className="text-gray-500">
                                {resumo.concluidos} ok, {resumo.pendentes} pend.
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
                                <div
                                  className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${
                                      resumo.total > 0
                                        ? (resumo.concluidos / resumo.total) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                            {formatDate(remanejamento.dataSolicitacao)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                            <button
                              onClick={() => toggleRow(remanejamento.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {isExpanded ? "Ocultar" : "Ver"}
                            </button>
                          </td>
                        </tr>

                        {/* Linha Expandida com Funcionários */}
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={7} className="px-0 py-0">
                              <div className="ml-3 mr-1 py-3 border-l-2 border-blue-300 bg-white">
                                <div className="pl-2 space-y-2">
                                  <div className="flex items-center space-x-1 mb-2">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                      Funcionários ({resumo.total})
                                    </h4>
                                  </div>

                                  {/* Tabela de Funcionários com Scroll Horizontal */}
                                  <div className="overflow-x-auto rounded border border-gray-200">
                                    <div className="min-w-max">
                                      <table className="w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[150px]">
                                              Funcionário
                                            </th>
                                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[80px]">
                                              Matrícula
                                            </th>
                                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                                              Função
                                            </th>
                                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                                              Tarefas
                                            </th>
                                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                                              Prestserv
                                            </th>
                                            <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase min-w-[80px]">
                                              Ações
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                          {remanejamento.funcionarios.map(
                                            (funcionarioRem, index) => (
                                              <tr
                                                key={funcionarioRem.id}
                                                className={`hover:bg-blue-50 ${
                                                  index % 2 === 0
                                                    ? "bg-white"
                                                    : "bg-gray-50"
                                                }`}
                                              >
                                                <td className="px-2 py-2 whitespace-nowrap min-w-[150px]">
                                                  <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-6 w-6">
                                                      <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                                                        <span className="text-white text-xs font-medium">
                                                          {funcionarioRem.funcionario.nome
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <div className="ml-2">
                                                      <div className="text-xs font-medium text-gray-900">
                                                        {
                                                          funcionarioRem
                                                            .funcionario.nome
                                                        }
                                                      </div>
                                                    </div>
                                                  </div>
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap min-w-[80px]">
                                                  <div className="text-xs text-gray-900 font-mono bg-gray-100 px-1 py-0.5 rounded">
                                                    {
                                                      funcionarioRem.funcionario
                                                        .matricula
                                                    }
                                                  </div>
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap min-w-[100px]">
                                                  <div className="text-xs text-gray-600">
                                                    {funcionarioRem.funcionario
                                                      .funcao || "N/A"}
                                                  </div>
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap min-w-[100px]">
                                                  <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                      funcionarioRem.statusTarefas ===
                                                      "SOLICITAÇÃO CONCLUÍDA"
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-yellow-100 text-yellow-800"
                                                    }`}
                                                  >
                                                    {funcionarioRem.statusTarefas ===
                                                    "SOLICITAÇÃO CONCLUÍDA"
                                                      ? "✅"
                                                      : "⏳"}{" "}
                                                    {
                                                      funcionarioRem.statusTarefas
                                                    }
                                                  </span>
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap min-w-[100px]">
                                                  <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                      funcionarioRem.statusPrestserv ===
                                                      "SOLICITAÇÃO CONCLUÍDA"
                                                        ? "bg-green-100 text-green-800"
                                                        : funcionarioRem.statusPrestserv ===
                                                          "SOLICITAÇÃO REJEITADA"
                                                        ? "bg-red-100 text-red-800"
                                                        : funcionarioRem.statusPrestserv ===
                                                          "ATENDER TAREFAS"
                                                        ? "bg-purple-100 text-purple-800"
                                                        : "bg-gray-100 text-gray-800"
                                                    }`}
                                                  >
                                                    {funcionarioRem.statusPrestserv ===
                                                    "SOLICITAÇÃO CONCLUÍDA"
                                                      ? "✅"
                                                      : funcionarioRem.statusPrestserv ===
                                                        "SOLICITAÇÃO REJEITADA"
                                                      ? "❌"
                                                      : funcionarioRem.statusPrestserv ===
                                                        "ATENDER TAREFAS"
                                                      ? "📤"
                                                      : "📝"}
                                                    {
                                                      funcionarioRem.statusPrestserv
                                                    }
                                                  </span>
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap text-xs font-medium min-w-[80px]">
                                                  <Link
                                                    href={`/prestserv/funcionario/${funcionarioRem.id}`}
                                                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-white bg-blue-500 hover:bg-blue-600 mr-2"
                                                  >
                                                    Ver
                                                  </Link>
                                                  <button
                                                    onClick={() =>
                                                      gerarTarefasPadrao(
                                                        funcionarioRem.id,
                                                        funcionarioRem
                                                          .funcionario.nome
                                                      )
                                                    }
                                                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-white bg-green-500 hover:bg-green-600 ml-1"
                                                    title="Gerar tarefas padrão RH, Medicina e Treinamento"
                                                  >
                                                    Gerar Tarefas Padrão
                                                  </button>
                                                </td>
                                              </tr>
                                            )
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Justificativa */}
                                  {remanejamento.justificativa && (
                                    <div className="mt-3 p-2 bg-amber-50 rounded border-l-2 border-amber-400">
                                      <div className="flex items-start space-x-1">
                                        <div className="flex-shrink-0">
                                          <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">
                                              !
                                            </span>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs font-semibold text-amber-800 mb-0.5">
                                            Justificativa:
                                          </p>
                                          <p className="text-xs text-amber-700">
                                            {remanejamento.justificativa}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resumo */}
        {remanejamentos.length > 0 && (
          <div className="mt-4 bg-blue-50 rounded p-3 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xs">📊</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">
                    Resumo
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {remanejamentos.length}
                  </div>
                  <div className="text-xs text-blue-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {remanejamentos.reduce(
                      (acc, r) =>
                        acc +
                        r.funcionarios.filter(
                          (f) =>
                            f.statusTarefas === "SOLICITAÇÃO CONCLUÍDA" &&
                            f.statusPrestserv === "SOLICITAÇÃO CONCLUÍDA"
                        ).length,
                      0
                    )}
                  </div>
                  <div className="text-xs text-green-500">Concluídos</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {remanejamentos.reduce(
                      (acc, r) =>
                        acc +
                        r.funcionarios.filter(
                          (f) =>
                            f.statusTarefas !== "SOLICITAÇÃO CONCLUÍDA" ||
                            f.statusPrestserv !== "SOLICITAÇÃO CONCLUÍDA"
                        ).length,
                      0
                    )}
                  </div>
                  <div className="text-xs text-orange-500">Pendentes</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
