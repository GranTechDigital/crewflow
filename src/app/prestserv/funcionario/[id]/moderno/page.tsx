"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  RemanejamentoFuncionario,
  StatusPrestserv,
  TarefaRemanejamento,
  StatusTarefa,
} from "@/types/remanejamento-funcionario";
import TarefaUnicaModal from "@/components/TarefaUnicaModal";
import HistoricoSimplificado from "@/components/HistoricoSimplificado";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";
import {
  ArrowLeftIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon as ClockIconSolid,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  FlagIcon,
  StarIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  CogIcon,
  BellIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface NovaObservacao {
  observacao: string;
}

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

interface NovaObservacaoTarefa {
  texto: string;
  criadoPor: string;
}

export default function DetalheFuncionario() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PRESTSERV.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PRESTSERV.requiredPermissions}
    >
      <DetalheFuncionarioContent />
    </ProtectedRoute>
  );
}

function DetalheFuncionarioContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const funcionarioId = params.id as string;

  const [funcionario, setFuncionario] =
    useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [mostrarObservacao, setMostrarObservacao] = useState(false);
  const [acaoPrestserv, setAcaoPrestserv] = useState<
    "submeter" | "aprovar" | "rejeitar" | null
  >(null);
  const [novaObservacao, setNovaObservacao] = useState<NovaObservacao>({
    observacao: "",
  });
  const [activeTab, setActiveTab] = useState<
    "overview" | "tasks" | "history" | "notes"
  >("overview");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [observacoesTarefa, setObservacoesTarefa] = useState<{
    [key: string]: ObservacaoTarefa[];
  }>({});
  const [mostrarObservacoesTarefa, setMostrarObservacoesTarefa] = useState<
    string | null
  >(null);
  const [editandoObservacao, setEditandoObservacao] = useState<number | null>(
    null
  );
  const [textoEdicaoObservacao, setTextoEdicaoObservacao] = useState("");
  const [novaObservacaoTarefa, setNovaObservacaoTarefa] =
    useState<NovaObservacaoTarefa>({ texto: "", criadoPor: "Sistema" });
  const [mostrarTarefaUnica, setMostrarTarefaUnica] = useState(false);

  const fetchFuncionario = useCallback(async () => {
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
  }, [funcionarioId]);

  useEffect(() => {
    if (funcionarioId) {
      fetchFuncionario();
    }
  }, [funcionarioId, fetchFuncionario]);

  const atualizarStatusPrestserv = async (
    novoStatus: StatusPrestserv,
    observacao?: string
  ) => {
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
          credentials: 'include',
          body: JSON.stringify({
            statusPrestserv: novoStatus,
            observacoesPrestserv: observacao,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao atualizar status");
      }

      await fetchFuncionario();

      // Notificações específicas para cada status
      const mensagens = {
        PENDENTE: "Status pendente.",
        CRIADO: "Rascunho criado com sucesso!",
        "EM VALIDAÇÃO": "Prestserv em validação!",
        INVALIDADO: "Prestserv invalidado!",
        VALIDADO: "Prestserv validado com sucesso!",
        "SISPAT BLOQUEADO": "SISPAT bloqueado — seguir para rascunho",
        "PENDENTE DE DESLIGAMENTO": "Marcado como pendente de desligamento",
        "DESLIGAMENTO SOLICITADO": "Desligamento solicitado",
        SOLICITAR_DESLIGAMENTO:
          "Solicitação de desligamento registrada com sucesso!",
        SUBMETIDO: "Prestserv submetido para aprovação com sucesso!",
        APROVADO: "Prestserv aprovado com sucesso!",
        REJEITADO: "Prestserv rejeitado com sucesso!",
        CANCELADO: "Prestserv cancelado com sucesso!",
      };

      const mensagem =
        mensagens[novoStatus] || "Status atualizado com sucesso!";
      showToast(mensagem, "success");

      setMostrarObservacao(false);
      setNovaObservacao({ observacao: "" });
      setAcaoPrestserv(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const getStatusTarefaColor = (status: string) => {
    const colors: { [key: string]: string } = {
      "ATENDER TAREFAS": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "SOLICITAÇÃO CONCLUÍDA": "bg-green-100 text-green-800 border-green-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusPrestservColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDENTE: "bg-gray-100 text-gray-800 border-gray-200",
      CRIADO: "bg-blue-100 text-blue-800 border-blue-200",
      SOLICITAR_DESLIGAMENTO: "bg-orange-100 text-orange-800 border-orange-200",
      SUBMETIDO: "bg-purple-100 text-purple-800 border-purple-200",
      APROVADO: "bg-green-100 text-green-800 border-green-200",
      REJEITADO: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getTarefaStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      "ATENDER TAREFAS": "bg-yellow-100 text-yellow-800 border-yellow-200",
      EM_ANDAMENTO: "bg-orange-100 text-orange-800 border-orange-200",
      "SOLICITAÇÃO CONCLUÍDA": "bg-green-100 text-green-800 border-green-200",
      CANCELADO: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: { [key: string]: string } = {
      Alta: "bg-red-100 text-red-800 border-red-200",
      Media: "bg-yellow-100 text-yellow-800 border-yellow-200",
      Baixa: "bg-green-100 text-green-800 border-green-200",
    };
    return colors[prioridade] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const isTaskOverdue = (dataLimite: string | null) => {
    if (!dataLimite) return false;
    return new Date(dataLimite) < new Date();
  };

  const podeSolicitarDesligamento = () => {
    return (
      funcionario?.statusTarefa === "CONCLUIDO" &&
      (funcionario?.statusPrestserv === "CRIADO" ||
        funcionario?.statusPrestserv === "INVALIDADO")
    );
  };

  const podeSubmeterPrestserv = () => {
    return funcionario?.statusPrestserv === "CRIADO";
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
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    }
  };

  const adicionarObservacaoTarefa = async (tarefaId: string) => {
    if (!novaObservacaoTarefa.texto.trim()) {
      showToast("Digite uma observação", "error");
      return;
    }

    try {
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaId}/observacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(novaObservacaoTarefa),
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao adicionar observação");
      }

      await buscarObservacoesTarefa(tarefaId);
      setNovaObservacaoTarefa({ texto: "", criadoPor: "Sistema" });
      showToast("Observação adicionada com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    }
  };

  const editarObservacaoTarefa = async (
    observacaoId: number,
    tarefaId: string
  ) => {
    if (!textoEdicaoObservacao.trim()) {
      showToast("Digite uma observação", "error");
      return;
    }

    try {
      const response = await fetch(
        `/api/logistica/tarefas/observacoes/${observacaoId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ texto: textoEdicaoObservacao }),
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao editar observação");
      }

      await buscarObservacoesTarefa(tarefaId);
      setEditandoObservacao(null);
      setTextoEdicaoObservacao("");
      showToast("Observação editada com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    }
  };

  const excluirObservacaoTarefa = async (
    observacaoId: number,
    tarefaId: string
  ) => {
    if (!confirm("Tem certeza que deseja excluir esta observação?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/logistica/tarefas/observacoes/${observacaoId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao excluir observação");
      }

      await buscarObservacoesTarefa(tarefaId);
      showToast("Observação excluída com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Carregando dados do funcionário...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Erro</div>
          <p className="text-gray-600">{error}</p>
          <div className="mt-4 space-x-2">
            <button
              onClick={fetchFuncionario}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!funcionario) {
    return <div>Funcionário não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Fixo */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                ← Voltar
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {funcionario.funcionario?.nome || ""}
                </h1>
                <p className="text-sm text-gray-500">
                  {funcionario.funcionario?.matricula || ""} •{" "}
                  {funcionario.funcionario?.funcao || "Não informada"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* <button
                onClick={() => router.push(`/prestserv/funcionario/${funcionarioId}/elegante`)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Versão Elegante
              </button>
              <button
                onClick={() => router.push(`/prestserv/funcionario/${funcionarioId}/moderno`)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                <StarIcon className="w-4 h-4 mr-2" />
                Versão Moderna
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusTarefaColor(
                  funcionario.statusTarefa
                )}`}
              >
                📋 Tarefas: {funcionario.statusTarefa}
              </span>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusPrestservColor(
                  funcionario.statusPrestserv
                )}`}
              >
                📄 Prestserv: {funcionario.statusPrestserv.replace("_", " ")}
              </span>
            </div>
            {funcionario.tarefas && funcionario.tarefas.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">Progresso:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (funcionario.tarefas.filter(
                            (t) => t.status === "CONCLUIDO"
                          ).length /
                            funcionario.tarefas.length) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {
                      funcionario.tarefas.filter(
                        (t) => t.status === "CONCLUIDO"
                      ).length
                    }
                    /{funcionario.tarefas.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal - Informações e Tarefas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Solicitação */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Informações da Solicitação
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Solicitação
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      #{funcionario.solicitacao?.id ?? ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Status da Solicitação
                    </p>
                    <span
                      className={`inline-block px-2 py-1 text-sm font-medium rounded border ${getStatusTarefaColor(
                        funcionario.solicitacao?.status || ""
                      )}`}
                    >
                      🗂️{" "}
                      {(funcionario.solicitacao?.status || "").replace(
                        "_",
                        " "
                      )}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Contrato Origem
                    </p>
                    <div className="font-medium">
                      {funcionario.solicitacao?.contratoOrigem ? (
                        <div>
                          <p className="text-gray-900">
                            {funcionario.solicitacao?.contratoOrigem?.nome ||
                              ""}
                          </p>
                          <p className="text-sm text-gray-500">
                            Nº{" "}
                            {funcionario.solicitacao?.contratoOrigem?.numero ||
                              ""}{" "}
                            -{" "}
                            {funcionario.solicitacao?.contratoOrigem?.cliente ||
                              ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-orange-600 font-medium">
                          USUÁRIO NOVO - NÃO POSSUÍA CONTRATO
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Contrato Destino
                    </p>
                    <div className="font-medium">
                      {funcionario.solicitacao?.contratoDestino ? (
                        <div>
                          <p className="text-gray-900">
                            {funcionario.solicitacao?.contratoDestino?.nome ||
                              ""}
                          </p>
                          <p className="text-sm text-gray-500">
                            Nº{" "}
                            {funcionario.solicitacao?.contratoDestino?.numero ||
                              ""}{" "}
                            -{" "}
                            {funcionario.solicitacao?.contratoDestino
                              ?.cliente || ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-500">Não informado</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Solicitante
                    </p>
                    <p className="text-lg text-gray-900">
                      {String(funcionario.solicitacao?.solicitadoPorId ?? "")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Data da Solicitação
                    </p>
                    <p className="text-lg text-gray-900">
                      {funcionario.solicitacao?.dataSolicitacao
                        ? formatDate(funcionario.solicitacao.dataSolicitacao)
                        : ""}
                    </p>
                  </div>
                </div>
                {funcionario.solicitacao?.justificativa && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-500 mb-2">
                      Justificativa
                    </p>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                      {funcionario.solicitacao?.justificativa || ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Resumo de Tarefas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                    Tarefas
                  </h2>
                  <button
                    onClick={() =>
                      router.push(
                        `/prestserv/funcionario/${funcionarioId}/tarefas`
                      )
                    }
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                  >
                    <ClipboardDocumentListIcon className="w-4 h-4 mr-2" />
                    Gerenciar Tarefas
                  </button>
                </div>
              </div>

              <div className="p-6">
                {funcionario.tarefas?.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardDocumentListIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma tarefa cadastrada
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Comece criando tarefas para este funcionário.
                    </p>
                    <button
                      onClick={() =>
                        router.push(
                          `/prestserv/funcionario/${funcionarioId}/tarefas`
                        )
                      }
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Criar primeira tarefa
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Estatísticas das Tarefas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <ClipboardDocumentListIcon className="w-8 h-8 text-gray-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-500">
                              Total
                            </p>
                            <p className="text-2xl font-semibold text-gray-900">
                              {funcionario.tarefas?.length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <ClockIcon className="w-8 h-8 text-yellow-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-yellow-600">
                              Pendentes
                            </p>
                            <p className="text-2xl font-semibold text-yellow-900">
                              {funcionario.tarefas?.filter(
                                (t) => t.status === "EM_ANDAMENTO"
                              ).length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <ClockIcon className="w-8 h-8 text-blue-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-blue-600">
                              Em Andamento
                            </p>
                            <p className="text-2xl font-semibold text-blue-900">
                              {funcionario.tarefas?.filter(
                                (t) => t.status === "EM_ANDAMENTO"
                              ).length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <CheckCircleIcon className="w-8 h-8 text-green-600" />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-600">
                              Concluídas
                            </p>
                            <p className="text-2xl font-semibold text-green-900">
                              {funcionario.tarefas?.filter(
                                (t) => t.status === "CONCLUIDO"
                              ).length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tarefas em Atraso */}
                    {funcionario.tarefas?.some(
                      (t) =>
                        isTaskOverdue(t.dataLimite || null) && t.status !== "CONCLUIDO"
                    ) && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center mb-2">
                          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
                          <h3 className="font-medium text-red-900">
                            Tarefas em Atraso
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {funcionario.tarefas
                            ?.filter(
                              (t) =>
                                isTaskOverdue(t.dataLimite || null) &&
                                t.status !== "CONCLUIDO"
                            )
                            .map((tarefa) => (
                              <div
                                key={tarefa.id}
                                className="text-sm text-red-800"
                              >
                                • {tarefa.tipo} - Previsão:{" "}
                                {tarefa.dataLimite
                                  ? formatDate(tarefa.dataLimite)
                                  : "N/A"}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="text-center">
                      <button
                        onClick={() =>
                          router.push(
                            `/prestserv/funcionario/${funcionarioId}/tarefas`
                          )
                        }
                        className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                      >
                        <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                        Ver Todas as Tarefas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Lateral - Controle do Prestserv */}
          <div className="space-y-6">
            {/* Status e Controles */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Controle do Prestserv
                </h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Status Atual */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">
                    Status Atual
                  </p>
                  <span
                    className={`inline-block px-3 py-2 text-sm font-medium rounded-lg border ${getStatusPrestservColor(
                      funcionario.statusPrestserv
                    )}`}
                  >
                    {funcionario.statusPrestserv.replace("_", " ")}
                  </span>
                </div>

                {/* Alertas de Status */}
                {funcionario.statusTarefa === "EM_ANDAMENTO" && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Aguardando conclusão das tarefas para liberar o
                      Prestserv
                    </p>
                  </div>
                )}

                {podeSubmeterPrestserv() && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✅ Funcionário apto para submissão do Prestserv
                    </p>
                  </div>
                )}

                {podeSolicitarDesligamento() && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      ✅ Todas as SUBMETER RASCUNHO. Solicite o desligamento
                      para liberar a submissão do Prestserv.
                    </p>
                    <button
                      onClick={() =>
                        atualizarStatusPrestserv("CANCELADO")
                      }
                      disabled={atualizandoStatus}
                      className="mt-2 w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      Solicitar Desligamento
                    </button>
                  </div>
                )}

                {/* Ações do Prestserv */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-500">
                    Ações Disponíveis
                  </p>
                  {funcionario.statusPrestserv !== "VALIDADO" && (
                    <select
                      value=""
                      onChange={(e) => {
                        const acao = e.target.value;

                        // Validações baseadas no status atual
                        if (acao === "criar-rascunho") {
                          if (
                            funcionario.statusPrestserv !== "PENDENTE" &&
                            funcionario.statusTarefa !== "EM_ANDAMENTO"
                          ) {
                            showToast(
                              "Só é possível criar rascunho quando o status está PENDENTE ou quando há tarefas para atender",
                              "warning"
                            );
                            e.target.value = "";
                            return;
                          }
                          atualizarStatusPrestserv("CRIADO");
                        } else if (acao === "submeter") {
                          if (
                            funcionario.statusPrestserv !==
                            "CRIADO"
                          ) {
                            showToast(
                              "Só é possível submeter quando o status é Solicitar Desligamento",
                              "warning"
                            );
                            e.target.value = "";
                            return;
                          }
                          if (!podeSubmeterPrestserv()) {
                            showToast(
                              "Todas as tarefas devem estar concluídas antes de submeter",
                              "warning"
                            );
                            e.target.value = "";
                            return;
                          }
                          setAcaoPrestserv("submeter");
                          setNovaObservacao({ observacao: "" });
                          setMostrarObservacao(true);
                        } else if (acao === "aprovar") {
                          if (funcionario.statusPrestserv !== "EM VALIDAÇÃO") {
                            showToast(
                              "Só é possível aprovar quando o prestserv foi submetido",
                              "warning"
                            );
                            e.target.value = "";
                            return;
                          }
                          setAcaoPrestserv("aprovar");
                          setNovaObservacao({ observacao: "" });
                          setMostrarObservacao(true);
                        } else if (acao === "rejeitar") {
                          if (funcionario.statusPrestserv !== "EM VALIDAÇÃO") {
                            showToast(
                              "Só é possível rejeitar quando o prestserv foi submetido",
                              "warning"
                            );
                            e.target.value = "";
                            return;
                          }
                          setAcaoPrestserv("rejeitar");
                          setNovaObservacao({ observacao: "" });
                          setMostrarObservacao(true);
                        }

                        e.target.value = ""; // Reset select
                      }}
                      disabled={atualizandoStatus}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">📋 Selecione uma ação</option>
                      <option value="criar-rascunho">📝 Criar Rascunho</option>
                      <option value="submeter">
                        📤 Submeter para Aprovação
                      </option>
                      <option value="aprovar">✅ Aprovar</option>
                      <option value="rejeitar">❌ Rejeitar</option>
                    </select>
                  )}

                  {funcionario.statusPrestserv === "INVALIDADO" && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      ⚠️ Prestserv rejeitado. Crie novas tarefas para tratar as
                      pendências e submeta novamente.
                    </div>
                  )}

                  {funcionario.statusPrestserv === "VALIDADO" && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
                      ✅ Prestserv Aprovado
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Histórico */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Histórico
                </h3>
              </div>
              <div className="p-6">
                <HistoricoSimplificado funcionarioId={funcionario.id} />
              </div>
            </div>

            {/* Observações */}
            {funcionario.observacoesPrestserv && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Observações
                  </h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {funcionario.observacoesPrestserv}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Observação */}
        {mostrarObservacao && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-4">
                {acaoPrestserv === "submeter" && "📤 Submeter para Aprovação"}
                {acaoPrestserv === "aprovar" && "✅ Aprovar Prestserv"}
                {acaoPrestserv === "rejeitar" && "❌ Rejeitar Prestserv"}
              </h3>
              <textarea
                value={novaObservacao.observacao}
                onChange={(e) =>
                  setNovaObservacao({ observacao: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite uma observação (opcional)..."
              />
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => {
                    let novoStatus: StatusPrestserv;

                    if (acaoPrestserv === "submeter") {
                      novoStatus = "EM VALIDAÇÃO";
                    } else if (acaoPrestserv === "aprovar") {
                      novoStatus = "VALIDADO";
                    } else if (acaoPrestserv === "rejeitar") {
                      novoStatus = "INVALIDADO";
                    } else {
                      return;
                    }

                    atualizarStatusPrestserv(
                      novoStatus,
                      novaObservacao.observacao
                    );
                  }}
                  disabled={atualizandoStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {atualizandoStatus ? "Salvando..." : "Confirmar"}
                </button>
                <button
                  onClick={() => {
                    setMostrarObservacao(false);
                    setNovaObservacao({ observacao: "" });
                    setAcaoPrestserv(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Observações da Tarefa */}
      {mostrarObservacoesTarefa && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Observações da Tarefa</h3>
              <button
                onClick={() => {
                  setMostrarObservacoesTarefa(null);
                  setEditandoObservacao(null);
                  setTextoEdicaoObservacao("");
                  setNovaObservacaoTarefa({ texto: "", criadoPor: "Sistema" });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Adicionar Nova Observação */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Adicionar Observação</h4>
              <div className="space-y-3">
                <textarea
                  value={novaObservacaoTarefa.texto}
                  onChange={(e) =>
                    setNovaObservacaoTarefa({
                      ...novaObservacaoTarefa,
                      texto: e.target.value,
                    })
                  }
                  placeholder="Digite sua observação..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <button
                  onClick={() =>
                    adicionarObservacaoTarefa(
                      mostrarObservacoesTarefa?.toString() || ""
                    )
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Adicionar Observação
                </button>
              </div>
            </div>

            {/* Lista de Observações */}
            <div>
              <h4 className="font-medium mb-3">Observações Existentes</h4>
              {observacoesTarefa[mostrarObservacoesTarefa]?.length > 0 ? (
                <div className="space-y-3">
                  {observacoesTarefa[mostrarObservacoesTarefa].map((obs) => (
                    <div
                      key={obs.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      {editandoObservacao === obs.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={textoEdicaoObservacao}
                            onChange={(e) =>
                              setTextoEdicaoObservacao(e.target.value)
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                editarObservacaoTarefa(
                                  obs.id,
                                  mostrarObservacoesTarefa?.toString() || ""
                                )
                              }
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => {
                                setEditandoObservacao(null);
                                setTextoEdicaoObservacao("");
                              }}
                              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-800 mb-2">{obs.texto}</p>
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <div>
                              <span>Criado por: {obs.criadoPor}</span>
                              <span className="ml-4">
                                Em:{" "}
                                {new Date(obs.dataCriacao).toLocaleString(
                                  "pt-BR"
                                )}
                              </span>
                              {obs.dataModificacao !== obs.dataCriacao && (
                                <span className="ml-4">
                                  Modificado:{" "}
                                  {new Date(obs.dataModificacao).toLocaleString(
                                    "pt-BR"
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setEditandoObservacao(obs.id);
                                  setTextoEdicaoObservacao(obs.texto);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  excluirObservacaoTarefa(
                                    obs.id,
                                    mostrarObservacoesTarefa?.toString() || ""
                                  )
                                }
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma observação encontrada.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
