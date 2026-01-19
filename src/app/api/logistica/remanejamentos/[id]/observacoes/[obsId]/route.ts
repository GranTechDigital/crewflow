import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; obsId: string }> }
) {
  try {
    const { id, obsId } = await params;
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const observacao =
      await prisma.observacaoRemanejamentoFuncionario.findUnique({
        where: {
          id: parseInt(obsId),
        },
      });

    if (!observacao) {
      return NextResponse.json(
        { error: "Observação não encontrada" },
        { status: 404 }
      );
    }

    if (observacao.remanejamentoFuncionarioId !== id) {
      return NextResponse.json(
        { error: "Observação não pertence a este remanejamento" },
        { status: 400 }
      );
    }

    await prisma.observacaoRemanejamentoFuncionario.delete({
      where: {
        id: parseInt(obsId),
      },
    });

    return NextResponse.json({ message: "Observação removida com sucesso" });
  } catch (error) {
    console.error("Erro ao remover observação:", error);
    return NextResponse.json(
      { error: "Erro ao remover observação" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; obsId: string }> }
) {
  try {
    const { id, obsId } = await params;
    const usuarioAutenticado = await getUserFromRequest(request);

    if (!usuarioAutenticado) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const novoTexto: string | undefined = body?.texto;

    if (!novoTexto || !novoTexto.trim()) {
      return NextResponse.json(
        { error: "Texto da observação é obrigatório" },
        { status: 400 }
      );
    }

    const observacaoExistente =
      await prisma.observacaoRemanejamentoFuncionario.findUnique({
        where: {
          id: parseInt(obsId),
        },
      });

    if (!observacaoExistente) {
      return NextResponse.json(
        { error: "Observação não encontrada" },
        { status: 404 }
      );
    }

    if (observacaoExistente.remanejamentoFuncionarioId !== id) {
      return NextResponse.json(
        { error: "Observação não pertence a este remanejamento" },
        { status: 400 }
      );
    }

    const observacaoAtualizada =
      await prisma.observacaoRemanejamentoFuncionario.update({
        where: {
          id: parseInt(obsId),
        },
        data: {
          texto: novoTexto.trim(),
          modificadoPor: usuarioAutenticado.funcionario.nome,
        },
      });

    return NextResponse.json(observacaoAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar observação:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar observação" },
      { status: 500 }
    );
  }
}
