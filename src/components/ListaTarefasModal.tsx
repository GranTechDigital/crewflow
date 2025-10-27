"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { Tooltip } from "flowbite-react";

interface TarefaRemanejamento {
  id: string;
  tipo: string;
  descricao?: string;
  responsavel: string;
  status: string;
  prioridade: string;
  dataCriacao: string;
  dataLimite?: string;
  dataConclusao?: string;
  observacoes?: string;
}

interface ListaTarefasModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcionario: {
    id: string;
    nome: string;
    matricula: string;
  } | null;
  statusPrestserv?: string; // Status do prestserv para controlar visibilidade do botão reprovar
  onTarefaReprovada?: () => void; // Callback para notificar quando uma tarefa foi reprovada
}

export default function ListaTarefasModal({
  isOpen,
  onClose,
  funcionario,
  statusPrestserv,
  onTarefaReprovada,
}: ListaTarefasModalProps) {
  const { showToast } = useToast();
  const [tarefas, setTarefas] = useState<TarefaRemanejamento[]>([]);
  const [tarefasFiltradas, setTarefasFiltradas] = useState<
    TarefaRemanejamento[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [expandedTarefaId, setExpandedTarefaId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [reprovarLoading, setReprovarLoading] = useState(false);
  const [reprovarLoadingId, setReprovarLoadingId] = useState<string | null>(
    null
  );
  // Removido estado de observações - não são exibidas na interface e causavam múltiplas requisições desnecessárias
  const [filtroSetor, setFiltroSetor] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [tarefaReprovada, setTarefaReprovada] = useState<boolean>(false); // Rastrear se alguma tarefa foi reprovada

  // Filtros adicionais e ordenação
  const [filtroDataLimite, setFiltroDataLimite] = useState<"" | "VENCIDOS" | "A_VENCER" | "NO_PRAZO" | "SEM_DATA">("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [ordenacaoDataLimite, setOrdenacaoDataLimite] = useState<"" | "asc" | "desc">("");

  // Valores disponíveis para selects dinâmicos
  const tiposDisponiveis = Array.from(new Set(tarefas.map((t) => t.tipo))).sort();
  const prioridadesDisponiveis = Array.from(new Set(tarefas.map((t) => t.prioridade))).sort();
  const statusDisponiveis = Array.from(new Set(tarefas.map((t) => t.status))).sort();

  useEffect(() => {
    if (isOpen && funcionario) {
      fetchTarefas();
    }
  }, [isOpen, funcionario]);

  // Efeito para filtrar tarefas quando o filtro ou termo de busca mudar
  useEffect(() => {
    if (tarefas.length > 0) {
      aplicarFiltros();
    }
  }, [
    tarefas,
    filtroSetor,
    termoBusca,
    filtroDataLimite,
    filtroStatus,
    filtroPrioridade,
    filtroTipo,
    ordenacaoDataLimite,
  ]);

  // Remover o carregamento automático de observações para evitar múltiplas requisições
  // As observações serão carregadas apenas quando necessário (lazy loading)

  // Função para aplicar filtros nas tarefas
  const aplicarFiltros = () => {
    let tarefasFiltradas = [...tarefas];

    // Filtrar por setor
    if (filtroSetor) {
      tarefasFiltradas = tarefasFiltradas.filter(
        (tarefa) => tarefa.responsavel === filtroSetor
      );
    }

    // Filtrar por termo de busca (em tipo, descrição e responsável)
    if (termoBusca.trim()) {
      const termo = termoBusca.toLowerCase().trim();
      tarefasFiltradas = tarefasFiltradas.filter(
        (tarefa) =>
          tarefa.tipo.toLowerCase().includes(termo) ||
          (tarefa.descricao &&
            tarefa.descricao.toLowerCase().includes(termo)) ||
          tarefa.responsavel.toLowerCase().includes(termo)
      );
    }

    // Filtro por Status
    if (filtroStatus) {
      tarefasFiltradas = tarefasFiltradas.filter((t) => t.status === filtroStatus);
    }

    // Filtro por Tipo
    if (filtroTipo) {
      tarefasFiltradas = tarefasFiltradas.filter((t) => t.tipo === filtroTipo);
    }

    // Filtro por Prioridade
    if (filtroPrioridade) {
      tarefasFiltradas = tarefasFiltradas.filter((t) => t.prioridade === filtroPrioridade);
    }

    // Filtro por Data Limite (aplica-se apenas a tarefas com status PENDENTE)
    if (filtroDataLimite) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const cincoDiasMs = 5 * 24 * 60 * 60 * 1000;

      tarefasFiltradas = tarefasFiltradas.filter((t) => {
        if (t.status !== "PENDENTE") return true; // Apenas PENDENTE é afetado
        const dl = t.dataLimite ? new Date(t.dataLimite) : null;
        const dlTime = dl ? dl.getTime() : null;
        const hojeTime = hoje.getTime();

        switch (filtroDataLimite) {
          case "VENCIDOS":
            return dlTime !== null && dlTime < hojeTime;
          case "A_VENCER":
            return dlTime !== null && dlTime >= hojeTime && dlTime < hojeTime + cincoDiasMs;
          case "NO_PRAZO":
            return dlTime !== null && dlTime >= hojeTime + cincoDiasMs;
          case "SEM_DATA":
            return dlTime === null;
          default:
            return true;
        }
      });
    }

    // Ordenação por Data Limite
    if (ordenacaoDataLimite) {
      tarefasFiltradas.sort((a, b) => {
        const aVal = a.dataLimite ? new Date(a.dataLimite).getTime() : (ordenacaoDataLimite === "asc" ? Infinity : -Infinity);
        const bVal = b.dataLimite ? new Date(b.dataLimite).getTime() : (ordenacaoDataLimite === "asc" ? Infinity : -Infinity);
        return ordenacaoDataLimite === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    setTarefasFiltradas(tarefasFiltradas);
  };

  const toggleOrdenacaoDataLimite = () => {
    setOrdenacaoDataLimite((prev) => (prev === "asc" ? "desc" : prev === "desc" ? "" : "asc"));
  };


  // Adicionar evento para fechar o campo de justificativa quando clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expandedTarefaId) {
        // Verificar se o clique foi fora do campo de justificativa
        const justificativaElement = document.querySelector(
          ".space-y-2.p-3.bg-white"
        );
        if (
          justificativaElement &&
          !justificativaElement.contains(event.target as Node)
        ) {
          setExpandedTarefaId(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expandedTarefaId]);

  // Função removida - buscarObservacoesTarefa não é mais necessária
  // As observações não são exibidas na interface e causavam múltiplas requisições desnecessárias

  const fetchTarefas = async () => {
    if (!funcionario) return;

    try {
      setLoading(true);
      let response;
      try {
        response = await fetch(
          `/api/logistica/tarefas?remanejamentoFuncionarioId=${funcionario.id}`
        );
      } catch (fetchError) {
        console.error("Erro na requisição de tarefas:", fetchError);
        throw new Error("Falha na conexão ao carregar tarefas");
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          throw new Error(errorData.error || "Erro ao carregar tarefas");
        } catch (jsonError) {
          throw new Error(`Erro ao carregar tarefas: ${response.status}`);
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Erro ao processar JSON das tarefas:", jsonError);
        throw new Error("Erro ao processar dados das tarefas");
      }

      // Adicionar tarefas de teste se não houver tarefas
      if (data.length === 0) {
        const tarefasTeste = [
          {
            id: "teste1",
            tipo: "Teste",
            descricao: "Tarefa de teste 1",
            responsavel: "Sistema",
            status: "PENDENTE",
            prioridade: "Alta",
            dataCriacao: new Date().toISOString(),
            dataLimite: new Date().toISOString(),
            observacoes: "Tarefa de teste para verificar o botão de reprovação",
          },
        ];
        setTarefas(tarefasTeste);
        console.log("Adicionando tarefas de teste:", tarefasTeste);
      } else {
        setTarefas(data);
        setTarefasFiltradas(data);
      }
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
      showToast("Erro ao carregar tarefas", "error");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONCLUIDO":
        return "bg-green-100 text-green-800";
      case "EM_ANDAMENTO":
        return "bg-yellow-100 text-yellow-800";
      case "PENDENTE":
        return "bg-gray-100 text-gray-800";
      case "ATRASADO":
        return "bg-red-100 text-red-800";
      case "REPROVADO":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const handleReprovarClick = (tarefaId: string) => {
    console.log("Clicou em reprovar para a tarefa:", tarefaId);
    // Sempre definir o ID da tarefa expandida (não alternar)
    setExpandedTarefaId(tarefaId);
    // Reset justificativa
    setJustificativa("");
    // Adicionar um pequeno atraso para garantir que o foco seja definido corretamente
    setTimeout(() => {
      const textareaElement = document.querySelector(
        'textarea[placeholder="Digite a justificativa da reprovação (obrigatório)"]'
      );
      if (textareaElement) {
        (textareaElement as HTMLTextAreaElement).focus();
      }
    }, 100);
  };

  const handleReprovarTarefa = async (tarefaId: string) => {
    // Validate justificativa
    if (!justificativa.trim()) {
      showToast("A justificativa é obrigatória", "error");
      return;
    }

    
    try {
      setReprovarLoading(true);
      setReprovarLoadingId(tarefaId);

      // Encontrar a tarefa pelo ID
      const tarefa = tarefas.find((t) => t.id === tarefaId);
      if (!tarefa) {
        throw new Error("Tarefa não encontrada");
      }

      // 1. Primeiro adicionar a justificativa como uma observação (apenas para tarefas reais)
      try {
        const observacaoResponse = await fetch(
          `/api/logistica/tarefas/${tarefaId}/observacoes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              texto: `Status alterado: De "${tarefa.status}" para "REPROVADO". \nDescrição: ${justificativa}`,
            }),
          }
        );

        if (!observacaoResponse.ok) {
          const errorData = await observacaoResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao adicionar observação");
        }
      } catch (fetchError) {
        console.error("Erro na requisição de observação:", fetchError);
        throw new Error("Falha ao adicionar observação");
      }

      // 2. Depois atualizar o status da tarefa para REPROVADO (apenas para tarefas reais)
      let statusResponse;
      try {
        statusResponse = await fetch(`/api/logistica/tarefas/${tarefaId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "REPROVADO",
          }),
        });
      } catch (fetchError) {
        console.error(
          "Erro na requisição de atualização de status:",
          fetchError
        );
        throw new Error("Falha na conexão ao atualizar status");
      }

      if (!statusResponse.ok) {
        let errorData;
        try {
          errorData = await statusResponse.json();
        } catch (jsonError) {
          throw new Error(
            "Erro ao processar resposta da atualização de status"
          );
        }
        throw new Error(errorData.error || "Erro ao reprovar tarefa");
      }

      // 3. Observação adicionada com sucesso via API
      // Não é necessário atualizar estado local de observações pois elas não são exibidas na interface

      // Marcar que uma tarefa foi reprovada
      setTarefaReprovada(true);

      showToast("Tarefa reprovada com sucesso", "success");
      // Close the expanded section after successful reprovação
      setExpandedTarefaId(null);
      // Refresh the tarefas list
      try {
        await fetchTarefas();
      } catch (fetchError) {
        console.error("Erro ao atualizar lista de tarefas:", fetchError);
        // Não lançamos erro aqui para não interromper o fluxo principal
      }
    } catch (error) {
      console.error("Erro ao reprovar tarefa:", error);
      showToast(
        error instanceof Error ? error.message : "Erro ao reprovar tarefa",
        "error"
      );
    } finally {
      setReprovarLoading(false);
    }
  };

  // Função personalizada para fechar o modal
  const handleCloseModal = () => {
    // Se alguma tarefa foi reprovada, chamar o callback para atualizar a página principal
    if (tarefaReprovada && onTarefaReprovada) {
      onTarefaReprovada();
    }
    
    // Resetar o estado de tarefa reprovada
    setTarefaReprovada(false);
    
    // Fechar o modal
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleCloseModal}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Tarefas do Funcionário
            </h3>
            {funcionario && (
              <p className="text-sm text-gray-500">
                {funcionario.nome} - Matrícula: {funcionario.matricula}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCloseModal();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Buscar tarefas..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
            />
          </div>
          <div className="w-full md:w-44">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
              >
                <option value="">Todos os setores</option>
                <option value="RH">RH</option>
                <option value="MEDICINA">MEDICINA</option>
                <option value="TREINAMENTO">TREINAMENTO</option>
              </select>
            </div>
          </div>
          <div className="w-full md:w-40">
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filtroDataLimite}
              onChange={(e) => setFiltroDataLimite(e.target.value as any)}
            >
              <option value="">Data limite (todas)</option>
              <option value="VENCIDOS">Vencidos</option>
              <option value="A_VENCER">A vencer</option>
              <option value="NO_PRAZO">No prazo</option>
              <option value="SEM_DATA">Pendentes (sem data)</option>
            </select>
          </div>
          <div className="w-full md:w-40">
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Status (todos)</option>
              {statusDisponiveis.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
            >
              <option value="">Prioridade (todas)</option>
              {prioridadesDisponiveis.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Tipo (todos)</option>
              {tiposDisponiveis.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Setor
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                  Descrição
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button onClick={toggleOrdenacaoDataLimite} className="flex items-center gap-1 text-gray-700">
                    Data Limite
                    {ordenacaoDataLimite === "asc" ? "▲" : ordenacaoDataLimite === "desc" ? "▼" : ""}
                  </button>
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-100 border border-gray-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tarefasFiltradas.map((tarefa) => (
                <tr key={tarefa.id} className="align-top">
                  <td className="px-4 py-2 text-sm text-gray-900 break-words">
                    {tarefa.responsavel}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 break-words">
                    {tarefa.tipo}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 break-words">
                    {tarefa.descricao || "N/A"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                    {formatDate(tarefa.dataLimite)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        tarefa.status
                      )}`}
                    >
                      {tarefa.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {tarefa.status === "CONCLUIDO" && 
                     statusPrestserv && 
                     (statusPrestserv === "CRIADO" || statusPrestserv === "INVALIDADO") && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReprovarClick(tarefa.id);
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 mr-2 disabled:opacity-50"
                        disabled={reprovarLoadingId === tarefa.id}
                      >
                        {reprovarLoadingId === tarefa.id
                          ? "Processando..."
                          : "Reprovar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Modal de Justificativa (fora da tabela) */}
        {expandedTarefaId && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-[999]"
              onClick={() => setExpandedTarefaId(null)}
            />
            <div className="space-y-2 p-4 bg-white border border-gray-300 rounded-md shadow-lg fixed w-80 z-[1000] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <h4 className="font-medium text-sm">
                Justificativa de reprovação
              </h4>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                placeholder="Digite a justificativa da reprovação (obrigatório)"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                required
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => handleReprovarTarefa(expandedTarefaId)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  disabled={reprovarLoading || !justificativa.trim()}
                >
                  {reprovarLoading ? "Processando..." : "Confirmar"}
                </button>
                <button
                  onClick={() => setExpandedTarefaId(null)}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  disabled={reprovarLoading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
