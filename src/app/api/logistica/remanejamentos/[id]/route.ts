import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE - Excluir remanejamento de funcionário e registros associados
export async function DELETE(
  request: Request,
  context: any
) {
  try {
    let { id } = context?.params || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Parâmetro id inválido ou ausente" },
        { status: 400 }
      );
    }

    // Tentar encontrar por id direto (UUID/texto)
    let remanejamentoFuncionario = await prisma.remanejamentoFuncionario.findUnique({
      where: { id },
      include: {
        funcionario: {
          select: { id: true, nome: true, matricula: true },
        },
        solicitacao: true,
      },
    });

    // Se não encontrou, tentar interpretar o parâmetro como id do funcionário (número)
    if (!remanejamentoFuncionario) {
      const funcionarioIdInt = parseInt(id);
      if (!isNaN(funcionarioIdInt)) {
        const candidato = await prisma.remanejamentoFuncionario.findFirst({
          where: { funcionarioId: funcionarioIdInt },
          include: {
            funcionario: { select: { id: true, nome: true, matricula: true } },
            solicitacao: true,
          },
          orderBy: { createdAt: "desc" },
        });
        if (candidato) {
          remanejamentoFuncionario = candidato;
          id = candidato.id; // usar o id real do remanejamentoFuncionario
        }
      }
    }

    if (!remanejamentoFuncionario) {
      return NextResponse.json(
        { error: "Remanejamento do funcionário não encontrado" },
        { status: 404 }
      );
    }

    // Coletar tarefas relacionadas
    const tarefas = await prisma.tarefaRemanejamento.findMany({
      where: { remanejamentoFuncionarioId: id },
      select: { id: true },
    });
    const tarefaIds = tarefas.map((t) => t.id);

    // Excluir observações das tarefas, depois tarefas e por fim o remanejamento do funcionário
    await prisma.$transaction([
      prisma.observacaoTarefaRemanejamento.deleteMany({
        where: { tarefaId: { in: tarefaIds } },
      }),
      prisma.tarefaRemanejamento.deleteMany({
        where: { remanejamentoFuncionarioId: id },
      }),
      prisma.remanejamentoFuncionario.delete({
        where: { id },
      }),
    ]);

    // Após exclusão, se não houver mais remanejamentos para o funcionário, redefinir emMigracao
    const funcionarioId = remanejamentoFuncionario.funcionario.id;
    const existeOutroRemanejamento = await prisma.remanejamentoFuncionario.findFirst({
      where: { funcionarioId },
    });
    if (!existeOutroRemanejamento) {
      await prisma.funcionario.update({
        where: { id: funcionarioId },
        data: { emMigracao: false },
      });
    }

    // Registrar no histórico (sem referência ao remanejamento já excluído)
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: null,
          tipoAcao: "EXCLUSAO",
          entidade: "REMANEJAMENTO_FUNCIONARIO",
          descricaoAcao: `Remanejamento de ${remanejamentoFuncionario.funcionario.nome} (${remanejamentoFuncionario.funcionario.matricula}) excluído`,
        },
      });
    } catch (logErr) {
      console.error("Falha ao registrar histórico de exclusão de remanejamento:", logErr);
    }

    return NextResponse.json({ message: "Remanejamento excluído com sucesso" }, { status: 200 });
  } catch (error) {
    console.error("Erro ao excluir remanejamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}