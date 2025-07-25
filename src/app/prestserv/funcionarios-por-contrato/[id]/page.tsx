"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  ArrowLeftIcon,
  UserIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CalendarIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  BriefcaseIcon,
  MapPinIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";

interface FuncionarioDetalhes {
  id: number;
  nome: string;
  matricula: string;
  funcao: string;
  centroCusto: string;
  status: string;
  statusPrestserv: string;
  emMigracao: boolean;
  cpf?: string;
  rg?: string;
  orgaoEmissor?: string;
  uf?: string;
  dataNascimento?: string;
  email?: string;
  telefone?: string;
  departamento?: string;
  criadoEm: string;
  sispat?: string;
  atualizadoEm: string;
  contrato?: {
    id: number;
    nome: string;
    numero: string;
    cliente: string;
  };
}

interface RemanejamentoDetalhes {
  idRemanejamento: string;
  idSolicitacao: string;
  contratoOrigem?: {
    id: number;
    nome: string;
    numero: string;
    cliente: string;
  };
  contratoDestino?: {
    id: number;
    nome: string;
    numero: string;
    cliente: string;
  };
  tipoSolicitacao: string;
  statusTarefas: string;
  statusPrestserv: string;
  statusFuncionario: string;
  dataCriacao: string;
  dataAtualizacao: string;
  dataSolicitacao: string;
  justificativa?: string;
  observacoesPrestserv?: string;
}

export default function FuncionarioDetalhePage() {
  return <FuncionarioDetalheContent />;
}

function FuncionarioDetalheContent() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [funcionario, setFuncionario] = useState<FuncionarioDetalhes | null>(
    null
  );
  const [remanejamentos, setRemanejamentos] = useState<RemanejamentoDetalhes[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const funcionarioId = params.id as string;

  useEffect(() => {
    if (funcionarioId) {
      fetchFuncionarioDetalhes();
    }
  }, [funcionarioId]);

  const fetchFuncionarioDetalhes = async () => {
    try {
      // Buscar dados do funcionário
      const funcionarioResponse = await fetch(
        `/api/funcionarios/${funcionarioId}`
      );
      if (!funcionarioResponse.ok) {
        throw new Error(`Erro ${funcionarioResponse.status}: ${funcionarioResponse.statusText}`);
      }
      const funcionarioData = await funcionarioResponse.json();
      setFuncionario(funcionarioData);
      
      // Buscar histórico de remanejamentos
      const remanejamentosResponse = await fetch(
        `/api/funcionarios/${funcionarioId}/remanejamentos`
      );
      if (remanejamentosResponse.ok) {
        const remanejamentosData = await remanejamentosResponse.json();
        setRemanejamentos(remanejamentosData.remanejamentos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar funcionário:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      showToast("Erro ao carregar dados do funcionário", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString("pt-BR");
  };

  const formatarDataHora = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ATIVO":
        return "bg-green-100 text-green-800 border-green-200";
      case "INATIVO":
        return "bg-red-100 text-red-800 border-red-200";
      case "PENDENTE":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "SEM_CADASTRO":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "APROVADO":
        return "bg-green-100 text-green-800 border-green-200";
      case "REJEITADO":
        return "bg-red-100 text-red-800 border-red-200";
      case "EM_ANALISE":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CRIADO":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case "ATIVO":
      case "APROVADO":
        return <CheckCircleIcon className="h-4 w-4" />;
      case "INATIVO":
      case "REJEITADO":
        return <XCircleIcon className="h-4 w-4" />;
      case "PENDENTE":
      case "EM_ANALISE":
      case "CRIADO":
        return <ClockIcon className="h-4 w-4" />;
      case "SEM_CADASTRO":
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      default:
        return <DocumentTextIcon className="h-4 w-4" />;
    }
  };

  const getTipoSolicitacaoLabel = (tipo: string) => {
    switch (tipo?.toUpperCase()) {
      case "ALOCACAO":
        return "Alocação";
      case "REALOCACAO":
        return "Realocação";
      case "DESLIGAMENTO":
        return "Desligamento";
      default:
        return tipo || "Não informado";
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

  if (error || !funcionario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erro ao carregar funcionário
          </h2>
          <p className="text-gray-600 mb-4">
            {error || "Funcionário não encontrado"}
          </p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho com botão de voltar */}
        <div className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 mb-6">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Detalhes do Funcionário
            </h1>
            {funcionario && (
              <span className="ml-3 text-sm text-gray-600 font-medium">
                #{funcionario.id} • {funcionario.nome}
              </span>
            )}
          </div>
          <div className="mt-3 sm:mt-0">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
            >
              <ArrowLeftIcon className="-ml-1 mr-2 h-4 w-4" />
              Voltar
            </button>
          </div>
        </div>

        {/* Layout principal em duas colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna da esquerda - Informações detalhadas */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Informações pessoais */}
              <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 bg-gray-800 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-white flex items-center">
                    <UserIcon className="h-4 w-4 mr-2" />
                    Informações
                  </h3>
                </div>
                <div className="p-6">
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Nome
                      </dt>
                      <dd className="text-gray-700">
                        {funcionario.nome || "Não informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Sispat
                      </dt>
                      <dd className="text-gray-700">
                        {funcionario.sispat || "Não informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Matrícula
                      </dt>
                      <dd className="text-gray-700">
                        {funcionario.matricula || "Não informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Função
                      </dt>
                      <dd className="text-gray-700">
                        {funcionario.funcao || "Não informado"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Contrato Atual
                      </dt>
                      <dd className="text-gray-700">
                        {funcionario.contrato?.nome || "Sem contrato"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Status Folha
                      </dt>
                      <dd className="text-gray-700">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300`}
                        >
                          {funcionario.status || "Não informado"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Status Prestserv
                      </dt>
                      <dd className="text-gray-700">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300`}
                        >
                          {funcionario.statusPrestserv || "Não informado"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Em migração
                      </dt>
                      <dd>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300`}
                        >
                          {funcionario.emMigracao ? "Sim" : "Não"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Criado em
                      </dt>
                      <dd className="text-gray-700">
                        {formatarDataHora(funcionario.criadoEm)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Última atualização
                      </dt>
                      <dd className="text-gray-700">
                        {formatarDataHora(funcionario.atualizadoEm)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna da direita - Tabela de remanejamentos */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 bg-gray-800 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white flex items-center">
                  <TableCellsIcon className="h-4 w-4 mr-2" />
                  Histórico de Remanejamentos
                  <span className="ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-700 text-gray-200">
                    {remanejamentos.length}{" "}
                    {remanejamentos.length === 1 ? "registro" : "registros"}
                  </span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                {remanejamentos.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                          ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                          Solic.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Origem
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Destino
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {remanejamentos.map((remanejamento, index) => (
                        <tr
                          key={remanejamento.idRemanejamento}
                          className={`hover:bg-gray-50 transition-colors duration-150 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-25"
                          }`}
                        >
                          <td className="px-4 py-4 text-xs font-semibold text-gray-900">
                            {remanejamento.idRemanejamento}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700">
                            {remanejamento.idSolicitacao}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700">
                            {remanejamento.contratoOrigem ? (
                              <div>
                                <div className="font-semibold text-gray-900 truncate max-w-[150px]">
                                  {remanejamento.contratoOrigem.nome}
                                </div>
                                <div className="text-gray-500 text-xs truncate max-w-[150px] mt-0.5">
                                  {remanejamento.contratoOrigem.numero} •{" "}
                                  {remanejamento.contratoOrigem.cliente}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                Não informado
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700">
                            {remanejamento.contratoDestino ? (
                              <div>
                                <div className="font-semibold text-gray-900 truncate max-w-[150px]">
                                  {remanejamento.contratoDestino.nome}
                                </div>
                                <div className="text-gray-500 text-xs truncate max-w-[150px] mt-0.5">
                                  {remanejamento.contratoDestino.numero} •{" "}
                                  {remanejamento.contratoDestino.cliente}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                Não informado
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">
                              {getTipoSolicitacaoLabel(
                                remanejamento.tipoSolicitacao
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                remanejamento.statusPrestserv
                              )}`}
                            >
                              {getStatusIcon(remanejamento.statusPrestserv)}
                              <span className="ml-1.5">
                                {remanejamento.statusPrestserv}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-700">
                            {formatarDataHora(remanejamento.dataCriacao)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <TableCellsIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-3 text-sm font-semibold text-gray-900">
                      Nenhum remanejamento encontrado
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">
                      Este funcionário ainda não possui histórico de
                      remanejamentos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
