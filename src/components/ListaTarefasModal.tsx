"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { XMarkIcon, MagnifyingGlassIcon, FunnelIcon } from "@heroicons/react/24/outline";
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
}

export default function ListaTarefasModal({
  isOpen,
  onClose,
  funcionario,
}: ListaTarefasModalProps) {
  const { showToast } = useToast();
  const [tarefas, setTarefas] = useState<TarefaRemanejamento[]>([]);
  const [tarefasFiltradas, setTarefasFiltradas] = useState<TarefaRemanejamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTarefaId, setExpandedTarefaId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [reprovarLoading, setReprovarLoading] = useState(false);
  const [observacoesTarefa, setObservacoesTarefa] = useState<{
    [key: string]: any[];
  }>({});
  const [filtroSetor, setFiltroSetor] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState<string>("");

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
  }, [tarefas, filtroSetor, termoBusca]);

  // Buscar observações quando as tarefas são carregadas
  useEffect(() => {
    if (tarefas.length > 0) {
      tarefas.forEach((tarefa) => {
        buscarObservacoesTarefa(tarefa.id);
      });
    }
  }, [tarefas]);

  // Função para aplicar filtros nas tarefas
  const aplicarFiltros = () => {
    let tarefasFiltradas = [...tarefas];
    
    // Filtrar por setor
    if (filtroSetor) {
      tarefasFiltradas = tarefasFiltradas.filter(tarefa => 
        tarefa.responsavel === filtroSetor
      );
    }
    
    // Filtrar por termo de busca (em tipo, descrição e responsável)
    if (termoBusca.trim()) {
      const termo = termoBusca.toLowerCase().trim();
      tarefasFiltradas = tarefasFiltradas.filter(tarefa => 
        tarefa.tipo.toLowerCase().includes(termo) || 
        (tarefa.descricao && tarefa.descricao.toLowerCase().includes(termo)) ||
        tarefa.responsavel.toLowerCase().includes(termo)
      );
    }
    
    setTarefasFiltradas(tarefasFiltradas);
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

  // Função para buscar observações de uma tarefa
  const buscarObservacoesTarefa = async (tarefaId: string) => {
    try {
      let response;
      try {
        response = await fetch(
          `/api/logistica/tarefas/${tarefaId}/observacoes`
        );
      } catch (fetchError) {
        console.error(
          `Erro na requisição de observações para tarefa ${tarefaId}:`,
          fetchError
        );
        // Definir um array vazio para observações em caso de erro
        setObservacoesTarefa((prev) => ({ ...prev, [tarefaId]: [] }));
        return; // Encerra a função em caso de erro de rede
      }

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error || `Erro ao buscar observações: ${response.status}`;
        } catch (jsonError) {
          errorMessage = `Erro ao buscar observações: ${response.status}`;
        }
        console.error(errorMessage);
        // Definir um array vazio para observações em caso de erro
        setObservacoesTarefa((prev) => ({ ...prev, [tarefaId]: [] }));
        return; // Encerra a função em vez de lançar erro
      }

      let observacoes;
      try {
        observacoes = await response.json();
      } catch (jsonError) {
        console.error(
          `Erro ao processar JSON das observações para tarefa ${tarefaId}:`,
          jsonError
        );
        // Definir um array vazio para observações em caso de erro
        setObservacoesTarefa((prev) => ({ ...prev, [tarefaId]: [] }));
        return; // Encerra a função em vez de lançar erro
      }

      setObservacoesTarefa((prev) => ({ ...prev, [tarefaId]: observacoes }));
    } catch (err) {
      console.error(`Erro ao buscar observações para tarefa ${tarefaId}:`, err);
      // Definir um array vazio para evitar erros de renderização
      setObservacoesTarefa((prev) => ({ ...prev, [tarefaId]: [] }));
    }
  };

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

      // Encontrar a tarefa pelo ID
      const tarefa = tarefas.find((t) => t.id === tarefaId);
      if (!tarefa) {
        throw new Error("Tarefa não encontrada");
      }

      // Verificar se é uma tarefa de teste (ID começa com "teste")
      const isTarefaTeste = tarefaId.startsWith("teste");
      let novaObservacao;

      if (!isTarefaTeste) {
        // 1. Primeiro adicionar a justificativa como uma observação (apenas para tarefas reais)
        let observacaoResponse;
        try {
          observacaoResponse = await fetch(
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
        } catch (fetchError) {
          console.error("Erro na requisição de observação:", fetchError);
          throw new Error("Falha na conexão ao adicionar observação");
        }

        if (!observacaoResponse.ok) {
          let errorData;
          try {
            errorData = await observacaoResponse.json();
          } catch (jsonError) {
            throw new Error("Erro ao processar resposta da observação");
          }
          throw new Error(errorData.error || "Erro ao adicionar observação");
        }

        try {
          novaObservacao = await observacaoResponse.json();
        } catch (jsonError) {
          console.error("Erro ao processar JSON da observação:", jsonError);
          throw new Error("Erro ao processar dados da observação");
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
      } else {
        // Para tarefas de teste, apenas simular a atualização localmente
        console.log("Simulando reprovação para tarefa de teste:", tarefaId);
        novaObservacao = {
          id: "teste-obs-" + Date.now(),
          texto: `Status alterado: De "${tarefa.status}" para "REPROVADO". \nDescrição: ${justificativa}`,
          dataCriacao: new Date().toISOString(),
          criadoPor: "Sistema (Teste)"
        };

        // Atualizar o status da tarefa localmente
        setTarefas(tarefas.map(t => 
          t.id === tarefaId ? {...t, status: "REPROVADO"} : t
        ));
        setTarefasFiltradas(tarefasFiltradas.map(t => 
          t.id === tarefaId ? {...t, status: "REPROVADO"} : t
        ));
      }

      // 3. Atualizar as observações localmente
      setObservacoesTarefa((prev) => {
        const tarefaObservacoes = prev[tarefaId] || [];
        return {
          ...prev,
          [tarefaId]: [...tarefaObservacoes, novaObservacao],
        };
      });

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
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
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
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
          <div className="w-full md:w-64">
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
        </div>

        <div className="overflow-auto flex-grow">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : tarefasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {tarefas.length === 0
                ? "Nenhuma tarefa encontrada para este funcionário."
                : "Nenhuma tarefa corresponde aos filtros aplicados."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Setor
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Item
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Descrição
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-100 border border-gray-300"
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tarefasFiltradas.map((tarefa) => (
                    <tr key={tarefa.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tarefa.responsavel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tarefa.tipo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tarefa.descricao || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            tarefa.status
                          )}`}
                        >
                          {tarefa.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tarefa.status === "CONCLUIDO" && (
                          <div className="relative" style={{ zIndex: 50 }}>
                            {expandedTarefaId !== tarefa.id ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleReprovarClick(tarefa.id);
                                }}
                                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 mr-2"
                                style={{ pointerEvents: "auto" }}
                              >
                                Reprovar
                              </button>
                            ) : (
                              <>
                                <div
                                  className="fixed inset-0 bg-black bg-opacity-50 z-[999]"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedTarefaId(null);
                                  }}
                                />
                                <div
                                  className="space-y-2 p-4 bg-white border border-gray-300 rounded-md shadow-lg"
                                  style={{
                                    position: "fixed",
                                    width: "350px",
                                    zIndex: 1000,
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <h4 className="font-medium text-sm">
                                    Justificativa de reprovação
                                  </h4>
                                  <textarea
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                                    placeholder="Digite a justificativa da reprovação (obrigatório)"
                                    value={justificativa}
                                    onChange={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setJustificativa(e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    rows={3}
                                    required
                                    style={{ pointerEvents: "auto" }}
                                  />
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleReprovarTarefa(tarefa.id);
                                      }}
                                      className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                      disabled={
                                        reprovarLoading || !justificativa.trim()
                                      }
                                      style={{ pointerEvents: "auto" }}
                                    >
                                      {reprovarLoading
                                        ? "Processando..."
                                        : "Confirmar"}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setExpandedTarefaId(null);
                                      }}
                                      className="px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                      disabled={reprovarLoading}
                                      style={{ pointerEvents: "auto" }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
