'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { RemanejamentoFuncionario } from '@/types/remanejamento-funcionario';
import * as XLSX from 'xlsx';

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
  solicitacaoId: string;
  contratoOrigem: string;
  contratoDestino: string;
  totalTarefas: number;
  tarefasConcluidas: number;
  dataSolicitacao: string;
  progressoPorSetor: ProgressoPorSetor[];
}

export default function FuncionariosPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [funcionarios, setFuncionarios] = useState<FuncionarioTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroContratoOrigem, setFiltroContratoOrigem] = useState<string>('');
  const [filtroContratoDestino, setFiltroContratoDestino] = useState<string>('');
  const [filtroStatusGeral, setFiltroStatusGeral] = useState<string>('');
  const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(10);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  const updatePrestservStatus = async (funcionarioId: string, novoStatus: string) => {
    try {
      setUpdatingStatus(funcionarioId);
      
      // Buscar dados do funcionário para notificação
      const funcionario = funcionarios.find(f => f.id === funcionarioId);
      if (!funcionario) {
        throw new Error('Funcionário não encontrado');
      }
      
      const response = await fetch(`/api/logistica/funcionario/${funcionarioId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statusPrestserv: novoStatus }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      // Atualizar o estado local
      setFuncionarios(prev => prev.map(func => 
        func.id === funcionarioId 
          ? { ...func, statusPrestserv: novoStatus }
          : func
      ));
      
      // Notificar funcionário sobre mudança de status
      const statusMessages = {
        'PENDENTE': 'Status alterado para Pendente',
        'CRIADO': 'Rascunho do Prestserv foi criado',
        'SUBMETIDO': 'Prestserv foi submetido para aprovação',
        'APROVADO': 'Prestserv foi aprovado! ✅',
        'REJEITADO': 'Prestserv foi rejeitado. Verifique as observações e corrija as pendências.'
      };
      
      const message = statusMessages[novoStatus as keyof typeof statusMessages] || 'Status atualizado';
      
      // Simular notificação ao funcionário (aqui você pode integrar com sistema de notificações real)
      console.log(`📧 Notificação enviada para ${funcionario.nome} (${funcionario.matricula}): ${message}`);
      
      showToast(`Status atualizado com sucesso! Funcionário ${funcionario.nome} foi notificado.`, 'success');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      showToast('Erro ao atualizar status. Tente novamente.', 'error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const canUpdateStatus = (funcionario: FuncionarioTableData, novoStatus: string) => {
    const statusAtual = funcionario.statusPrestserv;
    
    // Só pode submeter se as tarefas estiverem concluídas
    if (novoStatus === 'SUBMETIDO' && funcionario.statusTarefas !== 'CONCLUIDO') {
      return false;
    }
    
    // APROVADO e REJEITADO só podem acontecer após SUBMETIDO
    if ((novoStatus === 'APROVADO' || novoStatus === 'REJEITADO') && 
        statusAtual !== 'SUBMETIDO' && statusAtual !== 'APROVADO' && statusAtual !== 'REJEITADO') {
      return false;
    }
    
    return true;
  };

  const podeSubmeterPrestserv = (funcionario: FuncionarioTableData): boolean => {
    return funcionario.statusTarefas === 'CONCLUIDO' && (funcionario.statusPrestserv === 'CRIADO' || funcionario.statusPrestserv === 'REJEITADO');
  };

  const getValidStatusOptions = (funcionario: FuncionarioTableData): string[] => {
    const currentStatus = funcionario.statusPrestserv;
    const options: string[] = [];
    
    // Sempre incluir o status atual
    options.push(currentStatus);
    
    // Lógica de transições válidas baseada na página individual
    switch (currentStatus) {
      case 'PENDENTE':
        options.push('CRIADO'); // Criar rascunho
        break;
      case 'CRIADO':
        if (podeSubmeterPrestserv(funcionario)) {
          options.push('SUBMETIDO'); // Submeter para aprovação
        }
        break;
      case 'REJEITADO':
        if (podeSubmeterPrestserv(funcionario)) {
          options.push('SUBMETIDO'); // Submeter novamente
        }
        break;
      case 'SUBMETIDO':
        options.push('APROVADO'); // Aprovar
        options.push('REJEITADO'); // Rejeitar
        break;
      case 'APROVADO':
        // Status final, não permite mudanças
        break;
    }
    
    return [...new Set(options)]; // Remove duplicatas
  };

  const fetchFuncionarios = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logistica/remanejamentos');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar funcionários');
      }
      
      const data = await response.json();
      
      // Transformar dados para formato de tabela
      const funcionariosTable: FuncionarioTableData[] = [];
      
      data.forEach((solicitacao: any) => {
        solicitacao.funcionarios.forEach((func: RemanejamentoFuncionario) => {
          // Calcular progresso por setor
          const tarefasPorSetor: { [key: string]: { total: number; concluidas: number } } = {};
          
          func.tarefas?.forEach((tarefa: any) => {
            const setor = tarefa.responsavel || 'Outros';
            if (!tarefasPorSetor[setor]) {
              tarefasPorSetor[setor] = { total: 0, concluidas: 0 };
            }
            tarefasPorSetor[setor].total++;
            if (tarefa.status === 'CONCLUIDO') {
              tarefasPorSetor[setor].concluidas++;
            }
          });

          const progressoPorSetor: ProgressoPorSetor[] = Object.entries(tarefasPorSetor).map(([setor, dados]) => ({
            setor,
            total: dados.total,
            concluidas: dados.concluidas,
            percentual: dados.total > 0 ? (dados.concluidas / dados.total) * 100 : 0
          }));

          funcionariosTable.push({
            id: func.id,
            nome: func.funcionario?.nome || 'Nome não informado',
            matricula: func.funcionario?.matricula || 'Matrícula não informada',
            funcao: func.funcionario?.funcao || 'Não informado',
            statusTarefas: func.statusTarefas,
            statusPrestserv: func.statusPrestserv,
            solicitacaoId: solicitacao.id,
            contratoOrigem: solicitacao.contratoOrigem?.nome || 'N/A',
            contratoDestino: solicitacao.contratoDestino?.nome || 'N/A',
            totalTarefas: func.tarefas?.length || 0,
            tarefasConcluidas: func.tarefas?.filter((t: any) => t.status === 'CONCLUIDO').length || 0,
            dataSolicitacao: new Date(solicitacao.dataSolicitacao).toLocaleDateString('pt-BR'),
            progressoPorSetor
          });
        });
      });
      
      setFuncionarios(funcionariosTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const funcionariosFiltrados = funcionarios.filter(func => {
    const matchStatus = filtroStatus === 'TODOS' || func.statusTarefas === filtroStatus || func.statusPrestserv === filtroStatus;
    const matchNome = (func.nome?.toLowerCase() || '').includes(filtroNome.toLowerCase()) || 
                     (func.matricula || '').includes(filtroNome);
    const matchContratoOrigem = !filtroContratoOrigem || func.contratoOrigem === filtroContratoOrigem;
    const matchContratoDestino = !filtroContratoDestino || func.contratoDestino === filtroContratoDestino;
    const matchStatusGeral = !filtroStatusGeral || func.statusTarefas === filtroStatusGeral || func.statusPrestserv === filtroStatusGeral;
    // Filtrar por setores selecionados (se nenhum selecionado, mostra todos)
    const matchSetor = setoresSelecionados.length === 0 || func.progressoPorSetor?.some(progresso => setoresSelecionados.includes(progresso.setor));
    return matchStatus && matchNome && matchContratoOrigem && matchContratoDestino && matchStatusGeral && matchSetor;
  });

  // Paginação
  const totalPaginas = Math.ceil(funcionariosFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const funcionariosPaginados = funcionariosFiltrados.slice(indiceInicio, indiceFim);

  // Reset página quando filtros mudam
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroStatus, filtroNome, filtroContratoOrigem, filtroContratoDestino, filtroStatusGeral, setoresSelecionados]);

  // Calcular estatísticas gerais por setor
  const estatisticasPorSetor = () => {
    const setores: { [key: string]: { total: number; concluidas: number; funcionarios: Set<string> } } = {};
    
    funcionarios.forEach(func => {
      func.progressoPorSetor.forEach(progresso => {
        if (!setores[progresso.setor]) {
          setores[progresso.setor] = { total: 0, concluidas: 0, funcionarios: new Set() };
        }
        setores[progresso.setor].total += progresso.total;
        setores[progresso.setor].concluidas += progresso.concluidas;
        setores[progresso.setor].funcionarios.add(func.id);
      });
    });

    return Object.entries(setores).map(([setor, dados]) => ({
      setor,
      total: dados.total,
      concluidas: dados.concluidas,
      percentual: dados.total > 0 ? (dados.concluidas / dados.total) * 100 : 0,
      funcionarios: dados.funcionarios.size
    })).sort((a, b) => a.setor.localeCompare(b.setor));
  };

  const calcularProgresso = (concluidas: number, total: number) => {
    if (total === 0) return 0;
    return (concluidas / total) * 100;
  };

  const getSetorIcon = (setor: string) => {
    switch (setor.toUpperCase()) {
      case 'RH': return '👥';
      case 'MEDICINA': return '🏥';
      case 'LOGISTICA': return '📦';
      case 'TREINAMENTO': return '📚';
      default: return '📋';
    }
  };

  const getSetorColor = (percentual: number) => {
    if (percentual === 100) return 'bg-green-500';
    if (percentual >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getContratosOrigem = () => {
    const contratos = new Set(funcionarios.map(f => f.contratoOrigem).filter(Boolean));
    return Array.from(contratos).sort();
  };

  const getContratosDestino = () => {
    const contratos = new Set(funcionarios.map(f => f.contratoDestino).filter(Boolean));
    return Array.from(contratos).sort();
  };

  const getStatusGerais = () => {
    const statuses = new Set();
    funcionarios.forEach(f => {
      if (f.statusTarefas) statuses.add(f.statusTarefas);
      if (f.statusPrestserv) statuses.add(f.statusPrestserv);
    });
    return Array.from(statuses).sort();
  };

  const limparFiltros = () => {
    setFiltroStatus('TODOS');
    setFiltroNome('');
    setFiltroContratoOrigem('');
    setFiltroContratoDestino('');
    setFiltroStatusGeral('');
    setSetoresSelecionados([]);
  };

  const temFiltrosAtivos = () => {
    return filtroStatus !== 'TODOS' || filtroNome || filtroContratoOrigem || 
           filtroContratoDestino || filtroStatusGeral || setoresSelecionados.length > 0;
  };

  const exportarParaExcel = () => {
    try {
      // Identificar todos os setores únicos
      const setoresUnicos = new Set<string>();
      funcionariosFiltrados.forEach(funcionario => {
        funcionario.progressoPorSetor.forEach(progresso => {
          setoresUnicos.add(progresso.setor);
        });
      });
      const setoresOrdenados = Array.from(setoresUnicos).sort();
      
      // Preparar dados para exportação
      const dadosParaExportar = funcionariosFiltrados.map(funcionario => {
        // Calcular progresso geral
        const progressoGeral = funcionario.totalTarefas > 0 
          ? ((funcionario.tarefasConcluidas / funcionario.totalTarefas) * 100).toFixed(1)
          : '0';
        
        // Criar objeto base
        const dadosFuncionario: any = {
          'Nome': funcionario.nome,
          'Matrícula': funcionario.matricula,
          'Função': funcionario.funcao,
          'Status Tarefas': funcionario.statusTarefas,
          'Status Prestserv': funcionario.statusPrestserv,
          'Progresso Geral': `${funcionario.tarefasConcluidas}/${funcionario.totalTarefas} (${progressoGeral}%)`,
        };
        
        // Adicionar colunas para cada setor
        setoresOrdenados.forEach(setor => {
          const progressoSetor = funcionario.progressoPorSetor.find(p => p.setor === setor);
          if (progressoSetor) {
            dadosFuncionario[`${setor} - Tarefas`] = `${progressoSetor.concluidas}/${progressoSetor.total}`;
            dadosFuncionario[`${setor} - %`] = `${progressoSetor.percentual.toFixed(1)}%`;
          } else {
            dadosFuncionario[`${setor} - Tarefas`] = '0/0';
            dadosFuncionario[`${setor} - %`] = '0%';
          }
        });
        
        // Adicionar informações de contrato e data
        dadosFuncionario['Contrato Origem'] = funcionario.contratoOrigem;
        dadosFuncionario['Contrato Destino'] = funcionario.contratoDestino;
        dadosFuncionario['Data Solicitação'] = funcionario.dataSolicitacao;
        
        return dadosFuncionario;
      });
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      
      // Ajustar largura das colunas dinamicamente
      const colWidths = [
        { wch: 25 }, // Nome
        { wch: 15 }, // Matrícula
        { wch: 20 }, // Função
        { wch: 15 }, // Status Tarefas
        { wch: 15 }, // Status Prestserv
        { wch: 20 }, // Progresso Geral
      ];
      
      // Adicionar larguras para colunas de setores
      setoresOrdenados.forEach(() => {
        colWidths.push({ wch: 15 }); // Setor - Tarefas
        colWidths.push({ wch: 10 }); // Setor - %
      });
      
      // Adicionar larguras para colunas finais
      colWidths.push(
        { wch: 20 }, // Contrato Origem
        { wch: 20 }, // Contrato Destino
        { wch: 15 }  // Data Solicitação
      );
      
      ws['!cols'] = colWidths;
      
      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Funcionários');
      
      // Gerar nome do arquivo com data atual
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `funcionarios-prestserv-${dataAtual}.xlsx`;
      
      // Fazer download do arquivo
      XLSX.writeFile(wb, nomeArquivo);
      
      showToast(`Arquivo ${nomeArquivo} exportado com sucesso!`, 'success');
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      showToast('Erro ao exportar arquivo. Tente novamente.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">👥 Visão Nominal - Funcionários</h1>
            <p className="text-gray-600 text-sm">Visualização completa de todos os funcionários em remanejamento</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Total: {funcionariosFiltrados.length} funcionários | Página {paginaAtual} de {totalPaginas}
            </div>
            <button
              onClick={exportarParaExcel}
              disabled={funcionariosFiltrados.length === 0}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Exportar dados filtrados para Excel"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Estatísticas por Setor */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {estatisticasPorSetor().filter(est => ['RH', 'MEDICINA', 'TREINAMENTO'].includes(est.setor)).map((estatistica) => (
            <div 
              key={estatistica.setor} 
              onClick={() => {
                setSetoresSelecionados(prev => 
                  prev.includes(estatistica.setor)
                    ? prev.filter(s => s !== estatistica.setor)
                    : [...prev, estatistica.setor]
                );
              }}
              className={`cursor-pointer transition-all duration-200 rounded-lg p-3 border-2 hover:shadow-md transform hover:scale-102 ${
                setoresSelecionados.includes(estatistica.setor)
                  ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-400 shadow-md' 
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <span className="text-base">{getSetorIcon(estatistica.setor)}</span>
                  <h3 className="font-semibold text-gray-900 text-sm">{estatistica.setor}</h3>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {estatistica.funcionarios} func.
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Progresso:</span>
                  <span className="font-medium">{estatistica.concluidas}/{estatistica.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      getSetorColor(estatistica.percentual)
                    }`}
                    style={{
                      width: `${estatistica.percentual}%`
                    }}
                  ></div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${
                    estatistica.percentual === 100 ? 'text-green-600' :
                    estatistica.percentual >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {estatistica.percentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">🔍 Filtros</h3>
            {temFiltrosAtivos() && (
              <button
                onClick={limparFiltros}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              {/* Campo de busca com mais espaço */}
              <div className="lg:col-span-2">
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Buscar por nome ou matrícula..."
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              
              {/* Filtro de Contrato de Origem */}
              <div>
                <select
                  value={filtroContratoOrigem}
                  onChange={(e) => setFiltroContratoOrigem(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                >
                  <option value="">Contrato Origem</option>
                  {getContratosOrigem().map(contrato => (
                    <option key={contrato} value={contrato}>{contrato}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Contrato de Destino */}
              <div>
                <select
                  value={filtroContratoDestino}
                  onChange={(e) => setFiltroContratoDestino(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                >
                  <option value="">Contrato Destino</option>
                  {getContratosDestino().map(contrato => (
                    <option key={contrato} value={contrato}>{contrato}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Status Geral */}
              <div>
                <select
                  value={filtroStatusGeral}
                  onChange={(e) => setFiltroStatusGeral(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                >
                  <option value="">Status Geral</option>
                  {getStatusGerais().map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              {/* Filtro de Status (mantido para compatibilidade) */}
              <div>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                >
                  <option value="TODOS">Todos Status</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="CRIADO">Criado</option>
                  <option value="SUBMETIDO">Submetido</option>
                  <option value="APROVADO">Aprovado</option>
                  <option value="REJEITADO">Rejeitado</option>
                </select>
              </div>
            </div>
            
            {/* Informação sobre setores selecionados */}
            {setoresSelecionados.length > 0 && (
              <div className="flex items-center text-sm text-gray-600 mt-2">
                📍 {setoresSelecionados.length} setor(es) selecionado(s)
              </div>
            )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funcionário
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status Geral
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progresso por Setor
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status Prestserv
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contratos
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {funcionariosPaginados.map((funcionario) => (
                <tr key={funcionario.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700">
                             {(funcionario.nome || 'N/A').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                           </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{funcionario.nome}</div>
                        <div className="text-xs text-gray-500">Mat: {funcionario.matricula}</div>
                        <div className="text-xs text-gray-400">{funcionario.funcao}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      funcionario.statusTarefas === 'CONCLUIDO' ? 'bg-green-100 text-green-800' :
                      funcionario.statusTarefas === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {funcionario.statusTarefas}
                    </span>
                    <div className="mt-1 text-xs text-gray-500">
                      {funcionario.tarefasConcluidas}/{funcionario.totalTarefas} tarefas
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2 min-w-[200px]">
                      {funcionario.progressoPorSetor.map((progresso) => (
                        <div key={progresso.setor} className="flex flex-col space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs">{getSetorIcon(progresso.setor)}</span>
                              <span className="text-xs font-medium text-gray-700">{progresso.setor}</span>
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              {progresso.percentual.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                getSetorColor(progresso.percentual)
                              }`}
                              style={{ width: `${progresso.percentual}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <select
                          value={funcionario.statusPrestserv}
                          onChange={(e) => {
                            const novoStatus = e.target.value;
                            const statusAtual = funcionario.statusPrestserv;
                            
                            // Se não mudou o status, não faz nada
                            if (novoStatus === statusAtual) {
                              return;
                            }
                            
                            // Validações específicas baseadas na página individual
                            if (novoStatus === 'CRIADO' && statusAtual !== 'PENDENTE') {
                              showToast('Só é possível criar rascunho quando o status está PENDENTE', 'warning');
                              e.target.value = statusAtual;
                              return;
                            }
                            
                            if (novoStatus === 'SUBMETIDO') {
                              if (statusAtual !== 'CRIADO' && statusAtual !== 'REJEITADO') {
                                showToast('Só é possível submeter quando o rascunho foi criado ou rejeitado', 'warning');
                                e.target.value = statusAtual;
                                return;
                              }
                              if (!podeSubmeterPrestserv(funcionario)) {
                                showToast('Todas as tarefas devem estar concluídas antes de submeter', 'warning');
                                e.target.value = statusAtual;
                                return;
                              }
                            }
                            
                            if ((novoStatus === 'APROVADO' || novoStatus === 'REJEITADO') && statusAtual !== 'SUBMETIDO') {
                              showToast('Só é possível aprovar/rejeitar quando o prestserv foi submetido', 'warning');
                              e.target.value = statusAtual;
                              return;
                            }
                            
                            // Se passou por todas as validações, atualiza o status
                            updatePrestservStatus(funcionario.id, novoStatus);
                          }}
                          disabled={updatingStatus === funcionario.id}
                          className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            funcionario.statusPrestserv === 'APROVADO' ? 'bg-green-100 text-green-800' :
                            funcionario.statusPrestserv === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' :
                            funcionario.statusPrestserv === 'REJEITADO' ? 'bg-red-100 text-red-800' :
                            funcionario.statusPrestserv === 'CRIADO' ? 'bg-blue-100 text-blue-800' :
                            funcionario.statusPrestserv === 'SUBMETIDO' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getValidStatusOptions(funcionario).map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        {funcionario.statusPrestserv === 'REJEITADO' && (
                          <span className="text-red-500 text-sm animate-pulse" title="Status Rejeitado - Atenção Necessária">
                            🚨
                          </span>
                        )}
                        {updatingStatus === funcionario.id && (
                          <span className="text-blue-500 text-xs">
                            ⏳
                          </span>
                        )}
                      </div>
                      
                      {/* Indicadores de status */}
                      {funcionario.statusTarefas === 'PENDENTE' && (
                        <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                          ⚠️ Aguardando conclusão das tarefas
                        </div>
                      )}
                      
                      {podeSubmeterPrestserv(funcionario) && (
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                          ✅ Apto para submissão
                        </div>
                      )}
                      
                      {funcionario.statusPrestserv === 'REJEITADO' && (
                        <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                          ❌ Rejeitado - Corrija pendências
                        </div>
                      )}
                      
                      {funcionario.statusPrestserv === 'APROVADO' && (
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                          ✅ Prestserv Aprovado
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-0.5">
                      <div className="text-xs">
                        <span className="font-medium">De:</span> {funcionario.contratoOrigem}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Para:</span> {funcionario.contratoDestino}
                      </div>
                      <div className="text-xs text-gray-500">
                        {funcionario.dataSolicitacao}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => router.push(`/prestserv/funcionario/${funcionario.id}`)}
                      className="text-blue-600 hover:text-blue-900 transition-colors text-xs"
                    >
                      Ver Detalhes
                    </button>
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
        
        {/* Controles de Paginação */}
        {totalPaginas > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
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
                Próxima
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{indiceInicio + 1}</span> até{' '}
                  <span className="font-medium">{Math.min(indiceFim, funcionariosFiltrados.length)}</span> de{' '}
                  <span className="font-medium">{funcionariosFiltrados.length}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPaginas <= 7) return true;
                      if (page === 1 || page === totalPaginas) return true;
                      if (page >= paginaAtual - 1 && page <= paginaAtual + 1) return true;
                      return false;
                    })
                    .map((page, index, array) => {
                      const showEllipsis = index > 0 && page - array[index - 1] > 1;
                      return (
                        <div key={page} className="flex">
                          {showEllipsis && (
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                              ...
                            </span>
                          )}
                          <button
                            onClick={() => setPaginaAtual(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === paginaAtual
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                  <button
                    onClick={() => setPaginaAtual(Math.min(totalPaginas, paginaAtual + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}