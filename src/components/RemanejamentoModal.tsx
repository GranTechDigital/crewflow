import React, { useState, useEffect, useMemo } from "react";
import {
  XMarkIcon,
  ArrowRightIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserIcon,
  IdentificationIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ArrowLongRightIcon,
} from "@heroicons/react/24/outline";
import {
  FuncionarioSelecionado,
  NovoRemanejamento,
  ResumoRemanejamento,
} from "@/types/remanejamento";
import { useAuth } from "@/app/hooks/useAuth";

interface Contrato {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  centroDeCusto: string;
  centros?: Set<string>;
}

interface Funcionario {
  id: string;
  nome: string;
  centroCusto: string;
  funcao?: string;
  status?: string;
  dataAdmissao?: string;
  contratoId?: number;
}

interface RemanejamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contratos: Contrato[];
  funcionarios: Funcionario[];
  contratoSelecionado?: Contrato | null;
  centroCustoSelecionado?: string | null;
  onSubmit: (remanejamento: NovoRemanejamento) => Promise<void>;
}

export default function RemanejamentoModal({
  isOpen,
  onClose,
  contratos,
  funcionarios,
  contratoSelecionado,
  centroCustoSelecionado,
  onSubmit,
}: RemanejamentoModalProps) {
  const { usuario } = useAuth();
  // Estados principais
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<
    FuncionarioSelecionado[]
  >([]);
  const [contratoOrigem, setContratoOrigem] = useState<Contrato | null>(
    contratoSelecionado || null
  );
  const [centroCustoOrigem, setCentroCustoOrigem] = useState(
    centroCustoSelecionado || ""
  );
  const [contratoDestino, setContratoDestino] = useState<Contrato | null>(null);
  const [centroCustoDestino, setCentroCustoDestino] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [prioridade, setPrioridade] = useState<
    "baixa" | "media" | "alta" | "urgente"
  >("media");
  const [loading, setLoading] = useState(false);

  // Estados de filtros
  const [filtroFuncao, setFiltroFuncao] = useState("");
  const [buscaNome, setBuscaNome] = useState("");
  const [etapaAtual, setEtapaAtual] = useState<"selecao" | "confirmacao">(
    "selecao"
  );

  // Reset modal quando abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setContratoOrigem(contratoSelecionado || null);
      setCentroCustoOrigem(centroCustoSelecionado || "");
      setFuncionariosSelecionados([]);
      setContratoDestino(null);
      setCentroCustoDestino("");
      setJustificativa("");
      setPrioridade("media");
      setEtapaAtual("selecao");
    }
  }, [isOpen, contratoSelecionado, centroCustoSelecionado]);

  // Contratos únicos
  const contratosUnicos = useMemo(() => {
    const contratoMap = contratos.reduce((acc, contrato) => {
      if (!acc[contrato.id]) {
        acc[contrato.id] = {
          ...contrato,
          centros: new Set(
            contrato.centroDeCusto
              .split(",")
              .map((c) => c.trim())
              .filter((c) => c !== "")
          ),
        };
      }
      return acc;
    }, {} as Record<string, Contrato & { centros: Set<string> }>);
    return Object.values(contratoMap);
  }, [contratos]);

  // Funcionários disponíveis (origem)
  const funcionariosDisponiveis = useMemo(() => {
    return funcionarios
      .filter((f) => {
        // Filtro por contrato de origem
        if (contratoOrigem) {
          const centrosDoContrato = Array.from(contratoOrigem.centros || []);
          if (!centrosDoContrato.includes(f.centroCusto)) return false;
        }
        // Filtro por centro de custo específico
        if (centroCustoOrigem && f.centroCusto !== centroCustoOrigem)
          return false;
        // Filtro por função
        if (filtroFuncao && f.funcao !== filtroFuncao) return false;
        // Filtro por nome
        if (
          buscaNome &&
          !f.nome.toLowerCase().includes(buscaNome.toLowerCase())
        )
          return false;
        // Não mostrar funcionários já selecionados
        if (funcionariosSelecionados.some((fs) => fs.id === parseInt(f.id)))
          return false;
        return true;
      })
      .map((f) => ({
        id: parseInt(f.id),
        nome: f.nome,
        matricula: f.id,
        funcao: f.funcao || null,
        centroCusto: f.centroCusto || null,
        selecionado: false,
      }));
  }, [
    funcionarios,
    contratoOrigem,
    centroCustoOrigem,
    filtroFuncao,
    buscaNome,
    funcionariosSelecionados,
  ]);

  // Funções disponíveis para filtro
  const funcoesDisponiveis = useMemo(() => {
    const funcionariosFiltrados =
      contratoOrigem || centroCustoOrigem
        ? funcionarios.filter((f) => {
            if (contratoOrigem) {
              const centrosDoContrato = Array.from(
                contratoOrigem.centros || []
              );
              return centrosDoContrato.includes(f.centroCusto);
            }
            return f.centroCusto === centroCustoOrigem;
          })
        : funcionarios;
    return [
      ...new Set(funcionariosFiltrados.map((f) => f.funcao).filter(Boolean)),
    ];
  }, [funcionarios, contratoOrigem, centroCustoOrigem]);

  // Centros de custo disponíveis
  const centrosCustoOrigem = useMemo(() => {
    return contratoOrigem ? Array.from(contratoOrigem.centros || []) : [];
  }, [contratoOrigem]);

  const centrosCustoDestino = useMemo(() => {
    return contratoDestino ? Array.from(contratoDestino.centros || []) : [];
  }, [contratoDestino]);

  // Funções de manipulação
  const adicionarFuncionario = (funcionario: FuncionarioSelecionado) => {
    setFuncionariosSelecionados((prev) => {
      return prev.some((f) => f.id === funcionario.id)
        ? prev
        : [...prev, { ...funcionario, selecionado: true }];
    });
  };

  const removerFuncionario = (funcionarioId: number) => {
    setFuncionariosSelecionados((prev) =>
      prev.filter((f) => f.id !== funcionarioId)
    );
  };

  const adicionarTodosDaFuncao = (funcao: string) => {
    const funcionariosDaFuncao = funcionariosDisponiveis.filter(
      (f) => f.funcao === funcao
    );
    setFuncionariosSelecionados((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const toAdd = funcionariosDaFuncao
        .filter((f) => !existingIds.has(Number(f.id)))
        .map((f) => ({ ...f, selecionado: true }));
      return [...prev, ...toAdd];
    });
  };

  // Resumo para confirmação
  const getResumo = (): ResumoRemanejamento => {
    const porFuncao = funcionariosSelecionados.reduce((acc, f) => {
      const funcao = f.funcao || "Sem função";
      acc[funcao] = (acc[funcao] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSelecionados: funcionariosSelecionados.length,
      porFuncao,
      origem: {
        contrato: contratoOrigem?.nome,
        centroCusto: centroCustoOrigem,
      },
      destino: {
        contrato: contratoDestino?.nome,
        centroCusto: centroCustoDestino,
      },
    };
  };

  // Submissão
  const handleSubmit = async () => {
    if (funcionariosSelecionados.length === 0) {
      alert("Selecione pelo menos um funcionário");
      return;
    }

    if (!centroCustoDestino) {
      alert("Selecione o centro de custo de destino");
      return;
    }

    setLoading(true);
    try {
      const remanejamento: NovoRemanejamento = {
        funcionarioIds: funcionariosSelecionados.map((f) => f.id),
        contratoOrigemId: contratoOrigem?.id,
        centroCustoOrigem,
        contratoDestinoId: contratoDestino?.id,
        centroCustoDestino,
        justificativa,
        prioridade,
        solicitadoPor: usuario?.nome || usuario?.matricula || "Sistema",
      };

      (remanejamento as any).usuarioContexto = {
        id: usuario?.id,
        nome: usuario?.nome,
        email: usuario?.email,
        equipe: usuario?.equipe,
        matricula: usuario?.matricula,
      };

      await onSubmit(remanejamento);
      onClose();
    } catch (error) {
      console.error("Erro ao criar remanejamento:", error);
      alert("Erro ao criar solicitação de remanejamento");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {etapaAtual === "selecao"
                ? "Selecionar Funcionários"
                : "Confirmar Remanejamento"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Breadcrumb de Movimento */}
        <div className="bg-blue-50 px-6 py-3 border-b">
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">
                {contratoOrigem?.nome || "Origem"} →{" "}
                {centroCustoOrigem || "Centro não selecionado"}
              </span>
            </div>
            <ArrowLongRightIcon className="h-5 w-5 text-blue-600" />
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-900">
                {contratoDestino?.nome || "Destino"} →{" "}
                {centroCustoDestino || "Centro não selecionado"}
              </span>
            </div>
            {funcionariosSelecionados.length > 0 && (
              <div className="ml-4 bg-blue-100 px-3 py-1 rounded-full">
                <span className="text-blue-800 font-medium">
                  {funcionariosSelecionados.length} funcionário
                  {funcionariosSelecionados.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          {etapaAtual === "selecao" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Painel Esquerdo - Origem */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-blue-900 flex items-center gap-2">
                    <BuildingOfficeIcon className="h-5 w-5" />
                    Origem - Funcionários Disponíveis
                  </h3>
                </div>

                {/* Seleção de Origem */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Contrato de Origem
                    </label>
                    <select
                      value={contratoOrigem?.id || ""}
                      onChange={(e) => {
                        const contrato =
                          contratosUnicos.find(
                            (c) => c.id.toString() === e.target.value
                          ) || null;
                        setContratoOrigem(contrato);
                        setCentroCustoOrigem("");
                      }}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione um contrato</option>
                      {contratosUnicos.map((contrato) => (
                        <option
                          key={contrato.id}
                          value={contrato.id.toString()}
                        >
                          {contrato.nome} - {contrato.cliente}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Centro de Custo de Origem
                    </label>
                    <select
                      value={centroCustoOrigem}
                      onChange={(e) => setCentroCustoOrigem(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      disabled={!contratoOrigem}
                    >
                      <option value="">Selecione um centro de custo</option>
                      {centrosCustoOrigem.map((centro) => (
                        <option key={centro} value={centro}>
                          {centro}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtros */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Filtrar por Função
                      </label>
                      <select
                        value={filtroFuncao}
                        onChange={(e) => setFiltroFuncao(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todas as funções</option>
                        {funcoesDisponiveis.map((funcao) => (
                          <option key={funcao} value={funcao}>
                            {funcao}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Buscar por Nome
                      </label>
                      <input
                        type="text"
                        value={buscaNome}
                        onChange={(e) => setBuscaNome(e.target.value)}
                        placeholder="Digite o nome..."
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Lista de Funcionários Disponíveis */}
                <div className="border border-blue-200 rounded-md bg-white max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-blue-200 bg-blue-100">
                    <h4 className="text-sm font-medium text-blue-900">
                      Funcionários Disponíveis
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      {funcionariosDisponiveis.length} funcionário
                      {funcionariosDisponiveis.length !== 1 ? "s" : ""}{" "}
                      encontrado
                      {funcionariosDisponiveis.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {funcionariosDisponiveis.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Nenhum funcionário disponível com os filtros
                        selecionados
                      </div>
                    ) : (
                      funcionariosDisponiveis.map((funcionario) => (
                        <div
                          key={funcionario.id}
                          className="p-3 hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {funcionario.nome}
                            </div>
                            <div className="text-xs text-gray-500">
                              {funcionario.funcao} • ID: {funcionario.matricula}
                            </div>
                            <div className="text-xs text-gray-400">
                              Centro: {funcionario.centroCusto}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => adicionarFuncionario(funcionario)}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              Adicionar
                            </button>
                            {funcionario.funcao && (
                              <button
                                onClick={() =>
                                  adicionarTodosDaFuncao(funcionario.funcao!)
                                }
                                className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200 transition-colors"
                                title={`Adicionar todos os ${funcionario.funcao}`}
                              >
                                +Todos
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Painel Direito - Destino */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-green-900 flex items-center gap-2">
                    <BuildingOfficeIcon className="h-5 w-5" />
                    Destino - Funcionários Selecionados
                  </h3>
                </div>

                {/* Seleção de Destino */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-green-800 mb-1">
                      Contrato de Destino
                    </label>
                    <select
                      value={contratoDestino?.id || ""}
                      onChange={(e) => {
                        const contrato =
                          contratosUnicos.find(
                            (c) => c.id.toString() === e.target.value
                          ) || null;
                        setContratoDestino(contrato);
                        setCentroCustoDestino("");
                      }}
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Selecione um contrato</option>
                      {contratosUnicos.map((contrato) => (
                        <option
                          key={contrato.id}
                          value={contrato.id.toString()}
                        >
                          {contrato.nome} - {contrato.cliente}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-800 mb-1">
                      Centro de Custo de Destino
                    </label>
                    <select
                      value={centroCustoDestino}
                      onChange={(e) => setCentroCustoDestino(e.target.value)}
                      className="w-full px-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500"
                      disabled={!contratoDestino}
                    >
                      <option value="">Selecione um centro de custo</option>
                      {centrosCustoDestino.map((centro) => (
                        <option key={centro} value={centro}>
                          {centro}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lista de Funcionários Selecionados */}
                <div className="border border-green-200 rounded-md bg-white max-h-80 overflow-y-auto">
                  <div className="p-3 border-b border-green-200 bg-green-100">
                    <h4 className="text-sm font-medium text-green-900">
                      Funcionários Selecionados
                    </h4>
                    <p className="text-xs text-green-700 mt-1">
                      {funcionariosSelecionados.length} funcionário
                      {funcionariosSelecionados.length !== 1 ? "s" : ""}{" "}
                      selecionado
                      {funcionariosSelecionados.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {funcionariosSelecionados.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Nenhum funcionário selecionado
                      </div>
                    ) : (
                      funcionariosSelecionados.map((funcionario) => (
                        <div
                          key={funcionario.id}
                          className="p-3 hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {funcionario.nome}
                            </div>
                            <div className="text-xs text-gray-500">
                              {funcionario.funcao} • ID: {funcionario.matricula}
                            </div>
                            <div className="text-xs text-gray-400">
                              Centro: {funcionario.centroCusto}
                            </div>
                          </div>
                          <button
                            onClick={() => removerFuncionario(funcionario.id)}
                            className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs hover:bg-red-200 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Etapa de Confirmação */
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-medium text-yellow-800">
                    Confirmar Remanejamento
                  </h3>
                </div>
                <p className="text-sm text-yellow-700">
                  Revise as informações antes de enviar a solicitação de
                  remanejamento.
                </p>
              </div>

              {/* Resumo do Movimento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Origem</h4>
                  <p className="text-sm text-blue-800">
                    <strong>Contrato:</strong>{" "}
                    {contratoOrigem?.nome || "Não especificado"}
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Centro de Custo:</strong>{" "}
                    {centroCustoOrigem || "Não especificado"}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3">Destino</h4>
                  <p className="text-sm text-green-800">
                    <strong>Contrato:</strong>{" "}
                    {contratoDestino?.nome || "Não especificado"}
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Centro de Custo:</strong>{" "}
                    {centroCustoDestino || "Não especificado"}
                  </p>
                </div>
              </div>

              {/* Funcionários por Função */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  Funcionários Selecionados ({funcionariosSelecionados.length})
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {Object.entries(getResumo().porFuncao).map(
                    ([funcao, quantidade]) => (
                      <div
                        key={funcao}
                        className="flex justify-between items-center py-1"
                      >
                        <span className="text-sm text-gray-700">{funcao}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {quantidade}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Prioridade e Justificativa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade
                  </label>
                  <select
                    value={prioridade}
                    onChange={(e) =>
                      setPrioridade(
                        e.target.value as "baixa" | "media" | "alta" | "urgente"
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Justificativa
                  </label>
                  <textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Descreva o motivo do remanejamento..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>

          <div className="flex items-center gap-3">
            {etapaAtual === "confirmacao" && (
              <button
                onClick={() => setEtapaAtual("selecao")}
                className="px-4 py-2 text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
              >
                Voltar
              </button>
            )}

            {etapaAtual === "selecao" ? (
              <button
                onClick={() => setEtapaAtual("confirmacao")}
                disabled={
                  funcionariosSelecionados.length === 0 || !centroCustoDestino
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Continuar
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Enviar Solicitação
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
