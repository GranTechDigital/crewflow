"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  RemanejamentoFuncionario,
  StatusPrestserv,
  TarefaRemanejamento,
  StatusTarefa,
} from "@/types/remanejamento-funcionario";
import TarefaUnicaModal from "@/components/TarefaUnicaModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION, PERMISSIONS } from "@/lib/permissions";
import VersionSelector from "@/components/VersionSelector";
import FlowbiteStatusTimeline from "@/components/FlowbiteStatusTimeline";
import HistoricoCompleto from "@/components/HistoricoCompleto";
import {
  ArrowLeftIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface NovaTarefa {
  tipo: string;
  descricao: string;
  responsavel: string;
  prioridade: "Baixa" | "Media" | "Alta";
  dataLimite?: string;
}

interface ObservacaoTarefa {
  id: number;
  texto: string;
  dataCriacao: string;
  dataModificacao: string;
  criadoPor: string;
  modificadoPor: string;
}

export default function FuncionarioModernoPage() {
  return (
    <ProtectedRoute
      requiredEquipe={[
        ...ROUTE_PROTECTION.PRESTSERV.requiredEquipe,
        "RH",
        "Treinamento",
        "Medicina",
        "Planejamento",
        "Planejamento (Gestor)",
        "Planejamento (Editor)",
        "Planejamento (Visualizador)",
      ]}
      requiredPermissions={[
        ...ROUTE_PROTECTION.PRESTSERV.requiredPermissions,
        PERMISSIONS.ACCESS_RH,
        PERMISSIONS.ACCESS_TREINAMENTO,
        PERMISSIONS.ACCESS_MEDICINA,
        // Permissões específicas para o time de Planejamento
        PERMISSIONS.ACCESS_PLANEJAMENTO,
        PERMISSIONS.ACCESS_PLANEJAMENTO_VISUALIZADOR,
        PERMISSIONS.ACCESS_PLANEJAMENTO_GESTOR,
      ]}
    >
      <FuncionarioModernoContent />
    </ProtectedRoute>
  );
}

function FuncionarioModernoContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const funcionarioId = params.id as string;

  const [funcionario, setFuncionario] =
    useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "tasks" | "history" | "notes"
  >("overview");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [mostrarTarefaUnica, setMostrarTarefaUnica] = useState(false);
  const [observacoesTarefa, setObservacoesTarefa] = useState<{
    [tarefaId: string]: ObservacaoTarefa[];
  }>({});
  const [mostrarObservacoesTarefa, setMostrarObservacoesTarefa] = useState<
    string | null
  >(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [carregandoObservacoes, setCarregandoObservacoes] = useState(false);

  useEffect(() => {
    if (funcionarioId) {
      fetchFuncionario();
    }
  }, [funcionarioId]);

  useEffect(() => {
    if (funcionario?.tarefas && activeTab === "notes") {
      carregarTodasObservacoes();
    }
  }, [funcionario?.tarefas, activeTab]);

  const fetchFuncionario = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/logistica/funcionario/${funcionarioId}`
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar dados do funcionário");
      }

      const data = await response.json();
      setFuncionario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const buscarObservacoesTarefa = async (tarefaId: string) => {
    try {
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaId}/observacoes`
      );
      if (!response.ok) {
        throw new Error("Erro ao buscar observações");
      }
      const observacoes = await response.json();
      setObservacoesTarefa((prev) => ({ ...prev, [tarefaId]: observacoes }));
    } catch (err) {
      console.error("Erro ao buscar observações:", err);
    }
  };

  const carregarTodasObservacoes = async () => {
    if (!funcionario?.tarefas) return;

    setCarregandoObservacoes(true);
    try {
      const promises = funcionario.tarefas.map((tarefa) =>
        buscarObservacoesTarefa(tarefa.id)
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Erro ao carregar observações:", err);
    } finally {
      setCarregandoObservacoes(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONCLUIDO":
        return "bg-green-100 text-green-800 border-green-200";
      case "PENDENTE":
      case "EM_ANDAMENTO":
      case "RASCUNHO_CRIADO":
      case "EM_AVALIACAO":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CANCELADO":
      case "EM_CORRECAO":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "CONCLUIDO":
        return <CheckCircleIcon className="w-4 h-4" />;
      case "PENDENTE":
      case "EM_ANDAMENTO":
      case "RASCUNHO_CRIADO":
      case "EM_AVALIACAO":
        return <ClockIcon className="w-4 h-4" />;
      case "CANCELADO":
      case "EM_CORRECAO":
        return <XCircleIcon className="w-4 h-4" />;
      default:
        return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "Alta":
        return "bg-red-100 text-red-800 border-red-200";
      case "Media":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Baixa":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getProgressPercentage = () => {
    if (!funcionario?.tarefas || funcionario.tarefas.length === 0) return 0;
    const completed = funcionario.tarefas.filter(
      (t) => t.status === "CONCLUIDO"
    ).length;
    return Math.round((completed / funcionario.tarefas.length) * 100);
  };

  const atualizarStatusPrestserv = async (novoStatus: StatusPrestserv) => {
    if (!funcionario) return;

    try {
      setAtualizandoStatus(true);
      const response = await fetch(
        `/api/logistica/funcionario/${funcionarioId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            statusPrestserv: novoStatus,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao atualizar status");
      }

      // Recarregar dados do funcionário
      await fetchFuncionario();

      const mensagens: Record<StatusPrestserv, string> = {
        PENDENTE: "Prestserv marcado como pendente!",
        CRIADO: "Rascunho do prestserv criado com sucesso!",
        "EM VALIDAÇÃO": "Prestserv submetido para avaliação com sucesso!",
        INVALIDADO: "Prestserv enviado para correção com sucesso!",
        VALIDADO: "Prestserv validado com sucesso!",
        CANCELADO: "Prestserv cancelado com sucesso!",
        "SISPAT BLOQUEADO": "SISPAT bloqueado — criar rascunho em seguida",
        "PENDENTE DE DESLIGAMENTO":
          "Registro marcado como pendente de desligamento",
        "DESLIGAMENTO SOLICITADO": "Solicitação de desligamento registrada",
      };

      const mensagem =
        mensagens[novoStatus] || "Status atualizado com sucesso!";
      showToast(mensagem, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const podeAvancarStatus = () => {
    if (!funcionario) return false;

    const status = funcionario.statusPrestserv;

    // Lógica de transições válidas
    switch (status) {
      case "PENDENTE":
        return true; // Pode criar rascunho
      case "CRIADO":
        // Pode submeter se todas as tarefas estão concluídas
        return funcionario.statusTarefa === "CONCLUIDO";
      case "INVALIDADO":
        return true; // Pode recriar rascunho
      default:
        return false;
    }
  };

  const getProximoStatus = (): StatusPrestserv | null => {
    if (!funcionario) return null;

    const status = funcionario.statusPrestserv;

    switch (status) {
      case "PENDENTE":
      case "INVALIDADO":
        return "CRIADO";
      case "CRIADO":
        return "EM VALIDAÇÃO";
      default:
        return null;
    }
  };

  const getTextoProximoStatus = () => {
    const proximoStatus = getProximoStatus();

    switch (proximoStatus) {
      case "CRIADO":
        return "Criar Rascunho";
      case "EM VALIDAÇÃO":
        return "Submeter para Avaliação";
      default:
        return "Avançar Status";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg text-gray-600 font-medium">
            Carregando dados do funcionário...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <XCircleIcon className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Erro ao carregar
          </h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <div className="space-x-4">
            <button
              onClick={fetchFuncionario}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Funcionário não encontrado
          </h2>
          <p className="text-gray-600 mb-6">
            O funcionário solicitado não foi encontrado no sistema.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Moderno */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Voltar
              </button>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {funcionario.funcionario?.nome || "Funcionário"}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {funcionario.funcionario?.matricula || ""} •{" "}
                    {funcionario.funcionario?.funcao || "Função não informada"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: "overview", name: "Visão Geral", icon: ChartBarIcon },
                {
                  id: "tasks",
                  name: "Tarefas",
                  icon: ClipboardDocumentListIcon,
                },
                { id: "history", name: "Histórico", icon: ClockIcon },
                {
                  id: "notes",
                  name: "Observações",
                  icon: ChatBubbleLeftRightIcon,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4">
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Timeline de Status */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 mr-2 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Linha do Tempo do Processo
                  </h3>
                  <FlowbiteStatusTimeline
                    currentStatus={funcionario.statusPrestserv}
                    dataRascunhoCriado={funcionario.dataRascunhoCriado}
                    dataSubmetido={funcionario.dataSubmetido}
                    dataResposta={funcionario.dataResposta}
                    dataCriadoEm={funcionario.createdAt}
                  />
                </div>

                {/* Informações da Solicitação */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <DocumentTextIcon className="w-5 h-5 mr-2 text-blue-600" />
                    Informações da Solicitação
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Número da Solicitação
                        </label>
                        <p className="text-lg font-semibold text-gray-900">
                          #{funcionario.solicitacao?.id || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Solicitante
                        </label>
                        <p className="text-gray-900">N/A</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Data da Solicitação
                        </label>
                        <p className="text-gray-900">N/A</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Contrato Origem
                        </label>
                        {funcionario.solicitacao?.contratoOrigem ? (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-medium text-gray-900">
                              {funcionario.solicitacao.contratoOrigem.nome}
                            </p>
                            <p className="text-sm text-gray-500">
                              Nº {funcionario.solicitacao.contratoOrigem.numero}{" "}
                              - {funcionario.solicitacao.contratoOrigem.cliente}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                            <p className="text-orange-800 font-medium">
                              USUÁRIO NOVO - NÃO POSSUÍA CONTRATO
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Contrato Destino
                        </label>
                        {funcionario.solicitacao?.contratoDestino ? (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-medium text-gray-900">
                              {funcionario.solicitacao.contratoDestino.nome}
                            </p>
                            <p className="text-sm text-gray-500">
                              Nº{" "}
                              {funcionario.solicitacao.contratoDestino.numero} -{" "}
                              {funcionario.solicitacao.contratoDestino.cliente}
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-500">Não informado</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Status Funcionário
                        </label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <UserGroupIcon className="w-4 h-4 text-purple-600" />
                          </div>
                          <p className="text-base font-semibold text-gray-900">
                            {funcionario.statusFuncionario || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Status das Tarefas
                        </label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <ClipboardDocumentListIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <p className="text-base font-semibold text-gray-900">
                            {funcionario.statusTarefa}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tasks" && (
              <div className="space-y-6">
                {/* Progresso das Tarefas */}
                {funcionario.tarefas && funcionario.tarefas.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2 text-green-600" />
                      Progresso das Tarefas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Total
                          </span>
                          <span className="text-2xl font-bold text-gray-900">
                            {funcionario.tarefas.length}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Concluídas
                          </span>
                          <span className="text-2xl font-bold text-green-600">
                            {
                              funcionario.tarefas.filter(
                                (t) => t.status === "CONCLUIDO"
                              ).length
                            }
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Pendentes
                          </span>
                          <span className="text-2xl font-bold text-yellow-600">
                            {
                              funcionario.tarefas.filter(
                                (t) => t.status !== "CONCLUIDO"
                              ).length
                            }
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">
                            Progresso
                          </span>
                          <span className="text-2xl font-bold text-blue-600">
                            {getProgressPercentage()}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Progresso Geral</span>
                        <span className="font-medium text-gray-900">
                          {getProgressPercentage()}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${getProgressPercentage()}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {
                          funcionario.tarefas.filter(
                            (t) => t.status === "CONCLUIDO"
                          ).length
                        }{" "}
                        de {funcionario.tarefas.length} SUBMETER RASCUNHO
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Lista de Tarefas
                  </h3>
                  {funcionario.statusTarefa === "CONCLUIDO" && (
                    <button
                      onClick={() => setMostrarTarefaUnica(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Nova Tarefa
                    </button>
                  )}
                </div>

                {funcionario.tarefas && funcionario.tarefas.length > 0 ? (
                  <div className="space-y-4">
                    {funcionario.tarefas.map((tarefa) => (
                      <div
                        key={tarefa.id}
                        className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  tarefa.status === "CONCLUIDO"
                                    ? "bg-green-500"
                                    : tarefa.status === "EM_ANDAMENTO"
                                    ? "bg-yellow-500"
                                    : "bg-gray-400"
                                }`}
                              ></div>
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {tarefa.tipo}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {tarefa.descricao}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                                  tarefa.status
                                )}`}
                              >
                                {tarefa.status.replace("_", " ")}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full border ${getPrioridadeColor(
                                  tarefa.prioridade
                                )}`}
                              >
                                {tarefa.prioridade}
                              </span>
                              <button
                                onClick={() => toggleTaskExpansion(tarefa.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {expandedTasks.has(tarefa.id) ? (
                                  <ChevronUpIcon className="w-4 h-4" />
                                ) : (
                                  <ChevronDownIcon className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {expandedTasks.has(tarefa.id) && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-500">
                                  Responsável
                                </label>
                                <p className="text-gray-900">
                                  {tarefa.responsavel}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">
                                  Data Limite
                                </label>
                                <p className="text-gray-900">
                                  {tarefa.dataLimite
                                    ? formatDate(tarefa.dataLimite)
                                    : "Não definida"}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">
                                  Data de Criação
                                </label>
                                <p className="text-gray-900">
                                  {formatDateTime(tarefa.dataCriacao)}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">
                                  Última Atualização
                                </label>
                                <p className="text-gray-900">
                                  {formatDateTime(tarefa.dataCriacao)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ClipboardDocumentListIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma tarefa encontrada
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Este funcionário ainda não possui tarefas atribuídas.
                    </p>
                    {funcionario.statusTarefa === "CONCLUIDO" && (
                      <button
                        onClick={() => setMostrarTarefaUnica(true)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Criar Primeira Tarefa
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-6">
                <HistoricoCompleto funcionarioId={funcionario.id} />
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Observações das Tarefas
                  </h3>
                  <div className="text-sm text-gray-500">
                    {carregandoObservacoes
                      ? "Carregando..."
                      : `${funcionario?.tarefas?.length || 0} tarefa(s)`}
                  </div>
                </div>

                {carregandoObservacoes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="ml-3 text-gray-600">
                      Carregando observações...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {funcionario?.tarefas && funcionario.tarefas.length > 0 ? (
                      funcionario.tarefas.map((tarefa) => {
                        const observacoesDaTarefa =
                          observacoesTarefa[tarefa.id] || [];
                        return (
                          <div
                            key={tarefa.id}
                            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                          >
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <ClipboardDocumentListIcon className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-medium text-gray-700">
                                    {tarefa.tipo}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                      tarefa.status
                                    )}`}
                                  >
                                    {getStatusIcon(tarefa.status)}
                                    <span className="ml-1">
                                      {tarefa.status}
                                    </span>
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {observacoesDaTarefa.length} observação(ões)
                                </span>
                              </div>
                            </div>

                            <div className="p-6">
                              {observacoesDaTarefa.length > 0 ? (
                                <div className="space-y-4">
                                  {observacoesDaTarefa.map((obs) => (
                                    <div
                                      key={obs.id}
                                      className="border-l-4 border-blue-200 pl-4 py-2"
                                    >
                                      <div className="text-gray-900 text-sm leading-relaxed mb-2">
                                        {obs.texto}
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>Por: {obs.criadoPor}</span>
                                        <span>
                                          {formatDateTime(obs.dataCriacao)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4">
                                  <ChatBubbleLeftRightIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                  <p className="text-sm text-gray-500">
                                    Nenhuma observação para esta tarefa
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-8 text-center">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ClipboardDocumentListIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          Nenhuma tarefa encontrada
                        </h4>
                        <p className="text-gray-500 max-w-md mx-auto">
                          Este funcionário ainda não possui tarefas atribuídas,
                          portanto não há observações para exibir.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Informações adicionais sobre o sistema */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        Sobre as observações
                      </h4>
                      <p className="text-sm text-blue-700">
                        As observações são registradas para cada tarefa
                        individualmente e podem incluir comentários,
                        atualizações de status e informações importantes sobre o
                        progresso das atividades.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Tarefa Única */}
      {mostrarTarefaUnica && funcionario && (
        <TarefaUnicaModal
          isOpen={mostrarTarefaUnica}
          onClose={() => setMostrarTarefaUnica(false)}
          funcionarioId={funcionarioId}
          funcionarioNome={funcionario.funcionario?.nome || ""}
          onSuccess={() => {
            setMostrarTarefaUnica(false);
            fetchFuncionario();
            showToast("Tarefa criada com sucesso!", "success");
          }}
        />
      )}
    </div>
  );
}
