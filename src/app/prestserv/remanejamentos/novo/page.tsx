"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  UserGroupIcon,
  UsersIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserIcon,
  UserPlusIcon,
  IdentificationIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowLongRightIcon,
  ArrowLeftIcon,
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/app/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

interface Contrato {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
}

interface Funcionario {
  id: string;
  nome: string;
  centroCusto: string;
  funcao?: string;
  status?: string;
  dataAdmissao?: string;
  contratoId?: number;
  contratosVinculados?: {
    id: number;
    numero: string;
    nome: string;
    cliente: string;
    tipoVinculo: string;
  }[];
}

interface FuncionarioSelecionado {
  id: number;
  nome: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  status: string | null;
  selecionado: boolean;
}

interface ResumoRemanejamento {
  totalSelecionados: number;
  porFuncao: Record<string, number>;
  funcionarios: FuncionarioSelecionado[];
  origem: {
    contrato?: string;
  };
  destino: {
    contrato: string;
  };
}

interface DesvinculoOcorrencia {
  chave: string;
  funcionarioId: number;
  funcionarioNome: string;
  funcionarioMatricula: string;
  contratoId: number;
  contratoNome: string;
  contratoNumero: string;
}

export default function NovoRemanejamentoLogisticaPage() {
  return (
    <ProtectedRoute
      requiredEquipe={ROUTE_PROTECTION.NOVO_REMANEJAMENTO.requiredEquipe}
      requiredPermissions={
        ROUTE_PROTECTION.NOVO_REMANEJAMENTO.requiredPermissions
      }
    >
      <NovoRemanejamentoContent />
    </ProtectedRoute>
  );
}

function NovoRemanejamentoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { usuario } = useAuth();

  // Estados de dados
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosNovos, setFuncionariosNovos] = useState<Funcionario[]>([]);

  const [loading, setLoading] = useState(true);

  // Estados principais
  const [tipoRemanejamento, setTipoRemanejamento] = useState<
    | "funcionarios_novos"
    | "entre_contratos"
    | "multialocacao"
    | "desligamento"
    | "desvinculo"
    | ""
  >("");
  const [funcionariosSelecionados, setFuncionariosSelecionados] = useState<
    FuncionarioSelecionado[]
  >([]);
  const [contratoOrigem, setContratoOrigem] = useState<Contrato | null>(null);
  const [contratoDestino, setContratoDestino] = useState<Contrato | null>(null);
  const [contratosDesvinculoSelecionados, setContratosDesvinculoSelecionados] =
    useState<number[]>([]);
  const [ocorrenciasDesvinculoRemovidas, setOcorrenciasDesvinculoRemovidas] =
    useState<string[]>([]);
  const [justificativa, setJustificativa] = useState("");
  const [prioridade, setPrioridade] = useState<"BAIXA" | "MEDIA" | "ALTA">(
    "MEDIA",
  );
  const [submitting, setSubmitting] = useState(false);

  // Estados de exibição
  const [etapaAtual, setEtapaAtual] = useState<
    "tipo" | "contrato" | "selecao" | "confirmacao"
  >("tipo");
  const [mostrarFuncionarios, setMostrarFuncionarios] = useState(false);

  // Estados de filtros
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroFuncao, setFiltroFuncao] = useState("");
  const [filtroCentroCusto, setFiltroCentroCusto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  // Funções para manipular seleção de funcionários

  useEffect(() => {
    const fetchContratos = async () => {
      try {
        setLoading(true);
        const contratosRes = await fetch("/api/logistica/contratos");

        if (contratosRes.ok) {
          const contratosData = await contratosRes.json();
          setContratos(contratosData);
        }
      } catch (error) {
        console.error("Erro ao carregar contratos:", error);
        showToast("Erro ao carregar contratos", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchContratos();
  }, [showToast]);

  const carregarFuncionarios = async () => {
    try {
      setLoading(true);

      // Limpar estados anteriores para evitar conflitos
      setFuncionarios([]);
      setFuncionariosNovos([]);
      setFuncionariosSelecionados([]);
      setContratosDesvinculoSelecionados([]);
      setOcorrenciasDesvinculoRemovidas([]);

      // Limpar filtros para evitar que funcionários sejam escondidos
      setFiltroNome("");
      setFiltroFuncao("");
      setFiltroCentroCusto("");
      setFiltroStatus("");

      // Para alocação, limpar contrato origem pois não é necessário
      if (tipoRemanejamento === "funcionarios_novos") {
        setContratoOrigem(null);
      }

      if (tipoRemanejamento === "funcionarios_novos") {
        const funcionariosNovosRes = await fetch(
          "/api/logistica/funcionarios?tipo=alocacao",
        );

        if (funcionariosNovosRes.ok) {
          const funcionariosNovosData = await funcionariosNovosRes.json();
          setFuncionariosNovos(funcionariosNovosData);
        }
      } else if (
        tipoRemanejamento === "entre_contratos" ||
        tipoRemanejamento === "multialocacao" ||
        tipoRemanejamento === "desvinculo"
      ) {
        const funcionariosRes = await fetch(
          `/api/logistica/funcionarios?tipo=${
            tipoRemanejamento === "multialocacao"
              ? "multialocacao"
              : tipoRemanejamento === "desvinculo"
                ? "desvinculo"
                : "realocacao"
          }`,
        );

        if (funcionariosRes.ok) {
          const funcionariosData = await funcionariosRes.json();
          setFuncionarios(funcionariosData);
        }
      } else if (tipoRemanejamento === "desligamento") {
        const funcionariosRes = await fetch(
          "/api/logistica/funcionarios?tipo=desligamento",
        );

        if (funcionariosRes.ok) {
          const funcionariosData = await funcionariosRes.json();
          setFuncionarios(funcionariosData);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar funcionários:", error);
      showToast("Erro ao carregar funcionários", "error");
    } finally {
      setLoading(false);
    }
  };

  const contratosUnicos = useMemo(() => {
    const uniqueContratos = new Map();
    contratos.forEach((contrato) => {
      uniqueContratos.set(contrato.id, contrato);
    });
    return Array.from(uniqueContratos.values());
  }, [contratos]);

  const funcionariosDisponiveis = useMemo(() => {
    let funcionariosParaFiltrar: Funcionario[] = [];

    if (tipoRemanejamento === "funcionarios_novos") {
      funcionariosParaFiltrar = funcionariosNovos;
    } else {
      funcionariosParaFiltrar = funcionarios.filter((f) => {
        if (tipoRemanejamento === "entre_contratos") {
          if (contratoOrigem) {
            return f.contratoId === contratoOrigem.id;
          }
          return true;
        }
        if (tipoRemanejamento === "multialocacao") {
          if (!contratoDestino) {
            return true;
          }
          return !f.contratosVinculados?.some(
            (vinculo) => vinculo.id === contratoDestino.id,
          );
        }
        return true;
      });
    }

    return funcionariosParaFiltrar
      .filter((funcionario) => {
        const nomeMatch = funcionario.nome
          .toLowerCase()
          .includes(filtroNome.toLowerCase());
        const funcaoMatch =
          !filtroFuncao || funcionario.funcao === filtroFuncao;
        const centroCustoMatch =
          !filtroCentroCusto || funcionario.centroCusto === filtroCentroCusto;
        const statusMatch =
          !filtroStatus || funcionario.status === filtroStatus;
        const naoSelecionado = !funcionariosSelecionados.some(
          (sel) => sel.id === parseInt(funcionario.id),
        );

        return (
          nomeMatch &&
          funcaoMatch &&
          centroCustoMatch &&
          statusMatch &&
          naoSelecionado
        );
      })
      .map((funcionario) => ({
        id: parseInt(funcionario.id),
        nome: funcionario.nome,
        matricula: funcionario.id,
        funcao: funcionario.funcao || null,
        centroCusto: funcionario.centroCusto || null,
        status: funcionario.status || null,
        selecionado: false,
      }));
  }, [
    funcionarios,
    funcionariosNovos,
    tipoRemanejamento,
    contratoOrigem,
    contratoDestino,
    filtroNome,
    filtroFuncao,
    filtroCentroCusto,
    filtroStatus,
    funcionariosSelecionados,
  ]);

  const contratosDesvinculoDisponiveis = useMemo(() => {
    if (tipoRemanejamento !== "desvinculo") {
      return [] as Contrato[];
    }

    if (funcionariosSelecionados.length === 0) {
      return [] as Contrato[];
    }

    const selecionados = new Set(funcionariosSelecionados.map((f) => f.id));
    const contratosMap = new Map<number, Contrato>();

    funcionarios
      .filter((funcionario) => selecionados.has(Number(funcionario.id)))
      .forEach((funcionario) => {
        (funcionario.contratosVinculados || [])
          .filter((vinculo) => vinculo.tipoVinculo !== "PRINCIPAL")
          .forEach((vinculo) => {
            contratosMap.set(vinculo.id, {
              id: vinculo.id,
              numero: vinculo.numero,
              nome: vinculo.nome,
              cliente: vinculo.cliente,
            });
          });
      });

    return Array.from(contratosMap.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );
  }, [tipoRemanejamento, funcionarios, funcionariosSelecionados]);

  const funcionarioPorId = useMemo(() => {
    return funcionarios.reduce(
      (acc, funcionario) => {
        acc[Number(funcionario.id)] = funcionario;
        return acc;
      },
      {} as Record<number, Funcionario>,
    );
  }, [funcionarios]);

  const ocorrenciasDesvinculoPlanejadas = useMemo(() => {
    if (
      tipoRemanejamento !== "desvinculo" ||
      funcionariosSelecionados.length === 0 ||
      contratosDesvinculoSelecionados.length === 0
    ) {
      return [] as DesvinculoOcorrencia[];
    }

    const contratosSelecionadosSet = new Set(contratosDesvinculoSelecionados);

    return funcionariosSelecionados
      .flatMap((funcionarioSelecionado) => {
        const funcionarioCompleto = funcionarioPorId[funcionarioSelecionado.id];
        const vinculos = funcionarioCompleto?.contratosVinculados || [];
        return vinculos
          .filter(
            (vinculo) =>
              vinculo.tipoVinculo !== "PRINCIPAL" &&
              contratosSelecionadosSet.has(vinculo.id),
          )
          .map((vinculo) => ({
            chave: `${funcionarioSelecionado.id}-${vinculo.id}`,
            funcionarioId: funcionarioSelecionado.id,
            funcionarioNome: funcionarioSelecionado.nome,
            funcionarioMatricula: funcionarioSelecionado.matricula,
            contratoId: vinculo.id,
            contratoNome: vinculo.nome,
            contratoNumero: vinculo.numero,
          }));
      })
      .sort((a, b) => {
        const nomeCompare = a.funcionarioNome.localeCompare(b.funcionarioNome);
        if (nomeCompare !== 0) {
          return nomeCompare;
        }
        return a.contratoNome.localeCompare(b.contratoNome);
      });
  }, [
    tipoRemanejamento,
    funcionariosSelecionados,
    contratosDesvinculoSelecionados,
    funcionarioPorId,
  ]);

  const ocorrenciasDesvinculoAtivas = useMemo(() => {
    const removidas = new Set(ocorrenciasDesvinculoRemovidas);
    return ocorrenciasDesvinculoPlanejadas.filter(
      (ocorrencia) => !removidas.has(ocorrencia.chave),
    );
  }, [ocorrenciasDesvinculoPlanejadas, ocorrenciasDesvinculoRemovidas]);

  const mapaDesvinculoPorFuncionario = useMemo(() => {
    return ocorrenciasDesvinculoAtivas.reduce(
      (acc, ocorrencia) => {
        if (!acc[ocorrencia.funcionarioId]) {
          acc[ocorrencia.funcionarioId] = [];
        }
        acc[ocorrencia.funcionarioId].push(ocorrencia.contratoId);
        return acc;
      },
      {} as Record<number, number[]>,
    );
  }, [ocorrenciasDesvinculoAtivas]);

  useEffect(() => {
    setContratosDesvinculoSelecionados((prev) =>
      prev.filter((id) =>
        contratosDesvinculoDisponiveis.some((contrato) => contrato.id === id),
      ),
    );
  }, [contratosDesvinculoDisponiveis]);

  useEffect(() => {
    const chavesValidas = new Set(
      ocorrenciasDesvinculoPlanejadas.map((ocorrencia) => ocorrencia.chave),
    );
    setOcorrenciasDesvinculoRemovidas((prev) =>
      prev.filter((chave) => chavesValidas.has(chave)),
    );
  }, [ocorrenciasDesvinculoPlanejadas]);

  const funcoesDisponiveis = useMemo(() => {
    const funcoes = new Set<string>();
    funcionariosDisponiveis.forEach((f) => f.funcao && funcoes.add(f.funcao));
    return Array.from(funcoes).sort();
  }, [funcionariosDisponiveis]);

  const centrosCustoDisponiveis = useMemo(() => {
    const centros = new Set<string>();
    funcionariosDisponiveis.forEach(
      (f) => f.centroCusto && centros.add(f.centroCusto),
    );
    return Array.from(centros).sort();
  }, [funcionariosDisponiveis]);

  const statusDisponiveis = useMemo(() => {
    const status = new Set<string>();
    funcionariosDisponiveis.forEach((f) => f.status && status.add(f.status));
    return Array.from(status).sort();
  }, [funcionariosDisponiveis]);

  // Estado para controlar o loading ao selecionar funcionário
  const [loadingSelecao, setLoadingSelecao] = useState<number | null>(null);

  const adicionarFuncionario = async (funcionario: FuncionarioSelecionado) => {
    // Ativa o loading para este funcionário específico
    setLoadingSelecao(funcionario.id);

    try {
      // Simula um pequeno delay para dar feedback visual ao usuário
      await new Promise((resolve) => setTimeout(resolve, 300));

      setFuncionariosSelecionados((prev) =>
        prev.some((f) => f.id === funcionario.id)
          ? prev
          : [...prev, funcionario],
      );

      // Para remanejamentos entre contratos ou desligamentos, definir automaticamente o contrato de origem
      if (tipoRemanejamento === "entre_contratos" && !contratoOrigem) {
        // Buscar o funcionário original para obter o contratoId
        const funcionarioOriginal = funcionarios.find(
          (f) => f.id === funcionario.id.toString(),
        );
        if (funcionarioOriginal && funcionarioOriginal.contratoId) {
          const contratoDoFuncionario = contratos.find(
            (c) => c.id === funcionarioOriginal.contratoId,
          );
          if (contratoDoFuncionario) {
            setContratoOrigem(contratoDoFuncionario);
          }
        }
      }
    } finally {
      // Desativa o loading
      setLoadingSelecao(null);
    }
  };

  const removerFuncionario = (funcionarioId: number) => {
    setFuncionariosSelecionados((prev) =>
      prev.filter((f) => f.id !== funcionarioId),
    );
    setOcorrenciasDesvinculoRemovidas((prev) =>
      prev.filter((chave) => !chave.startsWith(`${funcionarioId}-`)),
    );
  };

  const adicionarTodosDaFuncao = (funcao: string) => {
    const funcionariosDaFuncao = funcionariosDisponiveis.filter(
      (f) => f.funcao === funcao,
    );
    setFuncionariosSelecionados((prev) => [...prev, ...funcionariosDaFuncao]);
  };

  const getResumo = (): ResumoRemanejamento => {
    const porFuncao = funcionariosSelecionados.reduce(
      (acc, funcionario) => {
        const funcao = funcionario.funcao || "Sem função";
        acc[funcao] = (acc[funcao] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalSelecionados: funcionariosSelecionados.length,
      porFuncao,
      funcionarios: funcionariosSelecionados,
      origem: {
        contrato: contratoOrigem?.nome,
      },
      destino: {
        contrato: contratoDestino?.nome || "",
      },
    };
  };

  const handleSubmit = async () => {
    // Validações básicas
    if (funcionariosSelecionados.length === 0 || !justificativa.trim()) {
      showToast("Preencha todos os campos obrigatórios", "error");
      return;
    }

    // Para desligamento e desvínculo, não precisa de contrato de destino
    if (
      tipoRemanejamento !== "desligamento" &&
      tipoRemanejamento !== "desvinculo" &&
      !contratoDestino
    ) {
      showToast("Selecione o contrato de destino", "error");
      return;
    }
    if (
      tipoRemanejamento === "desvinculo" &&
      contratosDesvinculoSelecionados.length === 0
    ) {
      showToast(
        "Selecione ao menos um contrato adicional para desvincular",
        "error",
      );
      return;
    }
    if (
      tipoRemanejamento === "desvinculo" &&
      ocorrenciasDesvinculoAtivas.length === 0
    ) {
      showToast(
        "Nenhuma ocorrência de desvínculo ativa para enviar. Revise o relatório.",
        "error",
      );
      return;
    }

    setSubmitting(true);

    try {
      const funcionarioIdsDesvinculo = Object.keys(mapaDesvinculoPorFuncionario)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);
      const contratoIdsDesvinculoAtivos = Array.from(
        new Set(
          ocorrenciasDesvinculoAtivas.map(
            (ocorrencia) => ocorrencia.contratoId,
          ),
        ),
      );
      const payload: any = {
        tipo:
          tipoRemanejamento === "funcionarios_novos"
            ? "ALOCACAO"
            : tipoRemanejamento === "entre_contratos"
              ? "REMANEJAMENTO"
              : tipoRemanejamento === "multialocacao"
                ? "VINCULO_ADICIONAL"
                : tipoRemanejamento === "desvinculo"
                  ? "DESVINCULO_ADICIONAL"
                  : "DESLIGAMENTO",
        contratoOrigemId:
          tipoRemanejamento === "entre_contratos"
            ? contratoOrigem?.id
            : undefined,
        funcionarioIds:
          tipoRemanejamento === "desvinculo"
            ? funcionarioIdsDesvinculo
            : funcionariosSelecionados.map((f) => f.id),
        contratoDesvinculoIds:
          tipoRemanejamento === "desvinculo"
            ? contratoIdsDesvinculoAtivos
            : undefined,
        contratosDesvinculoPorFuncionario:
          tipoRemanejamento === "desvinculo"
            ? mapaDesvinculoPorFuncionario
            : undefined,
        justificativa,
        prioridade,
        // solicitadoPor agora é inferido no backend via usuário autenticado
      };

      payload.usuarioContexto = {
        id: usuario?.id,
        nome: usuario?.nome,
        email: usuario?.email,
        equipe: usuario?.equipe,
        matricula: usuario?.matricula,
      };

      if (
        tipoRemanejamento !== "desligamento" &&
        tipoRemanejamento !== "desvinculo" &&
        contratoDestino
      ) {
        payload.contratoDestinoId = contratoDestino.id;
      }

      const response = await fetch("/api/logistica/remanejamentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const ignoradosDesvinculo = Array.isArray(
          data?.funcionariosIgnoradosDesvinculo,
        )
          ? data.funcionariosIgnoradosDesvinculo
          : [];
        if (ignoradosDesvinculo.length > 0) {
          showToast(
            `Alguns funcionários foram ignorados por não terem vínculo nos contratos selecionados: ${ignoradosDesvinculo
              .map((funcionario: { nome: string }) => funcionario.nome)
              .join(", ")}`,
            "warning",
            9000,
          );
        }
        showToast(
          "Solicitação de remanejamento enviada com sucesso!",
          "success",
        );

        // Aguardar um momento para o toast ser exibido e então redirecionar
        // Mantém o loading ativo durante todo o processo
        setTimeout(() => {
          const returnToParam = searchParams.get("returnTo");
          let target = returnToParam || "";
          if (!target) {
            try {
              const section = localStorage.getItem("sidebar-active-section");
              if (section === "planejamento") {
                target = "/prestserv/funcionarios/planejamento";
              } else {
                target = "/prestserv/funcionarios";
              }
            } catch {
              target = "/prestserv/funcionarios";
            }
          }
          router.push(target);
        }, 1500);
      } else {
        const error = await response.json();
        showToast(
          error?.error || error?.message || "Erro ao enviar solicitação",
          "error",
        );
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      showToast("Erro ao enviar solicitação", "error");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-800 to-slate-600 shadow-lg rounded-t-2xl border-slate-500 border-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-all duration-200"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <UserGroupIcon className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Novo Remanejamento
                  </h1>
                  <p className="text-sm text-slate-300 mt-1">
                    {etapaAtual === "tipo"
                      ? "Escolher tipo de remanejamento"
                      : etapaAtual === "contrato"
                        ? "Selecionar contrato"
                        : etapaAtual === "selecao"
                          ? "Selecionar funcionários"
                          : "Confirmar solicitação"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                    etapaAtual === "tipo"
                      ? "bg-white text-slate-800 shadow-lg"
                      : ["contrato", "selecao", "confirmacao"].includes(
                            etapaAtual,
                          )
                        ? "bg-slate-600 text-white shadow-lg"
                        : "bg-white/20 text-slate-300"
                  }`}
                >
                  1
                </div>
                <span
                  className={`text-xs font-medium hidden lg:block ${
                    etapaAtual === "tipo" ? "text-white" : "text-slate-300"
                  }`}
                >
                  Tipo
                </span>
              </div>

              <ArrowRightIcon className="h-3 w-3 text-slate-400" />

              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                    etapaAtual === "contrato"
                      ? "bg-white text-slate-800 shadow-lg"
                      : ["selecao", "confirmacao"].includes(etapaAtual)
                        ? "bg-slate-600 text-white shadow-lg"
                        : "bg-white/20 text-slate-300"
                  }`}
                >
                  2
                </div>
                <span
                  className={`text-xs font-medium hidden lg:block ${
                    etapaAtual === "contrato" ? "text-white" : "text-slate-300"
                  }`}
                >
                  Contrato
                </span>
              </div>

              <ArrowRightIcon className="h-3 w-3 text-slate-400" />

              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                    etapaAtual === "selecao"
                      ? "bg-white text-slate-800 shadow-lg"
                      : etapaAtual === "confirmacao"
                        ? "bg-slate-600 text-white shadow-lg"
                        : "bg-white/20 text-slate-300"
                  }`}
                >
                  3
                </div>
                <span
                  className={`text-xs font-medium hidden lg:block ${
                    etapaAtual === "selecao" ? "text-white" : "text-slate-300"
                  }`}
                >
                  Seleção
                </span>
              </div>

              <ArrowRightIcon className="h-3 w-3 text-slate-400" />

              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                    etapaAtual === "confirmacao"
                      ? "bg-white text-slate-800 shadow-lg"
                      : "bg-white/20 text-slate-300"
                  }`}
                >
                  4
                </div>
                <span
                  className={`text-xs font-medium hidden lg:block ${
                    etapaAtual === "confirmacao"
                      ? "text-white"
                      : "text-slate-300"
                  }`}
                >
                  Confirmação
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col">
        {etapaAtual === "tipo" ? (
          <div className="max-w-4xl mx-auto flex-1">
            <div className="overflow-hidden h-full flex flex-col">
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 text-center border-b border-gray-100">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
                  <UserGroupIcon className="h-6 w-6 text-slate-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Tipo de Solicitação
                </h2>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-5 h-full">
                  <div
                    className={`group relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col h-full ${
                      tipoRemanejamento === "funcionarios_novos"
                        ? "border-slate-400 bg-slate-50 shadow-lg transform scale-105"
                        : "border-gray-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                    onClick={() => setTipoRemanejamento("funcionarios_novos")}
                  >
                    <div className="flex flex-col items-center text-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-300 ${
                          tipoRemanejamento === "funcionarios_novos"
                            ? "border-slat-500 bg-slate-600 shadow-lg"
                            : "border-gray-300 group-hover:border-slate-400 group-hover:bg-slate-100"
                        }`}
                      >
                        {tipoRemanejamento === "funcionarios_novos" ? (
                          <CheckIcon className="w-5 h-5 text-white" />
                        ) : (
                          <UserPlusIcon className="w-5 h-5 text-gray-400 group-hover:text-slate-600" />
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        Alocação
                      </h3>
                      <p className="text-gray-600 mb-3 text-sm leading-relaxed flex-1">
                        Alocar funcionários novos em contratos (sem contrato de
                        origem)
                      </p>
                      <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Novos funcionários
                      </div>
                    </div>
                  </div>
                  <div
                    className={`group relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col h-full ${
                      tipoRemanejamento === "entre_contratos"
                        ? "border-slate-400 bg-slate-50 shadow-lg transform scale-105"
                        : "border-gray-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                    onClick={() => setTipoRemanejamento("entre_contratos")}
                  >
                    <div className="flex flex-col items-center text-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-300 ${
                          tipoRemanejamento === "entre_contratos"
                            ? "border-slate-500 bg-slate-600 shadow-lg"
                            : "border-gray-300 group-hover:border-slate-400 group-hover:bg-slate-100"
                        }`}
                      >
                        {tipoRemanejamento === "entre_contratos" ? (
                          <CheckIcon className="w-5 h-5 text-white" />
                        ) : (
                          <ArrowLongRightIcon className="w-5 h-5 text-gray-400 group-hover:text-slate-600" />
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        Remanejamento
                      </h3>
                      <p className="text-gray-600 mb-3 text-sm leading-relaxed flex-1">
                        Mover funcionários entre contratos (contrato de origem
                        obrigatório)
                      </p>
                      <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Redistribuição de equipes
                      </div>
                    </div>
                  </div>

                  <div
                    className={`group relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col h-full ${
                      tipoRemanejamento === "desligamento"
                        ? "border-slate-400 bg-slate-50 shadow-lg transform scale-105"
                        : "border-gray-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                    onClick={() => setTipoRemanejamento("desligamento")}
                  >
                    <div className="flex flex-col items-center text-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-300 ${
                          tipoRemanejamento === "desligamento"
                            ? "border-slate-500 bg-slate-600 shadow-lg"
                            : "border-gray-300 group-hover:border-slate-400 group-hover:bg-slate-100"
                        }`}
                      >
                        {tipoRemanejamento === "desligamento" ? (
                          <CheckIcon className="w-5 h-5 text-white" />
                        ) : (
                          <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-slate-600" />
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        Desligamento
                      </h3>
                      <p className="text-gray-600 mb-3 text-sm leading-relaxed flex-1">
                        Solicitar desligamento de funcionários
                      </p>
                      <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Encerramento de vínculo
                      </div>
                    </div>
                  </div>
                  <div
                    className={`group relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col h-full ${
                      tipoRemanejamento === "multialocacao"
                        ? "border-slate-400 bg-slate-50 shadow-lg transform scale-105"
                        : "border-gray-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                    onClick={() => setTipoRemanejamento("multialocacao")}
                  >
                    <div className="flex flex-col items-center text-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-300 ${
                          tipoRemanejamento === "multialocacao"
                            ? "border-slate-500 bg-slate-600 shadow-lg"
                            : "border-gray-300 group-hover:border-slate-400 group-hover:bg-slate-100"
                        }`}
                      >
                        {tipoRemanejamento === "multialocacao" ? (
                          <CheckIcon className="w-5 h-5 text-white" />
                        ) : (
                          <UsersIcon className="w-5 h-5 text-gray-400 group-hover:text-slate-600" />
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        Multi-alocação
                      </h3>
                      <p className="text-gray-600 mb-3 text-sm leading-relaxed flex-1">
                        Vincular funcionário a contrato adicional sem remover o
                        vínculo atual
                      </p>
                      <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Vínculo adicional
                      </div>
                    </div>
                  </div>
                  <div
                    className={`group relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col h-full ${
                      tipoRemanejamento === "desvinculo"
                        ? "border-slate-400 bg-slate-50 shadow-lg transform scale-105"
                        : "border-gray-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                    onClick={() => setTipoRemanejamento("desvinculo")}
                  >
                    <div className="flex flex-col items-center text-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 transition-all duration-300 ${
                          tipoRemanejamento === "desvinculo"
                            ? "border-slate-500 bg-slate-600 shadow-lg"
                            : "border-gray-300 group-hover:border-slate-400 group-hover:bg-slate-100"
                        }`}
                      >
                        {tipoRemanejamento === "desvinculo" ? (
                          <CheckIcon className="w-5 h-5 text-white" />
                        ) : (
                          <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-slate-600" />
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        Desvincular
                      </h3>
                      <p className="text-gray-600 mb-3 text-sm leading-relaxed flex-1">
                        Remover um ou mais vínculos adicionais mantendo o
                        contrato principal
                      </p>
                      <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Remoção de adicionais
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      if (!tipoRemanejamento) {
                        showToast("Selecione um tipo de solicitação", "error");
                        return;
                      }
                      setEtapaAtual("contrato");
                    }}
                    disabled={!tipoRemanejamento}
                    className={`w-full sm:w-auto px-8 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105 mx-auto ${
                      !tipoRemanejamento ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Continuar
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : etapaAtual === "contrato" ? (
          <div className="max-w-4xl mx-auto flex-1">
            <div className="overflow-hidden h-full flex flex-col">
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 text-center border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {tipoRemanejamento === "funcionarios_novos"
                    ? "Escolha o contrato para onde os funcionários serão alocados"
                    : tipoRemanejamento === "entre_contratos"
                      ? "Escolha o contrato de destino para o remanejamento"
                      : tipoRemanejamento === "multialocacao"
                        ? "Escolha o contrato de destino para vínculo adicional"
                        : tipoRemanejamento === "desvinculo"
                          ? "Confirme para seguir com a seleção de funcionários e contratos adicionais"
                          : "Confirme para seguir com o desligamento completo"}
                </h2>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                {(tipoRemanejamento === "desligamento" ||
                  tipoRemanejamento === "desvinculo") && (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      {tipoRemanejamento === "desligamento"
                        ? "No desligamento não é necessário escolher contrato. O funcionário será removido do contrato principal e de todos os contratos adicionais."
                        : "No desvínculo você escolherá os contratos adicionais após selecionar os funcionários."}
                    </p>
                  </div>
                )}

                {tipoRemanejamento !== "desligamento" &&
                  tipoRemanejamento !== "desvinculo" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                      {contratos.map((contrato) => (
                        <div
                          key={contrato.id}
                          onClick={() => {
                            setContratoDestino(contrato);
                          }}
                          className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                            contratoDestino?.id === contrato.id
                              ? "border-slate-400 bg-slate-50 shadow-lg"
                              : "border-gray-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          {contratoDestino?.id === contrato.id && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center">
                              <CheckIcon className="h-4 w-4 text-white" />
                            </div>
                          )}

                          <div className="text-center">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <BuildingOfficeIcon className="h-5 w-5 text-slate-700" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                              {contrato.nome}
                            </h3>
                            <p className="text-xs text-gray-600 mb-1">
                              {contrato.cliente}
                            </p>
                            <p className="text-xs text-gray-500">
                              Nº {contrato.numero}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {contratos.length === 0 &&
                  tipoRemanejamento !== "desligamento" &&
                  tipoRemanejamento !== "desvinculo" && (
                    <div className="text-center py-12">
                      <BuildingOfficeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Nenhum contrato encontrado
                      </h3>
                      <p className="text-gray-600">
                        Não há contratos disponíveis no momento.
                      </p>
                    </div>
                  )}

                <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
                  <button
                    onClick={() => setEtapaAtual("tipo")}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Voltar
                  </button>

                  <button
                    onClick={() => {
                      carregarFuncionarios();
                      setEtapaAtual("selecao");
                    }}
                    disabled={
                      tipoRemanejamento === "desligamento" ||
                      tipoRemanejamento === "desvinculo"
                        ? false
                        : !contratoDestino
                    }
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-700 text-white px-6 py-3 rounded-xl hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Continuar
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : etapaAtual === "selecao" ? (
          <div className="max-w-8xl mx-auto flex-1">
            <div className="overflow-hidden h-full flex flex-col">
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 text-center border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  {tipoRemanejamento === "funcionarios_novos"
                    ? "Selecione os funcionários novos para alocar"
                    : tipoRemanejamento === "entre_contratos"
                      ? "Selecione os funcionários para remanejamento"
                      : tipoRemanejamento === "multialocacao"
                        ? "Selecione os funcionários para vínculo adicional"
                        : tipoRemanejamento === "desvinculo"
                          ? "Selecione os funcionários para remover vínculos adicionais"
                          : "Selecione os funcionários para desligamento"}
                </h2>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                {/* Exibição do contrato de origem (apenas para visualização) */}
                {tipoRemanejamento === "entre_contratos" && contratoOrigem && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <BuildingOfficeIcon className="h-4 w-4" />
                      Contrato de Origem
                    </h3>
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <h4 className="font-medium text-blue-800">
                        {contratoOrigem.nome}
                      </h4>
                      <p className="text-sm text-blue-600">
                        Cliente: {contratoOrigem.cliente || "N/A"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Filtros */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Buscar por nome
                    </label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        value={filtroNome}
                        onChange={(e) => setFiltroNome(e.target.value)}
                        placeholder="Digite o nome..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Função
                    </label>
                    <select
                      value={filtroFuncao}
                      onChange={(e) => setFiltroFuncao(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Centro de Custo
                    </label>
                    <select
                      value={filtroCentroCusto}
                      onChange={(e) => setFiltroCentroCusto(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Todos os centros</option>
                      {centrosCustoDisponiveis.map((centro) => (
                        <option key={centro} value={centro}>
                          {centro}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Todos os status</option>
                      {statusDisponiveis.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {tipoRemanejamento === "desvinculo" &&
                  funcionariosSelecionados.length > 0 && (
                    <div className="mt-4 mb-2 border border-amber-200 bg-amber-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-900 mb-2">
                        Contratos adicionais para desvincular
                      </h3>
                      {contratosDesvinculoDisponiveis.length === 0 ? (
                        <p className="text-sm text-amber-800">
                          Os funcionários selecionados não possuem contratos
                          adicionais ativos.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {contratosDesvinculoDisponiveis.map((contrato) => {
                            const marcado =
                              contratosDesvinculoSelecionados.includes(
                                contrato.id,
                              );
                            return (
                              <label
                                key={contrato.id}
                                className="flex items-center gap-2 rounded border border-amber-200 bg-white px-3 py-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => {
                                    setContratosDesvinculoSelecionados(
                                      (prev) =>
                                        marcado
                                          ? prev.filter(
                                              (id) => id !== contrato.id,
                                            )
                                          : [...prev, contrato.id],
                                    );
                                  }}
                                  className="h-4 w-4"
                                />
                                <span className="text-sm text-gray-800">
                                  {contrato.nome} ({contrato.numero})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                {/* Duas listas lado a lado */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lista de Funcionários Disponíveis */}
                  <div className="border border-blue-200 rounded-lg bg-white">
                    <div className="p-4 border-b border-blue-200 bg-blue-50">
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
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-200">
                      {funcionariosDisponiveis.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          Nenhum funcionário disponível com os filtros
                          selecionados
                        </div>
                      ) : (
                        funcionariosDisponiveis.map((funcionario) => (
                          <div
                            key={funcionario.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer transition-colors relative"
                            onClick={() => adicionarFuncionario(funcionario)}
                          >
                            {loadingSelecao === funcionario.id && (
                              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium text-gray-900 text-sm">
                                    {funcionario.nome}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500 space-y-1">
                                  <div className="flex items-center gap-4">
                                    <span>Mat: {funcionario.matricula}</span>
                                    {funcionario.funcao && (
                                      <span>Função: {funcionario.funcao}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {funcionario.centroCusto && (
                                      <span>CC: {funcionario.centroCusto}</span>
                                    )}
                                    {funcionario.status && (
                                      <span>Status: {funcionario.status}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button className="ml-2 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded">
                                <ArrowRightIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Lista de Funcionários Selecionados */}
                  <div className="border border-green-200 rounded-lg bg-white">
                    <div className="p-4 border-b border-green-200 bg-green-50">
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
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-200">
                      {funcionariosSelecionados.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          Nenhum funcionário selecionado
                        </div>
                      ) : (
                        funcionariosSelecionados.map((funcionario) => (
                          <div
                            key={funcionario.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => removerFuncionario(funcionario.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium text-gray-900 text-sm">
                                    {funcionario.nome}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500 space-y-1">
                                  <div className="flex items-center gap-4">
                                    <span>Mat: {funcionario.matricula}</span>
                                    {funcionario.funcao && (
                                      <span>Função: {funcionario.funcao}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {funcionario.centroCusto && (
                                      <span>CC: {funcionario.centroCusto}</span>
                                    )}
                                    {funcionario.status && (
                                      <span>Status: {funcionario.status}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded">
                                <ArrowLeftIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Botões de navegação */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
                  <button
                    onClick={() => setEtapaAtual("contrato")}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Voltar
                  </button>

                  <button
                    onClick={() => setEtapaAtual("confirmacao")}
                    disabled={
                      funcionariosSelecionados.length === 0 ||
                      (tipoRemanejamento === "desvinculo" &&
                        ocorrenciasDesvinculoAtivas.length === 0)
                    }
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-700 text-white px-6 py-3 rounded-xl hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Continuar
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : etapaAtual === "confirmacao" ? (
          <div className="max-w-4xl mx-auto flex-1">
            <div className="overflow-hidden h-full flex flex-col">
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 text-center border-b border-gray-100">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-3">
                  <CheckCircleIcon className="h-6 w-6 text-slate-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Confirmar Solicitação
                </h2>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Revise os dados da solicitação antes de enviar
                </p>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                {/* Resumo da solicitação */}
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="text-gray-600">Tipo:</span>
                        <span className="ml-2 font-medium">
                          {tipoRemanejamento === "funcionarios_novos"
                            ? "Alocação de Funcionários Novos"
                            : tipoRemanejamento === "entre_contratos"
                              ? "Remanejamento entre Contratos"
                              : tipoRemanejamento === "multialocacao"
                                ? "Vínculo Adicional em Contrato"
                                : tipoRemanejamento === "desvinculo"
                                  ? "Desvínculo de Contratos Adicionais"
                                  : "Desligamento de Funcionários"}
                        </span>
                      </div>

                      {/* Movimento De -> Para */}
                      {(contratoOrigem || contratoDestino) && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-center gap-3">
                            {contratoOrigem ? (
                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-500 mb-1">
                                  De
                                </div>
                                <div className="font-medium text-blue-700 text-sm">
                                  {contratoOrigem.nome}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {contratoOrigem.cliente}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-500 mb-1">
                                  De
                                </div>
                                <div className="font-medium text-gray-500 text-sm">
                                  {tipoRemanejamento === "multialocacao"
                                    ? "Contrato atual mantido"
                                    : tipoRemanejamento === "desvinculo"
                                      ? "Contratos adicionais"
                                      : "Funcionários Novos"}
                                </div>
                              </div>
                            )}

                            <div className="flex-shrink-0">
                              <ArrowRightIcon className="h-5 w-5 text-gray-400" />
                            </div>

                            {contratoDestino ? (
                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-500 mb-1">
                                  Para
                                </div>
                                <div className="font-medium text-green-700 text-sm">
                                  {contratoDestino.nome}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {contratoDestino.cliente}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center flex-1">
                                <div className="text-xs text-gray-500 mb-1">
                                  Para
                                </div>
                                <div className="font-medium text-red-700 text-sm">
                                  {tipoRemanejamento === "desvinculo"
                                    ? "Manter principal"
                                    : "Desligamento"}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* <div className="text-sm">
                        <span className="text-gray-600">Funcionários Selecionados:</span>
                        <span className="ml-2 font-medium">{funcionariosSelecionados.length}</span>
                      </div> */}
                    </div>
                  </div>

                  {/* Lista de funcionários selecionados */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Funcionários Selecionados:{" "}
                      {funcionariosSelecionados.length}
                    </h3>
                    <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                      <div className="divide-y divide-gray-200">
                        {funcionariosSelecionados.map((funcionario) => (
                          <div key={funcionario.id} className="p-3">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900 text-sm">
                                {funcionario.nome}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-500 flex gap-4">
                              <span>Mat: {funcionario.matricula}</span>
                              {funcionario.funcao && (
                                <span>Função: {funcionario.funcao}</span>
                              )}
                              {funcionario.centroCusto && (
                                <span>CC: {funcionario.centroCusto}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {tipoRemanejamento === "desvinculo" && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-semibold text-amber-900">
                          Relatório de ocorrências de desvínculo
                        </h3>
                        <span className="text-xs text-amber-900 bg-white border border-amber-200 rounded-full px-2 py-1">
                          {ocorrenciasDesvinculoAtivas.length} de{" "}
                          {ocorrenciasDesvinculoPlanejadas.length} ativa
                          {ocorrenciasDesvinculoAtivas.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {ocorrenciasDesvinculoPlanejadas.length === 0 ? (
                        <p className="text-sm text-amber-800">
                          Nenhuma ocorrência encontrada para os funcionários e
                          contratos selecionados.
                        </p>
                      ) : (
                        <div className="border border-amber-200 rounded-lg bg-white max-h-72 overflow-y-auto divide-y divide-amber-100">
                          {ocorrenciasDesvinculoPlanejadas.map((ocorrencia) => {
                            const removida =
                              ocorrenciasDesvinculoRemovidas.includes(
                                ocorrencia.chave,
                              );
                            return (
                              <div
                                key={ocorrencia.chave}
                                className={`p-3 flex items-center justify-between gap-3 ${
                                  removida ? "opacity-60 bg-gray-50" : ""
                                }`}
                              >
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    {ocorrencia.funcionarioNome}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    Mat: {ocorrencia.funcionarioMatricula} •{" "}
                                    {ocorrencia.contratoNome} (
                                    {ocorrencia.contratoNumero})
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOcorrenciasDesvinculoRemovidas((prev) =>
                                      removida
                                        ? prev.filter(
                                            (chave) =>
                                              chave !== ocorrencia.chave,
                                          )
                                        : [...prev, ocorrencia.chave],
                                    );
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                    removida
                                      ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                                      : "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                                  }`}
                                >
                                  {removida
                                    ? "Desfazer remoção"
                                    : "Remover caso"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Justificativa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Justificativa *
                    </label>
                    <textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Descreva o motivo da solicitação..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Prioridade */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={prioridade}
                      onChange={(e) =>
                        setPrioridade(
                          e.target.value as "BAIXA" | "MEDIA" | "ALTA",
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="BAIXA">Baixa</option>
                      <option value="MEDIA">Média</option>
                      <option value="ALTA">Alta</option>
                    </select>
                  </div>
                </div>

                {/* Botões de navegação */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
                  <button
                    onClick={() => setEtapaAtual("selecao")}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-xl hover:bg-gray-50"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Voltar
                  </button>

                  <button
                    onClick={() => {
                      if (!submitting && justificativa.trim()) {
                        handleSubmit();
                      }
                    }}
                    disabled={
                      submitting ||
                      !justificativa.trim() ||
                      (tipoRemanejamento === "desvinculo" &&
                        ocorrenciasDesvinculoAtivas.length === 0)
                    }
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar Solicitação
                        <CheckIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
