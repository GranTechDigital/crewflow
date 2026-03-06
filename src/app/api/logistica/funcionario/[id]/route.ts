import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AtualizarStatusPrestserv } from "@/types/remanejamento-funcionario";

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
            },
          },
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
        { status: 404 },
      );
    }

    // Validação: só pode submeter se todas as tarefas estiverem concluídas, desconsiderando canceladas
    if (statusPrestserv === "EM VALIDAÇÃO") {
      const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
        (tarefa) =>
          tarefa.status !== "CONCLUIDO" &&
          tarefa.status !== "CONCLUIDA" &&
          tarefa.status !== "CANCELADO",
      );

      if (tarefasPendentes.length > 0) {
        return NextResponse.json(
          {
            error: "Não é possível submeter. Ainda existem tarefas pendentes.",
            tarefasPendentes: tarefasPendentes.length,
          },
          { status: 400 },
        );
      }
    }

    // Validação: para validar (exceto DESLIGAMENTO), deve haver tarefas ativas em todos os setores (RH, Med, Trein)
    if (statusPrestservCanonical === "VALIDADO") {
      const tipoSolicitacao = remanejamentoFuncionario.solicitacao?.tipo;

      if (tipoSolicitacao !== "DESLIGAMENTO") {
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

    // Lógica especial para status VALIDADO
    if (isValidado) {
      console.log("🔍 Status VALIDADO detectado no PUT");
      console.log(
        "📋 Dados da solicitação:",
        funcionarioAtualizado.solicitacao,
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
          "❌ Tipo DESLIGAMENTO - definindo status como INATIVO e removendo vínculo com contrato",
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
            funcionarioAtualizado.solicitacao.contratoDestinoId,
          );
        } else {
          console.log("⚠️ contratoDestinoId não encontrado na solicitação");
        }
      }

      console.log(
        "💾 Dados para atualização do funcionário:",
        funcionarioMainUpdateData,
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
    if (isValidado) {
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
          `Funcionário ${funcionarioAtualizado.funcionarioId} movido para contrato ${solicitacao.contratoDestinoId} e status atualizado para ATIVO`,
        );
      }
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

    // Validação: só pode submeter se todas as tarefas estiverem concluídas, desconsiderando canceladas
    if (statusPrestserv === "EM VALIDAÇÃO") {
      // Considerar tarefa concluída tanto "CONCLUIDO" quanto "CONCLUIDA" e ignorar "CANCELADO"
      const tarefasPendentes = remanejamentoFuncionario.tarefas.filter(
        (tarefa) =>
          tarefa.status !== "CONCLUIDO" &&
          tarefa.status !== "CONCLUIDA" &&
          tarefa.status !== "CANCELADO",
      );
      if (tarefasPendentes.length > 0) {
        return NextResponse.json(
          {
            error: "Não é possível submeter. Ainda existem tarefas pendentes.",
            tarefasPendentes: tarefasPendentes.length,
          },
          { status: 400 },
        );
      }
    }

    // Validação: para validar (exceto DESLIGAMENTO), deve haver tarefas ativas em todos os setores (RH, Med, Trein)
    if (statusPrestservCanonical === "VALIDADO") {
      const tipoSolicitacao = remanejamentoFuncionario.solicitacao?.tipo;

      if (tipoSolicitacao !== "DESLIGAMENTO") {
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
            contratoDestinoId: true,
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

    // Lógica especial para status VALIDADO
    if (statusPrestservCanonical === "VALIDADO") {
      console.log("🔍 Status VALIDADO detectado");
      console.log(
        "📋 Dados da solicitação:",
        funcionarioAtualizado.solicitacao,
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
          "❌ Tipo DESLIGAMENTO - definindo status como INATIVO e removendo vínculo com contrato",
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
            funcionarioAtualizado.solicitacao.contratoDestinoId,
          );
        } else {
          console.log("⚠️ contratoDestinoId não encontrado na solicitação");
        }
      }

      console.log(
        "💾 Dados para atualização do funcionário:",
        funcionarioMainUpdateData,
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
          `Funcionário ${funcionarioAtualizado.funcionarioId} desmarcado como em migração após ${statusPrestserv}`,
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
