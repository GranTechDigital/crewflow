"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { utils, writeFile } from 'xlsx';
import { toast } from "react-hot-toast";
import { useAuth } from "@/app/hooks/useAuth";
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  DocumentArrowDownIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  PlusIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

interface Tarefa {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  dataLimite: string | null;
  dataCriacao: string;
  funcionarioId: string;
  remanejamentoFuncionarioId: string;
  responsavel: string; // Setor responsável (RH, MEDICINA, TREINAMENTO)
  observacoesTarefa?: Observacao[];
  funcionario?: {
    id: string;
    nome: string;
    matricula: string;
    funcao: string;
    status: string;
    statusPrestserv: string;
    emMigracao: boolean;
  };
  remanejamentoFuncionario?: {
    funcionario: {
      id: string;
      nome: string;
      matricula: string;
      funcao: string;
      status: string;
      statusPrestserv: string;
      emMigracao: boolean;
    };
  };
}

interface Observacao {
  id: string;
  texto: string;
  criadoPor: string;
  criadoEm: string;
  modificadoPor?: string;
  modificadoEm?: string;
}

interface ProgressoGeral {
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  reprovadas: number;
  atrasadas: number;
}

interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  funcao: string;
  status: string;
  statusPrestserv: string;
  emMigracao: boolean;
}

interface FuncionarioRemanejamento {
  id: number;
  tipo?: string;
  status: string;
  dataSolicitacao: string;
  contratoOrigem?: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
  };
  contratoDestino?: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
  };
  funcionarios: {
    id: string;
    statusTarefas: string;
    statusPrestserv: string;
    funcionario: {
      id: number;
      nome: string;
      matricula: string;
      funcao: string;
      centroCusto: string;
      status: string;
      emMigracao: boolean;
    };
  }[];
}

interface NovaTarefa {
  tipo: string;
  descricao: string;
  prioridade: string;
  dataLimite: string;
  remanejamentoFuncionarioId: string;
  responsavel: string;
  status: string;
}

export default function TarefasPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setorAtual, setSetorAtual] = useState<string | null>(null);

  // Filtros
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");

  // Refs para evitar re-renderizações
  const filtroNomeRef = useRef<HTMLInputElement>(null);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina] = useState(20);

  // Estados para criação de tarefas
  const [mostrarFormTarefa, setMostrarFormTarefa] = useState(false);
  const [funcionariosRemanejamento, setFuncionariosRemanejamento] = useState<
    FuncionarioRemanejamento[]
  >([]);
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(false);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] =
    useState<FuncionarioRemanejamento | null>(null);
  const [tiposTarefaPadrao, setTiposTarefaPadrao] = useState<{
    [setor: string]: { tipo: string; descricao: string }[];
  }>({});
  const [loadingTiposTarefa, setLoadingTiposTarefa] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState<NovaTarefa>({
    tipo: "",
    descricao: "",
    status: "PENDENTE",
    prioridade: "MEDIA",
    dataLimite: "",
    remanejamentoFuncionarioId: "",
    responsavel: "RH", // Padrão inicial
  });

  // Ref para o campo de descrição
  const descricaoRef = useRef<HTMLTextAreaElement>(null);

  // Estados para modal de conclusão de tarefa
  const [tarefaSelecionada, setTarefaSelecionada] = useState<Tarefa | null>(
    null
  );
  const [mostrarModalConcluir, setMostrarModalConcluir] = useState(false);
  const [concluindoTarefa, setConcluindoTarefa] = useState(false);

  // Estados para o modal de observações
  const [mostrarModalObservacoes, setMostrarModalObservacoes] = useState(false);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [carregandoObservacoes, setCarregandoObservacoes] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState("");
  const [adicionandoObservacao, setAdicionandoObservacao] = useState(false);
  const [observacaoEditando, setObservacaoEditando] = useState<string | null>(
    null
  );
  const [textoEditado, setTextoEditado] = useState("");
  const [editandoObservacao, setEditandoObservacao] = useState(false);
  const [excluindoObservacao, setExcluindoObservacao] = useState(false);
  const [novaDataLimite, setNovaDataLimite] = useState("");
  const [justificativaDataLimite, setJustificativaDataLimite] = useState("");
  const [atualizandoDataLimite, setAtualizandoDataLimite] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"observacoes" | "dataLimite">(
    "observacoes"
  );

  const searchParams = useSearchParams();

  useEffect(() => {
    // Detectar o setor com base nos parâmetros da URL atual
    const setorParam = searchParams.get("setor");

    if (setorParam === "rh") {
      setSetorAtual("RH");
      setFiltroSetor("RH");
    } else if (setorParam === "medicina") {
      setSetorAtual("MEDICINA");
      setFiltroSetor("MEDICINA");
    } else if (setorParam === "treinamento") {
      setSetorAtual("TREINAMENTO");
      setFiltroSetor("TREINAMENTO");
    } else {
      setSetorAtual(null);
    }
  }, [searchParams]);

  // Efeito separado para buscar tarefas quando o setor muda
  useEffect(() => {
    fetchTodasTarefas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setorAtual]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroNome, filtroStatus, filtroPrioridade, filtroSetor]);

  const fetchTodasTarefas = async () => {
    try {
      setLoading(true);

      // Se tiver um setor específico na URL, buscar apenas as tarefas desse setor
      if (setorAtual) {
        const response = await fetch(
          `/api/logistica/tarefas?responsavel=${setorAtual}`
        );
        if (!response.ok) {
          throw new Error(`Erro ao carregar tarefas do setor ${setorAtual}`);
        }
        const data = await response.json();
        setTarefas(data);
      } else {
        // Buscar tarefas de todos os setores
        const setores = ["RH", "TREINAMENTO", "MEDICINA"];
        const promessas = setores.map((setor) =>
          fetch(`/api/logistica/tarefas?responsavel=${setor}`)
            .then((res) => (res.ok ? res.json() : []))
            .catch(() => [])
        );

        const resultados = await Promise.all(promessas);
        const todasTarefas = resultados.flat();

        setTarefas(todasTarefas);
      }
    } catch (err) {
      console.error("Erro ao buscar tarefas:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const fetchFuncionariosRemanejamento = async () => {
    try {
      setLoadingFuncionarios(true);
      // Adicionar parâmetro filtrarProcesso=true para filtrar apenas funcionários em processo
      const response = await fetch(
        "/api/logistica/remanejamentos?filtrarProcesso=true"
      );
      if (!response.ok) {
        throw new Error("Erro ao carregar funcionários");
      }
      const data = await response.json();
      setFuncionariosRemanejamento(data || []);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      toast.error("Erro ao carregar funcionários de remanejamento");
    } finally {
      setLoadingFuncionarios(false);
    }
  };

  const criarTarefa = async () => {
    try {
      setCriandoTarefa(true);
      const response = await fetch("/api/logistica/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novaTarefa),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar tarefa");
      }

      toast.success("Tarefa criada com sucesso!");
      fecharFormTarefa();
      fetchTodasTarefas();
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setCriandoTarefa(false);
    }
  };

  const fetchTiposTarefaPadrao = async () => {
    try {
      setLoadingTiposTarefa(true);
      const response = await fetch("/api/tarefas-padrao?ativo=true");
      if (!response.ok) {
        throw new Error("Erro ao carregar tipos de tarefa");
      }
      const data = await response.json();

      // Organizar por setor
      const tiposPorSetor: {
        [setor: string]: { tipo: string; descricao: string }[];
      } = {};
      data.forEach((tarefa: { setor: string; tipo: string; descricao: string }) => {
        if (!tiposPorSetor[tarefa.setor]) {
          tiposPorSetor[tarefa.setor] = [];
        }
        tiposPorSetor[tarefa.setor].push({
          tipo: tarefa.tipo,
          descricao: tarefa.descricao,
        });
      });

      setTiposTarefaPadrao(tiposPorSetor);
    } catch (error) {
      console.error("Erro ao buscar tipos de tarefa:", error);
      toast.error("Erro ao carregar tipos de tarefa");
    } finally {
      setLoadingTiposTarefa(false);
    }
  };

  const abrirFormTarefa = async () => {
    setMostrarFormTarefa(true);
    await Promise.all([
      fetchFuncionariosRemanejamento(),
      fetchTiposTarefaPadrao(),
    ]);
  };

  const fecharFormTarefa = () => {
    setMostrarFormTarefa(false);
    setSolicitacaoSelecionada(null);
    setNovaTarefa({
      tipo: "",
      descricao: "",
      prioridade: "MEDIA",
      dataLimite: "",
      remanejamentoFuncionarioId: "",
      responsavel: "RH",
      status: "PENDENTE",
    });
  };

  const getTarefasFiltradas = () => {
    return tarefas.filter((tarefa) => {
      const nomeFuncionario =
        tarefa.funcionario?.nome ||
        tarefa.remanejamentoFuncionario?.funcionario.nome ||
        "";
      const matchNome = nomeFuncionario
        .toLowerCase()
        .includes(filtroNome.toLowerCase());

      // Lógica especial para status concluído (pode ser CONCLUIDO ou CONCLUIDA)
      let matchStatus = !filtroStatus;
      if (filtroStatus === "CONCLUIDO") {
        matchStatus =
          tarefa.status === "CONCLUIDO" || tarefa.status === "CONCLUIDA";
      } else if (filtroStatus) {
        matchStatus = tarefa.status === filtroStatus;
      }

      const matchPrioridade =
        !filtroPrioridade || tarefa.prioridade === filtroPrioridade;
      const matchSetor = !filtroSetor || tarefa.responsavel === filtroSetor;

      return matchNome && matchStatus && matchPrioridade && matchSetor;
    });
  };

  const getTarefasPaginadas = () => {
    const tarefasFiltradas = getTarefasFiltradas();
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return tarefasFiltradas.slice(inicio, fim);
  };

  const getProgressoGeral = (): ProgressoGeral => {
    const tarefasFiltradas = getTarefasFiltradas();
    const total = tarefasFiltradas.length;
    const pendentes = tarefasFiltradas.filter(
      (t) => t.status === "PENDENTE"
    ).length;
    // Removido status EM_ANDAMENTO conforme solicitação
    const concluidas = tarefasFiltradas.filter(
      (t) => t.status === "CONCLUIDO" || t.status === "CONCLUIDA"
    ).length;
    const reprovadas = tarefasFiltradas.filter(
      (t) => t.status === "REPROVADO"
    ).length;

    // Calcular tarefas atrasadas (pendentes ou em andamento com data limite no passado)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Normalizar para início do dia

    const atrasadas = tarefasFiltradas.filter((tarefa) => {
      if (
        tarefa.status === "CONCLUIDO" ||
        tarefa.status === "CONCLUIDA" ||
        !tarefa.dataLimite
      )
        return false;
      const dataLimite = new Date(tarefa.dataLimite);
      dataLimite.setHours(0, 0, 0, 0); // Normalizar para início do dia
      return dataLimite < hoje;
    }).length;

    return { total, pendentes, emAndamento: 0, concluidas, reprovadas, atrasadas };
  };

  const exportarParaExcel = () => {
    const tarefasFiltradas = getTarefasFiltradas();

    const dadosExcel = tarefasFiltradas.map((tarefa) => ({
      ID: tarefa.id,
      Tipo: tarefa.tipo,
      Descrição: tarefa.descricao,
      Status: tarefa.status,
      Prioridade: tarefa.prioridade,
      "Data Limite": tarefa.dataLimite
        ? new Date(tarefa.dataLimite).toLocaleDateString("pt-BR")
        : "N/A",
      "Data Criação": new Date(tarefa.dataCriacao).toLocaleDateString("pt-BR"),
      Funcionário:
        tarefa.funcionario?.nome ||
        tarefa.remanejamentoFuncionario?.funcionario.nome ||
        "N/A",
      Matrícula:
        tarefa.funcionario?.matricula ||
        tarefa.remanejamentoFuncionario?.funcionario.matricula ||
        "N/A",
      Função:
        tarefa.funcionario?.funcao ||
        tarefa.remanejamentoFuncionario?.funcionario.funcao ||
        "N/A",
      "Setor Responsável": tarefa.responsavel,
    }));

    const wb = utils.book_new();
    const ws = utils.json_to_sheet(dadosExcel);
    utils.book_append_sheet(wb, ws, "Tarefas");
    writeFile(wb, "Tarefas_Exportadas.xlsx");

    toast.success("Tarefas exportadas com sucesso!");
  };

  // Função para verificar se funcionário demitido precisa de atenção
  const funcionarioDemitidoPrecisaAtencao = useCallback(
    (funcionario: Funcionario) => {
      if (funcionario?.status === "DEMITIDO") {
        return (
          funcionario.emMigracao || funcionario.statusPrestserv === "ATIVO"
        );
      }
      return false;
    },
    []
  );

  // Função para obter o tipo de alerta para funcionário demitido
  const getTipoAlertaDemitido = useCallback((funcionario: Funcionario) => {
    if (funcionario.status === "DEMITIDO") {
      if (funcionario.emMigracao && funcionario.statusPrestserv === "ATIVO") {
        return {
          tipo: "critico",
          mensagem:
            "Funcionário demitido em migração e com status ativo - Cancelar processo e inativar",
          icon: ExclamationCircleIcon,
          classes: "text-red-600 bg-red-50 border-red-200",
        };
      } else if (funcionario.emMigracao) {
        return {
          tipo: "alerta",
          mensagem: "Funcionário demitido em migração - Cancelar processo",
          icon: ExclamationTriangleIcon,
          classes: "text-orange-600 bg-orange-50 border-orange-200",
        };
      } else if (funcionario.statusPrestserv === "ATIVO") {
        return {
          tipo: "aviso",
          mensagem:
            "Funcionário demitido com status ativo - Alterar para inativo",
          icon: ExclamationTriangleIcon,
          classes: "text-yellow-600 bg-yellow-50 border-yellow-200",
        };
      }
    }
    return null;
  }, []);

  // Estado para data de vencimento no modal de conclusão
  const [dataVencimento, setDataVencimento] = useState("");

  // Funções para o modal de conclusão de tarefa
  const abrirModalConcluir = (tarefa: Tarefa) => {
    setTarefaSelecionada(tarefa);
    setDataVencimento(""); // Resetar a data de vencimento
    setMostrarModalConcluir(true);
  };

  const fecharModalConcluir = () => {
    setTarefaSelecionada(null);
    setDataVencimento("");
    setMostrarModalConcluir(false);
  };

  const concluirTarefa = async () => {
    if (!tarefaSelecionada) return;

    // Validar data de vencimento obrigatória exceto para RH
    if (tarefaSelecionada.responsavel !== "RH" && !dataVencimento) {
      toast.error("Informe a data de vencimento para concluir a tarefa.");
      return;
    }

    try {
      setConcluindoTarefa(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/concluir`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataVencimento: dataVencimento || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao concluir tarefa");
      }

      toast.success("Tarefa concluída com sucesso!");
      fecharModalConcluir();
      fetchTodasTarefas(); // Atualizar a lista de tarefas
    } catch (error) {
      console.error("Erro ao concluir tarefa:", error);
      toast.error("Erro ao concluir tarefa");
    } finally {
      setConcluindoTarefa(false);
    }
  };

  // Funções para o modal de observações
  const abrirModalObservacoes = async (tarefa: Tarefa) => {
    setTarefaSelecionada(tarefa);
    setMostrarModalObservacoes(true);
    // Definir a aba ativa como "observacoes" por padrão
    setAbaAtiva("observacoes");
    // Inicializar a data limite atual (se existir)
    if (tarefa.dataLimite) {
      const dataFormatada = new Date(tarefa.dataLimite)
        .toISOString()
        .split("T")[0];
      setNovaDataLimite(dataFormatada);
    } else {
      setNovaDataLimite("");
    }
    setJustificativaDataLimite("");
    await buscarObservacoes(tarefa.id);
  };

  const fecharModalObservacoes = () => {
    setTarefaSelecionada(null);
    setMostrarModalObservacoes(false);
    setObservacoes([]);
    setNovaObservacao("");
    setNovaDataLimite("");
    setJustificativaDataLimite("");
    // Atualizar a lista de tarefas para refletir as mudanças nas observações
    fetchTodasTarefas();
  };

  const buscarObservacoes = async (tarefaId: string) => {
    try {
      setCarregandoObservacoes(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaId}/observacoes`
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar observações");
      }

      const data = await response.json();
      setObservacoes(data);
    } catch (error) {
      console.error("Erro ao buscar observações:", error);
      toast.error("Erro ao carregar observações");
    } finally {
      setCarregandoObservacoes(false);
    }
  };

  const adicionarObservacao = async () => {
    if (!tarefaSelecionada || !novaObservacao.trim()) {
      toast.error("Digite uma observação");
      return;
    }

    try {
      setAdicionandoObservacao(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: novaObservacao,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta:", errorData);
        toast.error(errorData.error || "Erro ao adicionar observação");
        return;
      }

      toast.success("Observação adicionada com sucesso!");
      setNovaObservacao("");
      await buscarObservacoes(tarefaSelecionada.id);
      // Não fechamos o modal, apenas atualizamos as observações
    } catch (error) {
      console.error("Erro ao adicionar observação:", error);
      toast.error("Erro ao adicionar observação");
    } finally {
      setAdicionandoObservacao(false);
    }
  };

  const iniciarEdicaoObservacao = (observacao: Observacao) => {
    setObservacaoEditando(observacao.id);
    setTextoEditado(observacao.texto);
  };

  const cancelarEdicaoObservacao = () => {
    setObservacaoEditando(null);
    setTextoEditado("");
  };

  const salvarEdicaoObservacao = async (observacaoId: string) => {
    if (!tarefaSelecionada || !textoEditado.trim()) {
      toast.error("Digite uma observação");
      return;
    }

    try {
      setEditandoObservacao(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes/${observacaoId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: textoEditado,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta:", errorData);
        toast.error(errorData.error || "Erro ao editar observação");
        return;
      }

      toast.success("Observação editada com sucesso!");
      setObservacaoEditando(null);
      setTextoEditado("");
      await buscarObservacoes(tarefaSelecionada.id);
    } catch (error) {
      console.error("Erro ao editar observação:", error);
      toast.error("Erro ao editar observação");
    } finally {
      setEditandoObservacao(false);
    }
  };

  const excluirObservacao = async (observacaoId: string) => {
    if (!tarefaSelecionada) return;

    if (!confirm("Tem certeza que deseja excluir esta observação?")) {
      return;
    }

    try {
      setExcluindoObservacao(true);
      const response = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes/${observacaoId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta:", errorData);
        toast.error(errorData.error || "Erro ao excluir observação");
        return;
      }

      toast.success("Observação excluída com sucesso!");
      await buscarObservacoes(tarefaSelecionada.id);
    } catch (error) {
      console.error("Erro ao excluir observação:", error);
      toast.error("Erro ao excluir observação");
    } finally {
      setExcluindoObservacao(false);
    }
  };

  const atualizarDataLimite = async () => {
    if (!tarefaSelecionada) return;

    if (!novaDataLimite) {
      toast.error("Selecione uma nova data limite");
      return;
    }

    if (!justificativaDataLimite.trim()) {
      toast.error("Informe uma justificativa para a alteração da data");
      return;
    }

    try {
      setAtualizandoDataLimite(true);

      // Formatar as datas para exibição
      const dataAnterior = tarefaSelecionada.dataLimite
        ? new Date(tarefaSelecionada.dataLimite).toLocaleDateString("pt-BR")
        : "Não definida";
      const dataNova = new Date(novaDataLimite).toLocaleDateString("pt-BR");

      // Criar texto da observação automática
      const textoObservacao = `Data limite alterada: ${dataAnterior} → ${dataNova}\n\nJustificativa: ${justificativaDataLimite}`;

      // Atualizar a data limite da tarefa
      const responseDataLimite = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataLimite: novaDataLimite,
          }),
        }
      );

      if (!responseDataLimite.ok) {
        throw new Error("Erro ao atualizar data limite");
      }

      // Adicionar observação automática
      const responseObservacao = await fetch(
        `/api/logistica/tarefas/${tarefaSelecionada.id}/observacoes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: textoObservacao,
            criadoPor: usuario?.nome || "Sistema",
          }),
        }
      );

      if (!responseObservacao.ok) {
        throw new Error("Erro ao adicionar observação");
      }

      toast.success("Data limite atualizada com sucesso!");

      // Atualizar a tarefa selecionada com a nova data
      if (tarefaSelecionada) {
        setTarefaSelecionada({
          ...tarefaSelecionada,
          dataLimite: novaDataLimite,
        });
      }

      // Limpar campos
      setJustificativaDataLimite("");

      // Atualizar observações
      await buscarObservacoes(tarefaSelecionada.id);
    } catch (error) {
      console.error("Erro ao atualizar data limite:", error);
      toast.error("Erro ao atualizar data limite");
    } finally {
      setAtualizandoDataLimite(false);
    }
  };

  const handleSelecionarFuncionario = (remanejamentoFuncionarioId: string) => {
    // Encontrar a solicitação que contém este funcionário
    const funcionarioSelecionado = funcionariosRemanejamento
      .flatMap((solicitacao) => solicitacao.funcionarios)
      .find((f) => f.id === remanejamentoFuncionarioId);

    if (funcionarioSelecionado) {
      // Encontrar a solicitação que contém este funcionário
      const solicitacao = funcionariosRemanejamento.find((s) =>
        s.funcionarios.some((f) => f.id === remanejamentoFuncionarioId)
      );

      if (solicitacao) {
        setSolicitacaoSelecionada(solicitacao);
        setNovaTarefa((prev) => ({
          ...prev,
          remanejamentoFuncionarioId,
        }));
      }
    }
  };

  const handleSubmitTarefa = (e: React.FormEvent) => {
    e.preventDefault();

    // Validações básicas
    if (!novaTarefa.tipo) {
      toast.error("Selecione um tipo de tarefa");
      return;
    }

    if (!novaTarefa.descricao) {
      toast.error("Informe uma descrição para a tarefa");
      return;
    }

    if (!novaTarefa.remanejamentoFuncionarioId) {
      toast.error("Selecione um funcionário");
      return;
    }

    criarTarefa();
  };
  // Componente de UI para o progresso geral
  const ProgressoGeralComponent = () => {
    const progresso = getProgressoGeral();

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-linear-to-r from-gray-800 to-slate-600 p-5 rounded-lg shadow-lg min-h-[120px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm text-slate-300">Pendentes</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.pendentes}
                {progresso.atrasadas > 0 ? (
                  <span className="text-sm text-red-200 ml-2">
                    ( {progresso.atrasadas} atrasada
                    {progresso.atrasadas !== 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 mt-1 opacity-0 block">
                    Nenhuma atrasada
                  </span>
                )}
              </p>
            </div>
            <ClockIcon className="h-12 w-12 text-slate-400" />
          </div>
        </div>

        <div className="bg-linear-to-r from-gray-800 to-slate-600 p-5 rounded-lg shadow-lg min-h-[120px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm text-slate-300">Concluídas</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.concluidas}
              </p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-slate-400" />
          </div>
        </div>

        <div className="bg-linear-to-r from-gray-800 to-slate-600 p-5 rounded-lg shadow-lg min-h-[120px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm text-slate-300">Reprovadas</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.reprovadas}
              </p>
            </div>
            <ExclamationCircleIcon className="h-12 w-12 text-slate-400" />
          </div>
        </div>

        <div className="bg-linear-to-r from-gray-800 to-slate-600 p-5 rounded-lg shadow-lg min-h-[120px] flex items-center">
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm text-slate-300">Total</p>
              <p className="text-2xl font-semibold text-sky-300">
                {progresso.total}
              </p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-slate-400" />
          </div>
        </div>
      </div>
    );
  };

  // Componente para o filtro de tarefas
  const FiltroTarefas = () => {
    // Determinar o número de colunas com base na presença do filtro de setor
    const numColunas = setorAtual ? 3 : 4;

    return (
      <div className="bg-white border-slate-400 border-1 p-5 rounded-lg shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-slate-800">Filtros</h3>
          <button
            className="hover:bg-gray-200 text-gray-400 px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
            onClick={() => {
              // Limpar todos os filtros
              if (filtroNomeRef.current) {
                filtroNomeRef.current.value = "";
              }
              setFiltroNome("");
              setFiltroStatus("");
              setFiltroPrioridade("");
              setFiltroSetor("");
              setPaginaAtual(1);
            }}
          >
            <XMarkIcon className="h-5 w-5" />
            Limpar Filtros
          </button>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-${numColunas} gap-4`}>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Status
            </label>
            <select
              className="w-full h-12 rounded-md border-slate-800 bg-slate-100 text-slate-500 shadow-sm focus:border-slate-300 focus:ring-slate-300"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDO">Concluída</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Prioridade
            </label>
            <select
              className="w-full h-12 rounded-md border-slate-800 bg-slate-100 text-slate-500 shadow-sm focus:border-slate-500 focus:ring-slate-500"
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>

          {/* Mostrar o filtro de setor apenas quando não estiver em uma rota específica de setor */}
          {!setorAtual && (
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-2">
                Setor Responsável
              </label>
              <select
                className="w-full h-12 rounded-md border-slate-800 bg-slate-100 text-slate-500 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="RH">RH</option>
                <option value="TREINAMENTO">Treinamento</option>
                <option value="MEDICINA">Medicina</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Nome do Funcionário
            </label>
            <div className="relative flex">
              <input
                type="text"
                className="pl-10 w-full h-12 rounded-l-md border-slate-500 bg-slate-100 text-slate-500 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                placeholder="Buscar por nome..."
                ref={filtroNomeRef}
                defaultValue={filtroNome}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && filtroNomeRef.current) {
                    setFiltroNome(filtroNomeRef.current.value);
                  }
                }}
              />
              <div className="flex">
                <button
                  className="bg-slate-500 hover:bg-slate-600 text-white px-4 rounded-r-md transition-colors duration-200"
                  onClick={() => {
                    if (filtroNomeRef.current) {
                      setFiltroNome(filtroNomeRef.current.value);
                    }
                  }}
                >
                  <MagnifyingGlassIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Componente para a lista de tarefas
  const ListaTarefas = () => {
    const tarefasPaginadas = getTarefasPaginadas();
    const tarefasFiltradas = getTarefasFiltradas();

    if (loading) {
      return <div className="text-center py-10">Carregando tarefas...</div>;
    }

    if (error) {
      return (
        <div className="text-center py-10 text-red-500">
          Erro ao carregar tarefas: {error}
        </div>
      );
    }

    if (tarefasFiltradas.length === 0) {
      return (
        <div className="text-center py-10">Nenhuma tarefa encontrada.</div>
      );
    }

    return (
      <div className="bg-white border-slate-400 border-1 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-100">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  Funcionário
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  Tipo
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  Descrição
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  Prioridade
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  Data Limite
                </th>
                {!setorAtual && (
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Setor
                  </th>
                )}
                <th
                  scope="col"
                  className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider sticky right-0 bg-slate-100 shadow-md z-10"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tarefasPaginadas.map((tarefa) => {
                const nomeFuncionario =
                  tarefa.funcionario?.nome ||
                  tarefa.remanejamentoFuncionario?.funcionario.nome ||
                  "N/A";
                const matricula =
                  tarefa.funcionario?.matricula ||
                  tarefa.remanejamentoFuncionario?.funcionario.matricula ||
                  "N/A";
                const funcao =
                  tarefa.funcionario?.funcao ||
                  tarefa.remanejamentoFuncionario?.funcionario.funcao ||
                  "N/A";

                // Determinar classes de status
                let statusClasses = "px-2 py-1 text-xs rounded-full";
                if (tarefa.status === "PENDENTE")
                  statusClasses += " bg-yellow-100 text-yellow-800";
                // Removido status EM_ANDAMENTO conforme solicitação
                else if (
                  tarefa.status === "CONCLUIDA" ||
                  tarefa.status === "CONCLUIDO"
                )
                  statusClasses += " bg-green-100 text-green-800";
                else if (tarefa.status === "AGUARDANDO_APROVACAO")
                  statusClasses += " bg-slate-100 text-slate-800";

                // Determinar classes de prioridade
                let prioridadeClasses = "px-2 py-1 text-xs rounded-full";
                if (tarefa.prioridade === "BAIXA")
                  prioridadeClasses += " bg-gray-100 text-gray-800";
                else if (tarefa.prioridade === "MEDIA")
                  prioridadeClasses += " bg-blue-100 text-blue-800";
                else if (tarefa.prioridade === "ALTA")
                  prioridadeClasses += " bg-orange-100 text-orange-800";
                else if (tarefa.prioridade === "URGENTE")
                  prioridadeClasses += " bg-red-100 text-red-800";

                // Determinar classes de setor
                let setorClasses = "px-2 py-1 text-xs rounded-full";
                if (tarefa.responsavel === "RH")
                  setorClasses += " bg-purple-100 text-purple-800";
                else if (tarefa.responsavel === "TREINAMENTO")
                  setorClasses += " bg-indigo-100 text-indigo-800";
                else if (tarefa.responsavel === "MEDICINA")
                  setorClasses += " bg-teal-100 text-teal-800";

                // Verificar se está atrasada
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const dataLimite = tarefa.dataLimite
                  ? new Date(tarefa.dataLimite)
                  : null;
                if (dataLimite) dataLimite.setHours(0, 0, 0, 0);
                const atrasada =
                  dataLimite &&
                  dataLimite < hoje &&
                  tarefa.status !== "CONCLUIDA" &&
                  tarefa.status !== "CONCLUIDO";

                // Verificar se funcionário precisa de atenção
                const funcionarioData =
                  tarefa.remanejamentoFuncionario?.funcionario;
                console.log(tarefa.remanejamentoFuncionario);
                const precisaAtencao = funcionarioData
                  ? funcionarioDemitidoPrecisaAtencao(funcionarioData)
                  : false;
                console.log(funcionarioData?.nome, precisaAtencao);
                const tipoAlerta = funcionarioData
                  ? getTipoAlertaDemitido(funcionarioData)
                  : null;

                return (
                  <tr
                    key={tarefa.id}
                    className={`hover:bg-gray-100 group ${
                      precisaAtencao
                        ? `border-l-4 ${
                            tipoAlerta?.classes.includes("red")
                              ? "border-red-500"
                              : tipoAlerta?.classes.includes("orange")
                              ? "border-orange-500"
                              : "border-yellow-500"
                          } ${tipoAlerta?.classes
                            .split(" ")
                            .find((c) => c.startsWith("bg-"))}`
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap relative">
                      <div className="absolute left-0 top-0 h-full w-1 bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-xs font-medium text-gray-900">
                            {nomeFuncionario}
                          </div>
                          <div className="text-xs text-gray-500">
                            {matricula} - {funcao}
                          </div>
                        </div>
                        {precisaAtencao && tipoAlerta && (
                          <div className="group relative">
                            <tipoAlerta.icon
                              className={`h-5 w-5 ${
                                tipoAlerta.classes.split(" ")[0]
                              } cursor-help`}
                            />
                            <div
                              className={`absolute z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm rounded-lg border shadow-lg max-w-xs ${tipoAlerta.classes}`}
                            >
                              <div className="font-medium mb-1">
                                ⚠️ Atenção Necessária
                              </div>
                              <div>{tipoAlerta.mensagem}</div>
                              <div
                                className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${
                                  tipoAlerta.classes.includes("red")
                                    ? "border-t-red-200"
                                    : tipoAlerta.classes.includes("orange")
                                    ? "border-t-orange-200"
                                    : "border-t-yellow-200"
                                }`}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {tarefa.tipo}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                      {tarefa.descricao}
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                      <span className={statusClasses}>
                        {tarefa.status === "PENDENTE"
                          ? "Pendente"
                          : tarefa.status === "CONCLUIDA" ||
                            tarefa.status === "CONCLUIDO"
                          ? "Concluída"
                          : tarefa.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                      <span className={prioridadeClasses}>
                        {tarefa.prioridade === "BAIXA"
                          ? "Baixa"
                          : tarefa.prioridade === "MEDIA"
                          ? "Média"
                          : tarefa.prioridade === "ALTA"
                          ? "Alta"
                          : tarefa.prioridade === "URGENTE"
                          ? "Urgente"
                          : tarefa.prioridade}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {tarefa.dataLimite ? (
                        <span
                          className={atrasada ? "text-red-600 font-medium" : ""}
                        >
                          {new Date(tarefa.dataLimite).toLocaleDateString(
                            "pt-BR"
                          )}
                          {atrasada && " (Atrasada)"}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    {!setorAtual && (
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        <span className={setorClasses}>
                          {tarefa.responsavel === "RH"
                            ? "RH"
                            : tarefa.responsavel === "TREINAMENTO"
                            ? "Treinamento"
                            : tarefa.responsavel === "MEDICINA"
                            ? "Medicina"
                            : tarefa.responsavel}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 sticky right-0 shadow-md z-10 group-hover:bg-gray-100 bg-white">
                      <div className="flex space-x-2">
                        <button
                          className="text-slate-500 hover:text-sky-600"
                          title="Ver detalhes"
                          onClick={() =>
                            router.push(
                              `/prestserv/remanejamentos/${tarefa.remanejamentoFuncionarioId}`
                            )
                          }
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {/* Ocultar botão de concluir se a tarefa já estiver concluída */}
                        {tarefa.status !== "CONCLUIDO" &&
                          tarefa.status !== "CONCLUIDA" && (
                            <button
                              className="text-slate-500 hover:text-green-600"
                              title="Concluir tarefa"
                              onClick={() => abrirModalConcluir(tarefa)}
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                          )}
                        <button
                          className="text-slate-500 hover:text-blue-600 relative"
                          title="Observações"
                          onClick={() => abrirModalObservacoes(tarefa)}
                        >
                          <ChatBubbleLeftRightIcon className="h-5 w-5" />
                          {/* Mostrar contador de observações se houver */}
                          {tarefa.observacoesTarefa &&
                            tarefa.observacoesTarefa.length > 0 && (
                              <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                {tarefa.observacoesTarefa.length}
                              </span>
                            )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando{" "}
                <span className="font-medium">{tarefasPaginadas.length}</span>{" "}
                de{" "}
                <span className="font-medium">{tarefasFiltradas.length}</span>{" "}
                resultados
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button
                  onClick={() =>
                    setPaginaAtual(paginaAtual > 1 ? paginaAtual - 1 : 1)
                  }
                  disabled={paginaAtual === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    paginaAtual === 1
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Anterior
                </button>

                {Array.from({
                  length: Math.ceil(tarefasFiltradas.length / itensPorPagina),
                }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setPaginaAtual(index + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${
                      paginaAtual === index + 1
                        ? "bg-blue-50 text-blue-600 z-10"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}

                <button
                  onClick={() =>
                    setPaginaAtual(
                      paginaAtual <
                        Math.ceil(tarefasFiltradas.length / itensPorPagina)
                        ? paginaAtual + 1
                        : paginaAtual
                    )
                  }
                  disabled={
                    paginaAtual >=
                    Math.ceil(tarefasFiltradas.length / itensPorPagina)
                  }
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    paginaAtual >=
                    Math.ceil(tarefasFiltradas.length / itensPorPagina)
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Próxima
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Modal para criar nova tarefa
  const NovaTarefaModal = () => {
    if (!mostrarFormTarefa) return null;

    // Filtrar funcionários únicos (sem duplicatas)
    const funcionariosUnicos = funcionariosRemanejamento
      .flatMap((solicitacao) =>
        solicitacao.funcionarios
          .filter(
            (f) =>
              f.funcionario.emMigracao &&
              (f.statusTarefas === "REPROVAR TAREFAS" ||
                f.statusTarefas === "ATENDER TAREFAS")
          )
          .map((f) => ({
            id: f.id,
            nome: f.funcionario.nome,
            matricula: f.funcionario.matricula,
            funcao: f.funcionario.funcao,
          }))
      )
      .reduce((acc: Funcionario[], curr) => {
        // Verificar se já existe um funcionário com o mesmo ID
        if (!acc.some((f) => f.id === curr.id)) {
          acc.push({
            ...curr,
            status: (curr as Funcionario).status || "ATIVO",
            statusPrestserv: (curr as Funcionario).statusPrestserv || "ATIVO",
            emMigracao: (curr as Funcionario).emMigracao ?? false,
          });
        }
        return acc;
      }, []);

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                Nova Tarefa
              </h2>
              <button
                onClick={fecharFormTarefa}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitTarefa}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Seleção do Funcionário */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Funcionário
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.remanejamentoFuncionarioId}
                    onChange={(e) =>
                      handleSelecionarFuncionario(e.target.value)
                    }
                    disabled={loadingFuncionarios}
                  >
                    <option value="">Selecione um funcionário...</option>
                    {funcionariosUnicos.map((funcionario) => (
                      <option key={funcionario.id} value={funcionario.id}>
                        {funcionario.nome} - {funcionario.matricula} -{" "}
                        {funcionario.funcao}
                      </option>
                    ))}
                  </select>
                  {loadingFuncionarios && (
                    <p className="text-sm text-gray-500 mt-1">
                      Carregando funcionários...
                    </p>
                  )}
                </div>

                {/* Seleção do Setor Responsável */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Setor Responsável
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.responsavel}
                    onChange={(e) => {
                      // Ao mudar o setor, limpa o tipo selecionado
                      setNovaTarefa({
                        ...novaTarefa,
                        responsavel: e.target.value,
                        tipo: "",
                      });
                    }}
                  >
                    <option value="RH">RH</option>
                    <option value="TREINAMENTO">Treinamento</option>
                    <option value="MEDICINA">Medicina</option>
                  </select>
                </div>

                {/* Tipo de Tarefa */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Tarefa
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.tipo}
                    onChange={(e) => {
                      const selectedTipo = e.target.value;
                      const selectedSetor = novaTarefa.responsavel;
                      const tipoInfo = tiposTarefaPadrao[selectedSetor]?.find(
                        (t) => t.tipo === selectedTipo
                      );

                      const novaDescricao =
                        tipoInfo?.descricao || novaTarefa.descricao;
                      setNovaTarefa({
                        ...novaTarefa,
                        tipo: selectedTipo,
                        descricao: novaDescricao,
                      });

                      // Atualizar o valor do textarea
                      if (descricaoRef.current) {
                        descricaoRef.current.value = novaDescricao;
                      }
                    }}
                    disabled={loadingTiposTarefa}
                  >
                    <option value="">Selecione um tipo...</option>
                    {tiposTarefaPadrao[novaTarefa.responsavel]?.map(
                      (tipo, index) => (
                        <option key={index} value={tipo.tipo}>
                          {tipo.tipo}
                        </option>
                      )
                    )}
                  </select>
                  {loadingTiposTarefa && (
                    <p className="text-sm text-gray-500 mt-1">
                      Carregando tipos de tarefa...
                    </p>
                  )}
                </div>

                {/* Prioridade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridade
                  </label>
                  <select
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.prioridade}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        prioridade: e.target.value,
                      })
                    }
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                {/* Data Limite */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Limite
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={novaTarefa.dataLimite}
                    onChange={(e) =>
                      setNovaTarefa({
                        ...novaTarefa,
                        dataLimite: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  className="w-full rounded-md border-slate-600 bg-white-700 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                  rows={4}
                  placeholder="Descreva a tarefa..."
                  ref={descricaoRef}
                  defaultValue={novaTarefa.descricao}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    // Atualizar ao pressionar Tab
                    if (e.key === "Tab" && descricaoRef.current) {
                      setNovaTarefa((prev) => ({
                        ...prev,
                        descricao: descricaoRef.current?.value || "",
                      }));
                    }
                  }}
                  onBlur={() => {
                    if (descricaoRef.current) {
                      setNovaTarefa((prev) => ({
                        ...prev,
                        descricao: descricaoRef.current?.value || "",
                      }));
                    }
                  }}
                />
              </div>

              {/* Dados da Solicitação e Funcionário */}
              {solicitacaoSelecionada &&
                novaTarefa.remanejamentoFuncionarioId && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">
                        Dados da Solicitação
                      </h3>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Tipo:</span>{" "}
                        {solicitacaoSelecionada.tipo || "N/A"}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Status:</span>{" "}
                        {solicitacaoSelecionada.status}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Data:</span>{" "}
                        {new Date(
                          solicitacaoSelecionada.dataSolicitacao
                        ).toLocaleDateString("pt-BR")}
                      </p>
                      {solicitacaoSelecionada.contratoOrigem && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Contrato Origem:</span>{" "}
                          {solicitacaoSelecionada.contratoOrigem.nome}
                        </p>
                      )}
                      {solicitacaoSelecionada.contratoDestino && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Contrato Destino:</span>{" "}
                          {solicitacaoSelecionada.contratoDestino.nome}
                        </p>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-700 mb-2">
                        Detalhes do Funcionário
                      </h3>
                      {solicitacaoSelecionada.funcionarios.find(
                        (f) => f.id === novaTarefa.remanejamentoFuncionarioId
                      )?.funcionario && (
                        <>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Nome:</span>{" "}
                            {
                              solicitacaoSelecionada.funcionarios.find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario.nome
                            }
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Matrícula:</span>{" "}
                            {
                              solicitacaoSelecionada.funcionarios.find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario.matricula
                            }
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Função:</span>{" "}
                            {
                              solicitacaoSelecionada.funcionarios.find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario.funcao
                            }
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">
                              Centro de Custo:
                            </span>{" "}
                            {
                              solicitacaoSelecionada.funcionarios.find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario.centroCusto
                            }
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Status:</span>{" "}
                            {
                              solicitacaoSelecionada.funcionarios.find(
                                (f) =>
                                  f.id === novaTarefa.remanejamentoFuncionarioId
                              )?.funcionario.status
                            }
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={fecharFormTarefa}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoTarefa}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {criandoTarefa ? "Criando..." : "Criar Tarefa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  // Função para obter o título da página com base no setor atual
  const getTituloPagina = () => {
    if (setorAtual === "RH") {
      return "Gerenciamento de Tarefas - RH";
    } else if (setorAtual === "MEDICINA") {
      return "Gerenciamento de Tarefas - Medicina";
    } else if (setorAtual === "TREINAMENTO") {
      return "Gerenciamento de Tarefas - Treinamento";
    } else {
      return "Gerenciamento de Tarefas";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-600">
          {getTituloPagina()}
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={exportarParaExcel}
            className="flex items-center px-4 py-2 border border-slate-500 rounded-md shadow-sm text-sm font-medium text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Exportar Excel
          </button>
          <button
            onClick={abrirFormTarefa}
            className="flex items-center px-4 py-2 border border-slate-500 rounded-md shadow-sm text-sm font-bold bg-sky-500 text-slate-50 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nova Tarefa
          </button>
        </div>
      </div>

      <ProgressoGeralComponent />
      <FiltroTarefas />
      <ListaTarefas />
      <NovaTarefaModal />

      {/* Modal para concluir tarefa */}
      {mostrarModalConcluir && tarefaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Concluir Tarefa</h3>
              <button
                onClick={fecharModalConcluir}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja concluir esta tarefa?
              </p>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-700 mb-2">
                  Detalhes da Tarefa
                </h4>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tipo:</span>{" "}
                  {tarefaSelecionada.tipo}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Descrição:</span>{" "}
                  {tarefaSelecionada.descricao}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Funcionário:</span>{" "}
                  {tarefaSelecionada.funcionario?.nome ||
                    tarefaSelecionada.remanejamentoFuncionario?.funcionario
                      .nome ||
                    "N/A"}
                </p>
              </div>

              {/* Campo de Data de Vencimento */}
              <div className="mt-4">
                <label
                  htmlFor="dataVencimento"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {tarefaSelecionada?.responsavel !== "RH" ? "Data de Vencimento (Obrigatória)" : "Data de Vencimento (Opcional)"}
                </label>
                <input
                  type="date"
                  id="dataVencimento"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  required={tarefaSelecionada?.responsavel !== "RH"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalConcluir}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={concluirTarefa}
                disabled={concluindoTarefa}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
              >
                {concluindoTarefa ? "Concluindo..." : "Concluir Tarefa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para adicionar observações */}
      {mostrarModalObservacoes && tarefaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Observações da Tarefa</h3>
              <button
                onClick={fecharModalObservacoes}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium text-gray-700 mb-2">
                Detalhes da Tarefa
              </h4>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Tipo:</span>{" "}
                {tarefaSelecionada.tipo}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Descrição:</span>{" "}
                {tarefaSelecionada.descricao}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Status:</span>{" "}
                {tarefaSelecionada.status}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Funcionário:</span>{" "}
                {tarefaSelecionada.funcionario?.nome ||
                  tarefaSelecionada.remanejamentoFuncionario?.funcionario
                    .nome ||
                  "N/A"}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Data Limite Atual:</span>{" "}
                {tarefaSelecionada.dataLimite
                  ? new Date(tarefaSelecionada.dataLimite).toLocaleDateString(
                      "pt-BR"
                    )
                  : "Não definida"}
              </p>
            </div>

            {/* Abas para Observações e Data Limite */}
            <div className="mb-6">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setAbaAtiva("observacoes")}
                  className={`py-2 px-4 font-medium text-sm ${
                    abaAtiva === "observacoes"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Adicionar Observação
                </button>
                <button
                  onClick={() => setAbaAtiva("dataLimite")}
                  className={`py-2 px-4 font-medium text-sm ${
                    abaAtiva === "dataLimite"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Alterar Data Limite
                </button>
              </div>

              {/* Conteúdo da aba de Observações */}
              {abaAtiva === "observacoes" && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-3">
                    Adicionar Nova Observação
                  </h4>
                  <div className="space-y-3">
                    <textarea
                      value={novaObservacao}
                      onChange={(e) => setNovaObservacao(e.target.value)}
                      placeholder="Digite sua observação..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                    <button
                      onClick={adicionarObservacao}
                      disabled={adicionandoObservacao}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                    >
                      {adicionandoObservacao
                        ? "Adicionando..."
                        : "Adicionar Observação"}
                    </button>
                  </div>
                </div>
              )}

              {/* Conteúdo da aba de Data Limite */}
              {abaAtiva === "dataLimite" && (
                <div className="mt-4 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-3">
                    Alterar Data Limite
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nova Data Limite
                      </label>
                      <input
                        type="date"
                        value={novaDataLimite}
                        onChange={(e) => setNovaDataLimite(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Justificativa da Alteração
                      </label>
                      <textarea
                        value={justificativaDataLimite}
                        onChange={(e) =>
                          setJustificativaDataLimite(e.target.value)
                        }
                        placeholder="Informe o motivo da alteração da data limite..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={atualizarDataLimite}
                      disabled={atualizandoDataLimite}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
                    >
                      {atualizandoDataLimite
                        ? "Atualizando..."
                        : "Atualizar Data Limite"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Observações */}
            <div>
              <h4 className="font-medium mb-3">Observações Existentes</h4>
              {carregandoObservacoes ? (
                <div className="flex items-center justify-center py-4">
                  <ClockIcon className="animate-spin h-5 w-5 mr-2 text-gray-500" />
                  <span className="text-gray-500">
                    Carregando observações...
                  </span>
                </div>
              ) : observacoes.length > 0 ? (
                <div className="space-y-3">
                  {observacoes.map((obs) => (
                    <div
                      key={obs.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      {observacaoEditando === obs.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={textoEditado}
                            onChange={(e) => setTextoEditado(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={cancelarEdicaoObservacao}
                              className="px-3 py-1 text-xs border border-gray-300 rounded-md shadow-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => salvarEdicaoObservacao(obs.id)}
                              disabled={editandoObservacao}
                              className="px-3 py-1 text-xs border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                            >
                              {editandoObservacao ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              {obs.texto}
                            </p>
                            <div className="mt-2 text-xs text-gray-500">
                              <p>
                                <span className="mx-2">•</span>
                                <span>Criado por: {obs.criadoPor} em </span>
                                <span>
                                  {obs.criadoEm &&
                                  !isNaN(new Date(obs.criadoEm).getTime())
                                    ? new Date(obs.criadoEm).toLocaleDateString(
                                        "pt-BR",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : "Data não disponível"}
                                </span>
                              </p>
                              {obs.modificadoPor && (
                                <p>
                                  <span className="mx-2">•</span>
                                  <span>
                                    Editado por: {obs.modificadoPor} em{" "}
                                  </span>
                                  <span>
                                    {obs.modificadoEm &&
                                    !isNaN(
                                      new Date(obs.modificadoEm ?? "").getTime()
                                    )
                                      ? new Date(
                                          obs.modificadoEm ?? ""
                                        ).toLocaleDateString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "Data não disponível"}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => iniciarEdicaoObservacao(obs)}
                              className="text-gray-500 hover:text-blue-600"
                              title="Editar observação"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => excluirObservacao(obs.id)}
                              className="text-gray-500 hover:text-red-600"
                              title="Excluir observação"
                              disabled={excluindoObservacao}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
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
    </div>
  );
}

