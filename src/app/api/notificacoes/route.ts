import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";
import { getPermissionsByTeam, PERMISSIONS } from "@/lib/permissions";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret",
    );

    let decoded;
    try {
      const { payload } = await jwtVerify(token, secret);
      decoded = payload;
    } catch (e) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const equipeNome = decoded.equipe as string;
    const equipeId = decoded.equipeId as number;
    const nomeUsuario = decoded.nome as string;

    // Obter permissões para verificar acesso a notificações de treinamento
    const permissions = getPermissionsByTeam(equipeNome);
    const isTreinamento =
      permissions.includes(PERMISSIONS.ACCESS_TREINAMENTO) ||
      permissions.includes(PERMISSIONS.ACCESS_TREINAMENTO_GESTOR) ||
      permissions.includes(PERMISSIONS.ADMIN) ||
      equipeNome.includes("Treinamento");

    const isManagementTeam =
      permissions.includes(PERMISSIONS.ADMIN) ||
      permissions.includes(PERMISSIONS.ACCESS_PLANEJAMENTO) ||
      permissions.includes(PERMISSIONS.ACCESS_LOGISTICA) ||
      permissions.includes(PERMISSIONS.ACCESS_PREST_SERV) ||
      ["Planejamento", "Logística", "Prestserv", "Administração"].some((t) =>
        equipeNome.includes(t),
      );

    const isLogistica =
      permissions.includes(PERMISSIONS.ACCESS_LOGISTICA) ||
      permissions.includes(PERMISSIONS.ADMIN) ||
      equipeNome.includes("Logística") ||
      equipeNome.includes("Administração");

    // 1. Recentes (Criação e Aprovação) - Últimas 24h
    // Visível apenas para equipes de gestão (Planejamento, Logística, Prestserv, Admin)
    let recentCreates: any[] = [];
    let recentApprovals: any[] = [];
    if (isManagementTeam) {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      recentCreates = await prisma.historicoRemanejamento.findMany({
        where: {
          tipoAcao: { in: ["CRIACAO", "CREATE"] },
          dataAcao: { gte: oneDayAgo },
        },
        take: 5,
        orderBy: { dataAcao: "desc" },
        include: {
          usuario: {
            select: {
              funcionario: {
                select: {
                  nome: true,
                },
              },
            },
          },
          remanejamentoFuncionario: {
            select: {
              funcionario: {
                select: {
                  nome: true,
                },
              },
            },
          },
        },
      });

      // Registrar aprovações recentes (statusPrestserv -> VALIDADO/APROVADO)
      recentApprovals = await prisma.historicoRemanejamento.findMany({
        where: {
          tipoAcao: "ATUALIZACAO_STATUS",
          campoAlterado: "statusPrestserv",
          valorNovo: { in: ["VALIDADO", "APROVADO"] },
          dataAcao: { gte: oneDayAgo },
        },
        take: 10,
        orderBy: { dataAcao: "desc" },
        include: {
          usuario: {
            select: {
              funcionario: { select: { nome: true } },
            },
          },
          remanejamentoFuncionario: {
            select: {
              funcionario: { select: { nome: true } },
            },
          },
        },
      });
    }

    // Priority treinamento tasks (0/0) - Treinamento team only
    let priorityItems: any[] = [];
    if (isTreinamento) {
      const treinamentoItemsRaw =
        await prisma.remanejamentoFuncionario.findMany({
          where: {
            // Condição 1: Status do Prestserv aceitos para priorizar Treinamento 0/0
            // Inclui: VALIDADO/APROVADO (variações), CRIADO, PENDENTE. Exclui CANCELADO implicitamente por não estar na lista.
            statusPrestserv: {
              in: [
                // Validado / Aprovado (variações)
                "VALIDADO",
                "Validado",
                "validado",
                "VALIDADA",
                "Validada",
                "validada",
                "VALIDAO",
                "Validao",
                "validao",
                "APROVADO",
                "Aprovado",
                "aprovado",
                "APROVADA",
                "Aprovada",
                "aprovada",
                // Incluídos conforme solicitação
                "CRIADO",
                "Criado",
                "criado",
                "PENDENTE",
                "Pendente",
                "pendente",
              ],
            },
            // Condição 2: Devem existir tarefas geradas (gerarTarefasPadrao já rodou)
            tarefas: {
              some: {}, // Garante que existem tarefas (qualquer setor)
              none: {
                // Filtra para garantir que NÃO existe nenhuma tarefa de Treinamento ativa
                // Se existir qualquer tarefa que satisfaça estas condições, o remanejamento sai da lista
                AND: [
                  { status: { notIn: ["CANCELADO", "Cancelado"] } },
                  {
                    OR: [
                      {
                        responsavel: {
                          contains: "TREINAMENTO",
                          mode: "insensitive",
                        },
                      },
                      { treinamentoId: { not: null } },
                      { setorId: equipeId },
                    ],
                  },
                ],
              },
            },
          },
          take: 50,
          orderBy: { updatedAt: "desc" },
          include: {
            funcionario: { select: { nome: true, funcao: true } },
            solicitacao: {
              include: {
                contratoDestino: { select: { id: true, numero: true } },
              },
            },
          },
        });
      const treinamentoItems = treinamentoItemsRaw.map((it) => ({
        ...it,
        categoria: "TREINAMENTO_00",
      }));
      priorityItems = [...priorityItems, ...treinamentoItems];
    }

    if (isLogistica) {
      const logisticaItemsRaw = await prisma.remanejamentoFuncionario.findMany({
        where: {
          OR: [
            { statusTarefas: "APROVAR SOLICITAÇÃO" },
            { statusTarefas: "SUBMETER RASCUNHO" },
          ],
          statusPrestserv: {
            notIn: [
              "CONCLUIDO",
              "CANCELADO",
              "CONCLUÍDO",
              "Cancelado",
              "Concluido",
              "Concluído",
              "VALIDADO",
              "Validado",
              "validado",
            ],
          },
        },
        take: 20,
        orderBy: { createdAt: "asc" },
        include: {
          funcionario: { select: { nome: true, funcao: true } },
          solicitacao: {
            include: {
              contratoDestino: { select: { id: true, numero: true } },
            },
          },
        },
      });
      const logisticaItems = logisticaItemsRaw.map((it) => ({
        ...it,
        categoria: "LOGISTICA",
      }));
      priorityItems = [...priorityItems, ...logisticaItems];
    }

    // 3. Pendências (Tarefas vencidas)
    // Apenas tarefas da equipe do usuário ou onde ele é responsável
    const overdueTasks = await prisma.tarefaRemanejamento.findMany({
      where: {
        status: {
          notIn: [
            "CONCLUIDO",
            "CANCELADO",
            "CONCLUÍDO",
            "Cancelado",
            "Concluido",
            "Concluído",
          ],
        },
        dataLimite: { lt: new Date() },
        remanejamentoFuncionario: {
          statusPrestserv: {
            notIn: [
              "CONCLUIDO",
              "CANCELADO",
              "CONCLUÍDO",
              "Cancelado",
              "Concluido",
              "Concluído",
              "VALIDADO",
              "Validado",
              "validado",
            ],
          },
        },
        OR: [{ setorId: equipeId }, { responsavel: nomeUsuario }],
      },
      take: 10,
      orderBy: { dataLimite: "asc" },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: { select: { nome: true } },
          },
        },
        tarefaPadrao: { select: { descricao: true } },
      },
    });

    return NextResponse.json({
      recent: [...recentCreates, ...recentApprovals],
      priority: priorityItems,
      overdue: overdueTasks,
    });
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
