import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Buscar status mapping específico
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

    const statusMapping = await prisma.statusMapping.findUnique({
      where: { id },
      include: {
        status: true
      }
    });

    if (!statusMapping) {
      return NextResponse.json(
        { error: "Status mapping não encontrado" },
        { status: 404 }
      );
    }

    // Retornar no formato esperado
    const formatted = {
      id: statusMapping.id,
      statusGeral: statusMapping.statusGeral,
      categoria: statusMapping.status.categoria,
      ativo: statusMapping.ativo,
      createdAt: statusMapping.createdAt.toISOString(),
      updatedAt: statusMapping.updatedAt.toISOString()
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro ao buscar status mapping:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar status mapping
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
    const { statusGeral, categoria, ativo } = body;

    if (!statusGeral || !categoria) {
      return NextResponse.json(
        { error: "Status geral e categoria são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o status mapping existe
    const statusMappingExistente = await prisma.statusMapping.findUnique({
      where: { id }
    });

    if (!statusMappingExistente) {
      return NextResponse.json(
        { error: "Status mapping não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se já existe outro mapping com o mesmo statusGeral
    const outroMapping = await prisma.statusMapping.findFirst({
      where: {
        statusGeral,
        id: { not: id }
      }
    });

    if (outroMapping) {
      return NextResponse.json(
        { error: "Já existe outro mapping com este status geral" },
        { status: 409 }
      );
    }

    // Buscar ou criar o status (categoria)
    let status = await prisma.status.findUnique({
      where: { categoria }
    });

    if (!status) {
      status = await prisma.status.create({
        data: { categoria: categoria.trim() }
      });
    }

    // Atualizar o status mapping
    const statusMappingAtualizado = await prisma.statusMapping.update({
      where: { id },
      data: {
        statusGeral: statusGeral.trim(),
        statusId: status.id,
        ativo
      },
      include: {
        status: true
      }
    });

    // Retornar no formato esperado
    const formatted = {
      id: statusMappingAtualizado.id,
      statusGeral: statusMappingAtualizado.statusGeral,
      categoria: statusMappingAtualizado.status.categoria,
      ativo: statusMappingAtualizado.ativo,
      createdAt: statusMappingAtualizado.createdAt.toISOString(),
      updatedAt: statusMappingAtualizado.updatedAt.toISOString()
    };

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro ao atualizar status mapping:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir status mapping
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

    // Verificar se o status mapping existe
    const statusMapping = await prisma.statusMapping.findUnique({
      where: { id }
    });

    if (!statusMapping) {
      return NextResponse.json(
        { error: "Status mapping não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se há registros de PeriodoSheet usando este status
    const registrosUsando = await prisma.periodoSheet.count({
      where: {
        status: {
          statusMappings: {
            some: { id }
          }
        }
      }
    });

    if (registrosUsando > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Existem ${registrosUsando} registros usando este status mapping.` },
        { status: 409 }
      );
    }

    // Excluir o status mapping
    await prisma.statusMapping.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Status mapping excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir status mapping:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}