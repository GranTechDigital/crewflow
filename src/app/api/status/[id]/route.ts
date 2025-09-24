import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Buscar status por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const status = await prisma.status.findUnique({
      where: { id },
      include: {
        statusMappings: true
      }
    });

    if (!status) {
      return NextResponse.json(
        { error: "Status não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Erro ao buscar status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { categoria, ativo } = body;

    if (!categoria) {
      return NextResponse.json(
        { error: "Categoria é obrigatória" },
        { status: 400 }
      );
    }

    // Verificar se o status existe
    const statusExistente = await prisma.status.findUnique({
      where: { id }
    });

    if (!statusExistente) {
      return NextResponse.json(
        { error: "Status não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se a nova categoria já existe em outro registro
    if (categoria !== statusExistente.categoria) {
      const duplicado = await prisma.status.findUnique({
        where: { categoria }
      });

      if (duplicado) {
        return NextResponse.json(
          { error: "Categoria já existe" },
          { status: 409 }
        );
      }
    }

    const statusAtualizado = await prisma.status.update({
      where: { id },
      data: {
        categoria: categoria.trim(),
        ativo: ativo !== undefined ? ativo : statusExistente.ativo
      }
    });

    return NextResponse.json(statusAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir status
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    // Verificar se o status existe
    const status = await prisma.status.findUnique({
      where: { id }
    });

    if (!status) {
      return NextResponse.json(
        { error: "Status não encontrado" },
        { status: 404 }
      );
    }

    await prisma.status.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Status excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir status:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}