'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';

interface FuncionarioContrato {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  centroCusto: string;
  statusTarefas: string;
  statusPrestserv: string;
  totalTarefas: number;
  tarefasConcluidas: number;
  emProcesso: boolean;
}

interface ContratoComFuncionarios {
  contratoId: string;
  contratoNome: string;
  contratoCliente: string;
  funcionarios: FuncionarioContrato[];
  totalFuncionarios: number;
  funcionariosAprovados: number;
  funcionariosPendentes: number;
  funcionariosRejeitados: number;
}

export default function FuncionariosPorContratoPage() {
  const router = useRouter();
  const [contratos, setContratos] = useState<ContratoComFuncionarios[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contratoExpandido, setContratoExpandido] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroContrato, setFiltroContrato] = useState('');

  useEffect(() => {
    fetchFuncionariosPorContrato();
  }, []);

  const fetchFuncionariosPorContrato = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prestserv/funcionarios-por-contrato');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar funcionários por contrato');
      }
      
      const data = await response.json();
      setContratos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const toggleContratoExpandido = (contratoId: string) => {
    setContratoExpandido(contratoExpandido === contratoId ? null : contratoId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APROVADO':
        return 'bg-green-100 text-green-800';
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJEITADO':
        return 'bg-red-100 text-red-800';
      case 'EM_ANALISE':
        return 'bg-blue-100 text-blue-800';
      case 'CRIADO':
        return 'bg-purple-100 text-purple-800';
      case 'SEM_PROCESSO':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusTarefasColor = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return 'bg-green-100 text-green-800';
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'EM_ANDAMENTO':
        return 'bg-blue-100 text-blue-800';
      case 'SEM_TAREFAS':
        return 'bg-orange-100 text-orange-800';
      case 'SEM_PROCESSO':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportarParaExcel = () => {
    try {
      // Preparar dados para exportação
      const dadosParaExportar: any[] = [];
      
      contratosFiltrados.forEach(contrato => {
        contrato.funcionarios.forEach(funcionario => {
          dadosParaExportar.push({
            'Contrato': contrato.contratoNome,
            'Cliente': contrato.contratoCliente,
            'Nome': funcionario.nome,
            'Matrícula': funcionario.matricula,
            'Função': funcionario.funcao,
            'Centro de Custo': funcionario.centroCusto,
            'Status Tarefas': funcionario.statusTarefas.replace('_', ' '),
            'Status Prestserv': funcionario.statusPrestserv.replace('_', ' '),
            'Total Tarefas': funcionario.totalTarefas,
            'Tarefas Concluídas': funcionario.tarefasConcluidas,
            'Progresso (%)': funcionario.totalTarefas > 0 ? Math.round((funcionario.tarefasConcluidas / funcionario.totalTarefas) * 100) : 0,
            'Em Processo': funcionario.emProcesso ? 'Sim' : 'Não'
          });
        });
      });

      if (dadosParaExportar.length === 0) {
        toast.error('Nenhum dado para exportar');
        return;
      }

      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      
      // Ajustar largura das colunas
      const colWidths = [
        { wch: 25 }, // Contrato
        { wch: 25 }, // Cliente
        { wch: 30 }, // Nome
        { wch: 12 }, // Matrícula
        { wch: 20 }, // Função
        { wch: 15 }, // Centro de Custo
        { wch: 15 }, // Status Tarefas
        { wch: 15 }, // Status Prestserv
        { wch: 12 }, // Total Tarefas
        { wch: 15 }, // Tarefas Concluídas
        { wch: 12 }, // Progresso (%)
        { wch: 12 }  // Em Processo
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Funcionários por Contrato');
      
      // Gerar nome do arquivo com data atual
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `funcionarios-por-contrato-${dataAtual}.xlsx`;
      
      // Fazer download
      XLSX.writeFile(wb, nomeArquivo);
      
      toast.success('Arquivo Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      toast.error('Erro ao exportar arquivo Excel');
    }
  };

  const contratosFiltrados = contratos.filter(contrato => {
    const matchContrato = filtroContrato === '' || 
      contrato.contratoNome.toLowerCase().includes(filtroContrato.toLowerCase()) ||
      contrato.contratoCliente.toLowerCase().includes(filtroContrato.toLowerCase());
    
    if (filtroStatus === 'TODOS') {
      return matchContrato;
    }
    
    const temFuncionarioComStatus = contrato.funcionarios.some(func => 
      func.statusPrestserv === filtroStatus
    );
    
    return matchContrato && temFuncionarioComStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">
          <strong>Erro:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Funcionários por Contrato</h1>
        <div className="flex space-x-3">
          <button
            onClick={exportarParaExcel}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Exportar Excel
          </button>
          <button
            onClick={() => router.push('/prestserv/funcionarios')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Ver Lista Geral
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Contrato
            </label>
            <input
              type="text"
              value={filtroContrato}
              onChange={(e) => setFiltroContrato(e.target.value)}
              placeholder="Nome do contrato ou cliente..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Prestserv
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="SEM_PROCESSO">Sem Processo</option>
              <option value="CRIADO">Criado</option>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_ANALISE">Em Análise</option>
              <option value="APROVADO">Aprovado</option>
              <option value="REJEITADO">Rejeitado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Contratos */}
      <div className="space-y-4">
        {contratosFiltrados.map((contrato) => (
          <div key={contrato.contratoId} className="bg-white rounded-lg shadow">
            {/* Cabeçalho do Contrato */}
            <div 
              className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleContratoExpandido(contrato.contratoId)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {contrato.contratoNome}
                  </h3>
                  <p className="text-sm text-gray-600">{contrato.contratoCliente}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total de Funcionários</div>
                    <div className="text-lg font-semibold">{contrato.totalFuncionarios}</div>
                  </div>
                  <div className="flex space-x-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      {contrato.funcionariosAprovados} Aprovados
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                      {contrato.funcionariosPendentes} Pendentes
                    </span>
                    {contrato.funcionariosRejeitados > 0 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                        {contrato.funcionariosRejeitados} Rejeitados
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400">
                    {contratoExpandido === contrato.contratoId ? '▼' : '▶'}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Funcionários (expandível) */}
            {contratoExpandido === contrato.contratoId && (
              <div className="p-2">
                {contrato.funcionarios.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    Nenhum funcionário neste contrato
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Funcionário
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Função
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            C. Custo
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status Tarefas
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status Prestserv
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Progresso
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {contrato.funcionarios.map((funcionario) => (
                          <tr key={funcionario.id} className={`hover:bg-gray-50 ${funcionario.emProcesso ? 'bg-blue-50 border-l-4 border-blue-400' : ''}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center flex-wrap">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {funcionario.nome}
                                    </div>
                                    {funcionario.emProcesso && (
                                      <span className="ml-1 px-1 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                        Processo
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {funcionario.matricula}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              <div className="truncate max-w-24">{funcionario.funcao}</div>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              <div className="truncate max-w-20">{funcionario.centroCusto}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1 py-0.5 text-xs rounded ${getStatusTarefasColor(funcionario.statusTarefas)}`}>
                                {funcionario.statusTarefas.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1 py-0.5 text-xs rounded ${getStatusColor(funcionario.statusPrestserv)}`}>
                                {funcionario.statusPrestserv.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center">
                                <div className="w-12 bg-gray-200 rounded-full h-1.5 mr-1">
                                  <div 
                                    className="bg-blue-600 h-1.5 rounded-full" 
                                    style={{ 
                                      width: `${funcionario.totalTarefas > 0 ? (funcionario.tarefasConcluidas / funcionario.totalTarefas) * 100 : 0}%` 
                                    }}
                                  ></div>
                                </div>
                                <span className="text-xs text-gray-600 whitespace-nowrap">
                                  {funcionario.tarefasConcluidas}/{funcionario.totalTarefas}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm font-medium">
                              <button
                                onClick={() => router.push(`/planejamento/funcionarios/${funcionario.id}`)}
                                className="text-blue-600 hover:text-blue-900 text-xs"
                              >
                                Detalhes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                     </table>
                   </div>
                 )}
              </div>
            )}
          </div>
        ))}
      </div>

      {contratosFiltrados.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">Nenhum contrato encontrado com os filtros aplicados.</p>
        </div>
      )}
    </div>
  );
}