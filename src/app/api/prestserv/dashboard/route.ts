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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const startStr = url.searchParams.get("startDate") || undefined;
    const endStr = url.searchParams.get("endDate") || undefined;
    const startDate = startStr ? new Date(startStr) : undefined;
    const endDate =
      endStr && !endStr.endsWith("T23:59:59.999")
        ? new Date(new Date(endStr).setHours(23, 59, 59, 999))
        : endStr
          ? new Date(endStr)
          : undefined;
    const inRange = (d: Date | string | null | undefined) => {
      if (!d) return true;
      const dt = new Date(d);
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
      return true;
    };
    // Buscar todos os remanejamentos de funcionários com dados completos
    const remanejamentos = await prisma.remanejamentoFuncionario.findMany({
      include: {
        funcionario: true,
        solicitacao: true,
        tarefas: true,
      },
    });
    const remanejamentosFiltrados = remanejamentos.filter((r) =>
      inRange(r.solicitacao?.dataSolicitacao),
    );

    // Obter dados para solicitações por mês
    const solicitacoes = await prisma.solicitacaoRemanejamento.findMany({
      select: {
        id: true,
        dataSolicitacao: true,
      },
    });
    const solicitacoesFiltradas = solicitacoes.filter((s) =>
      inRange(s.dataSolicitacao),
    );

    // Calcular estatísticas gerais
    const totalSolicitacoes = solicitacoesFiltradas.length;
    const totalFuncionarios = remanejamentosFiltrados.length;

    // Contar solicitações por tipo (respeitando o range de datas)
    const solicitacoesTipos = await prisma.solicitacaoRemanejamento.findMany({
      select: { tipo: true, dataSolicitacao: true },
    });
    const solicitacoesPorTipoMap = solicitacoesTipos
      .filter((s) => inRange(s.dataSolicitacao))
      .reduce<Record<string, number>>((acc, s) => {
        const key = s.tipo || "Não definido";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    // Contar solicitações por origem/destino (respeitando o range de datas)
    const solicitacoesPorOrigemDestino = (
      await prisma.solicitacaoRemanejamento.findMany({
        select: {
          id: true,
          dataSolicitacao: true,
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
      })
    ).filter((s) => inRange((s as any).dataSolicitacao));

    // Contar funcionários por status de tarefas (filtrado por data)
    const funcionariosPorStatusTarefas = Object.entries(
      remanejamentosFiltrados.reduce<Record<string, number>>((acc, r) => {
        const key = r.statusTarefas || "Não definido";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    ).map(([statusTarefas, count]) => ({
      statusTarefas,
      _count: { id: count },
    }));

    // Contar funcionários por status de prestserv (filtrado por data)
    const funcionariosPorStatusPrestserv = Object.entries(
      remanejamentosFiltrados.reduce<Record<string, number>>((acc, r) => {
        const key = r.statusPrestserv || "Não definido";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    ).map(([statusPrestserv, count]) => ({
      statusPrestserv,
      _count: { id: count },
    }));

    // Contar funcionários por responsável (com base nas tarefas dos remanejamentos filtrados)
    const funcionariosPorResponsavel = Object.entries(
      remanejamentosFiltrados
        .flatMap((r) => r.tarefas)
        .reduce<Record<string, number>>((acc, t) => {
          const key = t.responsavel || "Não definido";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
    ).map(([responsavel, count]) => ({
      responsavel,
      _count: { id: count },
    }));

    // Calcular contadores específicos
    const funcionariosPendentes = remanejamentosFiltrados.filter(
      (r) => r.statusTarefas === "PENDENTE",
    ).length;

    const funcionariosRejeitados = remanejamentosFiltrados.filter(
      (r) => r.statusTarefas === "REJEITADO",
    ).length;

    const funcionariosPendentesAprovacao = remanejamentosFiltrados.filter(
      (r) => r.statusTarefas === "APROVAR SOLICITAÇÃO",
    ).length;

    // Novos contadores solicitados
    const funcionariosValidados = remanejamentosFiltrados.filter(
      (r) => r.statusTarefas === "CONCLUIDO",
    ).length;
    // Novos contadores solicitados
    const funcionariosCancelados = remanejamentosFiltrados.filter(
      (r) => r.statusTarefas === "CANCELADO",
    ).length;
    const funcionariosEmProcesso = remanejamentosFiltrados.filter(
      (r) =>
        r.statusTarefas === "REPROVAR TAREFAS" ||
        r.statusTarefas === "RETORNO DO PRESTSERV" ||
        r.statusTarefas === "ATENDER TAREFAS",
    ).length;

    // Totais adicionais compatíveis com o dashboard
    const funcionariosAptos =
      funcionariosPorStatusTarefas.find(
        (item) => item.statusTarefas === "CONCLUIDO",
      )?._count.id || 0;
    const funcionariosSubmetidos =
      funcionariosPorStatusPrestserv.find(
        (item) => item.statusPrestserv === "SUBMETIDO",
      )?._count.id || 0;
    const funcionariosAprovados =
      funcionariosPorStatusPrestserv.find(
        (item) => item.statusPrestserv === "APROVADO",
      )?._count.id || 0;

    // Funcionários que precisam de atenção (prontos para submissão ou rejeitados)
    const funcionariosAtencao = remanejamentosFiltrados
      .filter(
        (r) =>
          (r.statusTarefas === "CONCLUIDO" &&
            r.statusPrestserv === "PENDENTE") ||
          r.statusPrestserv === "REJEITADO",
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

    // Tarefas em atraso (derivadas dos remanejamentos filtrados)
    const hoje = new Date();
    const tarefasEmAtraso = remanejamentosFiltrados
      .flatMap((r) =>
        r.tarefas.map((t) => ({
          ...t,
          remanejamentoFuncionario: { funcionario: r.funcionario },
        })),
      )
      .filter(
        (t) => t.status !== "CONCLUIDO" && t.dataLimite && t.dataLimite < hoje,
      )
      .sort((a, b) => {
        const da = a.dataLimite ? a.dataLimite.getTime() : 0;
        const db = b.dataLimite ? b.dataLimite.getTime() : 0;
        return da - db;
      });

    // Calcular solicitações por mês para o gráfico de tendência
    const solicitacoesPorMes = Array(12).fill(0);

    solicitacoesFiltradas.forEach((solicitacao: SolicitacaoData) => {
      const data = new Date(solicitacao.dataSolicitacao);
      const mes = data.getMonth(); // 0-11 para Jan-Dez
      solicitacoesPorMes[mes]++;
    });

    // Transformar dados de status para formato mais adequado para gráficos
    const funcionariosPorStatusTarefaFormatado: { [key: string]: number } = {};
    const funcionariosPorStatusTarefaArray: {
      status: string;
      count: number;
    }[] = [];
    funcionariosPorStatusTarefas.forEach((item: GroupByStatusTarefas) => {
      const status = item.statusTarefas || "Não definido";
      funcionariosPorStatusTarefaFormatado[status] = item._count.id;
      funcionariosPorStatusTarefaArray.push({ status, count: item._count.id });
    });

    const funcionariosPorStatusPrestservFormatado: { [key: string]: number } =
      {};
    const funcionariosPorStatusPrestservArray: {
      status: string;
      count: number;
    }[] = [];
    funcionariosPorStatusPrestserv.forEach((item: GroupByStatusPrestserv) => {
      const status = item.statusPrestserv || "Não definido";
      funcionariosPorStatusPrestservFormatado[status] = item._count.id;
      funcionariosPorStatusPrestservArray.push({
        status,
        count: item._count.id,
      });
    });

    const funcionariosPorResponsavelFormatado: { [key: string]: number } = {};
    funcionariosPorResponsavel.forEach((item: GroupByResponsavel) => {
      funcionariosPorResponsavelFormatado[item.responsavel || "Não definido"] =
        item._count.id;
    });

    // Transformar dados de solicitações por tipo
    const solicitacoesPorTipoFormatado: { [key: string]: number } =
      solicitacoesPorTipoMap;

    // Transformar dados de solicitações por origem/destino
    const solicitacoesPorOrigemDestinoFormatado: Array<{
      origem: string;
      destino: string;
      count: number;
    }> = [];

    // Agrupar solicitações por origem/destino
    const origemDestinoMap: {
      [key: string]: { origem: string; destino: string; count: number };
    } = {};

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

    // Calcular pendências por setor (com base nas tarefas dos remanejamentos filtrados)
    const pendenciasPorSetor: { [key: string]: number } = {};
    const tarefasPendentes = remanejamentosFiltrados
      .flatMap((r) => r.tarefas)
      .filter((t) => t.status !== "CONCLUIDO")
      .map((t) => ({
        tipo: t.tipo,
        responsavel: t.responsavel || "Não definido",
      }));

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
    const solicitacoesConcluidasRaw =
      await prisma.solicitacaoRemanejamento.findMany({
        where: {
          dataConclusao: { not: null },
          status: { not: "CANCELADO" },
        },
        select: {
          id: true,
          tipo: true,
          solicitadoPorId: true,
          dataSolicitacao: true,
          dataConclusao: true,
          contratoOrigem: { select: { nome: true } },
          contratoDestino: { select: { nome: true } },
        },
      });
    const solicitacoesConcluidas = solicitacoesConcluidasRaw.filter((s) =>
      inRange(s.dataSolicitacao),
    );

    const diffInDays = (a: Date, b: Date) => {
      const ms = b.getTime() - a.getTime();
      return ms / (1000 * 60 * 60 * 24);
    };
    const diffInHours = (a: Date, b: Date) => {
      const ms = b.getTime() - a.getTime();
      return ms / (1000 * 60 * 60);
    };

    const temposSolicitacoesDias = solicitacoesConcluidas
      .map((s) =>
        diffInDays(new Date(s.dataSolicitacao), new Date(s.dataConclusao!)),
      )
      .filter((v) => Number.isFinite(v) && v >= 0);

    const slaTempoMedioSolicitacaoDias = temposSolicitacoesDias.length
      ? temposSolicitacoesDias.reduce((acc, v) => acc + v, 0) /
        temposSolicitacoesDias.length
      : 0;

    const temposSolicitacoesHoras = solicitacoesConcluidas
      .map((s) =>
        diffInHours(new Date(s.dataSolicitacao), new Date(s.dataConclusao!)),
      )
      .filter((v) => Number.isFinite(v) && v >= 0);

    const slaTempoMedioSolicitacaoHoras = temposSolicitacoesHoras.length
      ? temposSolicitacoesHoras.reduce((acc, v) => acc + v, 0) /
        temposSolicitacoesHoras.length
      : 0;

    const solicitacaoIds = solicitacoesConcluidas.map((s) => s.id);
    const historicoSolicitacoes = solicitacaoIds.length
      ? await prisma.historicoRemanejamento.findMany({
          where: { solicitacaoId: { in: solicitacaoIds } },
          select: {
            solicitacaoId: true,
            tipoAcao: true,
            entidade: true,
            campoAlterado: true,
            valorNovo: true,
            usuarioResponsavel: true,
            dataAcao: true,
          },
          orderBy: { dataAcao: "asc" },
        })
      : [];

    const mapaAtoresSolicitacao = new Map<
      number,
      { criadoPor?: string; concluidoPor?: string }
    >();
    historicoSolicitacoes.forEach((h) => {
      const m = mapaAtoresSolicitacao.get(h.solicitacaoId!) || {};
      if (h.tipoAcao === "CRIACAO" && h.entidade === "SOLICITACAO") {
        if (!m.criadoPor) m.criadoPor = h.usuarioResponsavel;
      }
      if (
        h.tipoAcao === "ATUALIZACAO_STATUS" &&
        h.entidade === "SOLICITACAO" &&
        (h.valorNovo?.toUpperCase() === "CONCLUIDO" ||
          h.valorNovo?.toUpperCase() === "CONCLUIDA")
      ) {
        m.concluidoPor = h.usuarioResponsavel;
      }
      mapaAtoresSolicitacao.set(h.solicitacaoId!, m);
    });

    const slaSolicitacoesDetalhesHoras = solicitacoesConcluidas
      .map((s) => {
        const horas = diffInHours(
          new Date(s.dataSolicitacao),
          new Date(s.dataConclusao!),
        );
        const atores = mapaAtoresSolicitacao.get(s.id) || {};
        return {
          id: s.id,
          tipo: s.tipo || "",
          origem: s.contratoOrigem?.nome || "Não definido",
          destino: s.contratoDestino?.nome || "Não definido",
          autorSolicitacao: String(s.solicitadoPorId ?? ""),
          autorConclusao: atores.concluidoPor || "",
          dataSolicitacao: new Date(s.dataSolicitacao).toISOString(),
          dataConclusao: new Date(s.dataConclusao!).toISOString(),
          horas,
        };
      })
      .filter((item) => Number.isFinite(item.horas) && item.horas >= 0);

    // 2) Tempo por setores: média de duração por setor considerando tempo de correção
    const tarefasConcluidasPorSetor = await prisma.tarefaRemanejamento.findMany(
      {
        where: {
          dataConclusao: { not: null },
        },
        select: {
          responsavel: true,
          dataCriacao: true,
          dataConclusao: true,
        },
      },
    );

    const tempoPorSetorAcumulado: Record<
      string,
      { somaDias: number; somaHoras: number; qtd: number }
    > = {};
    tarefasConcluidasPorSetor.forEach((t) => {
      const setor = t.responsavel || "Não definido";
      const dias = diffInDays(
        new Date(t.dataCriacao),
        new Date(t.dataConclusao!),
      );
      const horas = diffInHours(
        new Date(t.dataCriacao),
        new Date(t.dataConclusao!),
      );
      if (!Number.isFinite(dias) || dias < 0) return;
      if (!tempoPorSetorAcumulado[setor])
        tempoPorSetorAcumulado[setor] = { somaDias: 0, somaHoras: 0, qtd: 0 };
      tempoPorSetorAcumulado[setor].somaDias += dias;
      if (Number.isFinite(horas) && horas >= 0)
        tempoPorSetorAcumulado[setor].somaHoras += horas;
      tempoPorSetorAcumulado[setor].qtd += 1;
    });

    const slaTempoMedioPorSetorDias: Record<string, number> = {};
    const slaTempoMedioPorSetorHoras: Record<string, number> = {};
    Object.keys(tempoPorSetorAcumulado).forEach((setor) => {
      const { somaDias, somaHoras, qtd } = tempoPorSetorAcumulado[setor];
      slaTempoMedioPorSetorDias[setor] = qtd ? somaDias / qtd : 0;
      slaTempoMedioPorSetorHoras[setor] = qtd ? somaHoras / qtd : 0;
    });

    const slaTempoPorSetor = Object.keys(slaTempoMedioPorSetorHoras).map(
      (setor) => ({
        setor,
        mediaDias: slaTempoMedioPorSetorDias[setor] || 0,
        mediaHoras: slaTempoMedioPorSetorHoras[setor] || 0,
      }),
    );

    // 3) Tempo de aprovação da logística: diferença entre dataSubmetido e dataResposta
    const prestservAvaliacoesRaw = await prisma.remanejamentoFuncionario.findMany({
      where: {
        dataSubmetido: { not: null },
        dataResposta: { not: null },
      },
      select: {
        id: true,
        statusPrestserv: true,
        dataSubmetido: true,
        dataResposta: true,
        funcionario: { select: { nome: true, matricula: true } },
      },
    });
    // Respeitar o range: considerar ciclo a partir da dataSubmetido
    const prestservAvaliacoes = prestservAvaliacoesRaw.filter((r) =>
      inRange(r.dataSubmetido as Date),
    );

    // diffInHours já definido acima

    const temposAprovacaoHoras = prestservAvaliacoes
      .map((r) =>
        diffInHours(new Date(r.dataSubmetido!), new Date(r.dataResposta!)),
      )
      .filter((v) => Number.isFinite(v) && v >= 0);

    const slaLogisticaTempoMedioAprovacaoHoras = temposAprovacaoHoras.length
      ? temposAprovacaoHoras.reduce((acc, v) => acc + v, 0) /
        temposAprovacaoHoras.length
      : 0;

    const slaTempoPorSetorComLogistica = [
      ...slaTempoPorSetor,
      {
        setor: "LOGISTICA",
        mediaDias: 0,
        mediaHoras: slaLogisticaTempoMedioAprovacaoHoras,
      },
    ].sort((a, b) => b.mediaHoras - a.mediaHoras);

    const rfIds = prestservAvaliacoes.map((r) => r.id);
    const historicoRF = rfIds.length
      ? await prisma.historicoRemanejamento.findMany({
          where: { remanejamentoFuncionarioId: { in: rfIds } },
          select: {
            remanejamentoFuncionarioId: true,
            tipoAcao: true,
            entidade: true,
            campoAlterado: true,
            valorNovo: true,
            usuarioResponsavel: true,
            dataAcao: true,
          },
          orderBy: { dataAcao: "asc" },
        })
      : [];

    const mapaAtoresRF = new Map<
      string,
      { submetidoPor?: string; respondidoPor?: string }
    >();
    historicoRF.forEach((h) => {
      const id = h.remanejamentoFuncionarioId!;
      const m = mapaAtoresRF.get(id) || {};
      if (
        h.tipoAcao === "ATUALIZACAO_STATUS" &&
        h.entidade === "FUNCIONARIO" &&
        h.valorNovo?.toUpperCase() === "SUBMETIDO"
      ) {
        if (!m.submetidoPor) m.submetidoPor = h.usuarioResponsavel;
      }
      if (
        h.tipoAcao === "ATUALIZACAO_STATUS" &&
        h.entidade === "FUNCIONARIO" &&
        (h.valorNovo?.toUpperCase() === "APROVADO" ||
          h.valorNovo?.toUpperCase() === "REJEITADO")
      ) {
        m.respondidoPor = h.usuarioResponsavel;
      }
      mapaAtoresRF.set(id, m);
    });

    const slaLogisticaDetalhesHoras = prestservAvaliacoes
      .map((r) => {
        const horas = diffInHours(
          new Date(r.dataSubmetido!),
          new Date(r.dataResposta!),
        );
        const atores = mapaAtoresRF.get(r.id) || {};
        return {
          funcionarioNome: r.funcionario?.nome || "",
          funcionarioMatricula: r.funcionario?.matricula || "",
          statusPrestserv: r.statusPrestserv || "",
          autorSubmissao: atores.submetidoPor || "",
          autorResposta: atores.respondidoPor || "",
          dataSubmetido: new Date(r.dataSubmetido!).toISOString(),
          dataResposta: new Date(r.dataResposta!).toISOString(),
          horas,
        };
      })
      .filter((item) => Number.isFinite(item.horas) && item.horas >= 0);

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
      volumetriaCorrecoesPorTipo[tipo] =
        (volumetriaCorrecoesPorTipo[tipo] || 0) + 1;
    });

    // Auditoria detalhada de tarefas: id, funcionário, criado por, concluído por, datas e horas
    const tarefasParaAuditoriaRaw = await prisma.tarefaRemanejamento.findMany({
      select: {
        id: true,
        tipo: true,
        responsavel: true,
        status: true,
        dataCriacao: true,
        dataConclusao: true,
        remanejamentoFuncionario: {
          select: {
            funcionario: { select: { nome: true, matricula: true } },
          },
        },
      },
      orderBy: { dataCriacao: "asc" },
    });
    // Filtrar tarefas pela data de criação dentro do período
    const tarefasParaAuditoria = tarefasParaAuditoriaRaw.filter((t) =>
      inRange(t.dataCriacao as Date),
    );

    const tarefaIds = tarefasParaAuditoria.map((t) => t.id);
    const historicoTarefas = tarefaIds.length
      ? await prisma.historicoRemanejamento.findMany({
          where: { tarefaId: { in: tarefaIds } },
          select: {
            tarefaId: true,
            tipoAcao: true,
            entidade: true,
            campoAlterado: true,
            valorNovo: true,
            usuarioResponsavel: true,
            dataAcao: true,
          },
          orderBy: { dataAcao: "asc" },
        })
      : [];

    const mapaAtoresTarefa = new Map<
      string,
      { criadoPor?: string; concluidoPor?: string }
    >();
    historicoTarefas.forEach((h) => {
      const id = h.tarefaId!;
      const m = mapaAtoresTarefa.get(id) || {};
      if (h.tipoAcao === "CRIACAO" && h.entidade === "TAREFA") {
        if (!m.criadoPor) m.criadoPor = h.usuarioResponsavel;
      }
      if (
        h.tipoAcao === "ATUALIZACAO_STATUS" &&
        h.entidade === "TAREFA" &&
        h.valorNovo?.toUpperCase() === "CONCLUIDO"
      ) {
        m.concluidoPor = h.usuarioResponsavel;
      }
      mapaAtoresTarefa.set(id, m);
    });

    const tarefasAuditoriaDetalhes = tarefasParaAuditoria
      .filter((t) => t.dataConclusao)
      .map((t) => {
        const atores = mapaAtoresTarefa.get(t.id) || {};
        const horas = diffInHours(
          new Date(t.dataCriacao),
          new Date(t.dataConclusao!),
        );
        return {
          id: t.id,
          tipo: t.tipo,
          responsavel: t.responsavel,
          status: t.status,
          funcionarioNome: t.remanejamentoFuncionario?.funcionario?.nome || "",
          funcionarioMatricula:
            t.remanejamentoFuncionario?.funcionario?.matricula || "",
          criadoPor: atores.criadoPor || "",
          concluidoPor: atores.concluidoPor || "",
          dataCriacao: t.dataCriacao.toISOString(),
          dataConclusao: t.dataConclusao?.toISOString() || null,
          horas,
        };
      })
      .filter((item) => Number.isFinite(item.horas) && item.horas >= 0);

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
      slaSolicitacoesDetalhesHoras,
      slaTempoMedioPorSetorDias,
      slaTempoMedioPorSetorHoras,
      slaTempoPorSetor: slaTempoPorSetorComLogistica,
      slaLogisticaTempoMedioAprovacaoHoras,
      slaLogisticaDetalhesHoras,
      volumetriaCorrecoesPorTipo,
      tarefasAuditoriaDetalhes,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
