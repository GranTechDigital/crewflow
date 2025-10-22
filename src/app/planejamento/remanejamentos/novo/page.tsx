'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserIcon,
  IdentificationIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ArrowLongRightIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { FuncionarioSelecionado, NovoRemanejamento, ResumoRemanejamento } from '@/types/remanejamento';

interface Contrato {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  centroDeCusto: string;
  centros?: Set<string>;
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

export default function NovoRemanejamentoPage() {
  const router = useRouter();
  
  // Estados de dados
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados principais
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<FuncionarioSelecionado[]>([]);
  const [contratoOrigem, setContratoOrigem] = useState<Contrato | null>(null);
  const [centroCustoOrigem, setCentroCustoOrigem] = useState('');
  const [contratoDestino, setContratoDestino] = useState<Contrato | null>(null);
  const [centroCustoDestino, setCentroCustoDestino] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [submitting, setSubmitting] = useState(false);
  
  // Estados de filtros
  const [filtroFuncao, setFiltroFuncao] = useState('');
  const [buscaNome, setBuscaNome] = useState('');
  const [etapaAtual, setEtapaAtual] = useState<'selecao' | 'confirmacao'>('selecao');

  // Carregar dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [funcionariosRes, contratosRes] = await Promise.all([
          fetch('/api/funcionarios'),
          fetch('/api/contratos')
        ]);

        if (funcionariosRes.ok) {
          const funcionariosData = await funcionariosRes.json();
          setFuncionarios(funcionariosData);
        }

        if (contratosRes.ok) {
          const contratosData = await contratosRes.json();
          setContratos(contratosData);
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
        acc[contrato.id] = {
          ...contrato,
          centros: new Set(contrato.centroDeCusto.split(',').map(c => c.trim()).filter(c => c !== ''))
        };
      }
      return acc;
    }, {} as Record<string, Contrato & { centros: Set<string> }>);
    return Object.values(contratoMap);
  }, [contratos]);

  // Funcionários disponíveis (origem)
  const funcionariosDisponiveis = useMemo(() => {
    return funcionarios
      .filter(f => {
        // Filtro por contrato de origem
        if (contratoOrigem) {
          // Se o funcionário tem contratoId, usar ele diretamente
          if (f.contratoId) {
            if (f.contratoId !== contratoOrigem.id) return false;
          } else {
            // Fallback para centro de custo se não tiver contratoId
            const centrosDoContrato = Array.from(contratoOrigem.centros || []);
            if (!centrosDoContrato.includes(f.centroCusto)) return false;
          }
        }
        // Filtro por centro de custo específico
        if (centroCustoOrigem && f.centroCusto !== centroCustoOrigem) return false;
        // Filtro por função
        if (filtroFuncao && f.funcao !== filtroFuncao) return false;
        // Filtro por nome
        if (buscaNome && !f.nome.toLowerCase().includes(buscaNome.toLowerCase())) return false;
        // Não mostrar funcionários já selecionados
        if (funcionariosSelecionados.some(fs => fs.id === parseInt(f.id))) return false;
        return true;
      })
      .map(f => ({
        id: parseInt(f.id),
        nome: f.nome,
        matricula: f.id,
        funcao: f.funcao || null,
        centroCusto: f.centroCusto || null,
        selecionado: false
      }));
  }, [funcionarios, contratoOrigem, centroCustoOrigem, filtroFuncao, buscaNome, funcionariosSelecionados]);

  // Funções disponíveis para filtro
  const funcoesDisponiveis = useMemo(() => {
    const funcionariosFiltrados = contratoOrigem || centroCustoOrigem
      ? funcionarios.filter(f => {
          if (contratoOrigem) {
            const centrosDoContrato = Array.from(contratoOrigem.centros || []);
            return centrosDoContrato.includes(f.centroCusto);
          }
          return f.centroCusto === centroCustoOrigem;
        })
      : funcionarios;
    return [...new Set(funcionariosFiltrados.map(f => f.funcao).filter(Boolean))];
  }, [funcionarios, contratoOrigem, centroCustoOrigem]);

  // Centros de custo disponíveis
  const centrosCustoOrigem = useMemo(() => {
    return contratoOrigem
      ? Array.from(contratoOrigem.centros || [])
      : [];
  }, [contratoOrigem]);

  const centrosCustoDestino = useMemo(() => {
    return contratoDestino
      ? Array.from(contratoDestino.centros || [])
      : [];
  }, [contratoDestino]);

  // Funções de manipulação
  const adicionarFuncionario = (funcionario: FuncionarioSelecionado) => {
    setFuncionariosSelecionados(prev => {
      return prev.some(f => f.id === funcionario.id)
        ? prev
        : [...prev, { ...funcionario, selecionado: true }];
    });
  };

  const removerFuncionario = (funcionarioId: number) => {
    setFuncionariosSelecionados(prev => prev.filter(f => f.id !== funcionarioId));
  };

  const adicionarTodosDaFuncao = (funcao: string) => {
    const funcionariosDaFuncao = funcionariosDisponiveis.filter(f => f.funcao === funcao);
    setFuncionariosSelecionados(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const toAdd = funcionariosDaFuncao
        .filter(f => !existingIds.has(Number(f.id)))
        .map(f => ({ ...f, selecionado: true }));
      return [...prev, ...toAdd];
    });
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
      origem: {
        contrato: contratoOrigem?.nome,
        centroCusto: centroCustoOrigem
      },
      destino: {
        contrato: contratoDestino?.nome,
        centroCusto: centroCustoDestino
      }
    };
  };

  // Submissão
  const handleSubmit = async () => {
    if (funcionariosSelecionados.length === 0) {
      alert('Selecione pelo menos um funcionário');
      return;
    }

    if (!centroCustoDestino) {
      alert('Selecione o centro de custo de destino');
      return;
    }

    setSubmitting(true);
    try {
      const remanejamento: NovoRemanejamento = {
        funcionarioIds: funcionariosSelecionados.map(f => f.id),
        contratoOrigemId: contratoOrigem?.id,
        centroCustoOrigem,
        contratoDestinoId: contratoDestino?.id,
        centroCustoDestino,
        justificativa,
        prioridade,
        solicitadoPor: 'Usuário Atual'
      };

      const response = await fetch('/api/remanejamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(remanejamento),
      });

      if (response.ok) {
        alert('Solicitação de remanejamento criada com sucesso!');
        router.push('/planejamento/remanejamentos');
      } else {
        throw new Error('Erro ao criar solicitação');
      }
    } catch (error) {
      console.error('Erro ao criar remanejamento:', error);
      alert('Erro ao criar solicitação de remanejamento');
    } finally {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-3">
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Novo Remanejamento
                  </h1>
                  <p className="text-sm text-gray-500">
                    {etapaAtual === 'selecao' ? 'Selecionar funcionários' : 'Confirmar solicitação'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Indicador de etapas */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  etapaAtual === 'selecao' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                }`}>
                  1
                </div>
                <span className={`text-sm font-medium ${
                  etapaAtual === 'selecao' ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  Seleção
                </span>
              </div>
              
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
              
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  etapaAtual === 'confirmacao' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
                }`}>
                  2
                </div>
                <span className={`text-sm font-medium ${
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {etapaAtual === 'selecao' ? (
          <div className="space-y-8">
            {/* Seção de Origem */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Origem</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contrato de Origem
                  </label>
                  <select
                    value={contratoOrigem?.id || ''}
                    onChange={(e) => {
                      const contrato = contratosUnicos.find(c => c.id === parseInt(e.target.value));
                      setContratoOrigem(contrato || null);
                      setCentroCustoOrigem('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um contrato</option>
                    {contratosUnicos.map(contrato => (
                      <option key={contrato.id} value={contrato.id}>
                        {contrato.nome} - {contrato.cliente}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Centro de Custo de Origem
                  </label>
                  <select
                    value={centroCustoOrigem}
                    onChange={(e) => setCentroCustoOrigem(e.target.value)}
                    disabled={!contratoOrigem}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Todos os centros de custo</option>
                    {centrosCustoOrigem.map(centro => (
                      <option key={centro} value={centro}>
                        {centro}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção de Destino */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <ArrowLongRightIcon className="h-6 w-6 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Destino</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contrato de Destino *
                  </label>
                  <select
                    value={contratoDestino?.id || ''}
                    onChange={(e) => {
                      const contrato = contratosUnicos.find(c => c.id === parseInt(e.target.value));
                      setContratoDestino(contrato || null);
                      setCentroCustoDestino('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um contrato</option>
                    {contratosUnicos.map(contrato => (
                      <option key={contrato.id} value={contrato.id}>
                        {contrato.nome} - {contrato.cliente}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Centro de Custo de Destino *
                  </label>
                  <select
                    value={centroCustoDestino}
                    onChange={(e) => setCentroCustoDestino(e.target.value)}
                    disabled={!contratoDestino}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Selecione um centro de custo</option>
                    {centrosCustoDestino.map(centro => (
                      <option key={centro} value={centro}>
                        {centro}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filtros e Seleção de Funcionários */}
            {(contratoOrigem || centroCustoOrigem) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-6 w-6 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Funcionários</h2>
                  </div>
                  
                  {funcionariosSelecionados.length > 0 && (
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {funcionariosSelecionados.length} selecionado(s)
                    </div>
                  )}
                </div>
                
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      value={buscaNome}
                      onChange={(e) => setBuscaNome(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <select
                    value={filtroFuncao}
                    onChange={(e) => setFiltroFuncao(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas as funções</option>
                    {funcoesDisponiveis.map(funcao => (
                      <option key={funcao} value={funcao}>
                        {funcao}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Lista de funcionários disponíveis */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {funcionariosDisponiveis.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Nenhum funcionário encontrado com os filtros aplicados</p>
                    </div>
                  ) : (
                    funcionariosDisponiveis.map(funcionario => (
                      <div
                        key={funcionario.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{funcionario.nome}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Matrícula: {funcionario.matricula}</span>
                              {funcionario.funcao && <span>Função: {funcionario.funcao}</span>}
                              {funcionario.centroCusto && <span>Centro: {funcionario.centroCusto}</span>}
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => adicionarFuncionario(funcionario)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <CheckIcon className="h-4 w-4" />
                          Selecionar
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Ações rápidas por função */}
                {funcoesDisponiveis.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Ações rápidas:</h3>
                    <div className="flex flex-wrap gap-2">
                      {funcoesDisponiveis.map(funcao => {
                        const qtdFuncao = funcionariosDisponiveis.filter(f => f.funcao === funcao).length;
                        return (
                          <button
                            key={funcao}
                            onClick={() => adicionarTodosDaFuncao(funcao || '')}
                            disabled={qtdFuncao === 0}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Selecionar todos {funcao} ({qtdFuncao})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Funcionários Selecionados */}
            {funcionariosSelecionados.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Funcionários Selecionados ({funcionariosSelecionados.length})
                  </h2>
                </div>
                
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {funcionariosSelecionados.map(funcionario => (
                    <div
                      key={funcionario.id}
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{funcionario.nome}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Matrícula: {funcionario.matricula}</span>
                            {funcionario.funcao && <span>Função: {funcionario.funcao}</span>}
                            {funcionario.centroCusto && <span>Centro: {funcionario.centroCusto}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => removerFuncionario(funcionario.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Etapa de Confirmação */
          <div className="space-y-8">
            {/* Resumo da Solicitação */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Resumo da Solicitação</h2>
              </div>
              
              {(() => {
                const resumo = getResumo();
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Origem */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
                        Origem
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <p><span className="font-medium">Contrato:</span> {resumo.origem.contrato || 'Não especificado'}</p>
                        <p><span className="font-medium">Centro de Custo:</span> {resumo.origem.centroCusto || 'Todos'}</p>
                      </div>
                    </div>
                    
                    {/* Destino */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <ArrowLongRightIcon className="h-5 w-5 text-green-600" />
                        Destino
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <p><span className="font-medium">Contrato:</span> {resumo.destino.contrato}</p>
                        <p><span className="font-medium">Centro de Custo:</span> {resumo.destino.centroCusto}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Funcionários por função */}
              <div className="mt-8">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-blue-600" />
                  Funcionários por Função ({getResumo().totalSelecionados} total)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(getResumo().porFuncao).map(([funcao, quantidade]) => (
                    <div key={funcao} className="bg-blue-50 p-4 rounded-lg">
                      <p className="font-medium text-blue-900">{funcao}</p>
                      <p className="text-2xl font-bold text-blue-600">{quantidade}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Detalhes da Solicitação */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Detalhes da Solicitação</h2>
              
              <div className="space-y-6">
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
      <div className="bg-white border-t border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>

          <div className="flex items-center gap-3">
            {etapaAtual === 'confirmacao' && (
              <button
                onClick={() => setEtapaAtual('selecao')}
                className="px-4 py-2 text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
              >
                Voltar
              </button>
            )}
            
            {etapaAtual === 'selecao' ? (
              <button
                onClick={() => setEtapaAtual('confirmacao')}
                disabled={funcionariosSelecionados.length === 0 || !centroCustoDestino}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Continuar
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !justificativa.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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