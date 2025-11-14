import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AtualizarStatusPrestserv,
} from "@/types/remanejamento-funcionario";

// GET - Buscar detalhes de um funcionário em remanejamento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
        { status: 404 }
      );
    }

    return NextResponse.json(remanejamentoFuncionario);
  } catch (error) {
    console.error("Erro ao buscar funcionário:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar status do Prestserv
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Validações
    if (!statusPrestserv) {
      return NextResponse.json(
        { error: "Status do Prestserv é obrigatório" },
        { status: 400 }
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
          funcionario: {
            select: {
              id: true,
              nome: true,
              matricula: true,
            },
          },
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 }
      );
    }

    // Validação: só pode submeter se todas as tarefas estiverem concluídas
    if (statusPrestserv === "EM VALIDAÇÃO") {
      const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
        (tarefa) => tarefa.status !== "PROCESSO CONCLUIDO"
      );

      if (tarefasPendentes.length > 0) {
        return NextResponse.json(
          {
            error: "Não é possível submeter. Ainda existem tarefas pendentes.",
            tarefasPendentes: tarefasPendentes.length,
          },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {
      statusPrestserv,
      observacoesPrestserv,
    };

    // Se cancelar o Prestserv, marcar status geral das tarefas como CANCELADO
    if (statusPrestserv === "CANCELADO") {
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
    } else if (
      statusPrestserv === "VALIDADO" ||
      statusPrestserv === "INVALIDADO"
    ) {
      updateData.dataResposta = new Date();
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
      statusPrestserv !== "VALIDADO" &&
      statusPrestserv !== "INVALIDADO"
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

    // Registrar no histórico se o status mudou
    if (statusAnterior !== statusPrestserv) {
      try {
        await prisma.historicoRemanejamento.create({
          data: {
            solicitacaoId: funcionarioAtualizado.solicitacaoId,
            remanejamentoFuncionarioId: funcionarioAtualizado.id,
            tipoAcao: "ATUALIZACAO_STATUS",
            entidade: "PRESTSERV",
            descricaoAcao: `Status do Prestserv alterado de ${statusAnterior} para ${statusPrestserv} para ${funcionarioAtualizado.funcionario.nome} (${funcionarioAtualizado.funcionario.matricula})`,
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

    // Lógica especial para status VALIDADO
    if (statusPrestserv === "VALIDADO") {
      console.log("🔍 Status VALIDADO detectado no PUT");
      console.log(
        "📋 Dados da solicitação:",
        funcionarioAtualizado.solicitacao
      );

      const funcionarioMainUpdateData: Record<string, unknown> = {
        emMigracao: false,
      };

      // Adicionar SISPAT se fornecido
      if (sispat) {
        funcionarioMainUpdateData.sispat = sispat;
        console.log("📋 Adicionando SISPAT:", sispat);
      }

      if (funcionarioAtualizado.solicitacao?.tipo === "DESLIGAMENTO") {
        funcionarioMainUpdateData.statusPrestserv = "INATIVO";
        funcionarioMainUpdateData.contratoId = null;
        console.log(
          "❌ Tipo DESLIGAMENTO - definindo status como INATIVO e removendo vínculo com contrato"
        );
      } else {
        funcionarioMainUpdateData.statusPrestserv = "ATIVO";
        console.log("✅ Tipo não é DESLIGAMENTO - definindo status como ATIVO");

        // Atrelar funcionário ao contrato de destino
        if (funcionarioAtualizado.solicitacao?.contratoDestinoId) {
          funcionarioMainUpdateData.contratoId =
            funcionarioAtualizado.solicitacao.contratoDestinoId;
          console.log(
            "🔗 Vinculando funcionário ao contrato:",
            funcionarioAtualizado.solicitacao.contratoDestinoId
          );
        } else {
          console.log("⚠️ contratoDestinoId não encontrado na solicitação");
        }
      }

      console.log(
        "💾 Dados para atualização do funcionário:",
        funcionarioMainUpdateData
      );

      await prisma.funcionario.update({
        where: {
          id: funcionarioAtualizado.funcionarioId,
        },
        data: funcionarioMainUpdateData,
      });

      console.log("✅ Funcionário atualizado com sucesso");
    }

    // Se o Prestserv foi validado, mover o funcionário para o contrato de destino e atualizar statusPrestserv
    if (statusPrestserv === "VALIDADO") {
      // Buscar informações da solicitação para obter o contrato de destino
      const solicitacao = await prisma.solicitacaoRemanejamento.findUnique({
        where: { id: funcionarioAtualizado.solicitacaoId },
        select: { contratoDestinoId: true },
      });

      if (solicitacao?.contratoDestinoId) {
        // Atualizar o contrato do funcionário e desmarcar como em migração
        await prisma.funcionario.update({
          where: { id: funcionarioAtualizado.funcionarioId },
          data: {
            contratoId: solicitacao.contratoDestinoId,
            emMigracao: false,
          },
        });

        console.log(
          `Funcionário ${funcionarioAtualizado.funcionarioId} movido para contrato ${solicitacao.contratoDestinoId} e status atualizado para ATIVO`
        );
      }
    }

    // Se o Prestserv foi invalidado ou cancelado, desmarcar como em migração
    if (statusPrestserv === "INVALIDADO" || statusPrestserv === "CANCELADO") {
      await prisma.funcionario.update({
        where: { id: funcionarioAtualizado.funcionarioId },
        data: { emMigracao: false }, // Desmarca migração para permitir nova tentativa
      });

      console.log(
        `Funcionário ${funcionarioAtualizado.funcionarioId} desmarcado como em migração após ${statusPrestserv}`
      );
    }

    // Cancelar todas as tarefas associadas quando Prestserv é CANCELADO
    if (statusPrestserv === "CANCELADO") {
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
            entidade: "TAREFA",
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
          historicoError
        );
      }
    }

    // Se o Prestserv foi validado e todas as tarefas estão concluídas, verificar se a solicitação pode ser concluída
    if (
      statusPrestserv === "VALIDADO" &&
      funcionarioAtualizado.statusTarefas === "CONCLUIDO"
    ) {
      await verificarConclusaoSolicitacao(funcionarioAtualizado.solicitacaoId);
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
      { status: 500 }
    );
  }
}

// PATCH - Atualizar apenas o status do Prestserv (método simplificado)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
        { status: 400 }
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
        },
      });

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Funcionário em remanejamento não encontrado" },
        { status: 404 }
      );
    }

    // Validação: só pode submeter se todas as tarefas estiverem concluídas
    if (statusPrestserv === "EM VALIDAÇÃO") {
      // Considerar tarefa concluída tanto "CONCLUIDO" quanto "CONCLUIDA"
      const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
        (tarefa) => tarefa.status !== "CONCLUIDO" && tarefa.status !== "CONCLUIDA"
      );
      if (tarefasPendentes.length > 0) {
        return NextResponse.json(
          {
            error: "Não é possível submeter. Ainda existem tarefas pendentes.",
            tarefasPendentes: tarefasPendentes.length,
          },
          { status: 400 }
        );
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
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {};
    if (statusPrestserv) updateData.statusPrestserv = statusPrestserv;
    if (statusFuncionario) updateData.statusFuncionario = statusFuncionario;
    if (statusTarefas) updateData.statusTarefas = statusTarefas;
    if (observacoesPrestserv) updateData.observacoesPrestserv = observacoesPrestserv;

    // Adicionar datas automaticamente conforme o statusPrestserv
    if (statusPrestserv) {
      if (
        statusPrestserv === "CRIADO" &&
        !remanejamentoFuncionario.dataRascunhoCriado
      ) {
        updateData.dataRascunhoCriado = new Date();
      } else if (
        statusPrestserv === "ATENDER TAREFAS" ||
        statusPrestserv === "EM VALIDAÇÃO"
      ) {
        updateData.dataSubmetido = new Date();
      } else if (
        statusPrestserv === "VALIDADO" ||
        statusPrestserv === "INVALIDADO"
      ) {
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
        statusPrestserv !== "ATENDER TAREFAS" &&
        statusPrestserv !== "EM VALIDAÇÃO"
      ) {
        updateData.dataSubmetido = remanejamentoFuncionario.dataSubmetido;
      }
      if (
        !updateData.dataResposta &&
        remanejamentoFuncionario.dataResposta &&
        statusPrestserv !== "VALIDADO" &&
        statusPrestserv !== "INVALIDADO"
      ) {
        updateData.dataResposta = remanejamentoFuncionario.dataResposta;
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
            contratoDestinoId: true,
          },
        },
      },
    });

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

    // Lógica especial para status VALIDADO
    if (statusPrestserv === "VALIDADO") {
      console.log("🔍 Status VALIDADO detectado");
      console.log(
        "📋 Dados da solicitação:",
        funcionarioAtualizado.solicitacao
      );

      const funcionarioMainUpdateData: Record<string, unknown> = {
        emMigracao: false,
      };

      // Adicionar SISPAT se fornecido
      if (sispat) {
        funcionarioMainUpdateData.sispat = sispat;
        console.log("📋 Adicionando SISPAT:", sispat);
      }

      if (funcionarioAtualizado.solicitacao?.tipo === "DESLIGAMENTO") {
        funcionarioMainUpdateData.statusPrestserv = "INATIVO";
        funcionarioMainUpdateData.contratoId = null;
        console.log(
          "❌ Tipo DESLIGAMENTO - definindo status como INATIVO e removendo vínculo com contrato"
        );
      } else {
        funcionarioMainUpdateData.statusPrestserv = "ATIVO";
        console.log("✅ Tipo não é DESLIGAMENTO - definindo status como ATIVO");

        // Atrelar funcionário ao contrato de destino
        if (funcionarioAtualizado.solicitacao?.contratoDestinoId) {
          funcionarioMainUpdateData.contratoId =
            funcionarioAtualizado.solicitacao.contratoDestinoId;
          console.log(
            "🔗 Vinculando funcionário ao contrato:",
            funcionarioAtualizado.solicitacao.contratoDestinoId
          );
        } else {
          console.log("⚠️ contratoDestinoId não encontrado na solicitação");
        }
      }

      console.log(
        "💾 Dados para atualização do funcionário:",
        funcionarioMainUpdateData
      );

      await prisma.funcionario.update({
        where: {
          id: funcionarioAtualizado.funcionarioId,
        },
        data: funcionarioMainUpdateData,
      });

      console.log("✅ Funcionário atualizado com sucesso");
    }

    // Lógica especial para status INVALIDADO
    // Se for INVALIDADO, não altera emMigracao - funcionário continua em migração
    // até que seja validado

    // Se for desligamento e o status prestserv foi alterado para CONCLUIDO, atualizar status do funcionário para INATIVO
    if (
      funcionarioAtualizado.solicitacao?.tipo === "DESLIGAMENTO" &&
      statusPrestserv === "CONCLUIDO"
    ) {
      await prisma.funcionario.update({
        where: {
          id: funcionarioAtualizado.funcionarioId,
        },
        data: {
          statusPrestserv: "INATIVO",
          atualizadoEm: new Date(),
        },
      });
    }

    // Para solicitações de desligamento que foram concluídas, atualizar status do funcionário
    if (
      funcionarioAtualizado.solicitacao?.tipo === "DESLIGAMENTO" &&
      statusPrestserv === "CONCLUIDO"
    ) {
      await prisma.funcionario.update({
        where: { id: funcionarioAtualizado.funcionarioId },
        data: {
          statusPrestserv: "INATIVO",
          emMigracao: false,
        },
      });
    }

    // Para outros tipos de solicitação, desmarcar como em migração quando finalizado
    if (funcionarioAtualizado.solicitacao?.tipo !== "DESLIGAMENTO") {
      if (["VALIDADO", "INVALIDADO", "CANCELADO"].includes(statusPrestserv)) {
        await prisma.funcionario.update({
          where: { id: funcionarioAtualizado.funcionarioId },
          data: { emMigracao: false },
        });

        console.log(
          `Funcionário ${funcionarioAtualizado.funcionarioId} desmarcado como em migração após ${statusPrestserv}`
        );
      }
    }

    // Cancelar todas as tarefas associadas quando Prestserv é CANCELADO
    if (statusPrestserv === "CANCELADO") {
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
            entidade: "TAREFA",
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
          historicoError
        );
      }
    }

    return NextResponse.json({ success: true, funcionarioAtualizado });
  } catch (error) {
    console.error(
      "Erro ao atualizar status do funcionário ou prestserv:",
      error
    );
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

// Função para verificar se toda a solicitação pode ser marcada como concluída
async function verificarConclusaoSolicitacao(solicitacaoId: number) {
  try {
    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId,
      },
    });

    if (funcionarios.length === 0) {
      console.log(
        `Nenhum funcionário encontrado para a solicitação ${solicitacaoId}`
      );
      return;
    }

    // Verificar se todos os funcionários estão VALIDADOS ou CANCELADOS
    const todosValidosOuCancelados = funcionarios.every(
      (f) =>
        f.statusPrestserv === "VALIDADO" || f.statusPrestserv === "CANCELADO"
    );

    // Verificar se algum funcionário foi iniciado (não está mais como PENDENTE)
    const algumIniciado = funcionarios.some(
      (f) => f.statusPrestserv !== "PENDENTE"
    );

    let novoStatus = "Pendente";

    if (todosValidosOuCancelados) {
      novoStatus = "Concluído";
      console.log(
        `Todos os funcionários da solicitação ${solicitacaoId} estão validados ou cancelados. Marcando como Concluído.`
      );
    } else if (algumIniciado) {
      novoStatus = "Em Andamento";
      console.log(
        `Alguns funcionários da solicitação ${solicitacaoId} estão em processamento. Marcando como Em Andamento.`
      );
    } else {
      console.log(
        `Todos os funcionários da solicitação ${solicitacaoId} estão pendentes. Mantendo status como Pendente.`
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
        // Se concluído, atualizar a data de conclusão
        ...(novoStatus === "Concluído" ? { dataConclusao: new Date() } : {}),
      },
    });

    console.log(
      `Solicitação de remanejamento ${solicitacaoId} atualizada para status: ${novoStatus}`
    );
  } catch (error) {
    console.error("Erro ao verificar conclusão da solicitação:", error);
  }
}
