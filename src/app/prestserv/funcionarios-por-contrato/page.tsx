"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import {
  DocumentArrowDownIcon,
  UserGroupIcon,
  XCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  UserIcon,
  BriefcaseIcon,
  PaintBrushIcon
} from "@heroicons/react/24/outline";
import PlusIcon from "@heroicons/react/24/solid/PlusIcon";

interface FuncionarioContrato {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  centroCusto: string;
  status: string;
  statusPrestserv: string;
  emMigracao: boolean;
  contrato?: string;
  sispat?: string;
}

interface ContratoInfo {
  nome: string;
  total: number;
  aprovados: number;
  pendentes: number;
  rejeitados: number;
  totalOriginal?: number;
  aprovadosOriginal?: number;
  pendentesOriginal?: number;
  rejeitadosOriginal?: number;
}

export default function FuncionariosPorContratoPage() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState<FuncionarioContrato[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratosOriginais, setContratosOriginais] = useState<Record<string, ContratoInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros e paginacao
  const [selectedContrato, setSelectedContrato] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusPrestservFilter, setStatusPrestservFilter] = useState('');
  const [funcaoFilter, setFuncaoFilter] = useState('');
  const [centroCustoFilter, setCentroCustoFilter] = useState('');
  const [migracaoFilter, setMigracaoFilter] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(50);
  
  // Estado para todas as funções disponíveis no banco
  const [todasFuncoes, setTodasFuncoes] = useState<string[]>([]);
  
  // Estado para todos os centros de custo disponíveis no banco
  const [todosCentrosCusto, setTodosCentrosCusto] = useState<string[]>([]);
  
  // Estado para todos os status disponíveis no banco
  const [todosStatus, setTodosStatus] = useState<string[]>([]);

  // Carregar todas as funções disponíveis do banco
  useEffect(() => {
    const fetchFuncoes = async () => {
      try {
        const response = await fetch('/api/funcionarios/funcoes');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTodasFuncoes(data.data);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar funções:', error);
      }
    };

    fetchFuncoes();
  }, []);

  // Carregar todos os centros de custo disponíveis do banco
  useEffect(() => {
    const fetchCentrosCusto = async () => {
      try {
        const response = await fetch('/api/funcionarios/centros-custo');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTodosCentrosCusto(data.data);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar centros de custo:', error);
      }
    };

    fetchCentrosCusto();
  }, []);

  // Carregar todos os status disponíveis do banco
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/funcionarios/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTodosStatus(data.data);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar status:', error);
      }
    };

    fetchStatus();
   }, []);

  // Carregar dados originais dos contratos (sem filtros)
  useEffect(() => {
    const fetchContratosOriginais = async () => {
      try {
        const response = await fetch('/api/prestserv/funcionarios-por-contrato?page=1&limit=1');
        if (response.ok) {
          const data = await response.json();
          const contratosData = data.contratos || [];
          const contratosMap = contratosData.reduce((acc: Record<string, ContratoInfo>, contrato: any) => {
            acc[contrato.contratoNome] = {
              nome: contrato.contratoNome,
              total: contrato.totalFuncionarios,
              aprovados: contrato.funcionariosAprovados,
              pendentes: contrato.funcionariosPendentes,
              rejeitados: contrato.funcionariosRejeitados
            };
            return acc;
          }, {});
          setContratosOriginais(contratosMap);
        }
      } catch (error) {
        console.error('Erro ao carregar contratos originais:', error);
      }
    };

    fetchContratosOriginais();
  }, []);

  // Debounce do searchTerm
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);



  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construir parametros de query
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
        });

        if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
        if (statusFilter) params.append('status', statusFilter);
        if (statusPrestservFilter) params.append('statusPrestserv', statusPrestservFilter);
        if (funcaoFilter) params.append('funcao', funcaoFilter);
        if (centroCustoFilter) params.append('centroCusto', centroCustoFilter);
        if (migracaoFilter) params.append('migracao', migracaoFilter);
        if (selectedContrato) params.append('contrato', selectedContrato);

        const response = await fetch(`/api/prestserv/funcionarios-por-contrato?${params}`);
        
        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Processar dados dos funcionarios
        const funcionariosData = data.funcionarios || [];
        
        const funcionariosComContrato = funcionariosData.map((func: any) => ({
          id: func.id,
          nome: func.nome,
          matricula: func.matricula,
          funcao: func.funcao,
          centroCusto: func.centroCusto,
          status: func.status,
          statusPrestserv: func.statusPrestserv,
          emMigracao: func.emMigracao,
          contrato: func.contrato?.nome || "Sem contrato",
          sispat: func.sispat || "-",
        }));
        
        // Atualizar estados com dados e metadados de paginacao
        setFuncionarios(funcionariosComContrato);
        setContratos(data.contratos || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.totalItems || 0);
        console.log("ssss", funcionarios);

      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setFuncionarios([]);
        setContratos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, debouncedSearchTerm, statusFilter, statusPrestservFilter, funcaoFilter, centroCustoFilter, migracaoFilter, selectedContrato, itemsPerPage]);

  // Reset pagina quando searchTerm mudar
  useEffect(() => {
    if (debouncedSearchTerm !== '') {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm]);

  // Reset pagina quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, statusPrestservFilter, funcaoFilter, centroCustoFilter, selectedContrato]);

  const funcionariosFiltrados = useMemo(() => {
    // Os funcionarios ja vem filtrados do backend
    return funcionarios;
  }, [funcionarios]);

  const contratosData = useMemo(() => {
    // Converter array de contratos em objeto para compatibilidade com Object.entries
    if (Array.isArray(contratos)) {
      return contratos.reduce((acc, contrato) => {
        acc[contrato.contratoNome] = {
          nome: contrato.contratoNome,
          total: contrato.totalFuncionarios,
          aprovados: contrato.funcionariosAprovados,
          pendentes: contrato.funcionariosPendentes,
          rejeitados: contrato.funcionariosRejeitados,
          totalOriginal: contrato.totalOriginal || 0,
          aprovadosOriginal: contrato.aprovadosOriginal || 0,
          pendentesOriginal: contrato.pendentesOriginal || 0,
          rejeitadosOriginal: contrato.rejeitadosOriginal || 0
        };
        return acc;
      }, {} as Record<string, ContratoInfo>);
    }
    
    // Se contratos não é array, retornar como está (fallback)
    return contratos;
  }, [contratos]);

  const paginatedFuncionarios = useMemo(() => {
        
    // Os dados ja vem paginados do backend
    return funcionariosFiltrados;
  }, [funcionariosFiltrados]);

  const exportToExcel = useCallback(async () => {
    try {
      toast.loading('Preparando exportação...');
      
      // Construir parametros de query sem paginação para buscar todos os dados
      const params = new URLSearchParams({
        export: 'true', // Flag para indicar que é uma exportação
      });

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (statusPrestservFilter) params.append('statusPrestserv', statusPrestservFilter);
      if (funcaoFilter) params.append('funcao', funcaoFilter);
      if (centroCustoFilter) params.append('centroCusto', centroCustoFilter);
      if (migracaoFilter) params.append('migracao', migracaoFilter);
      if (selectedContrato) params.append('contrato', selectedContrato);

      const response = await fetch(`/api/prestserv/funcionarios-por-contrato?${params}`);
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const funcionariosData = data.funcionarios || [];
      
      const dataToExport = funcionariosData.map((func: any) => ({
        'Nome': func.nome,
        'Matricula': func.matricula,
        'Funcao': func.funcao,
        'Sispat': func.sispat ?? '-',
        'Centro de Custo': func.centroCusto,
        'Status': func.status,
        'Status Prestserv': func.statusPrestserv,
        'Processo em Andamento': func.emMigracao ? 'Sim' : 'Nao',
        'Contrato': func.contrato?.nome || 'Sem contrato'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios por Contrato');
      XLSX.writeFile(wb, 'funcionarios-por-contrato.xlsx');
      
      toast.dismiss();
      toast.success(`Relatório exportado com sucesso! ${dataToExport.length} funcionários incluídos.`);
    } catch (error) {
      toast.dismiss();
      toast.error('Erro ao exportar relatório');
      console.error('Erro na exportação:', error);
    }
  }, [debouncedSearchTerm, statusFilter, statusPrestservFilter, funcaoFilter, centroCustoFilter, migracaoFilter, selectedContrato]);

  const getStatusBadge = useCallback((status: string) => {
    const statusConfig = {
      'ATIVO': { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
      'ADMISSAO': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Admissao' },
      'DEMISSAO': { bg: 'bg-red-100', text: 'text-red-700', label: 'Demissao' },
      'INATIVO': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativo' },
      'FERIAS': { bg: 'bg-green-100', text: 'text-green-700', label: 'Ferias' },
      'AFASTADO': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Afastado' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return `${config.bg} ${config.text}`;
  }, []);

  const getStatusPrestservBadge = useCallback((status: string) => {
    const statusConfig = {
      'SEM_CADASTRO': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Sem Cadastro' },
      'ATIVO': { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
      'INATIVO': { bg: 'bg-red-100', text: 'text-red-700', label: 'Inativo' },
      'EM_MIGRACAO': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Em Migracao' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
    return `${config.bg} ${config.text}`;
  }, []);

  const handleFilterChange = useCallback((filterType: string, value: string) => {
    switch (filterType) {
      case 'status':
        setStatusFilter(value);
        break;
      case 'statusPrestserv':
        setStatusPrestservFilter(value);
        break;
      case 'funcao':
        setFuncaoFilter(value);
        break;
      case 'centroCusto':
        setCentroCustoFilter(value);
        break;
      case 'migracao':
        setMigracaoFilter(value);
        break;
    }
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('');
    setStatusPrestservFilter('');
    setFuncaoFilter('');
    setCentroCustoFilter('');
    setSelectedContrato(null);
    setCurrentPage(1);
  }, []);

  const handleContratoClick = useCallback((contratoNome: string) => {
    setSelectedContrato(selectedContrato === contratoNome ? null : contratoNome);
  }, [selectedContrato]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando funcionarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar dados</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <UserGroupIcon className="h-7 w-7 text-slate-600" />
                  Funcionários por Contrato
                </h1>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg">
                <BriefcaseIcon className="h-5 w-5 text-slate-600" /> 
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    Contratos Ativos
                  </h2>
                  <span className="text-xs text-slate-500">
                    {Object.keys(contratosData).length - 1} contratos
                  </span>
                </div> 
              </div>
            </div>
          </div>

          {/* Contratos Cards */}
          <div className="mb-4">
            <div
              className="flex gap-3 mb-4 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "thin" }}
            >
              {Object.entries(contratosData)
                .slice(0, 10)
                .map(([contratoNome, info]) => {
                  const hasFilter =
                    info.totalOriginal !== undefined &&
                    info.total !== info.totalOriginal &&
                    (info.total > 0 || info.totalOriginal > 0);
                  const contractsCount = Object.keys(contratosData).length;

                  return (
                    <div
                      key={contratoNome}
                      onClick={() => handleContratoClick(contratoNome)}
                      className={`p-4 bg-linear-to-r from-gray-800 to-slate-600 rounded-lg border cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                        contractsCount <= 10
                          ? "flex-grow min-w-0"
                          : "flex-shrink-0 min-w-[140px] max-w-[160px]"
                      } ${
                        selectedContrato === contratoNome
                          ? "border-1 border-slate-400 bg-slate-100 shadow-md ring-1 ring-slate-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-center">
                        <h3
                          className="font-semibold text-white text-sm truncate mb-2"
                          title={contratoNome}
                        >
                          {contratoNome}
                        </h3>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl font-bold text-sky-200">
                            {info.total}
                          </span>
                          {hasFilter && (
                            <span className="text-sm text-sky-200">
                              /{info.totalOriginal}
                            </span>
                          )}
                        </div>
                        {/* <p className="text-xs text-slate-500 mt-1">
                          funcionários
                        </p> */}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Filtro ativo */}
          {selectedContrato && (
            <div className="mb-4 p-4 bg-blue-50 border-1 border-slate-400 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong className="text-blue-900">Filtro ativo:</strong>{" "}
                {selectedContrato} ({funcionariosFiltrados.length} funcionários)
              </p>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border-1 border-slate-400 p-4 mb-4">
            <div className="flex items-center gap-3 mb-4 justify-between">
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Filtros
                </h3>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                >
                  <PaintBrushIcon className="h-4 w-4" />
                  Limpar Filtros
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Exportar Excel
                </button>
                <button
                  onClick={() => router.push("/prestserv/remanejamentos/novo")}
                  className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-sky-500 border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 shadow-sm transition-colors"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Criar Solicitação
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* Campo de busca */}
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar funcionário..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-slate-100 focus:bg-slate-100 transition-colors"
                />
              </div>

              {/* Status Folha */}
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-slate-100 focus:bg-slate-100 transition-colors"
              >
                <option value="">Status Folha</option>
                {todosStatus.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {/* Status Prestserv */}
              <select
                value={statusPrestservFilter}
                onChange={(e) =>
                  handleFilterChange("statusPrestserv", e.target.value)
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-slate-100 focus:bg-slate-100 transition-colors"
              >
                <option value="">Status Prestserv</option>
                <option value="SEM_CADASTRO">Sem Cadastro</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="EM_MIGRACAO">Em Migração</option>
              </select>

              {/* Função */}
              <select
                value={funcaoFilter}
                onChange={(e) => handleFilterChange("funcao", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-slate-100 focus:bg-slate-100 transition-colors"
              >
                <option value="">Função</option>
                {todasFuncoes.map((funcao) => (
                  <option key={funcao} value={funcao}>
                    {funcao}
                  </option>
                ))}
              </select>

              {/* Centro de Custo */}
              <select
                value={centroCustoFilter}
                onChange={(e) =>
                  handleFilterChange("centroCusto", e.target.value)
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-slate-100 focus:bg-slate-100 transition-colors"
              >
                <option value="">Centro de Custo</option>
                {todosCentrosCusto.map((centro) => (
                  <option key={centro} value={centro}>
                    {centro}
                  </option>
                ))}
              </select>

              {/* Migração */}
              <select
                value={migracaoFilter}
                onChange={(e) => handleFilterChange("migracao", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-slate-100 focus:bg-slate-100 transition-colors"
              >
                <option value="">Migração</option>
                <option value="true">Em Processo</option>
                <option value="false">Sem Processo</option>
              </select>
            </div>
          </div>

          {/* Tabela de Funcionários */}
          <div className="bg-white rounded-lg shadow-sm border-1 border-slate-400">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-600">
                    Funcionários
                  </h2>
                  <p className="text-sm text-slate-600">
                    {funcionariosFiltrados.length} funcionários encontrados
                  </p>
                </div>
                <div className="text-sm text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  Página {currentPage} de {totalPages}
                </div>
              </div>
            </div>

            {funcionariosFiltrados.length === 0 ? (
              <div className="p-8 text-center">
                <UserIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  Nenhum funcionário encontrado
                </h3>
                <p className="text-sm text-slate-500">
                  Tente ajustar os filtros ou termos de busca.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Funcionário
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Sispat
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Matrícula
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Função
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Centro Custo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status Folha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status Prestserv
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Vinculação a Contrato
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {paginatedFuncionarios.map((funcionario) => (
                      <tr
                        key={funcionario.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-slate-600" />
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-slate-800">
                                {funcionario.nome}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                          {funcionario.sispat ?? '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                          {funcionario.matricula}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate"
                          title={funcionario.funcao}
                        >
                          {funcionario.funcao}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                          {funcionario.centroCusto}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              funcionario.status === "ATIVO"
                                ? "bg-slate-100 text-slate-800"
                                : funcionario.status === "INATIVO"
                                ? "bg-slate-200 text-slate-600"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {funcionario.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              funcionario.statusPrestserv === "ATIVO"
                                ? "bg-slate-100 text-slate-800"
                                : funcionario.statusPrestserv === "INATIVO"
                                ? "bg-slate-200 text-slate-600"
                                : funcionario.statusPrestserv === "EM_MIGRACAO"
                                ? "bg-slate-300 text-slate-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {funcionario.statusPrestserv}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              funcionario.emMigracao
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {funcionario.emMigracao
                              ? "Em Processo"
                              : "Sem Processo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() =>
                              router.push(
                                `/prestserv/funcionarios-por-contrato/${funcionario.id}`
                              )
                            }
                            className="text-slate-600 hover:text-slate-800 flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Ver Detalhes"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, totalItems)} de{" "}
                    {totalItems} resultados
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Anterior
                    </button>

                    <span className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg">
                      {currentPage} de {totalPages}
                    </span>

                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      Próxima
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
