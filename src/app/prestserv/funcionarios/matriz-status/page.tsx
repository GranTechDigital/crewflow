'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  UserIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROUTE_PROTECTION } from '@/lib/permissions';

interface ProgressoPorSetor {
  setor: string;
  total: number;
  concluidas: number;
  percentual: number;
}

interface FuncionarioTableData {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  statusTarefas: string;
  statusPrestserv: string;
  statusFuncionario: string;
  solicitacaoId: string;
  contratoOrigem: string;
  contratoDestino: string;
  totalTarefas: number;
  tarefasConcluidas: number;
  dataSolicitacao: string;
  progressoPorSetor: ProgressoPorSetor[];
}

export default function MatrizStatusPage() {
  return (
    <ProtectedRoute 
      requiredEquipe={ROUTE_PROTECTION.PRESTSERV.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PRESTSERV.requiredPermissions}
    >
      <MatrizStatusPageContent />
    </ProtectedRoute>
  );
}

function MatrizStatusPageContent() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState<FuncionarioTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroContratoOrigem, setFiltroContratoOrigem] = useState('');
  const [filtroContratoDestino, setFiltroContratoDestino] = useState('');
  const [filtroStatusTarefas, setFiltroStatusTarefas] = useState('');
  const [filtroStatusPrestserv, setFiltroStatusPrestserv] = useState('');
  const [filtroStatusFuncionario, setFiltroStatusFuncionario] = useState('');
  const [filtroRH, setFiltroRH] = useState('');
  const [filtroMedicina, setFiltroMedicina] = useState('');
  const [filtroTreinamento, setFiltroTreinamento] = useState('');
  const [filtroGeral, setFiltroGeral] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);



  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFuncionarios = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logistica/remanejamentos');

      if (!response.ok) {
        throw new Error('Erro ao buscar dados');
      }

      const data = await response.json();

      console.log('Dados da API:', data);
      const funcionariosTransformados: FuncionarioTableData[] = data.flatMap((solicitacao: any) =>
        solicitacao.funcionarios.map((rf: any) => {
          // Calcular progresso das tarefas
          const totalTarefas = rf.tarefas?.length || 0;
          const tarefasConcluidas = rf.tarefas?.filter((t: any) => t.status === 'CONCLUIDO').length || 0;

          // Calcular status das tarefas baseado no progresso real
          let statusTarefasCalculado = 'ATENDER TAREFAS';
          if (totalTarefas === 0) {
            statusTarefasCalculado = 'ATENDER TAREFAS';
          } else if (tarefasConcluidas === totalTarefas && totalTarefas > 0) {
            statusTarefasCalculado = 'SOLICITAÇÃO CONCLUÍDA';
          } else if (tarefasConcluidas > 0) {
            statusTarefasCalculado = 'ATENDER TAREFAS';
          } else {
            statusTarefasCalculado = 'ATENDER TAREFAS';
          }

          // Usar o status calculado em vez do status do banco
          const statusTarefasFinal = rf.statusTarefas === 'SOLICITAÇÃO CONCLUÍDA' || rf.statusTarefas === 'SOLICITAÇÃO REJEITADA'
            ? rf.statusTarefas
            : statusTarefasCalculado;

          // Debug: Log para verificar os cálculos
          console.log(`Funcionário ${rf.funcionario.nome}:`, {
            totalTarefas,
            tarefasConcluidas,
            statusTarefasCalculado,
            statusTarefasFinal,
            statusTarefasOriginal: rf.statusTarefas,
            tarefas: rf.tarefas?.map((t: any) => ({
              tipo: t.tipo,
              responsavel: t.responsavel,
              status: t.status
            }))
          });

          return {
            id: rf.id,
            nome: rf.funcionario.nome,
            matricula: rf.funcionario.matricula,
            funcao: rf.funcionario.funcao || 'N/A',
            statusTarefas: statusTarefasFinal,
            statusPrestserv: rf.statusPrestserv || 'CRIADO',
            statusFuncionario: rf.statusFuncionario || 'SEM_CADASTRO',
            solicitacaoId: solicitacao.id.toString(),
            contratoOrigem: solicitacao.contratoOrigem?.numero || 'N/A',
            contratoDestino: solicitacao.contratoDestino?.numero || 'N/A',
            totalTarefas: totalTarefas,
            tarefasConcluidas: tarefasConcluidas,
            dataSolicitacao: solicitacao.dataSolicitacao,
            progressoPorSetor: [
              {
                setor: 'RH',
                total: rf.tarefas?.filter((t: any) => t.responsavel === 'RH').length || 0,
                concluidas: rf.tarefas?.filter((t: any) => t.responsavel === 'RH' && t.status === 'CONCLUIDO').length || 0,
                percentual: 0
              },
              {
                setor: 'MEDICINA',
                total: rf.tarefas?.filter((t: any) => t.responsavel === 'MEDICINA').length || 0,
                concluidas: rf.tarefas?.filter((t: any) => t.responsavel === 'MEDICINA' && t.status === 'CONCLUIDO').length || 0,
                percentual: 0
              },
              {
                setor: 'TREINAMENTO',
                total: rf.tarefas?.filter((t: any) => t.responsavel === 'TREINAMENTO').length || 0,
                concluidas: rf.tarefas?.filter((t: any) => t.responsavel === 'TREINAMENTO' && t.status === 'CONCLUIDO').length || 0,
                percentual: 0
              }
            ].map(progresso => ({
              ...progresso,
              percentual: progresso.total > 0 ? Math.round((progresso.concluidas / progresso.total) * 100) : 0
            }))
          };
        })
      );

      console.log('Dados transformados:', funcionariosTransformados);

      setFuncionarios(funcionariosTransformados);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  // Função para obter status visual baseado na legenda
  const getSetorStatusVisual = (progresso: ProgressoPorSetor) => {
    if (progresso.total === 0) {
      return 'SEM_TAREFAS';
    } else if (progresso.percentual === 100) {
      return 'ATENDIDO';
    } else if (progresso.concluidas > 0) {
      return 'EM_ANDAMENTO';
    } else {
      return 'ATENDER TAREFAS';
    }
  };

  // Função para obter status visual geral baseado na legenda
  const getStatusVisual = (status: string) => {
    switch (status) {
      case 'SOLICITAÇÃO CONCLUÍDA':
      case 'INATIVO':
        return 'ATENDIDO';
      case 'ATENDER TAREFAS':
        return 'ATENDER TAREFAS';
      case 'SOLICITAÇÃO REJEITADA':
      case 'ATIVO':
      case 'NAO_INFORMADO':
        return 'ATENDER TAREFAS';
      case 'EM_ANDAMENTO':
        return 'ATENDIDO';
      case 'APROVAR SOLICITAÇÃO':
      case 'REPROVAR TAREFAS':
        return 'EM_ANDAMENTO';
      default:
        return 'ATENDER TAREFAS';
    }
  };

  // Função para calcular status geral da linha
  const getStatusGeral = (funcionario: FuncionarioTableData) => {
    const statusTarefas = getStatusVisual(funcionario.statusTarefas);
    const statusPrestserv = getStatusVisual(funcionario.statusPrestserv);
    const statusFuncionario = getStatusVisual(funcionario.statusFuncionario);
    
    const progressoRH = funcionario.progressoPorSetor.find(p => p.setor === 'RH') || { setor: 'RH', total: 0, concluidas: 0, percentual: 0 };
    const progressoMedicina = funcionario.progressoPorSetor.find(p => p.setor === 'MEDICINA') || { setor: 'MEDICINA', total: 0, concluidas: 0, percentual: 0 };
    const progressoTreinamento = funcionario.progressoPorSetor.find(p => p.setor === 'TREINAMENTO') || { setor: 'TREINAMENTO', total: 0, concluidas: 0, percentual: 0 };
    
    const statusRH = getSetorStatusVisual(progressoRH);
    const statusMedicina = getSetorStatusVisual(progressoMedicina);
    const statusTreinamento = getSetorStatusVisual(progressoTreinamento);
    
    // Array com todos os status
    const todosStatus = [statusTarefas, statusPrestserv, statusFuncionario, statusRH, statusMedicina, statusTreinamento];
    
    // Se todos são ATENDIDO, então está COMPLETO
    if (todosStatus.every(status => status === 'ATENDIDO')) {
      return 'COMPLETO';
    }
    
    // Se todos são ATENDER TAREFAS, então está ATENDER TAREFAS
    if (todosStatus.every(status => status === 'ATENDER TAREFAS')) {
      return 'ATENDER TAREFAS';
    }
    
    // Se há pelo menos um EM_ANDAMENTO, então está EM_ANDAMENTO
    if (todosStatus.some(status => status === 'EM_ANDAMENTO')) {
      return 'EM_ANDAMENTO';
    }
    
    // Se há mistura de status (incluindo SEM_TAREFAS), então está SEM_TAREFAS
    return 'SEM_TAREFAS';
  };

  // Função para obter ícone baseado no status do setor
  const getSetorStatusIcon = (progresso: ProgressoPorSetor) => {
    let tooltip = '';

    if (progresso.total === 0) {
      tooltip = `${progresso.setor}: Sem tarefas`;
      return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" title={tooltip} />;
    } else if (progresso.percentual === 100) {
      tooltip = `${progresso.setor}: Concluído (${progresso.concluidas}/${progresso.total} tarefas)`;
      return <CheckCircleIcon className="w-5 h-5 text-green-600" title={tooltip} />;
    } else if (progresso.concluidas > 0) {
      tooltip = `${progresso.setor}: Em andamento (${progresso.concluidas}/${progresso.total} tarefas - ${progresso.percentual}%)`;
      return <ClockIcon className="w-5 h-5 text-blue-500" title={tooltip} />;
    } else {
      tooltip = `${progresso.setor}: Pendente (0/${progresso.total} tarefas)`;
      return <XCircleIcon className="w-5 h-5 text-red-600" title={tooltip} />;
    }
  };

  // Função para obter ícone baseado no status geral
  const getStatusIcon = (status: string) => {
    let tooltip = '';

    switch (status) {
      case 'SOLICITAÇÃO CONCLUÍDA':
        tooltip = 'Status: Solicitação Concluída - Todas as tarefas foram finalizadas';
        return <CheckCircleIcon className="w-5 h-5 text-green-600" title={tooltip} />;
      case 'INATIVO':
        tooltip = 'Status: Inativo - Funcionário inativo no sistema';
        return <CheckCircleIcon className="w-5 h-5 text-green-600" title={tooltip} />;
      case 'ATENDER TAREFAS':
        tooltip = 'Status: Atender Tarefas - Aguardando execução das tarefas';
        return <ClockIcon className="w-5 h-5 text-gray-400" title={tooltip} />;
      case 'SOLICITAÇÃO REJEITADA':
        tooltip = 'Status: Solicitação Rejeitada - Solicitação foi rejeitada';
        return <XCircleIcon className="w-5 h-5 text-red-600" title={tooltip} />;
      case 'ATIVO':
        tooltip = 'Status: Ativo - Funcionário ativo no sistema';
        return <XCircleIcon className="w-5 h-5 text-red-600" title={tooltip} />;
      case 'NAO_INFORMADO':
        tooltip = 'Status: Não Informado - Status do funcionário não foi definido';
        return <XCircleIcon className="w-5 h-5 text-red-600" title={tooltip} />;
      case 'EM_ANDAMENTO':
        tooltip = 'Status: Em Andamento - Tarefas estão sendo executadas';
        return <CheckCircleIcon className="w-5 h-5 text-green-600" title={tooltip} />;
      case 'APROVAR SOLICITAÇÃO':
        tooltip = 'Status: Aprovar Solicitação - Aguardando aprovação';
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" title={tooltip} />;
      case 'REPROVAR TAREFAS':
        tooltip = 'Status: Reprovar Tarefas - Aguardando reprovação das tarefas';
        return <ClockIcon className="w-5 h-5 text-blue-600" title={tooltip} />
      default:
        tooltip = `Status: ${status} - Status não reconhecido`;
        return <ClockIcon className="w-5 h-5 text-gray-400" title={tooltip} />;
    }
  };

  // Função para obter ícone do setor
  const getSetorIcon = (setor: string) => {
    switch (setor) {
      case 'RH':
        return <UserIcon className="w-4 h-4" />;
      case 'MEDICINA':
        return <BuildingOfficeIcon className="w-4 h-4" />;
      case 'TREINAMENTO':
        return <AcademicCapIcon className="w-4 h-4" />;
      default:
        return <DocumentTextIcon className="w-4 h-4" />;
    }
  };



  // Filtros
  const funcionariosFiltrados = funcionarios.filter(funcionario => {
    const matchSearch = funcionario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      funcionario.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    const matchContratoOrigem = !filtroContratoOrigem || funcionario.contratoOrigem.includes(filtroContratoOrigem);
    const matchContratoDestino = !filtroContratoDestino || funcionario.contratoDestino.includes(filtroContratoDestino);
    const matchStatusTarefas = !filtroStatusTarefas || funcionario.statusTarefas === filtroStatusTarefas;
    const matchStatusPrestserv = !filtroStatusPrestserv || funcionario.statusPrestserv === filtroStatusPrestserv;
    const matchStatusFuncionario = !filtroStatusFuncionario || funcionario.statusFuncionario === filtroStatusFuncionario;

    // Filtros baseados na legenda
    const statusTarefasVisual = getStatusVisual(funcionario.statusTarefas);
    const statusPrestservVisual = getStatusVisual(funcionario.statusPrestserv);
    const statusFuncionarioVisual = getStatusVisual(funcionario.statusFuncionario);
    
    const progressoRH = funcionario.progressoPorSetor.find(p => p.setor === 'RH') || { setor: 'RH', total: 0, concluidas: 0, percentual: 0 };
    const progressoMedicina = funcionario.progressoPorSetor.find(p => p.setor === 'MEDICINA') || { setor: 'MEDICINA', total: 0, concluidas: 0, percentual: 0 };
    const progressoTreinamento = funcionario.progressoPorSetor.find(p => p.setor === 'TREINAMENTO') || { setor: 'TREINAMENTO', total: 0, concluidas: 0, percentual: 0 };

    const matchStatusTarefasVisual = !filtroStatusTarefas || statusTarefasVisual === filtroStatusTarefas;
    const matchStatusPrestservVisual = !filtroStatusPrestserv || statusPrestservVisual === filtroStatusPrestserv;
    const matchStatusFuncionarioVisual = !filtroStatusFuncionario || statusFuncionarioVisual === filtroStatusFuncionario;
    const matchRH = !filtroRH || getSetorStatusVisual(progressoRH) === filtroRH;
    const matchMedicina = !filtroMedicina || getSetorStatusVisual(progressoMedicina) === filtroMedicina;
    const matchTreinamento = !filtroTreinamento || getSetorStatusVisual(progressoTreinamento) === filtroTreinamento;
    const matchGeral = !filtroGeral || getStatusGeral(funcionario) === filtroGeral;

    return matchSearch && matchContratoOrigem && matchContratoDestino &&
      matchStatusTarefasVisual && matchStatusPrestservVisual && matchStatusFuncionarioVisual &&
      matchRH && matchMedicina && matchTreinamento && matchGeral;
  });

  const getContratosOrigem = () => [...new Set(funcionarios.map(f => f.contratoOrigem))];
  const getContratosDestino = () => [...new Set(funcionarios.map(f => f.contratoDestino))];
  
  // Opções de filtro baseadas na legenda
  const getStatusTarefas = () => {
    return [...new Set(funcionarios.map(f => f.statusTarefas).filter(Boolean))];
  };
  const getStatusPrestserv = () => {
    return [...new Set(funcionarios.map(f => f.statusPrestserv).filter(Boolean))];
  };
  const getStatusFuncionarios = () => {
    return [...new Set(funcionarios.map(f => f.statusFuncionario).filter(Boolean))];
  };
  const getStatusSetores = () => ['SOLICITAÇÃO CONCLUÍDA', 'ATENDER TAREFAS', 'EM_ANDAMENTO', 'SEM_TAREFAS'];
  const getStatusGeralOptions = () => ['COMPLETO', 'ATENDER TAREFAS', 'EM_ANDAMENTO', 'SEM_TAREFAS'];

  const limparFiltros = () => {
    setSearchTerm('');
    setFiltroContratoOrigem('');
    setFiltroContratoDestino('');
    setFiltroStatusTarefas('');
    setFiltroStatusPrestserv('');
    setFiltroStatusFuncionario('');
    setFiltroRH('');
    setFiltroMedicina('');
    setFiltroTreinamento('');
    setFiltroGeral('');
  };

  const temFiltrosAtivos = () => {
    return searchTerm || filtroContratoOrigem || filtroContratoDestino ||
      filtroStatusTarefas || filtroStatusPrestserv || filtroStatusFuncionario ||
      filtroRH || filtroMedicina || filtroTreinamento || filtroGeral;
  };

  const exportarParaExcel = () => {
    // Implementação do export para Excel
    showToast('Exportação em desenvolvimento', 'warning');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Erro ao carregar dados</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Matriz de Status</h1>
          <p className="text-gray-600 text-sm">Visão em matriz dos status por setor</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Legenda Compacta */}
          <div className="flex items-center space-x-4 px-3 py-1 bg-gray-50 rounded-md border border-gray-200">
            <div className="flex items-center space-x-1">
              <CheckCircleIcon className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-600">Atendido</span>
            </div>
            <div className="flex items-center space-x-1">
              <XCircleIcon className="w-3 h-3 text-red-600" />
              <span className="text-xs text-gray-600">Pendente</span>
            </div>
            <div className="flex items-center space-x-1">
              <ClockIcon className="w-3 h-3 text-blue-500" />
              <span className="text-xs text-gray-600">Em andamento</span>
            </div>
            <div className="flex items-center space-x-1">
              <ExclamationTriangleIcon className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-gray-600">Sem tarefas</span>
            </div>
          </div>
          <button
            onClick={exportarParaExcel}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Busca */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>

          {/* Filtro Geral */}
          <div>
            <select
              value={filtroGeral}
              onChange={(e) => setFiltroGeral(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Status Geral</option>
              {getStatusGeralOptions().map(status => (
                <option key={status} value={status}>
                  {status === 'COMPLETO' ? '✅ Completo' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   status === 'EM_ANDAMENTO' ? '⏳ Em andamento' :
                   '⚠️ Sem tarefas'}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Contrato Origem */}
          <div>
            <select
              value={filtroContratoOrigem}
              onChange={(e) => setFiltroContratoOrigem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Contrato Origem</option>
              {getContratosOrigem().map(contrato => (
                <option key={contrato} value={contrato}>{contrato}</option>
              ))}
            </select>
          </div>

          {/* Filtro Contrato Destino */}
          <div>
            <select
              value={filtroContratoDestino}
              onChange={(e) => setFiltroContratoDestino(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Contrato Destino</option>
              {getContratosDestino().map(contrato => (
                <option key={contrato} value={contrato}>{contrato}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status Tarefas (Logística) */}
          <div>
            <select
              value={filtroStatusTarefas}
              onChange={(e) => setFiltroStatusTarefas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Aprovada pela Logística?</option>
              {getStatusTarefas().map(status => (
                <option key={status} value={status}>
                  {status === 'ATENDIDO' ? '✅ Atendido' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   '⏳ Em andamento'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Segunda linha de filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mt-4">
          {/* Filtro RH */}
          <div>
            <select
              value={filtroRH}
              onChange={(e) => setFiltroRH(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Status RH</option>
              {getStatusSetores().map(status => (
                <option key={status} value={status}>
                  {status === 'ATENDIDO' ? '✅ Atendido' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   status === 'EM_ANDAMENTO' ? '⏳ Em andamento' :
                   '⚠️ Sem tarefas'}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Medicina */}
          <div>
            <select
              value={filtroMedicina}
              onChange={(e) => setFiltroMedicina(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Status Medicina</option>
              {getStatusSetores().map(status => (
                <option key={status} value={status}>
                  {status === 'ATENDIDO' ? '✅ Atendido' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   status === 'EM_ANDAMENTO' ? '⏳ Em andamento' :
                   '⚠️ Sem tarefas'}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Treinamento */}
          <div>
            <select
              value={filtroTreinamento}
              onChange={(e) => setFiltroTreinamento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Status Treinamento</option>
              {getStatusSetores().map(status => (
                <option key={status} value={status}>
                  {status === 'ATENDIDO' ? '✅ Atendido' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   status === 'EM_ANDAMENTO' ? '⏳ Em andamento' :
                   '⚠️ Sem tarefas'}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Status Funcionário */}
          <div>
            <select
              value={filtroStatusFuncionario}
              onChange={(e) => setFiltroStatusFuncionario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Desligado do Contrato Anterior?</option>
              {getStatusFuncionarios().map(status => (
                <option key={status} value={status}>
                  {status === 'ATENDIDO' ? '✅ Atendido' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   '⏳ Em andamento'}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Status Prestserv */}
          <div>
            <select
              value={filtroStatusPrestserv}
              onChange={(e) => setFiltroStatusPrestserv(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="">Aprovado no Prestserv</option>
              {getStatusPrestserv().map(status => (
                <option key={status} value={status}>
                  {status === 'ATENDIDO' ? '✅ Atendido' : 
                   status === 'PENDENTE' ? '❌ Pendente' : 
                   '⏳ Em andamento'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botão Limpar Filtros */}
        {temFiltrosAtivos() && (
          <div className="mt-4">
            <button
              onClick={limparFiltros}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Tabela Matriz de Status */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-16">
                  Nº
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider w-40">
                  Funcionário
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-24">
                  De → Para
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-28">
                  Solicitação Aprovada pela Logística?
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-20">
                  Tarefas RH
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-24">
                  Tarefas Medicina
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-28">
                Tarefas Treinamento
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-28">
                  Desligado do Contrato Anterior?
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-28">
                  Aprovado no Prestserv
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider w-32">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {funcionariosFiltrados.map((funcionario, index) => (
                <tr key={funcionario.id} className={`group hover:bg-blue-50 hover:border-l-4 hover:border-l-blue-400 transition-all duration-300 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-4 text-xs text-gray-700 font-mono text-center" title={`Solicitação ID: ${funcionario.solicitacaoId}`}>
                    {funcionario.solicitacaoId}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900" title={`${funcionario.nome} - Matrícula: ${funcionario.matricula} - Função: ${funcionario.funcao}`}>
                    <div>
                      <div className="font-medium">{funcionario.nome}</div>
                      <div className="text-xs text-gray-500">{funcionario.matricula} • {funcionario.funcao}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-xs text-gray-700">
                      <div className="font-medium">{funcionario.contratoOrigem}</div>
                      <div className="text-gray-500">→</div>
                      <div className="font-medium">{funcionario.contratoDestino}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center h-8">
                      {getStatusIcon(funcionario.statusTarefas)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center h-8">
                      {getSetorStatusIcon(funcionario.progressoPorSetor.find(p => p.setor === 'RH') || { setor: 'RH', total: 0, concluidas: 0, percentual: 0 })}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center h-8">
                      {getSetorStatusIcon(funcionario.progressoPorSetor.find(p => p.setor === 'MEDICINA') || { setor: 'MEDICINA', total: 0, concluidas: 0, percentual: 0 })}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center h-8">
                      {getSetorStatusIcon(funcionario.progressoPorSetor.find(p => p.setor === 'TREINAMENTO') || { setor: 'TREINAMENTO', total: 0, concluidas: 0, percentual: 0 })}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center h-8">
                      {getStatusIcon(funcionario.statusFuncionario)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center h-8">
                      {getStatusIcon(funcionario.statusPrestserv)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center items-center">
                      <button
                        onClick={() => router.push(`/prestserv/funcionario/${funcionario.id}`)}
                        className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                        title="Ver detalhes da solicitação"
                      >
                        <EyeIcon className="w-3 h-3 mr-1" />
                        Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {funcionariosFiltrados.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <p className="text-base">📭 Nenhum funcionário encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
            </div>
          </div>
        )}
      </div>





      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
            'bg-yellow-500 text-white'
          }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}