"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";

interface FuncionarioPeriodo {
  matricula: string;
  nome: string;
  funcao: string;
  status: string;
  totalDias: number;
  totalDiasPeriodo: number;
  embarcacao: string;
  observacoes: string;
  sispat: string;
  departamento: string;
  centroCusto: string;
}

interface PeriodoUpload {
  id: number;
  dataUpload: string;
  dataRelatorio: string;
  nomeArquivo: string;
  registros: number;
  atualizados: number;
  naoEncontrados: number;
  uploadPor: string;
  mesReferencia: number;
  anoReferencia: number;
  periodoInicial: string;
  periodoFinal: string;
  totalDiasPeriodo: number;
}

interface DashboardProjeto {
  projeto: string;
  statusTotais: { [status: string]: { totalDias: number; totalFuncionarios: number } };
  totalGeralDias: number;
  totalGeralFuncionarios: number;
}

interface DashboardData {
  dados: DashboardProjeto[];
  statusDisponiveis: string[];
  periodosDisponiveis: { mesReferencia: number; anoReferencia: number }[];
  totaisGerais: { [status: string]: { totalDias: number; totalFuncionarios: number } };
  filtroAtual: { mes: number | null; ano: number | null };
  resumo: {
    totalProjetos: number;
    totalRegistros: number;
    totalDiasGeral: number;
    totalFuncionariosGeral: number;
  };
  opcoesFiltros: {
    regimes: string[];
    projetos: { id: number; projeto: string }[];
    status: { id: number; categoria: string }[];
  };
}

export default function PeriodoPage() {
  const { usuario } = useAuth();
  const [funcionariosData, setFuncionariosData] = useState<FuncionarioPeriodo[]>([]);
  const [uploadsHistorico, setUploadsHistorico] = useState<PeriodoUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "historico" | "dashboard">("dashboard");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [filtroMes, setFiltroMes] = useState<number | null>(null);
  const [filtroAno, setFiltroAno] = useState<number | null>(null);
  const [filtroRegime, setFiltroRegime] = useState<string>("");
  const [filtrosProjetos, setFiltrosProjetos] = useState<number[]>([]);
  const [filtrosStatus, setFiltrosStatus] = useState<number[]>([]);
  const [filtrosStatusFolha, setFiltrosStatusFolha] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    processed: number;
    stage: string;
    message: string;
    completed: boolean;
    error?: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const connectToProgressStream = (uploadId: string) => {
    const eventSource = new EventSource(`/api/periodo/upload/progress?uploadId=${uploadId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        setUploadProgress(progress);
        
        // Se completado ou com erro, fechar conexão
        if (progress.completed || progress.error) {
          eventSource.close();
          setUploading(false);
          
          if (progress.error) {
            setError(progress.message);
          }
        }
      } catch (err) {
        console.error('Erro ao processar progresso:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('Erro na conexão SSE:', error);
      eventSource.close();
      setUploading(false);
    };
    
    return eventSource;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccessMessage(null);
      setUploadProgress(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    // Gerar uploadId único
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);
      setUploadProgress(null);

      // Conectar ao stream de progresso ANTES do upload
      const eventSource = connectToProgressStream(uploadId);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('uploadId', uploadId); // Enviar uploadId para a API

      const response = await fetch("/api/periodo/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        eventSource?.close();
        throw new Error(result.message || "Erro ao processar o arquivo");
      }

      setSuccessMessage(result.message);
      setSelectedFile(null); // Limpar arquivo selecionado
      
      // Limpar o input file
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      // Atualizar histórico após upload bem-sucedido
      await carregarHistorico();

    } catch (err: any) {
      console.error("Erro no upload:", err);
      setError(err.message || "Erro ao processar arquivo");
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const carregarDashboard = useCallback(async (
    mes?: number | null, 
    ano?: number | null,
    regime?: string,
    projetos?: number[],
    status?: number[],
    statusFolha?: string[]
  ) => {
    try {
      setDashboardLoading(true);
      
      // Verificar se o usuário está autenticado
      if (!usuario) {
        return;
      }
      
      const params = new URLSearchParams();
      if (mes && mes > 0) params.append('mes', mes.toString());
      if (ano && ano > 0) params.append('ano', ano.toString());
      if (regime) params.append('regime', regime);
      if (projetos && projetos.length > 0) params.append('projetos', projetos.join(','));
      if (status && status.length > 0) params.append('status', status.join(','));
      if (statusFolha && statusFolha.length > 0) params.append('statusFolha', statusFolha.join(','));
      
      const queryString = params.toString();
      const url = queryString ? `/api/periodo/dashboard-projetos?${queryString}` : '/api/periodo/dashboard-projetos';
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Incluir cookies
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error("Erro ao carregar dados do dashboard");
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err: any) {
      console.error("Erro ao carregar dashboard:", err);
      setError(err.message || "Erro ao carregar dados do dashboard");
    } finally {
      setDashboardLoading(false);
    }
  }, [usuario]);

  const carregarHistorico = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/periodo/historico");
      
      if (response.ok) {
        const data = await response.json();
        setUploadsHistorico(data);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const exportarDadosFiltrados = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroMes && filtroMes > 0) params.append('mes', filtroMes.toString());
      if (filtroAno && filtroAno > 0) params.append('ano', filtroAno.toString());
      if (filtroRegime) params.append('regime', filtroRegime);
      if (filtrosProjetos && filtrosProjetos.length > 0) params.append('projetos', filtrosProjetos.join(','));
      if (filtrosStatus && filtrosStatus.length > 0) params.append('status', filtrosStatus.join(','));
      if (filtrosStatusFolha && filtrosStatusFolha.length > 0) params.append('statusFolha', filtrosStatusFolha.join(','));
      
      const queryString = params.toString();
      const url = queryString ? `/api/periodo/export-filtered?${queryString}` : '/api/periodo/export-filtered';
      
      // Criar link temporário para download
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao exportar dados filtrados:', error);
      setError('Erro ao exportar dados filtrados');
    }
  };

  const exportarTodosDados = async () => {
    try {
      // Criar link temporário para download
      const link = document.createElement('a');
      link.href = '/api/periodo/export-all';
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao exportar todos os dados:', error);
      setError('Erro ao exportar todos os dados');
    }
  };

  useEffect(() => {
    if (usuario) {
      if (activeTab === "historico") {
        carregarHistorico();
      } else if (activeTab === "dashboard") {
        carregarDashboard(filtroMes, filtroAno, filtroRegime, filtrosProjetos, filtrosStatus, filtrosStatusFolha);
      }
    }
  }, [activeTab, usuario, carregarHistorico, carregarDashboard, filtroMes, filtroAno, filtroRegime, filtrosProjetos, filtrosStatus, filtrosStatusFolha]);

  useEffect(() => {
    if (usuario && activeTab === "dashboard") {
      carregarDashboard(filtroMes, filtroAno, filtroRegime, filtrosProjetos, filtrosStatus, filtrosStatusFolha);
    }
  }, [filtroMes, filtroAno, filtroRegime, filtrosProjetos, filtrosStatus, filtrosStatusFolha, usuario, activeTab, carregarDashboard]);

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Upload de Relatórios de Período
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Faça upload de relatórios de período com validações específicas
                </p>
              </div>
              <div className="flex space-x-3">
                <a
                  href="/periodo/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  📊 Dashboard
                </a>
              </div>
            </div>

            {/* Informações importantes */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                📋 Regras para Relatórios de Período:
              </h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Data inicial:</strong> Sempre dia 1º do mês (ex: 01/08/2025)</li>
                <li>• <strong>Período mínimo:</strong> 7 dias</li>
                <li>• <strong>Mesmo mês:</strong> Início e fim devem ser no mesmo mês</li>
                <li>• <strong>Substituição:</strong> Novos uploads substituem dados do mesmo mês</li>
                <li>• <strong>Formato da célula A1:</strong> 01/Sep/2025 to 15/Sep/2025</li>
              </ul>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "upload"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  📤 Upload de Arquivo
                </button>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "dashboard"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  📈 Dashboard por Projetos
                </button>
                <button
                  onClick={() => setActiveTab("historico")}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "historico"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  📊 Histórico de Uploads
                </button>
              </nav>
            </div>

            {/* Mensagens */}
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

            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Sucesso</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>{successMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo das tabs */}
            {activeTab === "upload" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecionar arquivo Excel (.xlsx)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Clique para selecionar</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            disabled={uploading}
                          />
                        </label>
                        <p className="pl-1">ou arraste e solte</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Apenas arquivos Excel (.xlsx, .xls)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Arquivo selecionado e botão de envio */}
                {selectedFile && !uploading && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <button
                          onClick={handleFileUpload}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Enviar Arquivo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-4">
                    {uploadProgress ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-800">
                            {uploadProgress.message}
                          </span>
                          {uploadProgress.total > 0 && (
                            <span className="text-sm text-blue-600">
                              {uploadProgress.processed} / {uploadProgress.total}
                            </span>
                          )}
                        </div>
                        
                        {uploadProgress.total > 0 && (
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.min((uploadProgress.processed / uploadProgress.total) * 100, 100)}%` 
                              }}
                            ></div>
                          </div>
                        )}
                        
                        {uploadProgress.total > 0 && (
                          <div className="mt-2 text-xs text-blue-600">
                            {Math.round((uploadProgress.processed / uploadProgress.total) * 100)}% concluído
                          </div>
                        )}
                        
                        {uploadProgress.error && (
                          <div className="mt-2 text-sm text-red-600">
                            Erro: {uploadProgress.error}
                          </div>
                        )}
                        
                        {uploadProgress.completed && (
                          <div className="mt-2 flex items-center text-sm text-green-600">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Upload concluído com sucesso!
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Iniciando upload...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Filtros */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={exportarDadosFiltrados}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        📊 Exportar Filtrados
                      </button>
                      <button
                        onClick={exportarTodosDados}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        📋 Exportar Tudo
                      </button>
                    </div>
                  </div>
                  
                  {/* Primeira linha de filtros */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mês
                      </label>
                      <select
                        value={filtroMes || ""}
                        onChange={(e) => setFiltroMes(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos os meses</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
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
                        value={filtroAno || ""}
                        onChange={(e) => setFiltroAno(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos os anos</option>
                        {dashboardData?.periodosDisponiveis
                          .map(p => p.anoReferencia)
                          .filter((ano, index, self) => self.indexOf(ano) === index)
                          .sort((a, b) => b - a)
                          .map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Regime de Trabalho
                      </label>
                      <select
                        value={filtroRegime}
                        onChange={(e) => setFiltroRegime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos os regimes</option>
                        {dashboardData?.opcoesFiltros?.regimes?.map(regime => (
                          <option key={regime} value={regime}>{regime}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setFiltroMes(null);
                          setFiltroAno(null);
                          setFiltroRegime("");
                          setFiltrosProjetos([]);
                          setFiltrosStatus([]);
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  </div>

                  {/* Segunda linha de filtros */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Projetos (múltipla escolha)
                      </label>
                      <select
                        multiple
                        value={filtrosProjetos.map(String)}
                        onChange={(e) => {
                          const selectedValues = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                          setFiltrosProjetos(selectedValues);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                      >
                        {dashboardData?.opcoesFiltros?.projetos?.map(projeto => (
                          <option key={projeto.id} value={projeto.id}>
                            {projeto.projeto}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Segure Ctrl/Cmd para selecionar múltiplos projetos
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status do Funcionário (múltipla escolha)
                      </label>
                      <select
                        multiple
                        value={filtrosStatus.map(String)}
                        onChange={(e) => {
                          const selectedValues = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                          setFiltrosStatus(selectedValues);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                      >
                        {dashboardData?.opcoesFiltros?.status?.map(status => (
                          <option key={status.id} value={status.id}>
                            {status.categoria}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Segure Ctrl/Cmd para selecionar múltiplos status
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status da Folha (múltipla escolha)
                      </label>
                      <select
                        multiple
                        value={filtrosStatusFolha}
                        onChange={(e) => {
                          const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                          setFiltrosStatusFolha(selectedValues);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                      >
                        {(dashboardData?.opcoesFiltros as any)?.statusFolha?.map((statusFolha: any) => (
                          <option key={statusFolha} value={statusFolha}>
                            {statusFolha}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Segure Ctrl/Cmd para selecionar múltiplos status da folha
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resumo */}
                {dashboardData && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {dashboardData.resumo.totalProjetos}
                      </div>
                      <div className="text-sm text-blue-800">Projetos</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {dashboardData.resumo.totalFuncionariosGeral}
                      </div>
                      <div className="text-sm text-green-800">Funcionários</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {dashboardData.resumo.totalDiasGeral.toLocaleString()}
                      </div>
                      <div className="text-sm text-purple-800">Total de Dias</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {dashboardData.resumo.totalRegistros.toLocaleString()}
                      </div>
                      <div className="text-sm text-orange-800">Registros</div>
                    </div>
                  </div>
                )}

                {/* Tabela de Projetos */}
                {dashboardLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Carregando dashboard...</p>
                  </div>
                ) : dashboardData && dashboardData.dados.length > 0 ? (
                  <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                            Projeto
                          </th>
                          {dashboardData.statusDisponiveis.map(status => (
                            <th key={status} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {status}
                              <div className="text-xs text-gray-400 normal-case">Dias / Func.</div>
                            </th>
                          ))}
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                            <div className="text-xs text-gray-400 normal-case">Dias / Func.</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData.dados.map((projeto, index) => (
                          <tr key={projeto.projeto} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-inherit">
                              {projeto.projeto}
                            </td>
                            {dashboardData.statusDisponiveis.map(status => {
                              const statusData = projeto.statusTotais[status];
                              return (
                                <td key={status} className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                  {statusData ? (
                                    <div>
                                      <div className="font-semibold text-gray-900">
                                        {statusData.totalDias.toLocaleString('pt-BR')}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {statusData.totalFuncionarios} func.
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-gray-400">-</div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold">
                              <div className="text-blue-600">
                                {projeto.totalGeralDias.toLocaleString('pt-BR')}
                              </div>
                              <div className="text-xs text-blue-500">
                                {projeto.totalGeralFuncionarios} func.
                              </div>
                            </td>
                          </tr>
                        ))}
                        {/* Linha de totais */}
                        <tr className="bg-blue-50 font-semibold">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900 sticky left-0 bg-blue-50">
                            TOTAL GERAL
                          </td>
                          {dashboardData.statusDisponiveis.map(status => {
                            const totalStatus = dashboardData.totaisGerais[status];
                            return (
                              <td key={status} className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-900">
                                {totalStatus ? (
                                  <div>
                                    <div className="font-bold">
                                      {totalStatus.totalDias.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="text-xs">
                                      {totalStatus.totalFuncionarios} func.
                                    </div>
                                  </div>
                                ) : (
                                  <div>-</div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-900">
                            <div>
                              {dashboardData.resumo.totalDiasGeral.toLocaleString('pt-BR')}
                            </div>
                            <div className="text-xs">
                              {dashboardData.resumo.totalFuncionariosGeral} func.
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {dashboardData ? "Nenhum dado encontrado para os filtros selecionados." : "Nenhum dado de período encontrado."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "historico" && (
              <div className="space-y-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Carregando histórico...</p>
                  </div>
                ) : uploadsHistorico.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Nenhum upload de período encontrado.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Período
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mês/Ano
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dias
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registros
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Upload
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Por
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {uploadsHistorico.map((upload) => (
                          <tr key={upload.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(upload.periodoInicial).toLocaleDateString('pt-BR')} a{' '}
                              {new Date(upload.periodoFinal).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {upload.mesReferencia.toString().padStart(2, '0')}/{upload.anoReferencia}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {upload.totalDiasPeriodo} dias
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="text-green-600">{upload.atualizados} atualizados</div>
                              {upload.naoEncontrados > 0 && (
                                <div className="text-red-600">{upload.naoEncontrados} não encontrados</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(upload.dataUpload).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(upload.dataUpload).toLocaleTimeString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {upload.uploadPor}
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
        </div>
      </div>
    </div>
  );
}