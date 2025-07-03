'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { 
  MagnifyingGlassIcon, 
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

interface Tarefa {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  dataLimite: string | null;
  dataCriacao: string;
  funcionarioId: string;
  remanejamentoFuncionarioId: string;
  funcionario?: {
    nome: string;
    matricula: string;
    funcao: string;
  };
  remanejamentoFuncionario?: {
    funcionario: {
      nome: string;
      matricula: string;
      funcao: string;
    };
  };
}

interface ProgressoGeral {
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

export default function TreinamentoPage() {
  const router = useRouter();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('TODOS');
  const [filtroNome, setFiltroNome] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(15);

  useEffect(() => {
    fetchTarefas();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroStatus, filtroPrioridade, filtroNome]);

  const fetchTarefas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logistica/tarefas?responsavel=TREINAMENTO');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar tarefas');
      }
      
      const data = await response.json();
      setTarefas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getProgressoGeral = (): ProgressoGeral => {
    const total = tarefas.length;
    const pendentes = tarefas.filter(t => t.status === 'PENDENTE').length;
    const emAndamento = tarefas.filter(t => t.status === 'EM_ANDAMENTO').length;
    const concluidas = tarefas.filter(t => t.status === 'CONCLUIDO').length;
    const atrasadas = tarefas.filter(t => {
      if (!t.dataLimite || t.status === 'CONCLUIDO') return false;
      return new Date(t.dataLimite) < new Date();
    }).length;

    return { total, pendentes, emAndamento, concluidas, atrasadas };
  };

  const tarefasFiltradas = () => {
    return tarefas.filter(tarefa => {
      const matchStatus = filtroStatus === 'TODOS' || tarefa.status === filtroStatus;
      const matchPrioridade = filtroPrioridade === 'TODOS' || tarefa.prioridade === filtroPrioridade;
      const nomeFuncionario = tarefa.funcionario?.nome || tarefa.remanejamentoFuncionario?.funcionario?.nome || '';
      const matriculaFuncionario = tarefa.funcionario?.matricula || tarefa.remanejamentoFuncionario?.funcionario?.matricula || '';
      const matchNome = nomeFuncionario.toLowerCase().includes(filtroNome.toLowerCase()) ||
                       matriculaFuncionario.toLowerCase().includes(filtroNome.toLowerCase()) ||
                       tarefa.tipo.toLowerCase().includes(filtroNome.toLowerCase());
      
      return matchStatus && matchPrioridade && matchNome;
    });
  };

  const tarefasPaginadas = () => {
    const filtradas = tarefasFiltradas();
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return filtradas.slice(inicio, fim);
  };

  const totalPaginas = Math.ceil(tarefasFiltradas().length / itensPorPagina);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return 'bg-green-100 text-green-800';
      case 'EM_ANDAMENTO':
        return 'bg-blue-100 text-blue-800';
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELADO':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'ALTA':
        return 'bg-red-100 text-red-800';
      case 'MEDIA':
        return 'bg-yellow-100 text-yellow-800';
      case 'BAIXA':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isTaskOverdue = (dataLimite: string | null, status: string) => {
    if (!dataLimite || status === 'CONCLUIDO') return false;
    return new Date(dataLimite) < new Date();
  };

  const limparFiltros = () => {
    setFiltroStatus('TODOS');
    setFiltroPrioridade('TODOS');
    setFiltroNome('');
  };

  const temFiltrosAtivos = () => {
    return filtroStatus !== 'TODOS' || filtroPrioridade !== 'TODOS' || filtroNome;
  };

  const exportarParaExcel = () => {
    try {
      const dadosParaExportar = tarefasFiltradas().map(tarefa => {
        const nomeFuncionario = tarefa.funcionario?.nome || tarefa.remanejamentoFuncionario?.funcionario?.nome || 'N/A';
        const matriculaFuncionario = tarefa.funcionario?.matricula || tarefa.remanejamentoFuncionario?.funcionario?.matricula || 'N/A';
        const funcaoFuncionario = tarefa.funcionario?.funcao || tarefa.remanejamentoFuncionario?.funcionario?.funcao || 'N/A';
        const isOverdue = isTaskOverdue(tarefa.dataLimite, tarefa.status);
        
        return {
          'Funcionário': nomeFuncionario,
          'Matrícula': matriculaFuncionario,
          'Função': funcaoFuncionario,
          'Tipo da Tarefa': tarefa.tipo,
          'Descrição': tarefa.descricao,
          'Status': tarefa.status.replace('_', ' '),
          'Prioridade': tarefa.prioridade,
          'Data Limite': tarefa.dataLimite ? new Date(tarefa.dataLimite).toLocaleDateString('pt-BR') : 'Sem prazo',
          'Data Criação': new Date(tarefa.dataCriacao).toLocaleDateString('pt-BR'),
          'Atrasada': isOverdue ? 'Sim' : 'Não'
        };
      });

      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 25 }, // Funcionário
        { wch: 12 }, // Matrícula
        { wch: 20 }, // Função
        { wch: 25 }, // Tipo da Tarefa
        { wch: 40 }, // Descrição
        { wch: 15 }, // Status
        { wch: 12 }, // Prioridade
        { wch: 15 }, // Data Limite
        { wch: 15 }, // Data Criação
        { wch: 10 }  // Atrasada
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Tarefas Treinamento');

      // Gerar nome do arquivo com data atual
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `tarefas-treinamento-${dataAtual}.xlsx`;

      // Fazer download
      XLSX.writeFile(wb, nomeArquivo);
      
      toast.success('Arquivo Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar arquivo Excel');
    }
  };

  const progresso = getProgressoGeral();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-center">
          <p className="text-xl font-semibold mb-2">Erro ao carregar dados</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tarefas - Treinamento</h1>
        <p className="text-gray-600">Gerencie as tarefas e pendências do setor de Treinamento</p>
      </div>

      {/* Indicadores de Progresso Compactos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <UserGroupIcon className="w-5 h-5 text-gray-500 mr-2" />
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">{progresso.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-yellow-200">
          <div className="flex items-center">
            <ClockIcon className="w-5 h-5 text-yellow-500 mr-2" />
            <div>
              <p className="text-xs text-gray-500">Pendentes</p>
              <p className="text-lg font-semibold text-yellow-600">{progresso.pendentes}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <div className="flex items-center">
            <ClockIcon className="w-5 h-5 text-blue-500 mr-2" />
            <div>
              <p className="text-xs text-gray-500">Em Andamento</p>
              <p className="text-lg font-semibold text-blue-600">{progresso.emAndamento}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
            <div>
              <p className="text-xs text-gray-500">Concluídas</p>
              <p className="text-lg font-semibold text-green-600">{progresso.concluidas}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <div>
              <p className="text-xs text-gray-500">Atrasadas</p>
              <p className="text-lg font-semibold text-red-600">{progresso.atrasadas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Filtros</h3>
          {temFiltrosAtivos() && (
            <button
              onClick={limparFiltros}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Campo de busca */}
          <div className="relative md:col-span-2">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por funcionário, matrícula ou tipo..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Filtro de Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          
          {/* Filtro de Prioridade */}
          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="TODOS">Todas as Prioridades</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Média</option>
            <option value="BAIXA">Baixa</option>
          </select>
        </div>
      </div>

      {/* Tabela de Tarefas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Lista de Tarefas</h3>
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {tarefasFiltradas().length} tarefas
              </span>
              <button
                onClick={exportarParaExcel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funcionário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo/Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioridade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Prevista
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tarefasPaginadas().map((tarefa) => {
                const nomeFuncionario = tarefa.funcionario?.nome || tarefa.remanejamentoFuncionario?.funcionario?.nome || 'N/A';
                const matriculaFuncionario = tarefa.funcionario?.matricula || tarefa.remanejamentoFuncionario?.funcionario?.matricula || 'N/A';
                const funcaoFuncionario = tarefa.funcionario?.funcao || tarefa.remanejamentoFuncionario?.funcionario?.funcao || 'N/A';
                const isOverdue = isTaskOverdue(tarefa.dataLimite, tarefa.status);
                
                return (
                  <tr key={tarefa.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{nomeFuncionario}</div>
                        <div className="text-sm text-gray-500">#{matriculaFuncionario} • {funcaoFuncionario}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{tarefa.tipo}</div>
                        <div className="text-sm text-gray-500">{tarefa.descricao}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(tarefa.status)}`}>
                        {tarefa.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPrioridadeColor(tarefa.prioridade)}`}>
                        {tarefa.prioridade}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tarefa.dataLimite ? (
                        <div className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {new Date(tarefa.dataLimite).toLocaleDateString('pt-BR')}
                          {isOverdue && <span className="ml-1">⚠️</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">Sem prazo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => router.push(`/prestserv/funcionario/${tarefa.remanejamentoFuncionarioId}`)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        Ver detalhes
                        <ChevronRightIcon className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                  disabled={paginaAtual === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próximo
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando{' '}
                    <span className="font-medium">{(paginaAtual - 1) * itensPorPagina + 1}</span>
                    {' '}até{' '}
                    <span className="font-medium">
                      {Math.min(paginaAtual * itensPorPagina, tarefasFiltradas().length)}
                    </span>
                    {' '}de{' '}
                    <span className="font-medium">{tarefasFiltradas().length}</span>
                    {' '}resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                      disabled={paginaAtual === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
                      <button
                        key={numero}
                        onClick={() => setPaginaAtual(numero)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          numero === paginaAtual
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {numero}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próximo
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {tarefasFiltradas().length === 0 && (
        <div className="text-center py-12">
          <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma tarefa encontrada</h3>
          <p className="mt-1 text-sm text-gray-500">
            {temFiltrosAtivos() ? 'Tente ajustar os filtros para ver mais resultados.' : 'Não há tarefas cadastradas para este setor.'}
          </p>
        </div>
      )}
    </div>
  );
}