import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET - Listar funcionários baseado no tipo de solicitação
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    const contratoId = searchParams.get("contratoId");
    const search = searchParams.get("search")?.trim();
    const contratoIdNumber = contratoId ? parseInt(contratoId, 10) : null;

    // Se não há parâmetro de tipo, retorna funcionários em remanejamento (comportamento antigo)
    if (!tipo) {
      const funcionarios = await prisma.remanejamentoFuncionario.findMany({
        where: {
          statusPrestserv: {
            in: ["CRIADO", "PENDENTE", "EM_ANALISE", "REJEITADO"],
          },
        },
        include: {
          funcionario: {
            select: {
              id: true,
              nome: true,
              matricula: true,
              funcao: true,
              centroCusto: true,
              funcaoRef: {
                select: {
                  regime: true,
                },
              },
            },
          },
          solicitacao: {
            select: {
              id: true,
              contratoOrigem: {
                select: {
                  nome: true,
                  cliente: true,
                },
              },
              contratoDestino: {
                select: {
                  nome: true,
                  cliente: true,
                },
              },
            },
          },
        },
        orderBy: {
          funcionario: {
            nome: "asc",
          },
        },
      });

      const funcionariosFormatados = funcionarios.map((rf) => ({
        id: rf.id,
        funcionarioId: rf.funcionario.id,
        nome: rf.funcionario.nome,
        matricula: rf.funcionario.matricula,
        funcao: rf.funcionario.funcao,
        regime: rf.funcionario.funcaoRef?.regime || null,
        centroCusto: rf.funcionario.centroCusto,
        statusTarefas: rf.statusTarefas,
        statusPrestserv: rf.statusPrestserv,
        contratoOrigem: rf.solicitacao.contratoOrigem?.nome,
        contratoDestino: rf.solicitacao.contratoDestino?.nome,
      }));

      return Response.json(funcionariosFormatados);
    }

    const whereClause: Prisma.FuncionarioWhereInput = {
      matricula: {
        not: "ADMIN001",
      },
    };
    const andConditions: Prisma.FuncionarioWhereInput[] = [];
    const permiteDemitido = tipo === "desligamento" || tipo === "desvinculo";
    const exigeContratoVinculado =
      tipo === "realocacao" ||
      tipo === "multialocacao" ||
      tipo === "desligamento" ||
      tipo === "desvinculo";

    if (tipo === "alocacao") {
      whereClause.statusPrestserv = "SEM_CADASTRO";
    } else if (tipo === "realocacao") {
      whereClause.statusPrestserv = {
        in: ["ATIVO", "INATIVO"],
      };
    } else if (tipo === "multialocacao") {
      whereClause.statusPrestserv = {
        in: ["ATIVO", "INATIVO"],
      };
    } else if (tipo === "desvinculo") {
      whereClause.statusPrestserv = {
        in: ["ATIVO", "INATIVO"],
      };
    } else if (tipo === "desligamento") {
      whereClause.statusPrestserv = "ATIVO";
    }

    if (search) {
      andConditions.push({
        OR: [
          {
            nome: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            matricula: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      });
    }

    if (!permiteDemitido) {
      andConditions.push({
        NOT: {
          status: {
            equals: "DEMITIDO",
            mode: "insensitive",
          },
        },
      });
    }

    if (contratoIdNumber && !Number.isNaN(contratoIdNumber)) {
      andConditions.push({
        OR: [
          { contratoId: contratoIdNumber },
          {
            contratosVinculo: {
              some: {
                contratoId: contratoIdNumber,
                ativo: true,
              },
            },
          },
        ],
      });
    }

    if (exigeContratoVinculado) {
      andConditions.push({
        OR: [
          {
            contratoId: {
              not: null,
            },
          },
          {
            contratosVinculo: {
              some: {
                ativo: true,
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    let funcionarios: Array<{
      id: number;
      nome: string;
      matricula: string;
      emMigracao: boolean;
      funcao: string | null;
      regime: string | null;
      centroCusto: string | null;
      status: string | null;
      statusPrestserv: string | null;
      funcaoRef?: {
        regime: string;
      } | null;
      contratoId: number | null;
      contrato: {
        id: number;
        numero: string;
        nome: string;
        cliente: string;
      } | null;
      contratosVinculo?: Array<{
        contratoId: number;
        tipoVinculo: string;
        ativo?: boolean;
        origemVinculo?: "ATIVO" | "HISTORICO";
        dataInicio?: Date | string | null;
        dataFim?: Date | string | null;
        contrato: {
          id: number;
          numero: string;
          nome: string;
          cliente: string;
        };
      }>;
    }> = [];

    try {
      funcionarios = await prisma.funcionario.findMany({
        where: whereClause,
        select: {
          id: true,
          nome: true,
          matricula: true,
          emMigracao: true,
          funcao: true,
          funcaoRef: {
            select: {
              regime: true,
            },
          },
          centroCusto: true,
          status: true,
          statusPrestserv: true,
          contratoId: true,
          contrato: {
            select: {
              id: true,
              numero: true,
              nome: true,
              cliente: true,
            },
          },
          contratosVinculo: {
            where: {
              ativo: true,
            },
            select: {
              contratoId: true,
              tipoVinculo: true,
              ativo: true,
              dataInicio: true,
              dataFim: true,
              contrato: {
                select: {
                  id: true,
                  numero: true,
                  nome: true,
                  cliente: true,
                },
              },
            },
          },
        },
        orderBy: {
          nome: "asc",
        },
      });
    } catch {
      const whereFallback: Prisma.FuncionarioWhereInput = {
        matricula: {
          not: "ADMIN001",
        },
      };

      if (tipo === "alocacao") {
        whereFallback.statusPrestserv = "SEM_CADASTRO";
      } else if (
        tipo === "realocacao" ||
        tipo === "multialocacao" ||
        tipo === "desvinculo"
      ) {
        whereFallback.statusPrestserv = {
          in: ["ATIVO", "INATIVO"],
        };
      } else if (tipo === "desligamento") {
        whereFallback.statusPrestserv = "ATIVO";
      }

      const andFallback: Prisma.FuncionarioWhereInput[] = [];

      if (search) {
        andFallback.push({
          OR: [
            {
              nome: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              matricula: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        });
      }

      if (!permiteDemitido) {
        andFallback.push({
          NOT: {
            status: {
              equals: "DEMITIDO",
              mode: "insensitive",
            },
          },
        });
      }

      if (contratoIdNumber && !Number.isNaN(contratoIdNumber)) {
        andFallback.push({
          contratoId: contratoIdNumber,
        });
      }

      if (exigeContratoVinculado) {
        andFallback.push({
          contratoId: {
            not: null,
          },
        });
      }

      if (andFallback.length > 0) {
        whereFallback.AND = andFallback;
      }

      const funcionariosBase = await prisma.funcionario.findMany({
        where: whereFallback,
        select: {
          id: true,
          nome: true,
          matricula: true,
          emMigracao: true,
          funcao: true,
          funcaoRef: {
            select: {
              regime: true,
            },
          },
          centroCusto: true,
          status: true,
          statusPrestserv: true,
          contratoId: true,
          contrato: {
            select: {
              id: true,
              numero: true,
              nome: true,
              cliente: true,
            },
          },
        },
        orderBy: {
          nome: "asc",
        },
      });

      const prismaAny = prisma as any;
      const possuiDelegateVinculo =
        !!prismaAny.funcionarioContratoVinculo &&
        typeof prismaAny.funcionarioContratoVinculo.findMany === "function";

      let vinculosPorFuncionario = new Map<
        number,
        Array<{
          contratoId: number;
          tipoVinculo: string;
          ativo?: boolean;
          origemVinculo?: "ATIVO" | "HISTORICO";
          dataInicio?: Date | string | null;
          dataFim?: Date | string | null;
          contrato: {
            id: number;
            numero: string;
            nome: string;
            cliente: string;
          };
        }>
      >();

      if (possuiDelegateVinculo && funcionariosBase.length > 0) {
        const vinculos = await prismaAny.funcionarioContratoVinculo.findMany({
          where: {
            ativo: true,
            funcionarioId: {
              in: funcionariosBase.map((funcionario) => funcionario.id),
            },
          },
          select: {
            funcionarioId: true,
            contratoId: true,
            tipoVinculo: true,
            ativo: true,
            dataInicio: true,
            dataFim: true,
            contrato: {
              select: {
                id: true,
                numero: true,
                nome: true,
                cliente: true,
              },
            },
          },
        });

        vinculosPorFuncionario = vinculos.reduce(
          (
            acc: Map<
              number,
              Array<{
                contratoId: number;
                tipoVinculo: string;
                ativo?: boolean;
                origemVinculo?: "ATIVO" | "HISTORICO";
                dataInicio?: Date | string | null;
                dataFim?: Date | string | null;
                contrato: {
                  id: number;
                  numero: string;
                  nome: string;
                  cliente: string;
                };
              }>
            >,
            vinculo: {
              funcionarioId: number;
              contratoId: number;
              tipoVinculo: string;
              ativo?: boolean;
              dataInicio?: Date | string | null;
              dataFim?: Date | string | null;
              contrato: {
                id: number;
                numero: string;
                nome: string;
                cliente: string;
              };
            },
          ) => {
            const lista = acc.get(vinculo.funcionarioId) || [];
            lista.push({
              contratoId: vinculo.contratoId,
              tipoVinculo: vinculo.tipoVinculo,
              ativo: vinculo.ativo,
              origemVinculo: "ATIVO",
              dataInicio: vinculo.dataInicio,
              dataFim: vinculo.dataFim,
              contrato: vinculo.contrato,
            });
            acc.set(vinculo.funcionarioId, lista);
            return acc;
          },
          new Map(),
        );
      } else if (funcionariosBase.length > 0) {
        try {
          const vinculosRaw = (await prisma.$queryRawUnsafe(
            `SELECT "funcionarioId", "contratoId", "tipoVinculo", "ativo", "dataInicio", "dataFim"
             FROM "FuncionarioContratoVinculo"
             WHERE "ativo" = true
               AND "funcionarioId" = ANY($1::int[])`,
            funcionariosBase.map((funcionario) => funcionario.id),
          )) as Array<{
            funcionarioId: number;
            contratoId: number;
            tipoVinculo: string;
            ativo?: boolean;
            dataInicio?: Date | string | null;
            dataFim?: Date | string | null;
          }>;

          if (vinculosRaw.length > 0) {
            const contratosIds = Array.from(
              new Set(vinculosRaw.map((vinculo) => vinculo.contratoId)),
            );

            const contratos = await prisma.contrato.findMany({
              where: { id: { in: contratosIds } },
              select: {
                id: true,
                numero: true,
                nome: true,
                cliente: true,
              },
            });

            const contratosMap = new Map(
              contratos.map((contrato) => [contrato.id, contrato]),
            );

            vinculosPorFuncionario = vinculosRaw.reduce(
              (
                acc: Map<
                  number,
                  Array<{
                    contratoId: number;
                    tipoVinculo: string;
                    ativo?: boolean;
                    origemVinculo?: "ATIVO" | "HISTORICO";
                    dataInicio?: Date | string | null;
                    dataFim?: Date | string | null;
                    contrato: {
                      id: number;
                      numero: string;
                      nome: string;
                      cliente: string;
                    };
                  }>
                >,
                vinculo: {
                  funcionarioId: number;
                  contratoId: number;
                  tipoVinculo: string;
                  ativo?: boolean;
                  dataInicio?: Date | string | null;
                  dataFim?: Date | string | null;
                },
              ) => {
                const contrato = contratosMap.get(vinculo.contratoId);
                if (!contrato) {
                  return acc;
                }
                const lista = acc.get(vinculo.funcionarioId) || [];
                lista.push({
                  contratoId: vinculo.contratoId,
                  tipoVinculo: vinculo.tipoVinculo,
                  ativo: vinculo.ativo,
                  origemVinculo: "ATIVO",
                  dataInicio: vinculo.dataInicio,
                  dataFim: vinculo.dataFim,
                  contrato: {
                    id: contrato.id,
                    numero: contrato.numero,
                    nome: contrato.nome,
                    cliente: contrato.cliente,
                  },
                });
                acc.set(vinculo.funcionarioId, lista);
                return acc;
              },
              new Map(),
            );
          }
        } catch {
          vinculosPorFuncionario = new Map();
        }
      }

      funcionarios = funcionariosBase.map((funcionario) => ({
        ...funcionario,
        contratosVinculo: vinculosPorFuncionario.get(funcionario.id) || [],
      }));
    }

    let funcionariosFormatados = funcionarios.map((funcionario) => {
      const { funcaoRef, ...funcionarioBase } = funcionario;
      const contratosMap = new Map<
        number,
        {
          id: number;
          numero: string;
          nome: string;
          cliente: string;
          tipoVinculo: string;
          origemVinculo: "PRINCIPAL" | "ATIVO" | "HISTORICO";
          dataInicio?: Date | string | null;
          dataFim?: Date | string | null;
        }
      >();
      const contratosVinculoMap = new Map<
        number,
        {
          contratoId: number;
          tipoVinculo: string;
          ativo?: boolean;
          origemVinculo?: "ATIVO" | "HISTORICO";
          dataInicio?: Date | string | null;
          dataFim?: Date | string | null;
          contrato: {
            id: number;
            numero: string;
            nome: string;
            cliente: string;
          };
        }
      >();
      if (funcionario.contrato) {
        contratosMap.set(funcionario.contrato.id, {
          ...funcionario.contrato,
          tipoVinculo: "PRINCIPAL",
          origemVinculo: "PRINCIPAL",
          dataInicio: null,
          dataFim: null,
        });
      }

      (funcionario.contratosVinculo || []).forEach((vinculo) => {
        contratosVinculoMap.set(vinculo.contratoId, vinculo);
        contratosMap.set(vinculo.contrato.id, {
          ...vinculo.contrato,
          tipoVinculo: vinculo.tipoVinculo,
          origemVinculo: "ATIVO",
          dataInicio: vinculo.dataInicio || null,
          dataFim: vinculo.dataFim || null,
        });
      });

      return {
        ...funcionarioBase,
        regime: funcaoRef?.regime || null,
        contratosVinculo: Array.from(contratosVinculoMap.values()),
        contratosVinculados: Array.from(contratosMap.values()),
      };
    });

    const funcionarioIds = funcionariosFormatados.map(
      (funcionario) => funcionario.id,
    );
    if (funcionarioIds.length > 0) {
      const remanejamentosAtivos =
        await prisma.remanejamentoFuncionario.findMany({
          where: {
            funcionarioId: {
              in: funcionarioIds,
            },
            statusPrestserv: {
              notIn: ["VALIDADO", "INVALIDADO", "CANCELADO"],
            },
          },
          select: {
            funcionarioId: true,
          },
        });
      const funcionariosComRemanejamentoAtivo = new Set(
        remanejamentosAtivos.map((registro) => registro.funcionarioId),
      );
      funcionariosFormatados = funcionariosFormatados.filter(
        (funcionario) =>
          !funcionario.emMigracao ||
          !funcionariosComRemanejamentoAtivo.has(funcionario.id),
      );
    }

    if (tipo === "desvinculo") {
      funcionariosFormatados = funcionariosFormatados.filter((funcionario) =>
        (funcionario.contratosVinculados || []).some(
          (contrato) => contrato.tipoVinculo !== "PRINCIPAL",
        ),
      );
    }

    return Response.json(funcionariosFormatados);
  } catch (error) {
    console.error("Erro ao buscar funcionários:", error);
    return Response.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
