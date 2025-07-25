"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  RemanejamentoFuncionario,
  TarefaRemanejamento,
} from "@/types/remanejamento-funcionario";
import TarefasPadraoModal from "@/components/TarefasPadraoModal";

import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";
import {
  ArrowLeftIcon,
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
  UserIcon,
  BuildingOfficeIcon,
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

interface NovaObservacaoTarefa {
  texto: string;
  criadoPor: string;
}

export default function TarefasFuncionarioPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.PRESTSERV.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.PRESTSERV.requiredPermissions}
    >
      <TarefasFuncionarioContent />
    </ProtectedRoute>
  );
}

function TarefasFuncionarioContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const funcionarioId = params.id as string;

  const [funcionario, setFuncionario] =
    useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  const [mostrarTarefasPadrao, setMostrarTarefasPadrao] = useState(false);

  const [editandoDataLimite, setEditandoDataLimite] = useState<string | null>(
    null
  );
  const [novaDataLimite, setNovaDataLimite] = useState("");
  const [observacoesTarefa, setObservacoesTarefa] = useState<{
    [key: string]: ObservacaoTarefa[];
  }>({});
  const [mostrarObservacoesTarefa, setMostrarObservacoesTarefa] = useState<
    string | null
  >(null);
  const [novaObservacaoTarefa, setNovaObservacaoTarefa] =
    useState<NovaObservacaoTarefa>({
      texto: "",
      criadoPor: "Sistema",
    });
  const [adicionandoObservacao, setAdicionandoObservacao] = useState(false);
  const [editandoObservacao, setEditandoObservacao] = useState<number | null>(
    null
  );
  const [textoEdicaoObservacao, setTextoEdicaoObservacao] = useState("");
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: "",
    descricao: "",
    responsavel: "",
    prioridade: "Media",
    dataLimite: "",
  });

  useEffect(() => {
    fetchFuncionario();
  }, [funcionarioId]);

  const fetchFuncionario = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/logistica/funcionario/${funcionarioId}`
      );
      if (!response.ok) {
        throw new Error("Funcionário não encontrado");
      }
      const data = await response.json();
      setFuncionario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const criarTarefa = async () => {
    if (!novaTarefa.tipo || !novaTarefa.descricao || !novaTarefa.responsavel) {
      showToast("Preencha todos os campos obrigatórios", "error");
      return;
    }

    if (
      funcionario &&
      (funcionario.statusPrestserv === "SUBMETIDO" ||
        funcionario.statusPrestserv === "APROVADO")
    ) {
      showToast(
        "Não é possível criar novas tarefas quando o prestserv está submetido ou aprovado",
        "warning"
      );
      return;
    }

    if (criandoTarefa) return;

    setCriandoTarefa(true);

    try {
      const response = await fetch("/api/logistica/tarefas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...novaTarefa,
          remanejamentoFuncionarioId: funcionarioId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar tarefa");
      }

      await fetchFuncionario();
      setMostrarFormTarefa(false);
      setNovaTarefa({
        tipo: "",
        descricao: "",
        responsavel: "",
        prioridade: "Media",
        dataLimite: "",
      });
      showToast("Tarefa criada com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    } finally {
      setCriandoTarefa(false);
    }
  };

  const atualizarTarefa = async (tarefaId: string, novoStatus: string) => {
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: novoStatus }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar tarefa");
      }

      await fetchFuncionario();
      showToast("Tarefa atualizada com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    }
  };

  const excluirTarefa = async (tarefaId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) {
      return;
    }

    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir tarefa");
      }

      await fetchFuncionario();
      showToast("Tarefa excluída com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
    }
  };

  const editarDataLimiteTarefa = async (tarefaId: string) => {
    try {
      const response = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataLimite: novaDataLimite }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar data limite");
      }

      await fetchFuncionario();
      setEditandoDataLimite(null);
      setNovaDataLimite("");
      showToast("Data limite atualizada com sucesso!", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro desconhecido",
        "error"
      );
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

    setAdicionandoObservacao(true);

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
    } finally {
      setAdicionandoObservacao(false);
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
          body: JSON.stringify({ 
            texto: textoEdicaoObservacao,
            modificadoPor: "Sistema"
          }),
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

  // Funções auxiliares
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

  const getTarefaStatusColor = (status: string) => {
    switch (status) {
      case "ATENDER TAREFAS":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "EM_ANDAMENTO":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "SOLICITAÇÃO CONCLUÍDA":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "Alta":
        return "bg-red-50 text-red-700 border-red-200";
      case "Media":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "Baixa":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Funcionário não encontrado
          </h2>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() =>
                router.push(`/prestserv/funcionario/${funcionarioId}`)
              }
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Voltar ao Funcionário
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {funcionario.funcionario?.nome}
                </h1>
                <p className="text-gray-600">
                  Matrícula: {funcionario.funcionario?.matricula} | Função:{" "}
                  {funcionario.funcionario?.funcao || "N/A"}
                </p>
                <div className="flex items-center space-x-3 mt-2">
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${
                      funcionario.statusTarefas === "SUBMETER RASCUNHO"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : funcionario.statusTarefas === "CRIAR TAREFAS"
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : funcionario.statusTarefas === "ATENDER TAREFAS"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    📋 Tarefas:{" "}
                    {funcionario.statusTarefas === "CRIAR TAREFAS"
                      ? "CRIAR TAREFAS"
                      : funcionario.statusTarefas === "SUBMETER RASCUNHO"
                      ? "PROCESSO CONCLUÍDO"
                      : funcionario.statusTarefas === "ATENDER TAREFAS"
                      ? "ATENDER TAREFAS"
                      : funcionario.statusTarefas}
                  </span>
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${
                      funcionario.statusPrestserv === "APROVADO"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : funcionario.statusPrestserv === "SUBMETIDO"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : funcionario.statusPrestserv === "CRIADO"
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : funcionario.statusPrestserv === "REJEITADO"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    📄 Prestserv: {funcionario.statusPrestserv}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tarefas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                Tarefas do Funcionário
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setMostrarFormTarefa(true)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                >
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Nova Tarefa
                </button>
                <button
                  onClick={() => setMostrarTarefasPadrao(true)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100"
                >
                  <DocumentTextIcon className="w-4 h-4 mr-1" />
                  Padrões
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Formulário de Nova Tarefa */}
            {mostrarFormTarefa && (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-medium text-gray-900 mb-3">Nova Tarefa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo *
                    </label>
                    <input
                      type="text"
                      value={novaTarefa.tipo}
                      onChange={(e) =>
                        setNovaTarefa({ ...novaTarefa, tipo: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Documentação, Exame médico..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Responsável *
                    </label>
                    <select
                      value={novaTarefa.responsavel}
                      onChange={(e) =>
                        setNovaTarefa({
                          ...novaTarefa,
                          responsavel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o responsável</option>
                      <option value="RH">RH - Recursos Humanos</option>
                      <option value="MEDICINA">
                        MEDICINA - Medicina do Trabalho
                      </option>
                      <option value="TREINAMENTO">
                        TREINAMENTO - Treinamento
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prioridade
                    </label>
                    <select
                      value={novaTarefa.prioridade}
                      onChange={(e) =>
                        setNovaTarefa({
                          ...novaTarefa,
                          prioridade: e.target.value as
                            | "Baixa"
                            | "Media"
                            | "Alta",
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Media">Média</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Previsão
                    </label>
                    <input
                      type="date"
                      value={novaTarefa.dataLimite || ""}
                      onChange={(e) =>
                        setNovaTarefa({
                          ...novaTarefa,
                          dataLimite: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição *
                  </label>
                  <textarea
                    value={novaTarefa.descricao}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        descricao: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Descreva a tarefa..."
                  />
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={criarTarefa}
                    disabled={criandoTarefa}
                    className={`px-4 py-2 text-white rounded transition-colors ${
                      criandoTarefa
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {criandoTarefa ? "Criando..." : "Criar Tarefa"}
                  </button>
                  <button
                    onClick={() => setMostrarFormTarefa(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de Tarefas */}
            <div className="space-y-4">
              {funcionario.tarefas?.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardDocumentListIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma tarefa cadastrada
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Comece criando uma nova tarefa para este funcionário.
                  </p>
                  <button
                    onClick={() => setMostrarFormTarefa(true)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Criar primeira tarefa
                  </button>
                </div>
              ) : (
                funcionario.tarefas?.map((tarefa) => (
                  <div
                    key={tarefa.id}
                    className={`border rounded-lg p-4 ${
                      isTaskOverdue(tarefa.dataLimite) &&
                      tarefa.status !== "CONCLUIDO"
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {tarefa.tipo}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {tarefa.descricao}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${getTarefaStatusColor(
                            tarefa.status
                          )}`}
                        >
                          {tarefa.status.replace("_", " ")}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded border ${getPrioridadeColor(
                            tarefa.prioridade
                          )}`}
                        >
                          {tarefa.prioridade}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                      <div>Responsável: {tarefa.responsavel}</div>
                      <div
                        className={
                          isTaskOverdue(tarefa.dataLimite) &&
                          tarefa.status !== "CONCLUIDO"
                            ? "text-red-600 font-medium"
                            : ""
                        }
                      >
                        {editandoDataLimite === tarefa.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="date"
                              value={novaDataLimite}
                              onChange={(e) =>
                                setNovaDataLimite(e.target.value)
                              }
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() =>
                                editarDataLimiteTarefa(
                                  tarefa.id?.toString() || ""
                                )
                              }
                              className="text-green-600 hover:text-green-800"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditandoDataLimite(null);
                                setNovaDataLimite("");
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span>
                              Previsão:{" "}
                              {tarefa.dataLimite
                                ? formatDate(tarefa.dataLimite)
                                : "Não definida"}
                            </span>
                            <button
                              onClick={() => {
                                setEditandoDataLimite(tarefa.id);
                                setNovaDataLimite(
                                  tarefa.dataLimite
                                    ? new Date(tarefa.dataLimite)
                                        .toISOString()
                                        .split("T")[0]
                                    : ""
                                );
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              title="Editar data previsão"
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {tarefa.dataConclusao && (
                        <div>Concluída: {formatDate(tarefa.dataConclusao)}</div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      {tarefa.status !== "CONCLUIDO" && (
                        <button
                          onClick={() =>
                            atualizarTarefa(tarefa.id, "CONCLUIDO")
                          }
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Concluir
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMostrarObservacoesTarefa(tarefa.id);
                          buscarObservacoesTarefa(tarefa.id?.toString() || "");
                        }}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 relative flex items-center"
                      >
                        <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" />
                        Observações
                        {observacoesTarefa[tarefa.id] && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-800 rounded-full">
                            {observacoesTarefa[tarefa.id].length}
                          </span>
                        )}
                        {!observacoesTarefa[tarefa.id] && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-500 rounded-full">
                            0
                          </span>
                        )}
                      </button>
                      {tarefa.status !== "CONCLUIDO" && (
                        <button
                          onClick={() => excluirTarefa(tarefa.id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Observações da Tarefa */}
      {mostrarObservacoesTarefa && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Observações da Tarefa
              </h3>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {/* Lista de Observações */}
              <div className="space-y-4 mb-6">
                {observacoesTarefa[mostrarObservacoesTarefa]?.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    Nenhuma observação cadastrada
                  </p>
                ) : (
                  observacoesTarefa[mostrarObservacoesTarefa]?.map((obs) => (
                    <div
                      key={obs.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      {editandoObservacao === obs.id ? (
                        <div>
                          <textarea
                            value={textoEdicaoObservacao}
                            onChange={(e) =>
                              setTextoEdicaoObservacao(e.target.value)
                            }
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                editarObservacaoTarefa(
                                  obs.id,
                                  mostrarObservacoesTarefa
                                )
                              }
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => {
                                setEditandoObservacao(null);
                                setTextoEdicaoObservacao("");
                              }}
                              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-900 mb-2">{obs.texto}</p>
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>
                              Por: {obs.criadoPor} em{" "}
                              {formatDateTime(obs.dataCriacao)}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setEditandoObservacao(obs.id);
                                  setTextoEdicaoObservacao(obs.texto);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  excluirObservacaoTarefa(
                                    obs.id,
                                    mostrarObservacoesTarefa
                                  )
                                }
                                className="text-red-600 hover:text-red-800"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Formulário de Nova Observação */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  Adicionar Observação
                </h4>
                <textarea
                  value={novaObservacaoTarefa.texto}
                  onChange={(e) =>
                    setNovaObservacaoTarefa({
                      ...novaObservacaoTarefa,
                      texto: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  placeholder="Digite sua observação..."
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      adicionarObservacaoTarefa(mostrarObservacoesTarefa)
                    }
                    disabled={adicionandoObservacao}
                    className={`px-4 py-2 text-white rounded transition-colors ${
                      adicionandoObservacao
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {adicionandoObservacao ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setMostrarObservacoesTarefa(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarefas Padrões */}
      <TarefasPadraoModal
        isOpen={mostrarTarefasPadrao}
        onClose={() => setMostrarTarefasPadrao(false)}
        funcionario={
          funcionario?.funcionario
            ? {
                id: funcionario.id,
                nome: funcionario.funcionario.nome,
                matricula: funcionario.funcionario.matricula,
                statusPrestserv: funcionario.statusPrestserv,
              }
            : null
        }
        onSuccess={() => {
          fetchFuncionario();
          setMostrarTarefasPadrao(false);
        }}
      />
    </div>
  );
}
