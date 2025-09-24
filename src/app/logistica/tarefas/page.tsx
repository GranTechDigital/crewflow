"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Briefcase,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { formatarData } from "@/lib/utils";
import TarefasPadraoModal from "@/components/TarefasPadraoModal";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

interface Funcionario {
  id: number;
  nome: string;
  matricula: string;
  contrato: {
    id: number;
    numero: string;
    nome: string;
  };
}

interface Tarefa {
  id: number;
  tipo: string;
  responsavel: string;
  prioridade: "BAIXA" | "MEDIA" | "ALTA";
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
  dataLimite?: string;
  dataCriacao: string;
  descricao: string;
}

interface NovaTarefa {
  tipo: string;
  responsavel: string;
  prioridade: "BAIXA" | "MEDIA" | "ALTA";
  dataLimite: string;
  descricao: string;
}

interface RemanejamentoFuncionario {
  id: number;
  funcionario: Funcionario;
  tarefas: Tarefa[];
  statusTarefas: string;
}

export default function TarefasPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.LOGISTICA.requiredEquipe}
      requiredPermissions={ROUTE_PROTECTION.LOGISTICA.requiredPermissions}
    >
      <TarefasPageContent />
    </ProtectedRoute>
  );
}

function TarefasPageContent() {
  const params = useParams();
  const router = useRouter();
  const funcionarioId = params.id as string;

  const [remanejamento, setRemanejamento] =
    useState<RemanejamentoFuncionario | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [editandoTarefa, setEditandoTarefa] = useState<Tarefa | null>(null);
  const [mostrarModalTarefa, setMostrarModalTarefa] = useState(false);
  const [mostrarTarefasPadrao, setMostrarTarefasPadrao] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: "",
    responsavel: "",
    prioridade: "MEDIA",
    dataLimite: "",
    descricao: "",
  });

  useEffect(() => {
    if (funcionarioId) {
      fetchRemanejamento();
    }
  }, [funcionarioId]);

  const fetchRemanejamento = async () => {
    try {
      const response = await fetch(
        `/api/logistica/funcionario/${funcionarioId}`
      );
      if (!response.ok) {
        throw new Error("Erro ao carregar dados");
      }
      const data = await response.json();
      setRemanejamento(data);
    } catch (error) {
      console.error("Erro ao carregar remanejamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const criarTarefa = async () => {
    if (!novaTarefa.tipo || !novaTarefa.responsavel || !novaTarefa.descricao) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    // Validar se é possível reprovar tarefas baseado no status do prestserv
    if (
      remanejamento &&
      (remanejamento.statusPrestserv === "SUBMETIDO" ||
        remanejamento.statusPrestserv === "APROVADO")
    ) {
      alert(
        "Não é possível criar novas tarefas quando o prestserv está submetido ou aprovado"
      );
      return;
    }

    setCriandoTarefa(true);
    try {
      const response = await fetch("/api/logistica/tarefas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...novaTarefa,
          remanejamentoFuncionarioId: remanejamento?.id,
          criadoPor: "Sistema",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar tarefa");
      }

      // Resetar formulário
      setNovaTarefa({
        tipo: "",
        responsavel: "",
        prioridade: "MEDIA",
        dataLimite: "",
        descricao: "",
      });
      setMostrarFormTarefa(false);

      // Recarregar dados
      await fetchRemanejamento();
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      alert(error instanceof Error ? error.message : "Erro ao criar tarefa");
    } finally {
      setCriandoTarefa(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONCLUIDA":
        return "bg-green-100 text-green-800";
      case "EM_ANDAMENTO":
        return "bg-yellow-100 text-yellow-800";
      case "PENDENTE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONCLUIDA":
        return <CheckCircle className="w-4 h-4" />;
      case "EM_ANDAMENTO":
        return <Clock className="w-4 h-4" />;
      case "PENDENTE":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade.toUpperCase()) {
      case "ALTA":
        return "bg-red-100 text-red-800";
      case "MEDIA":
        return "bg-yellow-100 text-yellow-800";
      case "BAIXA":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando tarefas...</p>
        </div>
      </div>
    );
  }

  if (!remanejamento) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Funcionário não encontrado</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gerenciar Tarefas
              </h1>
              <p className="text-gray-600">
                Funcionário: {remanejamento.funcionario.nome}
              </p>
            </div>
          </div>

          {/* Informações do Funcionário */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  {remanejamento.funcionario.nome}
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Matrícula: {remanejamento.funcionario.matricula}</span>
                  <span>
                    Contrato:{" "}
                    {remanejamento.funcionario.contrato?.numero || "N/A"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Status das Tarefas</div>
                <div
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    remanejamento.statusTarefas
                  )}`}
                >
                  {getStatusIcon(remanejamento.statusTarefas)}
                  <span className="ml-1">{remanejamento.statusTarefas}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setMostrarFormTarefa(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Tarefa</span>
            </button>
            <button
              onClick={() => setMostrarTarefasPadrao(true)}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
            >
              Tarefas Padrões
            </button>
          </div>
        </div>

        {/* Formulário Nova Tarefa */}
        {mostrarFormTarefa && (
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Nova Tarefa
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <input
                    type="text"
                    value={novaTarefa.tipo}
                    onChange={(e) =>
                      setNovaTarefa({ ...novaTarefa, tipo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Documentação, Treinamento..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={novaTarefa.responsavel}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        responsavel: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do responsável"
                  />
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
                          | "BAIXA"
                          | "MEDIA"
                          | "ALTA",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Prevista
                  </label>
                  <input
                    type="date"
                    value={novaTarefa.dataLimite}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        dataLimite: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
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
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setMostrarFormTarefa(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={criarTarefa}
                  disabled={criandoTarefa}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {criandoTarefa ? "Criando..." : "Criar Tarefa"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Tarefas */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Tarefas ({remanejamento.tarefas?.length || 0})
            </h3>
          </div>
          <div className="p-6">
            {!remanejamento.tarefas || remanejamento.tarefas.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma tarefa encontrada</p>
                <p className="text-sm text-gray-400 mt-1">
                  Clique em "Nova Tarefa" ou "Tarefas Padrões" para começar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {remanejamento.tarefas.map((tarefa) => (
                  <div
                    key={tarefa.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900">
                            {tarefa.tipo}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              tarefa.status
                            )}`}
                          >
                            {getStatusIcon(tarefa.status)}
                            <span className="ml-1">{tarefa.status}</span>
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPrioridadeColor(
                              tarefa.prioridade
                            )}`}
                          >
                            {tarefa.prioridade}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {tarefa.descricao}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Responsável: {tarefa.responsavel}</span>
                          {tarefa.dataLimite && (
                            <span>Prazo: {formatDate(tarefa.dataLimite)}</span>
                          )}
                          <span>Criado: {formatDate(tarefa.dataCriacao)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Tarefas Padrões */}
      <TarefasPadraoModal
        isOpen={mostrarTarefasPadrao}
        onClose={() => setMostrarTarefasPadrao(false)}
        funcionario={remanejamento?.funcionario}
        onSuccess={() => {
          fetchRemanejamento();
          setMostrarTarefasPadrao(false);
        }}
      />
    </div>
  );
}
