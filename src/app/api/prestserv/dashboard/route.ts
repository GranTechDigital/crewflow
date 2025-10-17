import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Type definitions for better type safety
interface SolicitacaoData {
  id: number;
  dataSolicitacao: Date;
}

interface GroupByStatusTarefas {
  statusTarefas: string | null;
  _count: {
    id: number;
  };
}

interface GroupByStatusPrestserv {
  statusPrestserv: string | null;
  _count: {
    id: number;
  };
}

interface GroupByResponsavel {
  responsavel: string | null;
  _count: {
    id: number;
  };
}

interface GroupByTipo {
  tipo: string | null;
  _count: {
    id: number;
  };
}

interface SolicitacaoOrigemDestino {
  id: number;
  contratoOrigem: {
    nome: string;
  } | null;
  contratoDestino: {
    nome: string;
  } | null;
}

interface TarefaPendente {
  tipo: string;
  responsavel: string;
}

export async function GET() {
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
        r.statusTarefas === "REPROVAR TAREFAS" ||
        r.statusTarefas === "RETORNO DO PRESTSERV" ||
        r.statusTarefas === "ATENDER TAREFAS"
    ).length;

    // Totais adicionais compatíveis com o dashboard
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
          contratoOrigemId: r.solicitacao.contratoOrigemId,
          contratoDestinoId: r.solicitacao.contratoDestinoId,
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

    solicitacoes.forEach((solicitacao: SolicitacaoData) => {
      const data = new Date(solicitacao.dataSolicitacao);
      const mes = data.getMonth(); // 0-11 para Jan-Dez
      solicitacoesPorMes[mes]++;
    });

    // Transformar dados de status para formato mais adequado para gráficos
    const funcionariosPorStatusTarefaFormatado: { [key: string]: number } = {};
    const funcionariosPorStatusTarefaArray: { status: string; count: number }[] = [];
    funcionariosPorStatusTarefas.forEach((item: GroupByStatusTarefas) => {
      const status = item.statusTarefas || "Não definido";
      funcionariosPorStatusTarefaFormatado[status] = item._count.id;
      funcionariosPorStatusTarefaArray.push({ status, count: item._count.id });
    });

    const funcionariosPorStatusPrestservFormatado: { [key: string]: number } = {};
    const funcionariosPorStatusPrestservArray: { status: string; count: number }[] = [];
    funcionariosPorStatusPrestserv.forEach((item: GroupByStatusPrestserv) => {
      const status = item.statusPrestserv || "Não definido";
      funcionariosPorStatusPrestservFormatado[status] = item._count.id;
      funcionariosPorStatusPrestservArray.push({ status, count: item._count.id });
    });

    const funcionariosPorResponsavelFormatado: { [key: string]: number } = {};
    funcionariosPorResponsavel.forEach((item: GroupByResponsavel) => {
      funcionariosPorResponsavelFormatado[item.responsavel || "Não definido"] =
        item._count.id;
    });

    // Transformar dados de solicitações por tipo
    const solicitacoesPorTipoFormatado: { [key: string]: number } = {};
    solicitacoesPorTipo.forEach((item: GroupByTipo) => {
      solicitacoesPorTipoFormatado[item.tipo || "Não definido"] =
        item._count.id;
    });

    // Transformar dados de solicitações por origem/destino
    const solicitacoesPorOrigemDestinoFormatado: Array<{origem: string, destino: string, count: number}> = [];

    // Agrupar solicitações por origem/destino
    const origemDestinoMap: { [key: string]: {origem: string, destino: string, count: number} } = {};

    solicitacoesPorOrigemDestino.forEach((item: SolicitacaoOrigemDestino) => {
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
    const pendenciasPorSetor: { [key: string]: number } = {};
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

    tarefasPendentes.forEach((tarefa: TarefaPendente) => {
      const setor = tarefa.responsavel;
      if (!pendenciasPorSetor[setor]) {
        pendenciasPorSetor[setor] = 0;
      }
      pendenciasPorSetor[setor]++;
    });

    // =========================
    // SLAs solicitados
    // =========================
    // 1) Tempo total da solicitação: da criação até conclusão (se não cancelada)
    const solicitacoesConcluidas = await prisma.solicitacaoRemanejamento.findMany({
      where: {
        // Considera concluídas (dataConclusao definida) e não canceladas
        dataConclusao: { not: null },
        status: { not: "CANCELADO" },
      },
      select: {
        id: true,
        dataSolicitacao: true,
        dataConclusao: true,
      },
    });

    const diffInDays = (a: Date, b: Date) => {
      const ms = b.getTime() - a.getTime();
      return ms / (1000 * 60 * 60 * 24);
    };
    const diffInHours = (a: Date, b: Date) => {
      const ms = b.getTime() - a.getTime();
      return ms / (1000 * 60 * 60);
    };

    const temposSolicitacoesDias = solicitacoesConcluidas
      .map((s) => diffInDays(new Date(s.dataSolicitacao), new Date(s.dataConclusao!)))
      .filter((v) => Number.isFinite(v) && v >= 0);

    const slaTempoMedioSolicitacaoDias = temposSolicitacoesDias.length
      ? temposSolicitacoesDias.reduce((acc, v) => acc + v, 0) / temposSolicitacoesDias.length
      : 0;

    const temposSolicitacoesHoras = solicitacoesConcluidas
      .map((s) => diffInHours(new Date(s.dataSolicitacao), new Date(s.dataConclusao!)))
      .filter((v) => Number.isFinite(v) && v >= 0);

    const slaTempoMedioSolicitacaoHoras = temposSolicitacoesHoras.length
      ? temposSolicitacoesHoras.reduce((acc, v) => acc + v, 0) / temposSolicitacoesHoras.length
      : 0;

    // 2) Tempo por setores: média de duração por setor considerando tempo de correção
    const tarefasConcluidasPorSetor = await prisma.tarefaRemanejamento.findMany({
      where: {
        dataConclusao: { not: null },
      },
      select: {
        responsavel: true,
        dataCriacao: true,
        dataConclusao: true,
      },
    });

    const tempoPorSetorAcumulado: Record<string, { somaDias: number; somaHoras: number; qtd: number }> = {};
    tarefasConcluidasPorSetor.forEach((t) => {
      const setor = t.responsavel || "Não definido";
      const dias = diffInDays(new Date(t.dataCriacao), new Date(t.dataConclusao!));
      const horas = diffInHours(new Date(t.dataCriacao), new Date(t.dataConclusao!));
      if (!Number.isFinite(dias) || dias < 0) return;
      if (!tempoPorSetorAcumulado[setor]) tempoPorSetorAcumulado[setor] = { somaDias: 0, somaHoras: 0, qtd: 0 };
      tempoPorSetorAcumulado[setor].somaDias += dias;
      if (Number.isFinite(horas) && horas >= 0) tempoPorSetorAcumulado[setor].somaHoras += horas;
      tempoPorSetorAcumulado[setor].qtd += 1;
    });

    const slaTempoMedioPorSetorDias: Record<string, number> = {};
    const slaTempoMedioPorSetorHoras: Record<string, number> = {};
    Object.keys(tempoPorSetorAcumulado).forEach((setor) => {
      const { somaDias, somaHoras, qtd } = tempoPorSetorAcumulado[setor];
      slaTempoMedioPorSetorDias[setor] = qtd ? somaDias / qtd : 0;
      slaTempoMedioPorSetorHoras[setor] = qtd ? somaHoras / qtd : 0;
    });

    // 3) Tempo de aprovação da logística: diferença entre dataSubmetido e dataResposta
    const prestservAvaliacoes = await prisma.remanejamentoFuncionario.findMany({
      where: {
        dataSubmetido: { not: null },
        dataResposta: { not: null },
      },
      select: {
        dataSubmetido: true,
        dataResposta: true,
      },
    });

    // diffInHours já definido acima

    const temposAprovacaoHoras = prestservAvaliacoes
      .map((r) => diffInHours(new Date(r.dataSubmetido!), new Date(r.dataResposta!)))
      .filter((v) => Number.isFinite(v) && v >= 0);

    const slaLogisticaTempoMedioAprovacaoHoras = temposAprovacaoHoras.length
      ? temposAprovacaoHoras.reduce((acc, v) => acc + v, 0) / temposAprovacaoHoras.length
      : 0;

    // 4) Volumetria de correções por treinamento/documento (tarefas reprovadas)
    const historicoReprovacoes = await prisma.historicoRemanejamento.findMany({
      where: {
        entidade: "TAREFA",
        campoAlterado: "status",
        valorNovo: "REPROVADO",
      },
      select: {
        tarefa: {
          select: { tipo: true },
        },
      },
    });

    const volumetriaCorrecoesPorTipo: Record<string, number> = {};
    historicoReprovacoes.forEach((h) => {
      const tipo = h.tarefa?.tipo || "Não definido";
      volumetriaCorrecoesPorTipo[tipo] = (volumetriaCorrecoesPorTipo[tipo] || 0) + 1;
    });

    // Dados completos para o dashboard
    const response = {
      totalSolicitacoes,
      totalFuncionarios,
      funcionariosPendentes,
      funcionariosAptos,
      funcionariosSubmetidos,
      funcionariosAprovados,
      funcionariosRejeitados,
      funcionariosPendentesAprovacao,
      funcionariosValidados,
      funcionariosCancelados,
      funcionariosEmProcesso,
      funcionariosPorStatusTarefa: funcionariosPorStatusTarefaArray,
      funcionariosPorStatusPrestserv: funcionariosPorStatusPrestservArray,
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
      // SLAs
      slaTempoMedioSolicitacaoDias,
      slaTempoMedioSolicitacaoHoras,
      slaTempoMedioPorSetorDias,
      slaTempoMedioPorSetorHoras,
      slaLogisticaTempoMedioAprovacaoHoras,
      volumetriaCorrecoesPorTipo,
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
