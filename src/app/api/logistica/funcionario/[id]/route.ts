import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AtualizarStatusPrestserv } from "@/types/remanejamento-funcionario";

const normalizarTexto = (valor: unknown) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const normalizarNumeroContrato = (valor: unknown) =>
  String(valor || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");

const ehNr26OuNr33 = (tipo: unknown) => {
  const v = normalizarTexto(tipo).replace(/[^A-Z0-9]/g, "");
  return v.includes("NR26") || v.includes("NR33");
};

const ehNr26 = (tipo: unknown) =>
  normalizarTexto(tipo)
    .replace(/[^A-Z0-9]/g, "")
    .includes("NR26");

const ehNr33 = (tipo: unknown) =>
  normalizarTexto(tipo)
    .replace(/[^A-Z0-9]/g, "")
    .includes("NR33");

const tarefaConcluida = (status: string | null | undefined) =>
  status === "CONCLUIDO" || status === "CONCLUIDA";

const ehCasoEspecialSantos51Para10 = ({
  tipoSolicitacao,
  contratoOrigemNumero,
  contratoDestinoNumero,
  contratoFuncionarioNumero,
}: {
  tipoSolicitacao: unknown;
  contratoOrigemNumero: unknown;
  contratoDestinoNumero: unknown;
  contratoFuncionarioNumero: unknown;
}) =>
  normalizarTexto(tipoSolicitacao).replace(/[^A-Z0-9]/g, "") ===
    "VINCULOADICIONAL" &&
  (normalizarNumeroContrato(contratoOrigemNumero) === "4600679351" ||
    normalizarNumeroContrato(contratoFuncionarioNumero) === "4600679351") &&
  normalizarNumeroContrato(contratoDestinoNumero) === "4600684010";

// GET - Buscar detalhes de um funcionário em remanejamento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: id,
        },
        include: {
          funcionario: {
            select: {
              id: true,
              nome: true,
              matricula: true,
              funcao: true,
              centroCusto: true,
              email: true,
              telefone: true,
              sispat: true,
            },
          },
          solicitacao: {
            include: {
              contratoOrigem: {
                select: {
                  id: true,
                  numero: true,
                  nome: true,
                  cliente: true,
                },
              },
              contratoDestino: {
                select: {
                  id: true,
                  numero: true,
                  nome: true,
                  cliente: true,
                },
              },
            },
          },
          tarefas: {
            orderBy: {
              dataCriacao: "asc",
            },
          },
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(remanejamentoFuncionario);
  } catch (error) {
    console.error("Erro ao buscar funcionário:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

async function aplicarVinculosAoValidar(params: {
  funcionarioId: number;
  solicitacao?: {
    tipo?: string | null;
    contratoOrigemId?: number | null;
    contratoDestinoId?: number | null;
    observacoes?: string | null;
  } | null;
  sispat?: string;
}) {
  const { funcionarioId, solicitacao, sispat } = params;
  const tipo = solicitacao?.tipo || null;
  const contratoOrigemId = solicitacao?.contratoOrigemId ?? null;
  const contratoDestinoId = solicitacao?.contratoDestinoId ?? null;
  const observacoesSolicitacao = solicitacao?.observacoes ?? null;
  const prismaAny = prisma as any;
  const possuiDelegateVinculoFindMany =
    !!prismaAny.funcionarioContratoVinculo &&
    typeof prismaAny.funcionarioContratoVinculo.findMany === "function";
  const possuiDelegateVinculoCreate =
    possuiDelegateVinculoFindMany &&
    typeof prismaAny.funcionarioContratoVinculo.create === "function";
  const possuiDelegateVinculoDelete =
    possuiDelegateVinculoFindMany &&
    typeof prismaAny.funcionarioContratoVinculo.delete === "function";
  const possuiDelegateVinculoDeleteMany =
    possuiDelegateVinculoFindMany &&
    typeof prismaAny.funcionarioContratoVinculo.deleteMany === "function";
  const possuiDelegateVinculoCount =
    possuiDelegateVinculoFindMany &&
    typeof prismaAny.funcionarioContratoVinculo.count === "function";
  const buscarVinculosRaw = async () => {
    try {
      const vinculosRaw = (await prisma.$queryRawUnsafe(
        `SELECT "id", "contratoId" FROM "FuncionarioContratoVinculo" WHERE "funcionarioId" = $1 AND "ativo" = true ORDER BY "createdAt" ASC`,
        funcionarioId,
      )) as Array<{ id: number; contratoId: number }>;
      return vinculosRaw;
    } catch {
      return [] as Array<{ id: number; contratoId: number }>;
    }
  };
  const criarVinculoRaw = async (contratoId: number) => {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "FuncionarioContratoVinculo" ("funcionarioId", "contratoId", "tipoVinculo", "ativo", "dataInicio", "createdAt", "updatedAt")
         VALUES ($1, $2, 'ADICIONAL', true, NOW(), NOW(), NOW())
         ON CONFLICT ("funcionarioId", "contratoId")
         DO UPDATE SET "ativo" = true, "tipoVinculo" = 'ADICIONAL', "updatedAt" = NOW()`,
        funcionarioId,
        contratoId,
      );
      return true;
    } catch {
      return false;
    }
  };
  const deletarVinculoRawPorId = async (id: number) => {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "FuncionarioContratoVinculo" WHERE "id" = $1`,
        id,
      );
      return true;
    } catch {
      return false;
    }
  };
  const deletarVinculosRawPorContrato = async (contratoId: number) => {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "FuncionarioContratoVinculo" WHERE "funcionarioId" = $1 AND "contratoId" = $2`,
        funcionarioId,
        contratoId,
      );
      return true;
    } catch {
      return false;
    }
  };
  const deletarTodosVinculosRaw = async () => {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "FuncionarioContratoVinculo" WHERE "funcionarioId" = $1`,
        funcionarioId,
      );
      return true;
    } catch {
      return false;
    }
  };
  const contarVinculosRaw = async () => {
    try {
      const resultado = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "FuncionarioContratoVinculo" WHERE "funcionarioId" = $1 AND "ativo" = true`,
        funcionarioId,
      )) as Array<{ count: number }>;
      return resultado[0]?.count || 0;
    } catch {
      return 0;
    }
  };

  let funcionarioAtual: {
    contratoId: number | null;
    contratosVinculo: Array<{ id: number; contratoId: number }>;
  } | null = null;

  try {
    const funcionarioComVinculos = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: {
        contratoId: true,
        contratosVinculo: {
          where: { ativo: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, contratoId: true },
        },
      },
    });
    funcionarioAtual = funcionarioComVinculos as typeof funcionarioAtual;
  } catch (erroConsultaVinculos) {
    console.error(
      "Falha ao consultar vínculos do funcionário. Aplicando fallback:",
      erroConsultaVinculos,
    );
    const funcionarioSemVinculos = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: {
        contratoId: true,
      },
    });
    if (!funcionarioSemVinculos) {
      funcionarioAtual = null;
    } else {
      const vinculosRaw = await buscarVinculosRaw();
      funcionarioAtual = {
        contratoId: funcionarioSemVinculos.contratoId,
        contratosVinculo: vinculosRaw,
      };
    }
  }

  if (!funcionarioAtual) {
    return;
  }

  const contratosDesvinculoIds = (() => {
    if (!observacoesSolicitacao) {
      return [] as number[];
    }
    const prefixo = "DESVINCULO_CONTRATOS:";
    if (!observacoesSolicitacao.startsWith(prefixo)) {
      return [] as number[];
    }
    return observacoesSolicitacao
      .slice(prefixo.length)
      .split(",")
      .map((valor) => Number(valor.trim()))
      .filter((valor) => Number.isInteger(valor) && valor > 0);
  })();
  const contratosDesvinculoPorFuncionario = (() => {
    if (!observacoesSolicitacao) {
      return {} as Record<number, number[]>;
    }
    const prefixo = "DESVINCULO_MAP:";
    if (!observacoesSolicitacao.startsWith(prefixo)) {
      return {} as Record<number, number[]>;
    }
    try {
      const parsed = JSON.parse(observacoesSolicitacao.slice(prefixo.length));
      if (!parsed || typeof parsed !== "object") {
        return {} as Record<number, number[]>;
      }
      return Object.entries(parsed as Record<string, unknown>).reduce(
        (acc, [funcionarioIdStr, contratoIds]) => {
          const funcionarioIdMapa = Number(funcionarioIdStr);
          if (!Number.isInteger(funcionarioIdMapa) || funcionarioIdMapa <= 0) {
            return acc;
          }
          const idsNormalizados = Array.from(
            new Set(
              (Array.isArray(contratoIds) ? contratoIds : [])
                .map((valor) => Number(valor))
                .filter((valor) => Number.isInteger(valor) && valor > 0),
            ),
          );
          if (idsNormalizados.length > 0) {
            acc[funcionarioIdMapa] = idsNormalizados;
          }
          return acc;
        },
        {} as Record<number, number[]>,
      );
    } catch {
      return {} as Record<number, number[]>;
    }
  })();

  if (tipo === "VINCULO_ADICIONAL") {
    if (
      contratoDestinoId &&
      funcionarioAtual.contratoId !== contratoDestinoId &&
      !funcionarioAtual.contratosVinculo.some(
        (vinculo) => vinculo.contratoId === contratoDestinoId,
      )
    ) {
      if (possuiDelegateVinculoCreate) {
        await prisma.funcionarioContratoVinculo.create({
          data: {
            funcionarioId,
            contratoId: contratoDestinoId,
            tipoVinculo: "ADICIONAL",
            ativo: true,
          },
        });
      } else {
        const vinculoCriado = await criarVinculoRaw(contratoDestinoId);
        if (!vinculoCriado) {
          throw new Error(
            `Não foi possível criar vínculo adicional para funcionário ${funcionarioId} no contrato ${contratoDestinoId}`,
          );
        }
      }
    }

    await prisma.funcionario.update({
      where: { id: funcionarioId },
      data: {
        statusPrestserv: "ATIVO",
        emMigracao: false,
        ...(sispat ? { sispat } : {}),
      },
    });
    return;
  }

  if (tipo === "DESLIGAMENTO") {
    if (possuiDelegateVinculoDeleteMany) {
      await prisma.funcionarioContratoVinculo.deleteMany({
        where: {
          funcionarioId,
        },
      });
    } else {
      await deletarTodosVinculosRaw();
    }
    await prisma.funcionario.update({
      where: { id: funcionarioId },
      data: {
        contratoId: null,
        statusPrestserv: "INATIVO",
        emMigracao: false,
        ...(sispat ? { sispat } : {}),
      },
    });
    return;
  }

  if (tipo === "DESVINCULO_ADICIONAL") {
    const contratoIdsPorFuncionario =
      contratosDesvinculoPorFuncionario[funcionarioId] || [];
    const contratoIdsAlvo =
      contratoIdsPorFuncionario.length > 0
        ? contratoIdsPorFuncionario
        : contratosDesvinculoIds.length > 0
          ? contratosDesvinculoIds
          : contratoDestinoId
            ? [contratoDestinoId]
            : [];

    if (contratoIdsAlvo.length > 0) {
      if (possuiDelegateVinculoDeleteMany) {
        await prisma.funcionarioContratoVinculo.deleteMany({
          where: {
            funcionarioId,
            contratoId: {
              in: contratoIdsAlvo,
            },
          },
        });
      } else {
        await Promise.all(
          contratoIdsAlvo.map((contratoId) =>
            deletarVinculosRawPorContrato(contratoId),
          ),
        );
      }
    }

    const adicionaisAtivos = possuiDelegateVinculoCount
      ? await prisma.funcionarioContratoVinculo.count({
          where: { funcionarioId, ativo: true },
        })
      : await contarVinculosRaw();
    const possuiAlgumVinculo =
      funcionarioAtual.contratoId !== null || adicionaisAtivos > 0;

    await prisma.funcionario.update({
      where: { id: funcionarioId },
      data: {
        statusPrestserv: possuiAlgumVinculo ? "ATIVO" : "INATIVO",
        emMigracao: false,
        ...(sispat ? { sispat } : {}),
      },
    });
    return;
  }

  const data: Record<string, unknown> = {
    statusPrestserv: "ATIVO",
    emMigracao: false,
  };

  if (contratoDestinoId) {
    data.contratoId = contratoDestinoId;
  }
  if (sispat) {
    data.sispat = sispat;
  }

  await prisma.funcionario.update({
    where: { id: funcionarioId },
    data,
  });
}

// PUT - Atualizar status do Prestserv
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);
    const usuarioId = usuarioAutenticado?.id ?? null;
    if (usuarioId === null) {
      console.warn(
        "Auth: usuário não identificado no PUT de Prestserv; campos de responsável serão deixados nulos",
      );
    }
    const { id } = await params;
    const body: AtualizarStatusPrestserv = await request.json();

    const {
      statusPrestserv,
      dataRascunhoCriado,
      dataSubmetido,
      dataResposta,
      observacoesPrestserv,
      sispat,
    } = body;

    const rawInputPrestservValue = (body as any)?.statusPrestserv;
    const inputIdNumericPut =
      typeof rawInputPrestservValue === "number"
        ? rawInputPrestservValue
        : (() => {
            const s = String(rawInputPrestservValue ?? "").trim();
            const n = Number(s);
            return !Number.isNaN(n) && s !== "" ? n : null;
          })();
    const entradaIdSufixoPut =
      inputIdNumericPut !== null ? ` [entrada: ID ${inputIdNumericPut}]` : "";

    const coerceStatusPrestserv = (input: unknown): string | undefined => {
      if (input === undefined || input === null) return undefined;
      if (typeof input === "number") {
        if (input === 6 || input === 12) return "EM VALIDAÇÃO";
        if (input === 11) return "PENDENTE DE DESLIGAMENTO";
        return String(input);
      }
      const raw = String(input).trim();
      const n = Number(raw);
      if (!Number.isNaN(n) && raw !== "") return coerceStatusPrestserv(n);
      return raw;
    };
    const spUpper = coerceStatusPrestserv(statusPrestserv)?.toUpperCase();
    const isValidado =
      spUpper === "VALIDADO" || spUpper === "VALIDAO" || spUpper === "VALIDADA";
    const isCancelado = spUpper === "CANCELADO";
    const isInvalidado =
      spUpper === "INVALIDADO" ||
      spUpper === "INVALIDAO" ||
      spUpper === "INVALIDADA";
    const statusPrestservCanonical = isValidado
      ? "VALIDADO"
      : isInvalidado
        ? "INVALIDADO"
        : isCancelado
          ? "CANCELADO"
          : spUpper;

    // Validações
    if (!statusPrestserv) {
      return NextResponse.json(
        { error: "Status do Prestserv é obrigatório" },
        { status: 400 },
      );
    }

    // Buscar o funcionário em remanejamento
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: id,
        },
        include: {
          tarefas: true,
          solicitacao: {
            select: {
              tipo: true,
              contratoOrigem: {
                select: {
                  numero: true,
                },
              },
              contratoDestino: {
                select: {
                  numero: true,
                },
              },
            },
          },
          funcionario: {
            select: {
              id: true,
              nome: true,
              matricula: true,
              contrato: {
                select: {
                  numero: true,
                },
              },
            },
          },
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 },
      );
    }

    const casoEspecialSantos51Para10 = ehCasoEspecialSantos51Para10({
      tipoSolicitacao: remanejamentoFuncionario.solicitacao?.tipo,
      contratoOrigemNumero:
        remanejamentoFuncionario.solicitacao?.contratoOrigem?.numero,
      contratoDestinoNumero:
        remanejamentoFuncionario.solicitacao?.contratoDestino?.numero,
      contratoFuncionarioNumero:
        remanejamentoFuncionario.funcionario?.contrato?.numero,
    });

    // Validação: só pode submeter se todas as tarefas estiverem concluídas, desconsiderando canceladas
    if (statusPrestserv === "EM VALIDAÇÃO") {
      if (casoEspecialSantos51Para10) {
        const tarefasAtivas = remanejamentoFuncionario.tarefas.filter(
          (tarefa) => tarefa.status !== "CANCELADO",
        );
        const possuiNr26Concluida = tarefasAtivas.some(
          (tarefa) => ehNr26(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        const possuiNr33Concluida = tarefasAtivas.some(
          (tarefa) => ehNr33(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        if (!possuiNr26Concluida || !possuiNr33Concluida) {
          return NextResponse.json(
            {
              error:
                "No caso especial 51→10, só é possível submeter quando NR26 e NR33 estiverem concluídas.",
            },
            { status: 400 },
          );
        }
      } else {
        const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
          (tarefa) =>
            tarefa.status !== "CONCLUIDO" &&
            tarefa.status !== "CONCLUIDA" &&
            tarefa.status !== "CANCELADO",
        );

        if (tarefasPendentes.length > 0) {
          return NextResponse.json(
            {
              error:
                "Não é possível submeter. Ainda existem tarefas pendentes.",
              tarefasPendentes: tarefasPendentes.length,
            },
            { status: 400 },
          );
        }
      }
    }

    // Validação: para validar (exceto DESLIGAMENTO), deve haver tarefas ativas em todos os setores (RH, Med, Trein)
    if (statusPrestservCanonical === "VALIDADO") {
      const tipoSolicitacao = remanejamentoFuncionario.solicitacao?.tipo;

      if (tipoSolicitacao !== "DESLIGAMENTO" && !casoEspecialSantos51Para10) {
        const setoresObrigatorios = ["RH", "MEDICINA", "TREINAMENTO"];
        const setoresFaltantes: string[] = [];

        const detectSetorLocal = (resp: string) => {
          const r = resp.toUpperCase();
          if (r.includes("RH") || r.includes("RECURSOS HUMANOS")) return "RH";
          if (r.includes("MED") || r.includes("SAUDE") || r.includes("SAÚDE"))
            return "MEDICINA";
          if (r.includes("TREIN") || r.includes("CAPACIT"))
            return "TREINAMENTO";
          return "OUTROS";
        };

        const tarefasAtivas = remanejamentoFuncionario.tarefas.filter(
          (t) => t.status !== "CANCELADO",
        );

        for (const setor of setoresObrigatorios) {
          const temTarefa = tarefasAtivas.some(
            (t) => detectSetorLocal(t.responsavel) === setor,
          );
          if (!temTarefa) {
            setoresFaltantes.push(setor);
          }
        }

        if (setoresFaltantes.length > 0) {
          return NextResponse.json(
            {
              error: `Não é possível validar. Não existem tarefas ativas para os setores: ${setoresFaltantes.join(", ")}.`,
              details:
                "Para Alocação e Remanejamento, é obrigatório ter tarefas (não canceladas) em RH, Medicina e Treinamento.",
            },
            { status: 400 },
          );
        }
      }
      if (tipoSolicitacao !== "DESLIGAMENTO" && casoEspecialSantos51Para10) {
        const tarefasAtivas = remanejamentoFuncionario.tarefas.filter(
          (tarefa) =>
            tarefa.status !== "CANCELADO" && ehNr26OuNr33(tarefa.tipo),
        );
        const possuiNr26Concluida = tarefasAtivas.some(
          (tarefa) => ehNr26(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        const possuiNr33Concluida = tarefasAtivas.some(
          (tarefa) => ehNr33(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        if (!possuiNr26Concluida || !possuiNr33Concluida) {
          return NextResponse.json(
            {
              error:
                "No caso especial 51→10, só é possível validar quando NR26 e NR33 estiverem concluídas.",
            },
            { status: 400 },
          );
        }
      }
    }

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {
      statusPrestserv: statusPrestservCanonical,
      observacoesPrestserv,
    };

    // Se cancelar o Prestserv, marcar status geral das tarefas como CANCELADO
    if (isCancelado) {
      updateData.statusTarefas = "CANCELADO";
    }

    // Adicionar datas automaticamente conforme o status
    if (
      statusPrestserv === "CRIADO" &&
      !remanejamentoFuncionario.dataRascunhoCriado
    ) {
      updateData.dataRascunhoCriado = new Date();
    } else if (statusPrestserv === "EM VALIDAÇÃO") {
      // Para EM VALIDAÇÃO, sempre atualizar a data (permite resubmissão)
      updateData.dataSubmetido = new Date();
    } else if (isValidado || isInvalidado) {
      updateData.dataResposta = new Date();
    }

    // Concluído/cancelado: marcar responsável e data
    if (isValidado) {
      updateData.dataConcluido = new Date();
      if (usuarioId !== null) {
        (updateData as any).concluidoPorId = usuarioId;
      }
    }
    if (isCancelado) {
      updateData.dataCancelado = new Date();
      if (usuarioId !== null) {
        (updateData as any).canceladoPorId = usuarioId;
      }
    }

    // Preservar datas existentes se não estão sendo atualizadas
    if (
      !updateData.dataRascunhoCriado &&
      remanejamentoFuncionario.dataRascunhoCriado
    ) {
      updateData.dataRascunhoCriado =
        remanejamentoFuncionario.dataRascunhoCriado;
    }
    if (
      !updateData.dataSubmetido &&
      remanejamentoFuncionario.dataSubmetido &&
      statusPrestserv !== "EM VALIDAÇÃO"
    ) {
      updateData.dataSubmetido = remanejamentoFuncionario.dataSubmetido;
    }
    if (
      !updateData.dataResposta &&
      remanejamentoFuncionario.dataResposta &&
      !isValidado &&
      !isInvalidado
    ) {
      updateData.dataResposta = remanejamentoFuncionario.dataResposta;
    }

    // Permitir override manual das datas se fornecidas
    if (dataRascunhoCriado) {
      updateData.dataRascunhoCriado = new Date(dataRascunhoCriado);
    }
    if (dataSubmetido) {
      updateData.dataSubmetido = new Date(dataSubmetido);
    }
    if (dataResposta) {
      updateData.dataResposta = new Date(dataResposta);
    }

    // Buscar dados atuais antes da atualização para o histórico
    const statusAnterior = remanejamentoFuncionario.statusPrestserv;

    // Atualizar o registro
    const funcionarioAtualizado = await prisma.remanejamentoFuncionario.update({
      where: {
        id: id,
      },
      data: updateData,
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
            centroCusto: true,
            sispat: true,
          },
        },
        solicitacao: {
          include: {
            contratoOrigem: true,
            contratoDestino: true,
          },
        },
        tarefas: true,
      },
    });

    if (statusPrestservCanonical === "VALIDADO") {
      try {
        const tarefasConcluidas = await prisma.tarefaRemanejamento.findMany({
          where: {
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            status: "CONCLUIDO",
            responsavel: { in: ["RH", "MEDICINA", "TREINAMENTO"] },
          },
          select: {
            tarefaPadraoId: true,
            treinamentoId: true,
            tipo: true,
            descricao: true,
            responsavel: true,
            dataConclusao: true,
            dataVencimento: true,
          },
        });

        for (const t of tarefasConcluidas) {
          const funcionarioId = funcionarioAtualizado.funcionarioId;
          const baseWhere: any = { funcionarioId };
          if (t.treinamentoId) {
            baseWhere.treinamentoId = t.treinamentoId;
          } else if (t.tarefaPadraoId) {
            baseWhere.tarefaPadraoId = t.tarefaPadraoId;
          } else {
            baseWhere.tipo = t.tipo;
            baseWhere.responsavel = t.responsavel;
          }

          const existente = await prisma.funcionarioCapacitacao.findFirst({
            where: baseWhere,
          });

          const novaConclusao = t.dataConclusao ?? new Date();
          const novaValidade = t.dataVencimento ?? null;
          const novaDescricao = t.descricao ?? null;

          if (!existente) {
            await prisma.funcionarioCapacitacao.create({
              data: {
                funcionarioId,
                tarefaPadraoId: t.tarefaPadraoId ?? null,
                treinamentoId: t.treinamentoId ?? null,
                tipo: t.tipo,
                responsavel: t.responsavel,
                descricao: novaDescricao,
                dataConclusao: novaConclusao,
                dataVencimento: novaValidade,
                origemRemanejamentoId: funcionarioAtualizado.id,
              },
            });
          } else {
            const deveAtualizarConclusao =
              !existente.dataConclusao ||
              existente.dataConclusao < novaConclusao;
            const deveAtualizarValidade =
              (existente.dataVencimento == null && novaValidade != null) ||
              (existente.dataVencimento != null &&
                novaValidade != null &&
                existente.dataVencimento < novaValidade);
            const deveAtualizarDescricao =
              (existente.descricao == null && novaDescricao != null) ||
              (novaDescricao != null && existente.descricao !== novaDescricao);

            if (
              deveAtualizarConclusao ||
              deveAtualizarValidade ||
              deveAtualizarDescricao
            ) {
              await prisma.funcionarioCapacitacao.update({
                where: { id: existente.id },
                data: {
                  ...(deveAtualizarConclusao
                    ? { dataConclusao: novaConclusao }
                    : {}),
                  ...(deveAtualizarValidade
                    ? { dataVencimento: novaValidade }
                    : {}),
                  ...(deveAtualizarDescricao
                    ? { descricao: novaDescricao }
                    : {}),
                  origemRemanejamentoId: funcionarioAtualizado.id,
                },
              });
            }
          }
        }
      } catch (capError) {
        console.error(
          "Erro ao salvar/atualizar capacitações do funcionário:",
          capError,
        );
      }
    }

    // Registrar no histórico se o status mudou
    if (statusAnterior !== statusPrestserv) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao: `Status do Prestserv alterado de ${statusAnterior} para ${statusPrestserv} para ${funcionarioAtualizado.funcionario.nome} (${funcionarioAtualizado.funcionario.matricula})${entradaIdSufixoPut}`,
            campoAlterado: "statusPrestserv",
            valorAnterior: statusAnterior,
            valorNovo: statusPrestserv,
            usuarioResponsavel: "Sistema", // Pode ser melhorado para capturar o usuário real
            observacoes: observacoesPrestserv || undefined,
          },
        });
      } catch (historicoError) {
        console.error("Erro ao registrar histórico:", historicoError);
        // Não falha a atualização se o histórico falhar
      }
    }

    if (isValidado) {
      await aplicarVinculosAoValidar({
        funcionarioId: funcionarioAtualizado.funcionarioId,
        solicitacao: {
          tipo: funcionarioAtualizado.solicitacao?.tipo,
          contratoOrigemId:
            funcionarioAtualizado.solicitacao?.contratoOrigemId ?? null,
          contratoDestinoId:
            funcionarioAtualizado.solicitacao?.contratoDestinoId ?? null,
          observacoes: funcionarioAtualizado.solicitacao?.observacoes ?? null,
        },
        sispat,
      });
    }

    // Se o Prestserv foi invalidado ou cancelado, desmarcar como em migração
    if (isInvalidado || isCancelado) {
      await prisma.funcionario.update({
        where: { id: funcionarioAtualizado.funcionarioId },
        data: { emMigracao: false }, // Desmarca migração para permitir nova tentativa
      });

      console.log(
        `Funcionário ${funcionarioAtualizado.funcionarioId} desmarcado como em migração após ${statusPrestserv}`,
      );
    }

    // Cancelar todas as tarefas associadas quando Prestserv é CANCELADO
    if (isCancelado) {
      await prisma.tarefaRemanejamento.updateMany({
        where: { remanejamentoFuncionarioId: id },
        data: { status: "CANCELADO" },
      });
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao:
              "Todas as tarefas foram canceladas devido ao cancelamento do Prestserv.",
            usuarioResponsavel: "Sistema",
            campoAlterado: "status",
            valorNovo: "CANCELADO",
          },
        });
      } catch (historicoError) {
        console.error(
          "Erro ao registrar histórico de cancelamento das tarefas:",
          historicoError,
        );
      }
    }

    // Se o Prestserv foi validado e todas as tarefas estão concluídas, verificar se a solicitação pode ser concluída
    if (
      statusPrestserv === "VALIDADO" &&
      funcionarioAtualizado.statusTarefas === "CONCLUIDO"
    ) {
      await verificarConclusaoSolicitacao(
        funcionarioAtualizado.solicitacaoId,
        usuarioAutenticado?.id ?? undefined,
      );
    }

    return NextResponse.json(funcionarioAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar status do Prestserv:", error);

    // Log mais detalhado do erro
    if (error instanceof Error) {
      console.error("Detalhes do erro:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

// PATCH - Atualizar apenas o status do Prestserv (método simplificado)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { getUserFromRequest } = await import("@/utils/authUtils");
    const usuarioAutenticado = await getUserFromRequest(request);
    const usuarioId = usuarioAutenticado?.id ?? null;
    const { id } = await params;
    const body = await request.json();
    const {
      statusPrestserv,
      statusFuncionario,
      statusTarefas,
      emMigracao,
      contratoId,
      sispat,
      observacoesPrestserv,
    } = body;

    const rawInputPrestservPatch = statusPrestserv;
    const inputIdNumericPatch =
      typeof rawInputPrestservPatch === "number"
        ? rawInputPrestservPatch
        : (() => {
            const s = String(rawInputPrestservPatch ?? "").trim();
            const n = Number(s);
            return !Number.isNaN(n) && s !== "" ? n : null;
          })();
    const entradaIdSufixoPatch =
      inputIdNumericPatch !== null
        ? ` [entrada: ID ${inputIdNumericPatch}]`
        : "";

    const coerceStatusPrestservPatch = (input: unknown): string | undefined => {
      if (input === undefined || input === null) return undefined;
      if (typeof input === "number") {
        if (input === 6 || input === 12) return "EM VALIDAÇÃO";
        if (input === 11) return "PENDENTE DE DESLIGAMENTO";
        return String(input);
      }
      const raw = String(input).trim();
      const n = Number(raw);
      if (!Number.isNaN(n) && raw !== "") return coerceStatusPrestservPatch(n);
      return raw;
    };
    const spUpper = coerceStatusPrestservPatch(statusPrestserv)?.toUpperCase();
    const isValidado =
      spUpper === "VALIDADO" || spUpper === "VALIDAO" || spUpper === "VALIDADA";
    const isCancelado = spUpper === "CANCELADO";
    const isInvalidado =
      spUpper === "INVALIDADO" ||
      spUpper === "INVALIDAO" ||
      spUpper === "INVALIDADA";
    const statusPrestservCanonical = isValidado
      ? "VALIDADO"
      : isInvalidado
        ? "INVALIDADO"
        : isCancelado
          ? "CANCELADO"
          : spUpper;

    // Permitir atualizar statusTarefas, statusPrestserv, statusFuncionario, emMigracao, contratoId ou sispat
    if (
      !statusPrestserv &&
      !statusFuncionario &&
      !statusTarefas &&
      emMigracao === undefined &&
      contratoId === undefined &&
      !sispat &&
      !observacoesPrestserv
    ) {
      return NextResponse.json(
        {
          error:
            "Informe status do Prestserv, status do Funcionário, status das Tarefas, emMigracao, contratoId ou sispat",
        },
        { status: 400 },
      );
    }

    // Buscar o funcionário em remanejamento
    const remanejamentoFuncionario =
      await prisma.remanejamentoFuncionario.findUnique({
        where: {
          id: id,
        },
        include: {
          tarefas: true,
          solicitacao: {
            select: {
              tipo: true,
              contratoOrigem: {
                select: {
                  numero: true,
                },
              },
              contratoDestino: {
                select: {
                  numero: true,
                },
              },
            },
          },
          funcionario: {
            select: {
              contrato: {
                select: {
                  numero: true,
                },
              },
            },
          },
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 },
      );
    }

    const casoEspecialSantos51Para10 = ehCasoEspecialSantos51Para10({
      tipoSolicitacao: remanejamentoFuncionario.solicitacao?.tipo,
      contratoOrigemNumero:
        remanejamentoFuncionario.solicitacao?.contratoOrigem?.numero,
      contratoDestinoNumero:
        remanejamentoFuncionario.solicitacao?.contratoDestino?.numero,
      contratoFuncionarioNumero:
        remanejamentoFuncionario.funcionario?.contrato?.numero,
    });

    // Validação: só pode submeter se todas as tarefas estiverem concluídas, desconsiderando canceladas
    if (statusPrestserv === "EM VALIDAÇÃO") {
      if (casoEspecialSantos51Para10) {
        const tarefasAtivas = remanejamentoFuncionario.tarefas.filter(
          (tarefa) => tarefa.status !== "CANCELADO",
        );
        const possuiNr26Concluida = tarefasAtivas.some(
          (tarefa) => ehNr26(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        const possuiNr33Concluida = tarefasAtivas.some(
          (tarefa) => ehNr33(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        if (!possuiNr26Concluida || !possuiNr33Concluida) {
          return NextResponse.json(
            {
              error:
                "No caso especial 51→10, só é possível submeter quando NR26 e NR33 estiverem concluídas.",
            },
            { status: 400 },
          );
        }
      } else {
        const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
          (tarefa) =>
            tarefa.status !== "CONCLUIDO" &&
            tarefa.status !== "CONCLUIDA" &&
            tarefa.status !== "CANCELADO",
        );
        if (tarefasPendentes.length > 0) {
          return NextResponse.json(
            {
              error:
                "Não é possível submeter. Ainda existem tarefas pendentes.",
              tarefasPendentes: tarefasPendentes.length,
            },
            { status: 400 },
          );
        }
      }
    }

    // Validação: para validar (exceto DESLIGAMENTO), deve haver tarefas ativas em todos os setores (RH, Med, Trein)
    if (statusPrestservCanonical === "VALIDADO") {
      const tipoSolicitacao = remanejamentoFuncionario.solicitacao?.tipo;

      if (tipoSolicitacao !== "DESLIGAMENTO" && !casoEspecialSantos51Para10) {
        const setoresObrigatorios = ["RH", "MEDICINA", "TREINAMENTO"];
        const setoresFaltantes: string[] = [];

        const detectSetorLocal = (resp: string) => {
          const r = resp.toUpperCase();
          if (r.includes("RH") || r.includes("RECURSOS HUMANOS")) return "RH";
          if (r.includes("MED") || r.includes("SAUDE") || r.includes("SAÚDE"))
            return "MEDICINA";
          if (r.includes("TREIN") || r.includes("CAPACIT"))
            return "TREINAMENTO";
          return "OUTROS";
        };

        const tarefasAtivas = remanejamentoFuncionario.tarefas.filter(
          (t) => t.status !== "CANCELADO",
        );

        for (const setor of setoresObrigatorios) {
          const temTarefa = tarefasAtivas.some(
            (t) => detectSetorLocal(t.responsavel) === setor,
          );
          if (!temTarefa) {
            setoresFaltantes.push(setor);
          }
        }

        if (setoresFaltantes.length > 0) {
          return NextResponse.json(
            {
              error: `Não é possível validar. Não existem tarefas ativas para os setores: ${setoresFaltantes.join(", ")}.`,
              details:
                "Para Alocação e Remanejamento, é obrigatório ter tarefas (não canceladas) em RH, Medicina e Treinamento.",
            },
            { status: 400 },
          );
        }
      }
      if (tipoSolicitacao !== "DESLIGAMENTO" && casoEspecialSantos51Para10) {
        const tarefasAtivas = remanejamentoFuncionario.tarefas.filter(
          (tarefa) =>
            tarefa.status !== "CANCELADO" && ehNr26OuNr33(tarefa.tipo),
        );
        const possuiNr26Concluida = tarefasAtivas.some(
          (tarefa) => ehNr26(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        const possuiNr33Concluida = tarefasAtivas.some(
          (tarefa) => ehNr33(tarefa.tipo) && tarefaConcluida(tarefa.status),
        );
        if (!possuiNr26Concluida || !possuiNr33Concluida) {
          return NextResponse.json(
            {
              error:
                "No caso especial 51→10, só é possível validar quando NR26 e NR33 estiverem concluídas.",
            },
            { status: 400 },
          );
        }
      }
    }

    // Validação: não permitir ATENDER TAREFAS se statusFuncionario for ATIVO
    if (statusPrestserv === "ATENDER TAREFAS") {
      // Buscar statusFuncionario atual ou novo
      const statusAtualFuncionario =
        statusFuncionario || remanejamentoFuncionario.statusFuncionario;
      if (statusAtualFuncionario === "ATIVO") {
        return NextResponse.json(
          {
            error:
              "Não é possível atender tarefas enquanto o funcionário não foi desligado da logística.",
          },
          { status: 400 },
        );
      }
    }

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {};
    if (statusPrestserv) updateData.statusPrestserv = statusPrestservCanonical;
    if (statusFuncionario) updateData.statusFuncionario = statusFuncionario;
    if (statusTarefas) updateData.statusTarefas = statusTarefas;
    if (observacoesPrestserv)
      updateData.observacoesPrestserv = observacoesPrestserv;

    // Adicionar datas automaticamente conforme o statusPrestserv
    if (statusPrestserv) {
      if (
        statusPrestserv === "CRIADO" &&
        !remanejamentoFuncionario.dataRascunhoCriado
      ) {
        updateData.dataRascunhoCriado = new Date();
      } else if (statusPrestserv === "EM VALIDAÇÃO") {
        updateData.dataSubmetido = new Date();
      } else if (isValidado || isInvalidado) {
        updateData.dataResposta = new Date();
      }
      if (
        !updateData.dataRascunhoCriado &&
        remanejamentoFuncionario.dataRascunhoCriado
      ) {
        updateData.dataRascunhoCriado =
          remanejamentoFuncionario.dataRascunhoCriado;
      }
      if (
        !updateData.dataSubmetido &&
        remanejamentoFuncionario.dataSubmetido &&
        statusPrestserv !== "EM VALIDAÇÃO"
      ) {
        updateData.dataSubmetido = remanejamentoFuncionario.dataSubmetido;
      }
      if (
        !updateData.dataResposta &&
        remanejamentoFuncionario.dataResposta &&
        !isValidado &&
        !isInvalidado
      ) {
        updateData.dataResposta = remanejamentoFuncionario.dataResposta;
      }
    }

    if (isValidado) {
      updateData.dataConcluido = new Date();
      if (usuarioId !== null) {
        (updateData as any).concluidoPorId = usuarioId;
      }
    }
    if (isCancelado) {
      updateData.dataCancelado = new Date();
      if (usuarioId !== null) {
        (updateData as any).canceladoPorId = usuarioId;
      }
    }

    // Atualizar o registro
    const funcionarioAtualizado = await prisma.remanejamentoFuncionario.update({
      where: {
        id: id,
      },
      data: updateData,
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
        solicitacao: {
          select: {
            id: true,
            tipo: true,
            contratoOrigemId: true,
            contratoDestinoId: true,
            observacoes: true,
          },
        },
      },
    });

    try {
      const usuarioNome = usuarioAutenticado?.funcionario?.nome || "Sistema";
      const usuarioIdNum = usuarioAutenticado?.id;
      const equipeIdNum = (usuarioAutenticado as any)?.equipeId;
      const prevPrestserv = remanejamentoFuncionario.statusPrestserv;
      const newPrestserv = funcionarioAtualizado.statusPrestserv;
      const prevTarefas = remanejamentoFuncionario.statusTarefas;
      const newTarefas = funcionarioAtualizado.statusTarefas;
      const prevFunc = remanejamentoFuncionario.statusFuncionario;
      const newFunc = funcionarioAtualizado.statusFuncionario;

      if (typeof newPrestserv === "string" && newPrestserv !== prevPrestserv) {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao: `Status do Prestserv alterado de ${prevPrestserv} para ${newPrestserv} para ${funcionarioAtualizado.funcionario.nome} (${funcionarioAtualizado.funcionario.matricula})${entradaIdSufixoPatch}`,
            campoAlterado: "statusPrestserv",
            valorAnterior: prevPrestserv,
            valorNovo: newPrestserv,
            usuarioResponsavel: usuarioNome,
            usuarioResponsavelId: usuarioIdNum ?? undefined,
            equipeId: equipeIdNum ?? undefined,
            observacoes: (updateData as any)?.observacoesPrestserv || undefined,
          },
        });
      }

      if (typeof newTarefas === "string" && newTarefas !== prevTarefas) {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao: `Status geral das tarefas atualizado para: ${newTarefas}`,
            campoAlterado: "statusTarefas",
            valorAnterior: prevTarefas || null,
            valorNovo: newTarefas,
            usuarioResponsavel: usuarioNome,
            usuarioResponsavelId: usuarioIdNum ?? undefined,
            equipeId: equipeIdNum ?? undefined,
          },
        });
      }

      if (typeof newFunc === "string" && newFunc !== prevFunc) {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao: `Status do Funcionário alterado de ${prevFunc} para ${newFunc} para ${funcionarioAtualizado.funcionario.nome} (${funcionarioAtualizado.funcionario.matricula})`,
            campoAlterado: "statusFuncionario",
            valorAnterior: prevFunc || null,
            valorNovo: newFunc,
            usuarioResponsavel: usuarioNome,
            usuarioResponsavelId: usuarioIdNum ?? undefined,
            equipeId: equipeIdNum ?? undefined,
          },
        });
      }
    } catch (histPatchErr) {
      console.error(
        "Erro ao registrar histórico (PATCH status):",
        histPatchErr,
      );
    }

    // Se statusFuncionario, emMigracao ou contratoId foram fornecidos, atualizar também na tabela funcionario
    if (
      statusFuncionario ||
      emMigracao !== undefined ||
      contratoId !== undefined
    ) {
      const funcionarioUpdateData: Record<string, unknown> = {};
      if (statusFuncionario) {
        funcionarioUpdateData.statusPrestserv = statusFuncionario;
      }
      if (emMigracao !== undefined) {
        funcionarioUpdateData.emMigracao = emMigracao;
      }
      if (contratoId !== undefined) {
        funcionarioUpdateData.contratoId = contratoId;
      }

      await prisma.funcionario.update({
        where: {
          id: funcionarioAtualizado.funcionarioId,
        },
        data: funcionarioUpdateData,
      });
    }

    if (statusPrestservCanonical === "VALIDADO") {
      await aplicarVinculosAoValidar({
        funcionarioId: funcionarioAtualizado.funcionarioId,
        solicitacao: {
          tipo: funcionarioAtualizado.solicitacao?.tipo,
          contratoOrigemId:
            funcionarioAtualizado.solicitacao?.contratoOrigemId ?? null,
          contratoDestinoId:
            funcionarioAtualizado.solicitacao?.contratoDestinoId ?? null,
          observacoes: funcionarioAtualizado.solicitacao?.observacoes ?? null,
        },
        sispat,
      });
    }

    // Para outros tipos de solicitação, desmarcar como em migração quando finalizado
    if (funcionarioAtualizado.solicitacao?.tipo !== "DESLIGAMENTO") {
      if (
        ["VALIDADO", "INVALIDADO", "CANCELADO"].includes(
          statusPrestservCanonical || "",
        )
      ) {
        await prisma.funcionario.update({
          where: { id: funcionarioAtualizado.funcionarioId },
          data: { emMigracao: false },
        });

        console.log(
          `Funcionário ${funcionarioAtualizado.funcionarioId} desmarcado como em migração após ${statusPrestservCanonical}`,
        );
      }
    }

    // Cancelar todas as tarefas associadas quando Prestserv é CANCELADO
    if (statusPrestservCanonical === "CANCELADO") {
      await prisma.tarefaRemanejamento.updateMany({
        where: { remanejamentoFuncionarioId: id },
        data: { status: "CANCELADO" },
      });
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "STATUS_TAREFAS",
            descricaoAcao:
              "Todas as tarefas foram canceladas devido ao cancelamento do Prestserv.",
            usuarioResponsavel: "Sistema",
            campoAlterado: "status",
            valorNovo: "CANCELADO",
          },
        });
      } catch (historicoError) {
        console.error(
          "Erro ao registrar histórico de cancelamento das tarefas:",
          historicoError,
        );
      }
    }

    if (isValidado && funcionarioAtualizado.statusTarefas === "CONCLUIDO") {
      await verificarConclusaoSolicitacao(
        funcionarioAtualizado.solicitacaoId,
        usuarioAutenticado?.id ?? undefined,
      );
    }

    return NextResponse.json({ success: true, funcionarioAtualizado });
  } catch (error) {
    console.error(
      "Erro ao atualizar status do funcionário ou prestserv:",
      error,
    );
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

// Função para verificar se toda a solicitação pode ser marcada como concluída
async function verificarConclusaoSolicitacao(
  solicitacaoId: number,
  usuarioId?: number,
) {
  try {
    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId,
      },
    });

    if (funcionarios.length === 0) {
      console.log(
        `Nenhum funcionário encontrado para a solicitação ${solicitacaoId}`,
      );
      return;
    }

    // Verificar se todos os funcionários estão VALIDADOS ou CANCELADOS
    const todosValidosOuCancelados = funcionarios.every(
      (f) =>
        f.statusPrestserv === "VALIDADO" || f.statusPrestserv === "CANCELADO",
    );

    // Verificar se algum funcionário foi iniciado (não está mais como PENDENTE)
    const algumIniciado = funcionarios.some(
      (f) => f.statusPrestserv !== "PENDENTE",
    );

    let novoStatus = "Pendente";

    if (todosValidosOuCancelados) {
      novoStatus = "Concluído";
      console.log(
        `Todos os funcionários da solicitação ${solicitacaoId} estão validados ou cancelados. Marcando como Concluído.`,
      );
    } else if (algumIniciado) {
      novoStatus = "Em Andamento";
      console.log(
        `Alguns funcionários da solicitação ${solicitacaoId} estão em processamento. Marcando como Em Andamento.`,
      );
    } else {
      console.log(
        `Todos os funcionários da solicitação ${solicitacaoId} estão pendentes. Mantendo status como Pendente.`,
      );
    }

    // Atualizar o status da solicitação
    await prisma.solicitacaoRemanejamento.update({
      where: {
        id: solicitacaoId,
      },
      data: {
        status: novoStatus,
        // Sempre atualizar a data de atualização para indicar progresso
        updatedAt: new Date(),
        ...(usuarioId
          ? { atualizadoPorUsuario: { connect: { id: usuarioId } } }
          : {}),
        // Se concluído, atualizar a data de conclusão
        ...(novoStatus === "Concluído"
          ? {
              dataConclusao: new Date(),
              ...(usuarioId
                ? { concluidoPorUsuario: { connect: { id: usuarioId } } }
                : {}),
            }
          : {}),
      },
    });

    console.log(
      `Solicitação de remanejamento ${solicitacaoId} atualizada para status: ${novoStatus}`,
    );
  } catch (error) {
    console.error("Erro ao verificar conclusão da solicitação:", error);
  }
}
