"use client";

import { useState, useEffect } from "react";
import {   writeFile } from "xlsx";
import DowntimeStatsCard from "@/components/DowntimeStatsCard";
import DowntimeCharts from "@/components/DowntimeCharts";

interface DowntimeProjetoData {
  'COD.PROJETO'?: string;
  'NOME_PROJETO'?: string;
  'Uptime'?: string;
  'Downtime'?: string;
  'Ag. Embarque'?: number;
  '% Ag. Embarque'?: string;
  'Cadastro'?: number;
  '%Cadastro'?: string;
  'Medicina'?: number;
  '% Medicina'?: string;
  'Treinamento'?: number;
  '% Treinamento'?: string;
  'Atestado'?: number;
  '% Atestado'?: string;
  'Falta'?: number;
  '% Falta'?: string;
  'Demissão'?: number;
  '% Demissão'?: string;
  [key: string]: any;
}

interface DashboardData {
  totalProjetos: number;
  mediaUptime: number;
  mediaDowntime: number;
  totalAgEmbarque: number;
  totalCadastro: number;
  totalMedicina: number;
  projetos: any[];
  distribuicaoCategorias: any;
  ultimoUpload?: {
    dataUpload: string;
    nomeArquivo: string;
    uploadPor: string;
  } | null;
}

export default function DowntimePage() {
  const [activeTab, setActiveTab] = useState<"upload" | "dashboard">("dashboard");
  
  // Estados para upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // Estados para dashboard
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Carregar dados do dashboard
  const loadDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      const response = await fetch('/api/downtime/dashboard');
      if (response.ok) {
        const result = await response.json();
        console.log('Dados recebidos da API:', result); // Debug
        
        if (result.success && result.data) {
          // Mapear os dados da API para a estrutura esperada
          const mappedData = {
            totalProjetos: result.data.totalProjetos || 0,
            mediaUptime: result.data.medias?.uptime || 0,
            mediaDowntime: result.data.medias?.downtime || 0,
            totalAgEmbarque: result.data.totaisPorCategoria?.agEmbarque || 0,
            totalCadastro: result.data.totaisPorCategoria?.cadastro || 0,
            totalMedicina: result.data.totaisPorCategoria?.medicina || 0,
            projetos: result.data.projetos || [],
            distribuicaoCategorias: result.data.totaisPorCategoria || {},
            ultimoUpload: result.data.ultimoUpload || null
          };
          console.log('Dados mapeados:', mappedData); // Debug
          setDashboardData(mappedData);
        } else {
          console.error('Estrutura de dados inválida:', result);
        }
      } else {
        console.error('Erro ao carregar dados do dashboard');
      }
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      loadDashboardData();
    }
  }, [activeTab]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage("");
      setMessageType("");
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setMessage("Por favor, selecione um arquivo Excel.");
      setMessageType("error");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setMessage(response.message || "Arquivo processado com sucesso!");
          setMessageType("success");
          setFile(null);
          // Recarregar dados do dashboard se estiver na aba dashboard
          if (activeTab === "dashboard") {
            loadDashboardData();
          }
        } else {
          const errorResponse = JSON.parse(xhr.responseText);
          setMessage(errorResponse.error || "Erro ao processar arquivo.");
          setMessageType("error");
        }
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener("error", () => {
        setMessage("Erro de conexão ao fazer upload.");
        setMessageType("error");
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", "/api/downtime/upload");
      xhr.send(formData);
    } catch (error) {
      console.error("Erro no upload:", error);
      setMessage("Erro inesperado ao fazer upload.");
      setMessageType("error");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Downtime</h1>
          <p className="mt-2 text-gray-600">
            Gerencie e visualize dados de downtime dos projetos
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "dashboard"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "upload"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Upload de Dados
              </button>
            </nav>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {loadingDashboard ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : dashboardData ? (
              <>
                {/* Stats Cards */}
                 <div className="grid grid-cols-3 lg:grid-cols-3 gap-6">
                   <DowntimeStatsCard
                     title="Total de Projetos"
                     value={(dashboardData?.totalProjetos || 0).toString()}
                     subtitle="Projetos ativos"
                     icon="📊"
                     color="blue"
                   />
                   <DowntimeStatsCard
                     title="Média de Uptime"
                     value={`${(dashboardData?.mediaUptime || 0).toFixed(1)}%`}
                     subtitle="Tempo ativo médio"
                     icon="⬆️"
                     color="green"
                   />
                   <DowntimeStatsCard
                     title="Média de Downtime"
                     value={`${(dashboardData?.mediaDowntime || 0).toFixed(1)}%`}
                     subtitle="Tempo inativo médio"
                     icon="⬇️"
                     color="red"
                   />
                 </div>

                 {/* Informações de Upload */}
                 {dashboardData?.ultimoUpload && (
                   <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center space-x-3">
                         <div className="flex-shrink-0">
                           <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                           </svg>
                         </div>
                         <div>
                           <p className="text-sm font-medium text-gray-900">
                             Última atualização: {new Date(dashboardData.ultimoUpload.dataUpload).toLocaleString('pt-BR')}
                           </p>
                           <p className="text-xs text-gray-600">
                             Arquivo: {dashboardData.ultimoUpload.nomeArquivo} • 
                             Enviado por: {dashboardData.ultimoUpload.uploadPor}
                           </p>
                         </div>
                       </div>
                       <div className="flex-shrink-0">
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           Atualizado
                         </span>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Charts */}
                 <DowntimeCharts 
                   projetos={dashboardData?.projetos || []}
                   distribuicaoCategorias={dashboardData?.distribuicaoCategorias || {}}
                 />
              </>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum dado disponível
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Para visualizar o dashboard, você precisa fazer upload de um arquivo Excel com dados de downtime primeiro.
                    </p>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Fazer Upload
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Upload de Arquivo Excel
              </h2>

              <div className="space-y-6">
                {/* Informações sobre o formato */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Formato esperado do arquivo:
                  </h3>
                </div>

                {/* Área de upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <svg
                      className="w-12 h-12 text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-lg font-medium text-gray-900">
                      Clique para selecionar arquivo
                    </span>
                    <span className="text-sm text-gray-500 mt-1">
                      Apenas arquivos Excel (.xlsx, .xls)
                    </span>
                  </label>
                </div>

                {/* Arquivo selecionado */}
                {file && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg
                          className="w-8 h-8 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-blue-800">
                          {file.name}
                        </p>
                        <p className="text-sm text-blue-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Barra de progresso */}
                {uploading && (
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}

                {/* Mensagem */}
                {message && (
                  <div
                    className={`p-4 rounded-md ${
                      messageType === "success"
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    <p className="text-sm">{message}</p>
                  </div>
                )}

                {/* Botão de upload */}
                <div className="flex justify-end">
                  <button
                    onClick={handleFileUpload}
                    disabled={!file || uploading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? "Processando..." : "Fazer Upload"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
