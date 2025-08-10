"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

interface VisaoSolicitacoesProps {
  funcionarios: any[];
  filtroNome: string;
  filtroContratoOrigem: string[];
  filtroContratoDestino: string[];
  filtroStatusGeral: string[];
  filtroTipoSolicitacao: string[];
  filtroNumeroSolicitacao: string;
  filtroResponsavel: string[];
  filtroPendenciaSetor: string[];
  ordenacao: string;
  onViewDetails: (funcionario: any) => void;
  onSelectFuncionario: (funcionario: any) => void;
  fetchFuncionarios: () => Promise<void>;
}

const VisaoSolicitacoes: React.FC<VisaoSolicitacoesProps> = ({
  funcionarios,
  filtroNome,
  filtroContratoOrigem,
  filtroContratoDestino,
  filtroStatusGeral,
  filtroTipoSolicitacao,
  filtroNumeroSolicitacao,
  filtroResponsavel,
  filtroPendenciaSetor,
  ordenacao,
  onViewDetails,
  onSelectFuncionario,
  fetchFuncionarios,
}) => {
  // Estados para paginação da tabela de solicitações
  const [paginaAtualSolicitacoes, setPaginaAtualSolicitacoes] = useState(1);
  const [itensPorPaginaSolicitacoes] = useState(5);
  const [totalSolicitacoes, setTotalSolicitacoes] = useState(0);

  // Efeito para recarregar dados quando a página atual muda
  useEffect(() => {
    fetchFuncionarios();
  }, [paginaAtualSolicitacoes]);

  // Função para determinar o responsável atual
  const getResponsavelAtual = (funcionario: any): string => {
    if (!funcionario.tarefas || funcionario.tarefas.length === 0) {
      return "N/A";
    }

    // Encontrar tarefas pendentes
    const tarefasPendentes = funcionario.tarefas.filter(
      (tarefa: any) => tarefa.status === "PENDENTE"
    );

    if (tarefasPendentes.length > 0) {
      // Retornar o setor da primeira tarefa pendente
      return tarefasPendentes[0].setor?.nome || "N/A";
    }

    // Se não houver tarefas pendentes, retornar o setor da última tarefa atualizada
    const tarefasOrdenadas = [...funcionario.tarefas].sort(
      (a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return tarefasOrdenadas[0].setor?.nome || "N/A";
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                ID Remanejamento
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Tipo
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Data Criação
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Última Atualização
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Contrato Origem
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Contrato Destino
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Funcionário
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Responsável
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Progresso
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {funcionarios.map((funcionario) => (
              <tr key={funcionario.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {funcionario.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {funcionario.tipoSolicitacao || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(funcionario.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(funcionario.updatedAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {funcionario.contratoOrigem || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {funcionario.contratoDestino || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {funcionario.nome || "N/A"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {funcionario.matricula || "N/A"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      funcionario.statusPrestserv === "APROVADO"
                        ? "bg-green-100 text-green-800"
                        : funcionario.statusPrestserv === "REPROVADO"
                        ? "bg-red-100 text-red-800"
                        : funcionario.statusPrestserv === "PENDENTE"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {funcionario.statusPrestserv || "N/A"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getResponsavelAtual(funcionario)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {funcionario.tarefas && funcionario.tarefas.length > 0 ? (
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{
                            width: `${Math.round(
                              (funcionario.tarefas.filter(
                                (t: any) => t.status === "CONCLUIDO"
                              ).length /
                                funcionario.tarefas.length) *
                                100
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <span className="ml-2 text-xs">
                        {Math.round(
                          (funcionario.tarefas.filter(
                            (t: any) => t.status === "CONCLUIDO"
                          ).length /
                            funcionario.tarefas.length) *
                            100
                        )}%
                      </span>
                    </div>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSelectFuncionario(funcionario)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Selecionar Funcionário"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onViewDetails(funcionario)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Ver Detalhes"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalSolicitacoes > 0 && (
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
          <div className="flex items-center text-sm text-gray-700">
            <span>
              Mostrando{" "}
              <span className="font-medium">
                {Math.min(
                  (paginaAtualSolicitacoes - 1) * itensPorPaginaSolicitacoes + 1,
                  totalSolicitacoes
                )}
              </span>{" "}
              até{" "}
              <span className="font-medium">
                {Math.min(
                  paginaAtualSolicitacoes * itensPorPaginaSolicitacoes,
                  totalSolicitacoes
                )}
              </span>{" "}
              de{" "}
              <span className="font-medium">{totalSolicitacoes}</span>{" "}
              solicitações
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPaginaAtualSolicitacoes(prev => Math.max(prev - 1, 1))}
              disabled={paginaAtualSolicitacoes === 1}
              className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from(
                { length: Math.ceil(totalSolicitacoes / itensPorPaginaSolicitacoes) },
                (_, i) => i + 1
              ).map((numeroPagina) => {
                const totalPaginas = Math.ceil(totalSolicitacoes / itensPorPaginaSolicitacoes);
                
                // Mostrar apenas algumas páginas ao redor da página atual
                if (
                  numeroPagina === 1 ||
                  numeroPagina === totalPaginas ||
                  (numeroPagina >= paginaAtualSolicitacoes - 1 && numeroPagina <= paginaAtualSolicitacoes + 1)
                ) {
                  return (
                    <button
                      key={numeroPagina}
                      onClick={() => setPaginaAtualSolicitacoes(numeroPagina)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium border ${
                        numeroPagina === paginaAtualSolicitacoes
                          ? "bg-blue-50 border-blue-500 text-blue-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {numeroPagina}
                    </button>
                  );
                } else if (
                  numeroPagina === paginaAtualSolicitacoes - 2 ||
                  numeroPagina === paginaAtualSolicitacoes + 2
                ) {
                  return (
                    <span key={numeroPagina} className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            
            <button
              onClick={() => setPaginaAtualSolicitacoes(prev => 
                Math.min(prev + 1, Math.ceil(totalSolicitacoes / itensPorPaginaSolicitacoes))
              )}
              disabled={paginaAtualSolicitacoes >= Math.ceil(totalSolicitacoes / itensPorPaginaSolicitacoes)}
              className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisaoSolicitacoes;