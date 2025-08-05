import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os remanejamentos de funcionários com dados completos
    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      include: {
        funcionario: true,
        solicitacao: true,
        tarefas: true,
      },
    });

    // Obter dados para solicitações por mês
    const solicitacoes = await prisma.solicitacaoRemanejamento.findMany({
      select: {
        id: true,
        dataSolicitacao: true,
      },
    });

    // Calcular estatísticas gerais
    const totalSolicitacoes = await prisma.solicitacaoRemanejamento.count();
    const totalFuncionarios = await prisma.remanejamentoFuncionario.count();

    // Contar solicitações por tipo
    const solicitacoesPorTipo = await prisma.solicitacaoRemanejamento.groupBy({
      by: ["tipo"],
      _count: {
        id: true,
      },
    });

    // Contar solicitações por origem/destino
    const solicitacoesPorOrigemDestino =
      await prisma.solicitacaoRemanejamento.findMany({
        select: {
          id: true,
          contratoOrigem: {
            select: {
              nome: true,
            },
          },
          contratoDestino: {
            select: {
              nome: true,
            },
          },
        },
      });

    // Contar funcionários por status de tarefas
    const funcionariosPorStatusTarefas =
      await prisma.remanejamentoFuncionario.groupBy({
        by: ["statusTarefas"],
        _count: {
          id: true,
        },
      });

    // Contar funcionários por status de prestserv
    const funcionariosPorStatusPrestserv =
      await prisma.remanejamentoFuncionario.groupBy({
        by: ["statusPrestserv"],
        _count: {
          id: true,
        },
      });

    // Contar funcionários por responsável
    const funcionariosPorResponsavel = await prisma.tarefaRemanejamento.groupBy(
      {
        by: ["responsavel"],
        _count: {
          id: true,
        },
      }
    );

    // Calcular contadores específicos
    const funcionariosPendentes = remanejamentos.filter(
      (r) => r.statusTarefas === "PENDENTE"
    ).length;

    const funcionariosRejeitados = remanejamentos.filter(
      (r) => r.statusTarefas === "REJEITADO"
    ).length;

    const funcionariosPendentesAprovacao = remanejamentos.filter(
      (r) => r.statusTarefas === "APROVAR SOLICITAÇÃO"
    ).length;

    // Novos contadores solicitados
    const funcionariosValidados = remanejamentos.filter(
      (r) => r.statusTarefas === "CONCLUIDO"
    ).length;
    // Novos contadores solicitados
    const funcionariosCancelados = remanejamentos.filter(
      (r) => r.statusTarefas === "CANCELADO"
    ).length;
    const funcionariosEmProcesso = remanejamentos.filter(
      (r) =>
        r.statusTarefas === "CRIAR TAREFAS" ||
        r.statusTarefas === "RETORNO DO PRESTSERV" ||
        r.statusTarefas === "ATENDER TAREFAS"
    ).length;

    // Funcionários que precisam de atenção (prontos para submissão ou rejeitados)
    const funcionariosAtencao = remanejamentos
      .filter(
        (r) =>
          (r.statusTarefas === "CONCLUIDO" &&
            r.statusPrestserv === "PENDENTE") ||
          r.statusPrestserv === "REJEITADO"
      )
      .map((r) => ({
        id: r.id,
        statusTarefas: r.statusTarefas,
        statusPrestserv: r.statusPrestserv,
        funcionario: {
          id: r.funcionario.id,
          nome: r.funcionario.nome,
          matricula: r.funcionario.matricula,
          funcao: r.funcionario.funcao,
        },
        solicitacao: {
          id: r.solicitacao.id,
          centroCustoOrigem: r.solicitacao.centroCustoOrigem,
          centroCustoDestino: r.solicitacao.centroCustoDestino,
          dataSolicitacao: r.solicitacao.dataSolicitacao.toISOString(),
        },
        tarefas: r.tarefas.map((t) => ({
          id: t.id,
          tipo: t.tipo,
          responsavel: t.responsavel,
          status: t.status,
          dataLimite: t.dataLimite?.toISOString() || null,
        })),
      }));

    // Tarefas em atraso
    const hoje = new Date();
    const tarefasEmAtraso = await prisma.tarefaRemanejamento.findMany({
      where: {
        dataLimite: {
          lt: hoje,
        },
        status: {
          not: "CONCLUIDO",
        },
      },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: true,
          },
        },
      },
    });

    // Calcular solicitações por mês para o gráfico de tendência
    const solicitacoesPorMes = Array(12).fill(0);

    solicitacoes.forEach((solicitacao) => {
      const data = new Date(solicitacao.dataSolicitacao);
      const mes = data.getMonth(); // 0-11 para Jan-Dez
      solicitacoesPorMes[mes]++;
    });

    // Transformar dados de status para formato mais adequado para gráficos
    const funcionariosPorStatusTarefaFormatado = {};
    funcionariosPorStatusTarefas.forEach((item) => {
      funcionariosPorStatusTarefaFormatado[
        item.statusTarefas || "Não definido"
      ] = item._count.id;
    });

    const funcionariosPorStatusPrestservFormatado = {};
    funcionariosPorStatusPrestserv.forEach((item) => {
      funcionariosPorStatusPrestservFormatado[
        item.statusPrestserv || "Não definido"
      ] = item._count.id;
    });

    const funcionariosPorResponsavelFormatado = {};
    funcionariosPorResponsavel.forEach((item) => {
      funcionariosPorResponsavelFormatado[item.responsavel || "Não definido"] =
        item._count.id;
    });

    // Transformar dados de solicitações por tipo
    const solicitacoesPorTipoFormatado = {};
    solicitacoesPorTipo.forEach((item) => {
      solicitacoesPorTipoFormatado[item.tipo || "Não definido"] =
        item._count.id;
    });

    // Transformar dados de solicitações por origem/destino
    const solicitacoesPorOrigemDestinoFormatado = [];

    // Agrupar solicitações por origem/destino
    const origemDestinoMap = {};

    solicitacoesPorOrigemDestino.forEach((item) => {
      const origem = item.contratoOrigem?.nome || "Não definido";
      const destino = item.contratoDestino?.nome || "Não definido";
      const key = `${origem}-${destino}`;

      if (!origemDestinoMap[key]) {
        origemDestinoMap[key] = {
          origem,
          destino,
          count: 0,
        };
      }

      origemDestinoMap[key].count++;
    });

    // Converter o mapa para array
    for (const key in origemDestinoMap) {
      solicitacoesPorOrigemDestinoFormatado.push(origemDestinoMap[key]);
    }

    // Calcular pendências por setor
    const pendenciasPorSetor = {};
    const tarefasPendentes = await prisma.tarefaRemanejamento.findMany({
      where: {
        status: {
          not: "CONCLUIDO",
        },
      },
      select: {
        tipo: true,
        responsavel: true,
      },
    });

    tarefasPendentes.forEach((tarefa) => {
      const setor = tarefa.responsavel;
      if (!pendenciasPorSetor[setor]) {
        pendenciasPorSetor[setor] = 0;
      }
      pendenciasPorSetor[setor]++;
    });

    // Dados completos para o dashboard
    const response = {
      totalSolicitacoes,
      totalFuncionarios,
      funcionariosPendentes,
      funcionariosRejeitados,
      funcionariosPendentesAprovacao,
      funcionariosValidados,
      funcionariosCancelados,
      funcionariosEmProcesso,
      funcionariosPorStatusTarefa: funcionariosPorStatusTarefaFormatado,
      funcionariosPorStatusPrestserv: funcionariosPorStatusPrestservFormatado,
      funcionariosPorResponsavel: funcionariosPorResponsavelFormatado,
      solicitacoesPorTipo: solicitacoesPorTipoFormatado,
      solicitacoesPorOrigemDestino: solicitacoesPorOrigemDestinoFormatado,
      pendenciasPorSetor: pendenciasPorSetor,
      funcionariosAtencao,
      tarefasEmAtraso: tarefasEmAtraso.map((t) => ({
        id: t.id,
        tipo: t.tipo,
        responsavel: t.responsavel,
        status: t.status,
        dataLimite: t.dataLimite?.toISOString() || null,
        remanejamentoFuncionario: {
          funcionario: {
            id: t.remanejamentoFuncionario.funcionario.id,
            nome: t.remanejamentoFuncionario.funcionario.nome,
            matricula: t.remanejamentoFuncionario.funcionario.matricula,
          },
        },
      })),
      solicitacoesPorMes,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
