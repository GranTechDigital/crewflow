"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

interface ProjetoData {
  projeto: string;
  codProjeto: string;
  statusData: { [status: string]: number };
  totalProjeto: number;
  funcionarios: any[];
  uptime: number;
  downtime: number;
}

interface FiltroOpcoes {
  projetos: { id: number; projeto: string; cc: string }[];
  status: { id: number; categoria: string }[];
  statusFolha: string[];
  periodos: { mesReferencia: number; anoReferencia: number }[];
  regimeTrabalho: string[];
}

interface FiltrosAplicados {
  regimeTrabalho: string | null;
  projetos: number[];
  status: number[];
  statusFolha: string[];
  mes: number | null;
  ano: number | null;
}

interface DashboardData {
  projetos: ProjetoData[];
  statusDisponiveis: string[];
  totaisGerais: { [status: string]: number };
  resumo: {
    totalProjetos: number;
    totalRegistros: number;
    totalDiasGeral: number;
  };
  filtros: FiltroOpcoes;
  filtrosAplicados: FiltrosAplicados;
}

export default function DashboardProjetosPage() {
  const { usuario } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projetoExpandido, setProjetoExpandido] = useState<string | null>(null);
  
  // Estados dos filtros
  const [filtroRegime, setFiltroRegime] = useState<string>('OFFSHORE');
  const [filtrosProjetos, setFiltrosProjetos] = useState<number[]>([]);
  const [filtrosStatus, setFiltrosStatus] = useState<number[]>([]);
  const [filtrosStatusFolha, setFiltrosStatusFolha] = useState<string[]>([]);
  const [filtroMes, setFiltroMes] = useState<number | null>(8); // Agosto como padrão
  const [filtroAno, setFiltroAno] = useState<number | null>(2025); // 2025 como padrão
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtrosInicializados, setFiltrosInicializados] = useState(false);

  // Projetos padrão
  const projetosPadrao = [
    'TRIDENT',
    'MODEC',
    'BC | OPERAÇÕES',
    'MM | EQUINOR',
    'ES | LOTE 3',
    'C&M PAPA TERRA',
    'SAPURA',
    '3R | UBARANA-OPERAÇÃO E MANUTENÇÃO',
    'BC | LOTE 2',
    'BS-O&M SANTOS',
    'TVD | BC-LOTE 1',
    'UNBS | LOTE 2 UMS',
    'YINSON'
  ];

  // Funções para persistência de filtros
  const salvarFiltros = () => {
    const filtros = {
      regime: filtroRegime,
      projetos: filtrosProjetos,
      status: filtrosStatus,
      statusFolha: filtrosStatusFolha,
      mes: filtroMes,
      ano: filtroAno
    };
    localStorage.setItem('dashboardProjetos_filtros', JSON.stringify(filtros));
  };

  const carregarFiltrosSalvos = () => {
    try {
      const filtrosSalvos = localStorage.getItem('dashboardProjetos_filtros');
      return filtrosSalvos ? JSON.parse(filtrosSalvos) : null;
    } catch (error) {
      console.error('Erro ao carregar filtros salvos:', error);
      return null;
    }
  };

  const carregarDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Construir parâmetros de filtro
      const params = new URLSearchParams();
      
      if (filtroRegime) {
        params.append('regimeTrabalho', filtroRegime);
      }
      
      if (filtrosProjetos.length > 0) {
        params.append('projetos', filtrosProjetos.join(','));
      }
      
      if (filtrosStatus.length > 0) {
        params.append('status', filtrosStatus.join(','));
      }
      
      if (filtrosStatusFolha.length > 0) {
        params.append('statusFolha', filtrosStatusFolha.join(','));
      }
      
      if (filtroMes) {
        params.append('mes', filtroMes.toString());
      }
      
      if (filtroAno) {
        params.append('ano', filtroAno.toString());
      }
      
      const url = `/api/periodo/dashboard-projetos-simples${params.toString() ? '?' + params.toString() : ''}`;
      
      // LOG TEMPORÁRIO: Debug filtros
      console.log('🔍 DEBUG FILTROS:');
      console.log('- Regime:', filtroRegime);
      console.log('- Projetos:', filtrosProjetos);
      console.log('- Status:', filtrosStatus);
      console.log('- Status Folha:', filtrosStatusFolha);
      console.log('- URL:', url);
      
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na API:', response.status, errorText);
        throw new Error(`Erro ${response.status}: ${errorText || "Erro ao carregar dados do dashboard"}`);
      }
      
      const data = await response.json();
      
      // LOG TEMPORÁRIO: Debug resposta
      console.log('📊 DEBUG RESPOSTA:');
      console.log('- Total registros:', data.resumo?.totalRegistros);
      console.log('- Total projetos:', data.resumo?.totalProjetos);
      console.log('- Projetos encontrados:', data.projetos?.length);
      console.log('- Status disponíveis:', data.statusDisponiveis?.length);
      console.log('- Filtros aplicados:', data.filtrosAplicados);
      
      // Validar se os dados estão no formato esperado
      if (!data || typeof data !== 'object') {
        throw new Error("Dados inválidos recebidos da API");
      }

      
      setDashboardData(data);
    } catch (err: any) {
      console.error("Erro ao carregar dashboard:", err);
      setError(err.message || "Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Inicializar filtros na primeira carga
  useEffect(() => {
    const inicializarFiltros = async () => {
      // Primeiro, carregar dados básicos para ter acesso aos filtros disponíveis
      try {
        const response = await fetch('/api/periodo/dashboard-projetos-simples', {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Carregar filtros salvos ou usar padrões
          const filtrosSalvos = carregarFiltrosSalvos();
          
          if (filtrosSalvos) {
            // Usar filtros salvos
            setFiltroRegime(filtrosSalvos.regime || 'OFFSHORE');
            setFiltrosProjetos(filtrosSalvos.projetos || []);
            setFiltrosStatus(filtrosSalvos.status || []);
            setFiltrosStatusFolha(filtrosSalvos.statusFolha || []);
            setFiltroMes(filtrosSalvos.mes !== undefined ? filtrosSalvos.mes : 8);
            setFiltroAno(filtrosSalvos.ano !== undefined ? filtrosSalvos.ano : 2025);
          } else {
            // Usar filtros padrão
            // Encontrar IDs dos projetos padrão
            const idsProjetosPadrao: number[] = [];
            projetosPadrao.forEach(nomeProjeto => {
              const projetosEncontrados = data.filtros?.projetos?.filter((p: any) => p.projeto === nomeProjeto) || [];
              projetosEncontrados.forEach((projeto: any) => {
                idsProjetosPadrao.push(projeto.id);
              });
            });
            
            // Encontrar ID do status "Ativo"
            const statusAtivo = data.filtros?.status?.find((s: any) => s.categoria === 'Ativo');
            const idStatusAtivo = statusAtivo ? [statusAtivo.id] : [];
            
            setFiltrosProjetos(idsProjetosPadrao);
            setFiltrosStatus(idStatusAtivo);
            setFiltrosStatusFolha(['Ativo']);
          }
          
          setFiltrosInicializados(true);
        }
      } catch (error) {
        console.error('Erro ao inicializar filtros:', error);
        // Em caso de erro, usar filtros padrão básicos
        setFiltrosStatusFolha(['Ativo']);
        setFiltrosInicializados(true);
      }
    };

    inicializarFiltros();
  }, []);

  // Salvar filtros automaticamente quando mudarem
  useEffect(() => {
    if (filtrosInicializados) {
      salvarFiltros();
    }
  }, [filtroRegime, filtrosProjetos, filtrosStatus, filtrosStatusFolha, filtroMes, filtroAno, filtrosInicializados]);

  // Carregar dashboard apenas após filtros inicializados e usuário logado
  useEffect(() => {
    if (filtrosInicializados && usuario) {
      const timer = setTimeout(() => {
        carregarDashboard();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [filtroRegime, filtrosProjetos, filtrosStatus, filtrosStatusFolha, filtroMes, filtroAno, filtrosInicializados, usuario]);

  const toggleProjetoExpandido = (projeto: string) => {
    setProjetoExpandido(projetoExpandido === projeto ? null : projeto);
  };

  const limparFiltros = () => {
    // Limpar filtros salvos
    localStorage.removeItem('dashboardProjetos_filtros');
    
    // Aplicar filtros padrão
    setFiltroRegime('OFFSHORE');
    setFiltrosProjetos([]);
    setFiltrosStatus([]);
    setFiltrosStatusFolha(['Ativo']);
    setFiltroMes(8); // Agosto
    setFiltroAno(2025);
    
    // Recarregar com filtros padrão
    setTimeout(() => {
      if (dashboardData?.filtros) {
        // Encontrar IDs dos projetos padrão
        const idsProjetosPadrao: number[] = [];
        projetosPadrao.forEach(nomeProjeto => {
          const projetosEncontrados = dashboardData.filtros.projetos?.filter((p: any) => p.projeto === nomeProjeto) || [];
          projetosEncontrados.forEach((projeto: any) => {
            idsProjetosPadrao.push(projeto.id);
          });
        });
        
        // Encontrar ID do status "Ativo"
        const statusAtivo = dashboardData.filtros.status?.find((s: any) => s.categoria === 'Ativo');
        const idStatusAtivo = statusAtivo ? [statusAtivo.id] : [];
        
        setFiltrosProjetos(idsProjetosPadrao);
        setFiltrosStatus(idStatusAtivo);
      }
    }, 100);
  };

  const toggleProjeto = (nomeProjeto: string) => {
    if (!dashboardData?.filtros.projetos) return;
    
    // Encontrar todos os IDs que correspondem a este nome de projeto
    const idsDosProjetos = dashboardData.filtros.projetos
      .filter(p => p.projeto === nomeProjeto)
      .map(p => p.id);
    
    // Verificar se algum ID deste projeto já está selecionado
    const projetoJaSelecionado = idsDosProjetos.some(id => filtrosProjetos.includes(id));
    
    let novosFiltros;
    if (projetoJaSelecionado) {
      // Remover todos os IDs deste projeto
      novosFiltros = filtrosProjetos.filter(id => !idsDosProjetos.includes(id));
    } else {
      // Adicionar todos os IDs deste projeto
      novosFiltros = [...filtrosProjetos, ...idsDosProjetos];
    }
    
    setFiltrosProjetos(novosFiltros);
  };

  const toggleStatus = (statusId: number) => {
    const novosFiltros = filtrosStatus.includes(statusId) 
      ? filtrosStatus.filter(id => id !== statusId)
      : [...filtrosStatus, statusId];
    
    setFiltrosStatus(novosFiltros);
  };

  const toggleStatusFolha = (statusFolha: string) => {
    const novosFiltros = filtrosStatusFolha.includes(statusFolha) 
      ? filtrosStatusFolha.filter(s => s !== statusFolha)
      : [...filtrosStatusFolha, statusFolha];
    
    setFiltrosStatusFolha(novosFiltros);
  };

  const handleRegimeChange = (value: string) => {
    setFiltroRegime(value);
  };

  const handleMesChange = (value: number | null) => {
    setFiltroMes(value);
  };

  const handleAnoChange = (value: number | null) => {
    setFiltroAno(value);
  };

  // Os useEffect para carregamento do dashboard foram movidos para o sistema de filtros inicializados

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <div className="bg-white shadow">
          <div className="px-6 py-6">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Dashboard de Projetos - Soma por Status
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Soma do totalDiasPeriodo de todos os funcionários por projeto e status
                </p>
              </div>
              <div className="flex space-x-3">
                <a
                  href="/periodo"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  ← Voltar
                </a>
                <button
                  onClick={() => setMostrarFiltros(!mostrarFiltros)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  🔍 {mostrarFiltros ? 'Ocultar' : 'Mostrar'} Filtros
                </button>
                <button
                  onClick={carregarDashboard}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  🔄 Atualizar
                </button>
              </div>
            </div>

            {/* Seção de Filtros */}
            {mostrarFiltros && dashboardData && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Filtros</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Filtro Regime de Trabalho */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Regime de Trabalho
                    </label>
                    <select
                      value={filtroRegime}
                      onChange={(e) => handleRegimeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {dashboardData.filtros.regimeTrabalho.map((regime) => (
                        <option key={regime} value={regime}>
                          {regime}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro Período */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mês
                    </label>
                    <select
                      value={filtroMes || ''}
                      onChange={(e) => handleMesChange(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map((mes) => (
                        <option key={mes} value={mes}>
                          {new Date(2024, mes - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ano
                    </label>
                    <select
                      value={filtroAno || ''}
                      onChange={(e) => handleAnoChange(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {dashboardData.filtros.periodos.map((periodo) => (
                        <option key={periodo.anoReferencia} value={periodo.anoReferencia}>
                          {periodo.anoReferencia}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtros de múltipla seleção */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Filtro Projetos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Projetos ({(() => {
                        // Contar quantos projetos únicos estão selecionados
                        const projetosUnicos = new Set();
                        dashboardData.filtros.projetos.forEach(p => {
                          if (filtrosProjetos.includes(p.id)) {
                            projetosUnicos.add(p.projeto);
                          }
                        });
                        return projetosUnicos.size;
                      })()} selecionados)
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 bg-white">
                      {(() => {
                        // Agrupar projetos por nome
                        const projetosAgrupados = new Map();
                        dashboardData.filtros.projetos.forEach(projeto => {
                          if (!projetosAgrupados.has(projeto.projeto)) {
                            projetosAgrupados.set(projeto.projeto, {
                              nome: projeto.projeto,
                              ids: [projeto.id],
                              cc: projeto.cc
                            });
                          } else {
                            projetosAgrupados.get(projeto.projeto).ids.push(projeto.id);
                          }
                        });
                        
                        return Array.from(projetosAgrupados.values()).map((projetoAgrupado) => {
                          // Verificar se algum ID deste projeto está selecionado
                          const estaSelecionado = projetoAgrupado.ids.some((id: any) => filtrosProjetos.includes(id));
                          
                          return (
                            <label key={projetoAgrupado.nome} className="flex items-center space-x-2 py-1">
                              <input
                                type="checkbox"
                                checked={estaSelecionado}
                                onChange={() => toggleProjeto(projetoAgrupado.nome)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">
                                {projetoAgrupado.nome}
                                {projetoAgrupado.ids.length > 1 && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({projetoAgrupado.ids.length} centros)
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Filtro Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status ({filtrosStatus.length} selecionados)
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 bg-white">
                      {dashboardData.filtros.status.map((status) => (
                        <label key={status.id} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={filtrosStatus.includes(status.id)}
                            onChange={() => toggleStatus(status.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{status.categoria}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Filtro Status Folha */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status Folha ({filtrosStatusFolha.length} selecionados)
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 bg-white">
                      {dashboardData.filtros.statusFolha.map((statusFolha) => (
                        <label key={statusFolha} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={filtrosStatusFolha.includes(statusFolha)}
                            onChange={() => toggleStatusFolha(statusFolha)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{statusFolha}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>


              </div>
             )}

            {/* Indicador de Filtros Aplicados */}
            {dashboardData && dashboardData.filtrosAplicados && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Filtros Aplicados:</h4>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {dashboardData.filtrosAplicados.regimeTrabalho && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Regime: {dashboardData.filtrosAplicados.regimeTrabalho}
                        </span>
                      )}
                      {dashboardData.filtrosAplicados.projetos && dashboardData.filtrosAplicados.projetos.length > 0 && 
                        dashboardData.filtrosAplicados.projetos.map((projeto: any, index: number) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Projeto: {projeto}
                          </span>
                        ))
                      }
                      {dashboardData.filtrosAplicados.status && dashboardData.filtrosAplicados.status.length > 0 && 
                        dashboardData.filtrosAplicados.status.map((status: any, index: number) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Status: {status}
                          </span>
                        ))
                      }
                      {dashboardData.filtrosAplicados.statusFolha && dashboardData.filtrosAplicados.statusFolha.length > 0 && 
                        dashboardData.filtrosAplicados.statusFolha.map((statusFolha: string, index: number) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Status Folha: {statusFolha}
                          </span>
                        ))
                      }
                      {(dashboardData.filtrosAplicados as any).periodo && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Período: {(dashboardData.filtrosAplicados as any).periodo}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={limparFiltros}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Limpar Todos
                  </button>
                </div>
              </div>
            )}

            {/* Mensagem de erro */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Erro</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resumo */}
            {dashboardData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.resumo.totalProjetos}
                  </div>
                  <div className="text-sm text-blue-800">Projetos</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.resumo.totalDiasGeral.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-sm text-green-800">Total de Dias</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {dashboardData.resumo.totalRegistros.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-sm text-purple-800">Registros</div>
                </div>
              </div>
            )}

            {/* Tabela de Projetos */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando dashboard...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-red-600 mb-4">❌ Erro ao carregar dados</div>
                <p className="text-gray-600">{error}</p>
                <button
                  onClick={carregarDashboard}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Tentar novamente
                </button>
              </div>
            ) : dashboardData && dashboardData.projetos && dashboardData.projetos.length > 0 ? (
              <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                        COD.PROJETO
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-20 bg-gray-50 z-10">
                        NOME_PROJETO
                      </th>
                      {(dashboardData.statusDisponiveis || []).map(status => (
                        <th key={status} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {status}
                          <div className="text-xs text-gray-400 normal-case">
                            {status === 'Uptime' || status === 'Downtime' ? '%' : 'Dias'}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                        Total
                        <div className="text-xs text-gray-400 normal-case">Dias</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.projetos.map((projeto, index) => (
                      <>
                        <tr 
                          key={projeto.projeto} 
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 cursor-pointer`}
                          onClick={() => toggleProjetoExpandido(projeto.projeto)}
                        >
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-inherit z-10">
                            <div className="flex items-center">
                              <span className="mr-1">
                                {projetoExpandido === projeto.projeto ? '▼' : '▶'}
                              </span>
                              {projeto.codProjeto || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-20 bg-inherit z-10">
                            {projeto.projeto}
                          </td>
                          {(dashboardData.statusDisponiveis || []).map(status => {
                            let valor, displayValue;
                            
                            if (status === 'Uptime') {
                              valor = projeto.uptime || 0;
                              displayValue = `${valor.toFixed(1)}%`;
                            } else if (status === 'Downtime') {
                              valor = projeto.downtime || 0;
                              displayValue = `${valor.toFixed(1)}%`;
                            } else {
                              valor = projeto.statusData[status] || 0;
                              displayValue = valor.toLocaleString('pt-BR');
                            }
                            
                            return (
                              <td key={status} className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                <div className={valor > 0 ? "font-semibold text-gray-900" : "text-gray-600"}>
                                  {displayValue}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold bg-blue-50">
                            <div className="text-blue-600">
                              {projeto.totalProjeto.toLocaleString('pt-BR')}
                            </div>
                          </td>
                        </tr>
                        
                        {projetoExpandido === projeto.projeto && (
                          <tr>
                            <td colSpan={(dashboardData.statusDisponiveis || []).length + 3} className="px-6 py-4 bg-gray-50">
                              <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-gray-700">
                                  Funcionários do projeto: {projeto.projeto}
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Matrícula
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Nome
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Função
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Status
                                        </th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Dias
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {projeto.funcionarios && projeto.funcionarios.map((funcionario: any, funcIndex: number) => (
                                        <tr key={funcIndex} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                                            {funcionario.matricula}
                                          </td>
                                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">
                                            {funcionario.nome}
                                          </td>
                                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                            {funcionario.funcao}
                                          </td>
                                          <td className="px-4 py-2 whitespace-nowrap text-xs">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                              funcionario.status === 'Embarcado' ? 'bg-green-100 text-green-800' :
                                              funcionario.status === 'Aguardando embarque' ? 'bg-yellow-100 text-yellow-800' :
                                              funcionario.status === 'Folga' ? 'bg-blue-100 text-blue-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                              {funcionario.status}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900 text-center">
                                            {funcionario.totalDiasPeriodo}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {/* Linha de totais */}
                    <tr className="bg-blue-100 font-semibold border-t-2 border-blue-200">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900 sticky left-0 bg-blue-100 z-10">
                        TOTAL GERAL
                      </td>
                      {(dashboardData.statusDisponiveis || []).map(status => {
                        const totalStatus = dashboardData.totaisGerais[status] || 0;
                        return (
                          <td key={status} className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-900">
                            <div className="font-bold">
                              {totalStatus.toLocaleString('pt-BR')}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-900 bg-blue-200">
                        {dashboardData.resumo.totalDiasGeral.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum dado encontrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {(filtroRegime || filtrosProjetos.length > 0 || filtrosStatus.length > 0 || filtrosStatusFolha.length > 0 || filtroMes || filtroAno) 
                      ? "Não há dados disponíveis para os filtros selecionados. Tente ajustar os filtros ou limpar as seleções."
                      : "Não há dados de período disponíveis para exibir."
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}