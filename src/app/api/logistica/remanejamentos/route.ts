import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NovasolicitacaoRemanejamento } from "@/types/remanejamento-funcionario";

// Tipos de status de tarefas que são considerados em processo
type StatusTarefasEmProcesso = "REPROVAR TAREFAS" | "ATENDER TAREFAS";

// Interfaces para tipagem adequada
// Tipos que correspondem exatamente ao que o Prisma retorna
type PrismaUptimeSheet = {
  id: number;
  matricula: string;
  dataAdmissao: Date | null;
  dataDemissao: Date | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  totalDias: number | null;
  totalDiasPeriodo: number | null;
  nome: string | null;
  funcao: string | null;
  status: string | null;
  embarcacao: string | null;
  observacoes: string | null;
  sispat: string | null;
  departamento: string | null;
  centroCusto: string | null;
  createdAt: Date;
  periodoFinal: Date | null;
  periodoInicial: Date | null;
};

type PrismaFuncionario = {
  id: number;
  nome: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  status: string | null;
  emMigracao: boolean;
  statusPrestserv: string | null;
  sispat: string | null;
  uptimeSheets: PrismaUptimeSheet[];
};

type PrismaTarefaRemanejamento = {
  id: string;
  remanejamentoFuncionarioId: string;
  tarefaPadraoId: number | null;
  treinamentoId: number | null;
  tipo: string;
  descricao: string | null;
  responsavel: string;
  status: string;
  prioridade: string;
  dataCriacao: Date;
  dataLimite: Date | null;
  dataVencimento: Date | null;
  dataConclusao: Date | null;
  observacoes: string | null;
};

type PrismaRemanejamentoFuncionario = {
  id: string;
  solicitacaoId: number;
  funcionarioId: number;
  statusTarefas: string;
  statusPrestserv: string;
  statusFuncionario: string;
  dataRascunhoCriado: Date | null;
  dataSubmetido: Date | null;
  dataResposta: Date | null;
  dataAprovado: Date | null;
  dataConcluido: Date | null;
  dataCancelado: Date | null;
  observacoesPrestserv: string | null;
  createdAt: Date;
  updatedAt: Date;
  aprovadoPorId: number | null;
  concluidoPorId: number | null;
  canceladoPorId: number | null;
  funcionario: PrismaFuncionario;
  tarefas: PrismaTarefaRemanejamento[];
};

type PrismaContrato = {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  dataInicio: Date;
  dataFim: Date;
  status: string;
  createdAt: Date;
};

type PrismaSolicitacaoRemanejamento = {
  id: number;
  tipo: string;
  contratoOrigemId: number | null;
  contratoDestinoId: number | null;
  justificativa: string | null;
  status: string;
  prioridade: string;
  solicitadoPorId: number | null;
  analisadoPor: string | null;
  aprovadoPorId: number | null;
  dataSolicitacao: Date;
  dataAnalise: Date | null;
  dataAprovacao: Date | null;
  dataConclusao: Date | null;
  concluidoPorId: number | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
  atualizadoPorId: number | null;
  contratoOrigem: PrismaContrato | null;
  contratoDestino: PrismaContrato | null;
  funcionarios: PrismaRemanejamentoFuncionario[];
};

// Interfaces antigas mantidas para compatibilidade (podem ser removidas gradualmente)
interface FuncionarioSelect {
  id: number;
  nome: string;
  matricula: string;
  funcao: string | null;
  centroCusto: string | null;
  status: string | null;
  emMigracao: boolean;
  statusPrestserv: string | null;
  sispat: string | null;
  uptimeSheets: UptimeSheetData[];
}

interface UptimeSheetData {
  id: number;
  matricula: string;
  dataAdmissao: Date | null;
  dataDemissao: Date | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  totalDias: number | null;
  totalDiasPeriodo: number | null;
  nome: string | null;
  funcao: string | null;
  status: string | null;
  embarcacao: string | null;
  observacoes: string | null;
  sispat: string | null;
  departamento: string | null;
  centroCusto: string | null;
  createdAt: Date;
  periodoFinal: Date | null;
  periodoInicial: Date | null;
}

interface RemanejamentoFuncionarioWithFuncionario {
  id: string;
  solicitacaoId: number;
  funcionarioId: number;
  statusTarefas: string;
  statusPrestserv: string;
  statusFuncionario: string;
  dataRascunhoCriado: Date | null;
  dataSubmetido: Date | null;
  dataResposta: Date | null;
  dataAprovado: Date | null;
  dataConcluido: Date | null;
  dataCancelado: Date | null;
  observacoesPrestserv: string | null;
  createdAt: Date;
  updatedAt: Date;
  aprovadoPorId: number | null;
  concluidoPorId: number | null;
  canceladoPorId: number | null;
  funcionario: FuncionarioSelect;
  tarefas: TarefaRemanejamento[];
}

interface TarefaRemanejamento {
  id: string;
  remanejamentoFuncionarioId: string;
  tarefaPadraoId: number | null;
  treinamentoId: number | null;
  tipo: string;
  descricao: string | null;
  responsavel: string;
  status: string;
  prioridade: string;
  dataCriacao: Date;
  dataLimite: Date | null;
  dataVencimento: Date | null;
  dataConclusao: Date | null;
  observacoes: string | null;
}

interface ContratoInfo {
  id: number;
  numero: string;
  nome: string;
  cliente: string;
  dataInicio: Date;
  dataFim: Date;
  status: string;
  createdAt: Date;
}

interface SolicitacaoRemanejamentoComplete {
  id: number;
  tipo: string;
  contratoOrigemId: number | null;
  contratoDestinoId: number | null;
  justificativa: string | null;
  status: string;
  prioridade: string;
  solicitadoPorId: number | null;
  analisadoPor: string | null;
  aprovadoPorId: number | null;
  dataSolicitacao: Date;
  dataAnalise: Date | null;
  dataAprovacao: Date | null;
  dataConclusao: Date | null;
  concluidoPorId: number | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
  atualizadoPorId: number | null;
  contratoOrigem: ContratoInfo | null;
  contratoDestino: ContratoInfo | null;
  funcionarios: RemanejamentoFuncionarioWithFuncionario[];
}

interface ResultadoPaginado {
  solicitacoes: PrismaSolicitacaoRemanejamento[];
  totalSolicitacoes: number;
  totalPaginas: number;
  paginaAtual: number;
  itensPorPagina: number;
}

// Função auxiliar para filtrar solicitações para processo de criação de tarefas
function filtrarSolicitacoesParaProcesso(
  solicitacoes: SolicitacaoRemanejamentoComplete[]
): SolicitacaoRemanejamentoComplete[] {
  const statusEmProcesso: StatusTarefasEmProcesso[] = [
    "REPROVAR TAREFAS",
    "ATENDER TAREFAS",
  ];

  return solicitacoes.filter((s: SolicitacaoRemanejamentoComplete) =>
    s.funcionarios.some(
      (f: RemanejamentoFuncionarioWithFuncionario) =>
        f.funcionario &&
        f.funcionario.emMigracao === true &&
        statusEmProcesso.includes(f.statusTarefas as StatusTarefasEmProcesso)
    )
  );
}

// Interface para os parâmetros de busca de remanejamentos
interface ParametrosBuscaRemanejamento {
  status?: string;
  statusTarefas?: string | string[];
  statusPrestserv?: string;
  funcionarioId?: string;
  filtrarProcesso: boolean;
  page?: number;
  limit?: number;
  nome?: string;
  contratoOrigem?: string | string[];
  contratoDestino?: string | string[];
  tipoSolicitacao?: string | string[];
  solicitacaoId?: string | string[];
  responsavel?: string | string[];
}

// Função auxiliar para buscar remanejamentos com filtros
async function buscarRemanejamentos(
  params: ParametrosBuscaRemanejamento
): Promise<PrismaSolicitacaoRemanejamento[] | ResultadoPaginado> {
  const {
    status,
    statusTarefas,
    statusPrestserv,
    funcionarioId,
    filtrarProcesso,
    page,
    limit,
    nome,
    contratoOrigem,
    contratoDestino,
    tipoSolicitacao,
    solicitacaoId,
    responsavel,
  } = params;

  interface SolicitacaoWhereClause {
    status?: string;
    tipo?: string | { in: string[] };
    id?: number | { in: number[] };
    contratoOrigem?: {
      numero?: string | { in: string[] } | { equals: string };
    };
    contratoDestino?: {
      numero?: string | { in: string[] } | { equals: string };
    };
  }

  const where: SolicitacaoWhereClause = {};
  if (status) {
    where.status = status;
  }

  // Adicionar filtros para solicitação
  if (tipoSolicitacao) {
    where.tipo = Array.isArray(tipoSolicitacao)
      ? { in: tipoSolicitacao }
      : tipoSolicitacao;
  }

  if (solicitacaoId) {
    where.id = Array.isArray(solicitacaoId)
      ? {
          in: Array.isArray(solicitacaoId)
            ? solicitacaoId.map((id) => parseInt(id))
            : [parseInt(solicitacaoId)],
        }
      : parseInt(solicitacaoId);
  }

  // Filtros para contratos
  if (contratoOrigem) {
    where.contratoOrigem = {
      numero: Array.isArray(contratoOrigem)
        ? { in: contratoOrigem }
        : { equals: contratoOrigem },
    };
  }

  if (contratoDestino) {
    where.contratoDestino = {
      numero: Array.isArray(contratoDestino)
        ? { in: contratoDestino }
        : { equals: contratoDestino },
    };
  }

  interface RemanejamentoFuncionarioWhereClause {
    statusTarefas?: string | { in: string[] };
    statusPrestserv?: string;
    funcionarioId?: number;
  }

  const funcionariosWhere: RemanejamentoFuncionarioWhereClause = {
    ...(statusTarefas && {
      statusTarefas: Array.isArray(statusTarefas)
        ? { in: statusTarefas }
        : statusTarefas,
    }),
    ...(statusPrestserv && { statusPrestserv: statusPrestserv }),
  };

  if (funcionarioId) {
    funcionariosWhere.funcionarioId = parseInt(funcionarioId);
  }

  // Filtro por nome de funcionário
  interface FuncionarioWhereClause {
    nome?: {
      contains: string;
    };
  }

  const funcionarioWhere: FuncionarioWhereClause = {};
  if (nome) {
    funcionarioWhere.nome = {
      contains: nome,
    };
  }

  // Filtro por responsável nas tarefas
  interface TarefasWhereClause {
    responsavel?: string | { in: string[] };
  }

  const tarefasWhere: TarefasWhereClause = {};
  if (responsavel) {
    tarefasWhere.responsavel = Array.isArray(responsavel)
      ? { in: responsavel }
      : responsavel;
  }

  // Buscar todos os remanejamentos que atendem aos critérios, sem filtrar por funcionário único
  const funcionariosComRemanejamentos =
    await prisma.remanejamentoFuncionario.findMany({
      where: {
        funcionario: {
          // Só aplicar filtro de emMigracao se estiver filtrando para processo
          ...(filtrarProcesso ? { emMigracao: true } : {}),
          // Adicionar filtro por nome se fornecido
          ...funcionarioWhere,
        },
        ...funcionariosWhere,
        // Adicionar filtro por tarefas se responsável for fornecido
        ...(Object.keys(tarefasWhere).length > 0
          ? {
              tarefas: {
                some: tarefasWhere,
              },
            }
          : {}),
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            status: true,
            statusPrestserv: true,
            emMigracao: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  // Obter todos os IDs dos remanejamentos, sem filtrar por funcionário único
  const remanejamentoIds = funcionariosComRemanejamentos.map((rem) => rem.id);

  // Buscar as solicitações com todos os remanejamentos encontrados
  const solicitacoes = await prisma.solicitacaoRemanejamento.findMany({
    where,
    include: {
      contratoOrigem: true,
      contratoDestino: true,
      funcionarios: {
        where: {
          id: {
            in: remanejamentoIds,
          },
          ...funcionariosWhere,
        },
        include: {
          funcionario: {
            select: {
              id: true,
              nome: true,
              matricula: true,
              funcao: true,
              centroCusto: true,
              status: true,
              emMigracao: true,
              statusPrestserv: true,
              sispat: true,
              uptimeSheets: true,
            },
          },
          tarefas: true,
        },
      },
    },
    orderBy: {
      id: "desc",
    },
  });

  // Badge: função alterada recentemente (últimos 30 dias) para RFs em processo
  try {
    const rfIds: string[] = [];
    solicitacoes.forEach((s: any) => s.funcionarios?.forEach((rf: any) => rfIds.push(rf.id)));
    if (rfIds.length > 0) {
      const limite = new Date();
      limite.setDate(limite.getDate() - 30);
      const historicos = await prisma.historicoRemanejamento.findMany({
        where: {
          remanejamentoFuncionarioId: { in: rfIds },
          entidade: "FUNCIONARIO",
          campoAlterado: "funcao",
          dataAcao: { gte: limite },
        },
        select: { remanejamentoFuncionarioId: true, dataAcao: true },
        orderBy: { dataAcao: "desc" },
      });
      const map = new Map<string, string>();
      historicos.forEach((h) => {
        if (!map.has(h.remanejamentoFuncionarioId!)) {
          map.set(h.remanejamentoFuncionarioId!, h.dataAcao.toISOString());
        }
      });
      solicitacoes.forEach((s: any) =>
        s.funcionarios?.forEach((rf: any) => {
          const dt = map.get(rf.id);
          if (dt) {
            (rf as any).funcaoAlteradaRecentemente = true;
            (rf as any).dataMudancaFuncao = dt;
          }
        })
      );
    }
  } catch (e) {
    console.warn("Falha ao calcular badge de função alterada recentemente:", e);
  }

  // Filtrar solicitações que não têm funcionários (após a filtragem)
  let solicitacoesFiltradas: SolicitacaoRemanejamentoComplete[] = (
    solicitacoes.filter((s) => s.funcionarios.length > 0) as unknown as SolicitacaoRemanejamentoComplete[]
  );

  // Aplicar filtro adicional ANTES da paginação se estiver filtrando para processo
  if (params.filtrarProcesso) {
    solicitacoesFiltradas = filtrarSolicitacoesParaProcesso(
      solicitacoesFiltradas
    );
  }

  // Aplicar paginação se page e limit forem fornecidos
  if (page && limit) {
    // Paginação por solicitações, não por funcionários
    const totalSolicitacoes = solicitacoesFiltradas.length;
    const totalPaginas = Math.ceil(totalSolicitacoes / limit);
    const skip = (page - 1) * limit;
    const solicitacoesPaginadas = solicitacoesFiltradas.slice(
      skip,
      skip + limit
    );

    return {
      solicitacoes: solicitacoesPaginadas,
      totalSolicitacoes: totalSolicitacoes,
      totalPaginas: totalPaginas,
      paginaAtual: page,
      itensPorPagina: limit,
    } as ResultadoPaginado;
  }

  return solicitacoesFiltradas as SolicitacaoRemanejamentoComplete[];
}

// GET - Listar todas as solicitações de remanejamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusTarefasParams = searchParams.getAll("statusTarefas");
    const statusTarefas =
      statusTarefasParams.length > 0
        ? statusTarefasParams
        : searchParams.get("statusTarefas");
    const statusPrestserv = searchParams.get("statusPrestserv");
    const funcionarioId = searchParams.get("funcionarioId");
    const filtrarProcesso = searchParams.get("filtrarProcesso") === "true";

    // Parâmetros de paginação
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!)
      : undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;

    // Novos parâmetros de filtro
    const nome = searchParams.get("nome");
    const contratoOrigemParams = searchParams.getAll("contratoOrigem");
    const contratoOrigem =
      contratoOrigemParams.length > 0 ? contratoOrigemParams : undefined;
    const contratoDestinoParams = searchParams.getAll("contratoDestino");
    const contratoDestino =
      contratoDestinoParams.length > 0 ? contratoDestinoParams : undefined;
    const tipoSolicitacaoParams = searchParams.getAll("tipoSolicitacao");
    const tipoSolicitacao =
      tipoSolicitacaoParams.length > 0 ? tipoSolicitacaoParams : undefined;
    const solicitacaoIdParams = searchParams.getAll("solicitacaoId");
    const solicitacaoId =
      solicitacaoIdParams.length > 0 ? solicitacaoIdParams : undefined;
    const responsavelParams = searchParams.getAll("responsavel");
    const responsavel =
      responsavelParams.length > 0 ? responsavelParams : undefined;

    // Buscar solicitações de remanejamento com os filtros aplicados
    const resultado = await buscarRemanejamentos({
      status: status || undefined,
      statusTarefas: statusTarefas || undefined,
      statusPrestserv: statusPrestserv || undefined,
      funcionarioId: funcionarioId || undefined,
      filtrarProcesso,
      page,
      limit,
      nome: nome || undefined,
      contratoOrigem,
      contratoDestino,
      tipoSolicitacao,
      solicitacaoId,
      responsavel,
    });

    // Se o resultado tem paginação, é um objeto com metadados
    if (typeof resultado === "object" && "solicitacoes" in resultado) {
      return NextResponse.json({
        solicitacoes: resultado.solicitacoes,
        totalSolicitacoes: resultado.totalSolicitacoes,
        totalPaginas: resultado.totalPaginas,
        paginaAtual: resultado.paginaAtual,
        itensPorPagina: resultado.itensPorPagina,
      });
    }

    // Se não há paginação, resultado é array direto
    const solicitacoesComFuncionarios =
      resultado as SolicitacaoRemanejamentoComplete[];

    // Retornar todas as solicitações com funcionários (filtros já aplicados na função buscarRemanejamentos)
    return NextResponse.json(solicitacoesComFuncionarios);
  } catch (error) {
    console.error("Erro ao buscar funcionários de remanejamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST - Criar nova solicitação de remanejamento
export async function POST(request: NextRequest) {
  try {
    const body: NovasolicitacaoRemanejamento = await request.json();
    const { getUserFromRequest } = await import('@/utils/authUtils');
    const usuarioAutenticado = await getUserFromRequest(request);
    const usuarioId = usuarioAutenticado?.id ?? null;
    const usuarioNome =
      usuarioAutenticado?.funcionario?.nome || usuarioAutenticado?.funcionario?.matricula || 'Sistema';

    const {
      tipo = "REMANEJAMENTO",
      funcionarioIds,
      contratoOrigemId,
      contratoDestinoId,
      justificativa,
      prioridade = "Normal",
    } = body;

    // Validações básicas
    if (!funcionarioIds || funcionarioIds.length === 0) {
      return NextResponse.json(
        { error: "Pelo menos um funcionário deve ser selecionado" },
        { status: 400 }
      );
    }

    // solicitadoPor agora é preenchido via usuário autenticado (id)

    // Validações específicas por tipo
    if (tipo === "DESLIGAMENTO") {
      // Para desligamento, não precisa de contrato destino
      if (contratoDestinoId) {
        return NextResponse.json(
          { error: "Desligamento não deve ter contrato de destino" },
          { status: 400 }
        );
      }
    } else {
      // Para alocação e remanejamento, contrato destino é obrigatório
      if (!contratoDestinoId) {
        return NextResponse.json(
          {
            error:
              "Contrato de destino é obrigatório para alocação e remanejamento",
          },
          { status: 400 }
        );
      }
    }

    // Verificar se os funcionários existem
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        id: {
          in: funcionarioIds,
        },
      },
    });

    if (funcionarios.length !== funcionarioIds.length) {
      return NextResponse.json(
        { error: "Um ou mais funcionários não foram encontrados" },
        { status: 400 }
      );
    }

    // Criar a solicitação de remanejamento
    const solicitacao = await prisma.solicitacaoRemanejamento.create({
      data: {
        tipo,
        contratoOrigemId: contratoOrigemId ?? null,
        contratoDestinoId: contratoDestinoId ?? null,
        justificativa,
        prioridade,
        solicitadoPorId: usuarioId ?? null,
        funcionarios: {
          create: funcionarioIds.map((funcionarioId) => ({
            funcionarioId,
            statusTarefas: "APROVAR SOLICITAÇÃO",
            statusPrestserv: "PENDENTE",
          })),
        },
      },
      include: {
        contratoOrigem: true,
        contratoDestino: true,
        funcionarios: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
                funcao: true,
                centroCusto: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Marcar funcionários como em migração
    await prisma.funcionario.updateMany({
      where: {
        id: {
          in: funcionarioIds,
        },
      },
      data: {
        emMigracao: true,
      },
    });

    // Registrar no histórico para cada funcionário
    try {
      const solicitacaoRel = solicitacao as any;
      await Promise.all(
        (solicitacaoRel.funcionarios as any[]).map(async (funcionarioRem: any) => {
          await prisma.historicoRemanejamento.create({
            data: {
              solicitacaoId: solicitacaoRel.id,
              remanejamentoFuncionarioId: funcionarioRem.id,
              tipoAcao: "CRIACAO",
              entidade: "SOLICITACAO",
              descricaoAcao: `Solicitação de ${tipo.toLowerCase()} criada para ${
                funcionarioRem.funcionario.nome
              } (${funcionarioRem.funcionario.matricula})`,
              usuarioResponsavel: usuarioNome,
              usuarioResponsavelId: usuarioId ?? undefined,
              observacoes: `Contrato origem: ${
                solicitacaoRel.contratoOrigem?.nome || "N/A"
              } → Contrato destino: ${
                solicitacaoRel.contratoDestino?.nome || "N/A"
              }. Justificativa: ${justificativa}`,
            },
          });
        })
      );
    } catch (historicoError) {
      console.error("Erro ao registrar histórico:", historicoError);
      // Não falha a criação da solicitação se o histórico falhar
    }

    return NextResponse.json(solicitacao, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar remanejamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id") || "";

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetro id é obrigatório" },
        { status: 400 }
      );
    }

    // Tentar encontrar por id direto (UUID/texto)
    let remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: { id },
        include: {
          funcionario: {
            select: { id: true, nome: true, matricula: true },
          },
          solicitacao: true,
        },
      });

    // Se não encontrou, tentar interpretar o parâmetro como id do funcionário (número)
    if (!remanejamentoFuncionario) {
      const funcionarioIdInt = parseInt(id);
      if (!isNaN(funcionarioIdInt)) {
        const candidato = await prisma.remanejamentoFuncionario.findFirst({
          where: { funcionarioId: funcionarioIdInt },
          include: {
            funcionario: { select: { id: true, nome: true, matricula: true } },
            solicitacao: true,
          },
          orderBy: { createdAt: "desc" },
        });
        if (candidato) {
          remanejamentoFuncionario = candidato;
          id = candidato.id; // usar o id real do remanejamentoFuncionario
        }
      }
    }

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Remanejamento do funcionário não encontrado" },
        { status: 404 }
      );
    }

    // Coletar tarefas relacionadas
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: { remanejamentoFuncionarioId: id },
      select: { id: true },
    });
    const tarefaIds = tarefas.map((t) => t.id);

    // Excluir observações das tarefas, depois tarefas e por fim o remanejamento do funcionário
    await prisma.$transaction([
      prisma.observacaoTarefaRemanejamento.deleteMany({
        where: { tarefaId: { in: tarefaIds } },
      }),
      prisma.tarefaRemanejamento.deleteMany({
        where: { remanejamentoFuncionarioId: id },
      }),
      prisma.remanejamentoFuncionario.delete({ where: { id } }),
    ]);

    // Após exclusão, se não houver mais remanejamentos para o funcionário, redefinir emMigracao
    const funcionarioId = remanejamentoFuncionario.funcionario.id;
    const existeOutroRemanejamento =
      await prisma.remanejamentoFuncionario.findFirst({
        where: { funcionarioId },
      });
    if (!existeOutroRemanejamento) {
      await prisma.funcionario.update({
        where: { id: funcionarioId },
        data: { emMigracao: false },
      });
    }

    // Registrar no histórico (sem referência ao remanejamento já excluído)
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: null,
          tipoAcao: "EXCLUSAO",
          entidade: "REMANEJAMENTO_FUNCIONARIO",
          descricaoAcao: `Remanejamento de ${remanejamentoFuncionario.funcionario.nome} (${remanejamentoFuncionario.funcionario.matricula}) excluído`,
          usuarioResponsavel: "Sistema",
        },
      });
    } catch (logErr) {
      console.error(
        "Falha ao registrar histórico de exclusão de remanejamento:",
        logErr
      );
    }

    return NextResponse.json(
      { message: "Remanejamento excluído com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao excluir remanejamento (rota base):", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
