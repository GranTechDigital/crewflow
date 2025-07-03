'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  UserGroupIcon,
  UsersIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserIcon,
  UserPlusIcon,
  IdentificationIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowLongRightIcon,
  ArrowLeftIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useToast } from '@/components/Toast';

interface Contrato {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  centroDeCusto: string;
}

interface Funcionario {
  id: string;
  nome: string;
  centroCusto: string;
  funcao?: string;
  status?: string;
  dataAdmissao?: string;
  contratoId?: number;
}

interface FuncionarioSelecionado {
  id: number;
  nome: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  status: string | null;
  selecionado: boolean;
}



interface ResumoRemanejamento {
  totalSelecionados: number;
  porFuncao: Record<string, number>;
  funcionarios: Funcionario[];
  origem: {
    contrato?: string;
  };
  destino: {
    contrato: string;
  };
}

export default function NovoRemanejamentoLogisticaPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  // Estados de dados
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosNovos, setFuncionariosNovos] = useState<Funcionario[]>([]);
  const [funcionariosEmProcessoAtivo, setFuncionariosEmProcessoAtivo] = useState<Set<number>>(new Set());
  const [funcionariosComHistorico, setFuncionariosComHistorico] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Estados principais
  const [tipoRemanejamento, setTipoRemanejamento] = useState<'entre_contratos' | 'funcionarios_novos'>('entre_contratos');
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<FuncionarioSelecionado[]>([]);
  const [contratoOrigem, setContratoOrigem] = useState<Contrato | null>(null);
  const [contratoDestino, setContratoDestino] = useState<Contrato | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [submitting, setSubmitting] = useState(false);
  const [mostrarFuncionarios, setMostrarFuncionarios] = useState(false);
  
  // Estados de filtros
  const [filtroFuncao, setFiltroFuncao] = useState('');
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [buscaNome, setBuscaNome] = useState('');
  const [etapaAtual, setEtapaAtual] = useState<'tipo' | 'selecao' | 'confirmacao'>('tipo');

  // Carregar dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [funcionariosRes, contratosRes, remanejamentosAtivosRes, remanejamentosHistoricoRes] = await Promise.all([
          fetch('/api/funcionarios'),
          fetch('/api/contratos'),
          fetch('/api/logistica/remanejamentos?status=PENDENTE,APROVADO,EM_ANDAMENTO'),
          fetch('/api/logistica/remanejamentos')
        ]);

        if (funcionariosRes.ok) {
          const funcionariosData = await funcionariosRes.json();
          
          // Separar funcionários com e sem contrato
          const funcionariosComContrato = funcionariosData.filter((f: Funcionario) => f.contratoId);
          const funcionariosSemContrato = funcionariosData.filter((f: Funcionario) => !f.contratoId);
          
          setFuncionarios(funcionariosComContrato);
          setFuncionariosNovos(funcionariosSemContrato);
        }

        if (contratosRes.ok) {
          const contratosData = await contratosRes.json();
          setContratos(contratosData);
        }

        // Processar todos os remanejamentos para encontrar o status mais recente de cada funcionário
        if (remanejamentosHistoricoRes.ok) {
          const todosRemanejamentos = await remanejamentosHistoricoRes.json();
          
          // Mapear o processo mais recente de cada funcionário
          const funcionarioProcessoMaisRecente = new Map<number, any>();
          const funcionariosComQualquerHistorico = new Set<number>();
          
          // Ordenar remanejamentos por data (mais recente primeiro)
          const remanejamentosOrdenados = todosRemanejamentos.sort((a: any, b: any) => 
            new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime()
          );
          
          remanejamentosOrdenados.forEach((rem: any) => {
            if (rem.funcionarios && Array.isArray(rem.funcionarios)) {
              rem.funcionarios.forEach((remFunc: any) => {
                if (remFunc.funcionarioId) {
                  const funcionarioId = remFunc.funcionarioId;
                  
                  // Adicionar ao histórico geral
                  funcionariosComQualquerHistorico.add(funcionarioId);
                  
                  // Se ainda não temos o processo mais recente deste funcionário, armazenar
                  if (!funcionarioProcessoMaisRecente.has(funcionarioId)) {
                    // Verificar o status específico do funcionário, não da solicitação geral
                    const statusFuncionario = remFunc.statusTarefas || remFunc.statusPrestserv || 'PENDENTE';
                    const isAtivo = ['PENDENTE', 'EM_ANDAMENTO', 'APROVADO'].includes(statusFuncionario) || 
                                   ['PENDENTE', 'APROVADO', 'EM_ANDAMENTO'].includes(rem.status);
                    
                    funcionarioProcessoMaisRecente.set(funcionarioId, {
                      status: rem.status,
                      statusFuncionario: statusFuncionario,
                      isAtivo: isAtivo,
                      dataSolicitacao: rem.dataSolicitacao,
                      solicitacaoId: rem.id
                    });
                  }
                }
              });
            }
          });
          
          // Identificar funcionários com processo ativo (mais recente em andamento)
          const funcionariosComProcessoAtivo = new Set<number>();
          funcionarioProcessoMaisRecente.forEach((processo, funcionarioId) => {
            if (processo.isAtivo) {
              funcionariosComProcessoAtivo.add(funcionarioId);
            }
          });
           setFuncionariosEmProcessoAtivo(funcionariosComProcessoAtivo);
           setFuncionariosComHistorico(funcionariosComQualquerHistorico);
        }
        
        // Processar remanejamentos ativos separadamente (mantido para compatibilidade)
        if (remanejamentosAtivosRes.ok) {
          // Esta chamada agora é redundante, mas mantida para não quebrar outras partes
          // A lógica principal agora está no processamento acima
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Contratos únicos
  const contratosUnicos = useMemo(() => {
    const contratoMap = contratos.reduce((acc, contrato) => {
      if (!acc[contrato.id]) {
        acc[contrato.id] = contrato;
      }
      return acc;
    }, {} as Record<string, Contrato>);
    return Object.values(contratoMap);
  }, [contratos]);

  // Funcionários disponíveis baseado no tipo de remanejamento
  const funcionariosDisponiveis = useMemo(() => {
    const listaFuncionarios = tipoRemanejamento === 'entre_contratos' ? funcionarios : funcionariosNovos;
    
    return listaFuncionarios
      .filter(f => {
        const funcionarioId = parseInt(f.id);
        
        // Para remanejamento entre contratos, filtrar por contrato de origem
        if (tipoRemanejamento === 'entre_contratos' && contratoOrigem && f.contratoId !== contratoOrigem.id) return false;
        
        // Lógica específica por tipo de remanejamento
        if (tipoRemanejamento === 'funcionarios_novos') {
          // Funcionários novos: nunca tiveram contrato E nunca foram remanejados
          if (funcionariosComHistorico.has(funcionarioId)) return false;
        } else if (tipoRemanejamento === 'entre_contratos') {
          // Entre contratos: podem ser remanejados, mas não podem estar em processo ativo
          if (funcionariosEmProcessoAtivo.has(funcionarioId)) return false;
        }
        
        // Filtros comuns
        if (filtroFuncao && f.funcao !== filtroFuncao) return false;
        if (filtroCentroCusto && f.centroCusto !== filtroCentroCusto) return false;
        if (filtroStatus && f.status !== filtroStatus) return false;
        if (buscaNome && !f.nome.toLowerCase().includes(buscaNome.toLowerCase())) return false;
        if (funcionariosSelecionados.some(fs => fs.id === funcionarioId)) return false;
        
        return true;
      })
      .map(f => ({
        id: parseInt(f.id),
        nome: f.nome,
        matricula: f.id,
        funcao: f.funcao || null,
        centroCusto: f.centroCusto || null,
        status: f.status || null,
        selecionado: false
      }));
  }, [funcionarios, funcionariosNovos, tipoRemanejamento, contratoOrigem, filtroFuncao, filtroCentroCusto, filtroStatus, buscaNome, funcionariosSelecionados, funcionariosEmProcessoAtivo, funcionariosComHistorico]);

  // Listas disponíveis para filtros
  const funcoesDisponiveis = useMemo(() => {
    const listaFuncionarios = tipoRemanejamento === 'entre_contratos' ? funcionarios : funcionariosNovos;
    const funcionariosFiltrados = (tipoRemanejamento === 'entre_contratos' && contratoOrigem)
      ? listaFuncionarios.filter(f => f.contratoId === contratoOrigem.id)
      : listaFuncionarios;
    return [...new Set(funcionariosFiltrados.map(f => f.funcao).filter(Boolean))];
  }, [funcionarios, funcionariosNovos, tipoRemanejamento, contratoOrigem]);

  const centrosCustoDisponiveis = useMemo(() => {
    const listaFuncionarios = tipoRemanejamento === 'entre_contratos' ? funcionarios : funcionariosNovos;
    const funcionariosFiltrados = (tipoRemanejamento === 'entre_contratos' && contratoOrigem)
      ? listaFuncionarios.filter(f => f.contratoId === contratoOrigem.id)
      : listaFuncionarios;
    return [...new Set(funcionariosFiltrados.map(f => f.centroCusto).filter(Boolean))];
  }, [funcionarios, funcionariosNovos, tipoRemanejamento, contratoOrigem]);

  const statusDisponiveis = useMemo(() => {
    const listaFuncionarios = tipoRemanejamento === 'entre_contratos' ? funcionarios : funcionariosNovos;
    const funcionariosFiltrados = (tipoRemanejamento === 'entre_contratos' && contratoOrigem)
      ? listaFuncionarios.filter(f => f.contratoId === contratoOrigem.id)
      : listaFuncionarios;
    return [...new Set(funcionariosFiltrados.map(f => f.status).filter(Boolean))];
  }, [funcionarios, funcionariosNovos, tipoRemanejamento, contratoOrigem]);



  // Funções de manipulação
  const adicionarFuncionario = (funcionario: FuncionarioSelecionado) => {
    setFuncionariosSelecionados(prev => [...prev, { ...funcionario, selecionado: true }]);
  };

  const removerFuncionario = (funcionarioId: number) => {
    setFuncionariosSelecionados(prev => prev.filter(f => f.id !== funcionarioId));
  };

  const adicionarTodosDaFuncao = (funcao: string) => {
    const funcionariosDaFuncao = funcionariosDisponiveis.filter(f => f.funcao === funcao);
    setFuncionariosSelecionados(prev => [
      ...prev,
      ...funcionariosDaFuncao.map(f => ({ ...f, selecionado: true }))
    ]);
  };

  // Resumo para confirmação
  const getResumo = (): ResumoRemanejamento => {
    const porFuncao = funcionariosSelecionados.reduce((acc, f) => {
      const funcao = f.funcao || 'Sem função';
      acc[funcao] = (acc[funcao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSelecionados: funcionariosSelecionados.length,
      porFuncao,
      funcionarios: funcionariosSelecionados,
      origem: {
        contrato: contratoOrigem?.nome
      },
      destino: {
        contrato: contratoDestino?.nome || ''
      }
    };
  };

  // Submissão - usando a nova API da logística
  const handleSubmit = async () => {
    if (funcionariosSelecionados.length === 0) {
      showToast('Selecione pelo menos um funcionário', 'warning');
      return;
    }

    if (!contratoDestino) {
      showToast('Selecione o contrato de destino', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const remanejamento: NovasolicitacaoRemanejamento = {
        funcionarioIds: funcionariosSelecionados.map(f => f.id),
        contratoOrigemId: tipoRemanejamento === 'entre_contratos' ? contratoOrigem?.id : undefined,
        contratoDestinoId: contratoDestino.id,
        justificativa,
        prioridade,
        solicitadoPor: 'Logística' // Identificar que veio da logística
      };

      const response = await fetch('/api/logistica/remanejamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(remanejamento),
      });

      if (response.ok) {
        showToast('Solicitação de remanejamento criada com sucesso!', 'success');
        // Aguarda um pouco para garantir que o toast seja exibido antes do redirecionamento
        setTimeout(() => {
          setSubmitting(false);
          router.push('/prestserv/remanejamentos/tabela');
        }, 1500);
      } else {
        const errorData = await response.json();
        setSubmitting(false);
        throw new Error(errorData.error || 'Erro ao criar solicitação');
      }
    } catch (error) {
      console.error('Erro ao criar remanejamento:', error);
      showToast('Erro ao criar solicitação de remanejamento', 'error');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-blue-600" />
                <div>
                  <h1 className="text-base font-bold text-gray-900">
                    Novo Remanejamento - Logística
                  </h1>
                  <p className="text-xs text-gray-500">
                    {etapaAtual === 'tipo' ? 'Escolher tipo de remanejamento' : 
                     etapaAtual === 'selecao' ? 'Selecionar funcionários' : 'Confirmar solicitação'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Indicador de etapas */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  etapaAtual === 'tipo' ? 'bg-blue-600 text-white' : 
                  etapaAtual === 'selecao' || etapaAtual === 'confirmacao' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
                }`}>
                  1
                </div>
                <span className={`text-xs font-medium ${
                  etapaAtual === 'tipo' ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Tipo
                </span>
              </div>
              
              <ArrowRightIcon className="h-3 w-3 text-gray-400" />
              
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  etapaAtual === 'selecao' ? 'bg-blue-600 text-white' : 
                  etapaAtual === 'confirmacao' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
                }`}>
                  2
                </div>
                <span className={`text-xs font-medium ${
                  etapaAtual === 'selecao' ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Seleção
                </span>
              </div>
              
              <ArrowRightIcon className="h-3 w-3 text-gray-400" />
              
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  etapaAtual === 'confirmacao' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
                }`}>
                  3
                </div>
                <span className={`text-xs font-medium ${
                  etapaAtual === 'confirmacao' ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Confirmação
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 py-2">
        {etapaAtual === 'tipo' ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-center mb-4">
                <UserGroupIcon className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-gray-900 mb-1">Tipo de Remanejamento</h2>
                <p className="text-sm text-gray-600">Escolha o tipo de remanejamento que deseja realizar</p>
              </div>
              
              <div className="space-y-3">
                <div 
                  className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                    tipoRemanejamento === 'entre_contratos' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setTipoRemanejamento('entre_contratos')}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      tipoRemanejamento === 'entre_contratos' 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {tipoRemanejamento === 'entre_contratos' && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        Remanejamento entre Contratos
                      </h3>
                      <p className="text-gray-600 mb-1 text-xs">
                        Mover funcionários que já estão alocados em um contrato para outro contrato.
                      </p>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Ideal para:</span> Redistribuição de equipes, otimização de recursos
                      </div>
                    </div>
                  </div>
                </div>
                
                <div 
                  className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                    tipoRemanejamento === 'funcionarios_novos' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setTipoRemanejamento('funcionarios_novos')}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      tipoRemanejamento === 'funcionarios_novos' 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {tipoRemanejamento === 'funcionarios_novos' && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        Alocação de Funcionários Novos
                      </h3>
                      <p className="text-gray-600 mb-1 text-xs">
                        Alocar funcionários que ainda não estão vinculados a nenhum contrato.
                      </p>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Ideal para:</span> Novos funcionários, funcionários em processo de admissão
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setEtapaAtual('selecao')}
                  disabled={!tipoRemanejamento}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        ) : etapaAtual === 'selecao' ? (
          <div className="space-y-3">
            {/* Seção de Origem - apenas para remanejamento entre contratos */}
            {tipoRemanejamento === 'entre_contratos' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                <div className="flex items-center gap-2 mb-2">
                  <BuildingOfficeIcon className="h-4 w-4 text-blue-600" />
                  <label className="text-xs font-medium text-gray-900">
                    Contrato de Origem *
                  </label>
                </div>
                
                <select
                  value={contratoOrigem?.id || ''}
                  onChange={(e) => {
                    const contrato = contratosUnicos.find(c => c.id === parseInt(e.target.value));
                    setContratoOrigem(contrato || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Selecione um contrato</option>
                  {contratosUnicos.map(contrato => (
                    <option key={contrato.id} value={contrato.id}>
                      {contrato.nome} - {contrato.cliente}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Seção de Destino Unificada */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ArrowLongRightIcon className="h-4 w-4 text-green-600" />
                  <label className="text-xs font-medium text-gray-900">
                    Contrato de Destino *
                  </label>
                </div>
                {tipoRemanejamento === 'funcionarios_novos' && (
                  <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-md">
                    <UserPlusIcon className="h-3 w-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-900">Funcionários Novos</span>
                  </div>
                )}
              </div>
              
              <select
                value={contratoDestino?.id || ''}
                onChange={(e) => {
                  const contrato = contratosUnicos.find(c => c.id === parseInt(e.target.value));
                  setContratoDestino(contrato || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Selecione um contrato</option>
                {contratosUnicos.map(contrato => (
                  <option key={contrato.id} value={contrato.id}>
                    {contrato.nome} - {contrato.cliente}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtros e Seleção de Funcionários */}
            {(tipoRemanejamento === 'entre_contratos' ? contratoOrigem : tipoRemanejamento === 'funcionarios_novos') && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="h-4 w-4 text-blue-600" />
                  <h2 className="text-xs font-semibold text-gray-900">Seleção de Funcionários</h2>
                  {funcionariosSelecionados.length > 0 && (
                    <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      {funcionariosSelecionados.length} selecionado(s)
                    </div>
                  )}
                </div>
                
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-3 w-3 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      value={buscaNome}
                      onChange={(e) => setBuscaNome(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  
                  <select
                    value={filtroFuncao}
                    onChange={(e) => setFiltroFuncao(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option value="">Todas as funções</option>
                    {funcoesDisponiveis.map(funcao => (
                      <option key={funcao} value={funcao}>
                        {funcao}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroCentroCusto}
                    onChange={(e) => setFiltroCentroCusto(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option value="">Todos os centros</option>
                    {centrosCustoDisponiveis.map(centro => (
                      <option key={centro} value={centro}>
                        {centro}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option value="">Todos os status</option>
                    {statusDisponiveis.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Layout lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Funcionários Disponíveis */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Funcionários Disponíveis</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {funcionariosDisponiveis.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <UserIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs">Nenhum funcionário encontrado</p>
                        </div>
                      ) : (
                        funcionariosDisponiveis.map(funcionario => (
                          <div
                            key={funcionario.id}
                            className="flex items-center justify-between p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                <UserIcon className="h-3 w-3 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-xs truncate">{funcionario.nome}</h4>
                                <div className="text-xs text-gray-500 space-y-0.5">
                                  <div>Mat: {funcionario.matricula}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {funcionario.funcao && <span className="bg-gray-100 px-1 rounded text-xs">{funcionario.funcao}</span>}
                                    {funcionario.centroCusto && <span className="bg-blue-100 px-1 rounded text-xs">{funcionario.centroCusto}</span>}
                                    {funcionario.status && <span className="bg-green-100 px-1 rounded text-xs">{funcionario.status}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => adicionarFuncionario(funcionario)}
                              className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs ml-2"
                            >
                              <CheckIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Funcionários Selecionados */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Funcionários Selecionados</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {funcionariosSelecionados.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <UserGroupIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs">Nenhum funcionário selecionado</p>
                        </div>
                      ) : (
                        funcionariosSelecionados.map(funcionario => (
                          <div
                            key={funcionario.id}
                            className="flex items-center justify-between p-2 border border-green-200 bg-green-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                <UserIcon className="h-3 w-3 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-xs truncate">{funcionario.nome}</h4>
                                <div className="text-xs text-gray-500 space-y-0.5">
                                  <div>Mat: {funcionario.matricula}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {funcionario.funcao && <span className="bg-gray-100 px-1 rounded text-xs">{funcionario.funcao}</span>}
                                    {funcionario.centroCusto && <span className="bg-blue-100 px-1 rounded text-xs">{funcionario.centroCusto}</span>}
                                    {funcionario.status && <span className="bg-green-100 px-1 rounded text-xs">{funcionario.status}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => removerFuncionario(funcionario.id)}
                              className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs ml-2"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>
        ) : (
          /* Etapa de Confirmação */
          <div className="space-y-3">
            {/* Resumo da Solicitação */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-3">
                <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Resumo da Solicitação</h2>
              </div>
              
              {(() => {
                const resumo = getResumo();
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Origem */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                        <BuildingOfficeIcon className="h-4 w-4 text-blue-600" />
                        Origem
                      </h3>
                      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                        <p className="text-sm"><span className="font-medium">Contrato:</span> {resumo.origem.contrato || 'Não especificado'}</p>
                      </div>
                    </div>
                    
                    {/* Destino */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                        <ArrowLongRightIcon className="h-4 w-4 text-green-600" />
                        Destino
                      </h3>
                      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                        <p className="text-sm"><span className="font-medium">Contrato:</span> {resumo.destino.contrato}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Funcionários por função */}
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm">
                  <UserGroupIcon className="h-4 w-4 text-blue-600" />
                  Funcionários por Função ({getResumo().totalSelecionados} total)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(getResumo().porFuncao).map(([funcao, quantidade]) => (
                    <div key={funcao} className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-medium text-blue-900 text-sm">{funcao}</p>
                      <p className="text-xl font-bold text-blue-600">{quantidade}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Lista detalhada dos funcionários - Toggle */}
              <div className="mt-6">
                <button
                  onClick={() => setMostrarFuncionarios(!mostrarFuncionarios)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-green-600" />
                    <h3 className="font-medium text-gray-900 text-sm">
                      Funcionários Selecionados ({getResumo().totalSelecionados})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {mostrarFuncionarios ? 'Ocultar' : 'Ver detalhes'}
                    </span>
                    {mostrarFuncionarios ? (
                      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </button>
                
                {mostrarFuncionarios && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto border border-gray-200">
                    <div className="space-y-2">
                      {getResumo().funcionarios.map((funcionario) => (
                        <div key={funcionario.id} className="flex items-center justify-between bg-white p-3 rounded-md border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <UserIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 text-sm">{funcionario.nome}</h4>
                              <div className="text-xs text-gray-500">
                                <span>Mat: {funcionario.matricula}</span>
                                {funcionario.funcao && <span> • {funcionario.funcao}</span>}
                                {funcionario.centroCusto && <span> • {funcionario.centroCusto}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              {funcionario.dataAdmissao && (
                                <span>Admissão: {new Date(funcionario.dataAdmissao).toLocaleDateString('pt-BR')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Detalhes da Solicitação */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Detalhes da Solicitação</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Justificativa *
                  </label>
                  <textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Descreva o motivo do remanejamento..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade
                  </label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer com ações */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>

          <div className="flex items-center gap-2">
            {etapaAtual === 'selecao' && (
              <button
                onClick={() => setEtapaAtual('tipo')}
                className="px-3 py-2 text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors text-sm"
              >
                Voltar
              </button>
            )}
            
            {etapaAtual === 'confirmacao' && (
              <button
                onClick={() => setEtapaAtual('selecao')}
                className="px-3 py-2 text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors text-sm"
              >
                Voltar
              </button>
            )}
            
            {etapaAtual === 'selecao' ? (
              <button
                onClick={() => setEtapaAtual('confirmacao')}
                disabled={
                  funcionariosSelecionados.length === 0 || 
                  !contratoDestino || 
                  (tipoRemanejamento === 'entre_contratos' && !contratoOrigem)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
              >
                Continuar
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !justificativa.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Enviar Solicitação
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}