import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DashboardRemanejamento, StatusTarefa, StatusPrestserv } from "@/types/remanejamento-funcionario";

// GET - Dados do dashboard da logística
export async function GET() {
  try {
    // Contar total de solicitações
    const totalSolicitacoes = await prisma.solicitacaoRemanejamento.count();

    // Contar funcionários por status de tarefas
    const funcionariosPorStatusTarefas =
      await prisma.remanejamentoFuncionario.groupBy({
        by: ["statusTarefas"],
        _count: {
          id: true,
        },
      });

    // Contar funcionários por status do Prestserv
    const funcionariosPorStatusPrestserv =
      await prisma.remanejamentoFuncionario.groupBy({
        by: ["statusPrestserv"],
        _count: {
          id: true,
        },
      });

    // Contar solicitações por status
    const solicitacoesPorStatus = await prisma.solicitacaoRemanejamento.groupBy(
      {
        by: ["status"],
        _count: {
          id: true,
        },
      }
    );

    // Calcular totais específicos
    const funcionariosPendentes =
      funcionariosPorStatusTarefas.find(
        (item) => item.statusTarefas === "PENDENTE"
      )?._count.id || 0;

    const funcionariosAptos =
      funcionariosPorStatusTarefas.find(
        (item) => item.statusTarefas === "CONCLUIDO"
      )?._count.id || 0;

    const funcionariosSubmetidos =
      funcionariosPorStatusPrestserv.find(
        (item) => item.statusPrestserv === "SUBMETIDO"
      )?._count.id || 0;

    const funcionariosAprovados =
      funcionariosPorStatusPrestserv.find(
        (item) => item.statusPrestserv === "APROVADO"
      )?._count.id || 0;

    const funcionariosRejeitados =
      funcionariosPorStatusPrestserv.find(
        (item) => item.statusPrestserv === "REJEITADO"
      )?._count.id || 0;

    // Buscar funcionários que precisam de atenção
    const funcionariosAtencao = await prisma.remanejamentoFuncionario.findMany({
      where: {
        OR: [
          // Funcionários com SUBMETER RASCUNHO mas ainda não submetidos
          {
            statusTarefas: "CONCLUIDO",
            statusPrestserv: {
              in: ["PENDENTE", "CRIADO"],
            },
          },
          // Funcionários rejeitados
          {
            statusPrestserv: "REJEITADO",
          },
        ],
      },
      include: {
        funcionario: {
          select: {
            id: true,
            nome: true,
            matricula: true,
            funcao: true,
          },
        },
        solicitacao: {
          select: {
            id: true,
            contratoOrigemId: true,
            contratoDestinoId: true,
            dataSolicitacao: true,
          },
        },
        tarefas: {
          where: {
            status: {
              not: "CONCLUIDO",
            },
          },
          select: {
            id: true,
            tipo: true,
            responsavel: true,
            status: true,
            dataLimite: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Buscar tarefas em atraso
    const tarefasEmAtraso = await prisma.tarefaRemanejamento.findMany({
      where: {
        status: {
          not: "CONCLUIDO",
        },
        dataLimite: {
          lt: new Date(),
        },
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true,
              },
            },
          },
        },
      },
      orderBy: {
        dataLimite: "asc",
      },
    });

    // Montar resposta do dashboard
    const dashboardData: DashboardRemanejamento & {
      funcionariosAtencao: typeof funcionariosAtencao;
      tarefasEmAtraso: typeof tarefasEmAtraso;
    } = {
      totalSolicitacoes,
      funcionariosPendentes,
      funcionariosAptos,
      funcionariosSubmetidos,
      funcionariosAprovados,
      funcionariosRejeitados,
      solicitacoesPorStatus: solicitacoesPorStatus.map((item) => ({
        status: item.status,
        count: item._count.id,
      })),
      funcionariosPorStatusTarefa: funcionariosPorStatusTarefas.map(
        (item) => ({
          status: item.statusTarefas as StatusTarefa,
          count: item._count.id,
        })
      ),
      funcionariosPorStatusPrestserv: funcionariosPorStatusPrestserv.map(
        (item) => ({
          status: item.statusPrestserv as StatusPrestserv,
          count: item._count.id,
        })
      ),
      funcionariosAtencao,
      tarefasEmAtraso,
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
