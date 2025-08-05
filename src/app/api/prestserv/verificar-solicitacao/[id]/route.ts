import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Verificar e atualizar o status da solicitação de remanejamento
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const solicitacaoId = parseInt(params.id);

    if (isNaN(solicitacaoId)) {
      return NextResponse.json(
        { error: "ID da solicitação inválido" },
        { status: 400 }
      );
    }

    // Buscar todos os funcionários da solicitação
    const funcionarios = await prisma.remanejamentoFuncionario.findMany({
      where: {
        solicitacaoId,
      },
    });

    if (funcionarios.length === 0) {
      return NextResponse.json(
        { error: "Nenhum funcionário encontrado para esta solicitação" },
        { status: 404 }
      );
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
    const solicitacaoAtualizada = await prisma.solicitacaoRemanejamento.update({
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

    // Registrar no histórico a mudança de status
    await prisma.historicoRemanejamento.create({
      data: {
        solicitacaoId,
        tipoAcao: "ATUALIZACAO_STATUS",
        entidade: "SOLICITACAO",
        descricaoAcao: `Status da solicitação alterado para ${novoStatus}`,
        campoAlterado: "status",
        valorNovo: novoStatus,
        usuarioResponsavel: "Sistema",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Status da solicitação atualizado para ${novoStatus}`,
      solicitacao: solicitacaoAtualizada,
    });
  } catch (error) {
    console.error(
      "Erro ao verificar e atualizar status da solicitação:",
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
