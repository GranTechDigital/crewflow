import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    const equipe = await prisma.equipe.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usuarios: true }
        }
      }
    });

    if (!equipe) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      equipe: {
        id: equipe.id,
        nome: equipe.nome,
        descricao: equipe.descricao,
        ativo: equipe.ativo,
        totalUsuarios: equipe._count.usuarios,
        createdAt: equipe.createdAt,
        updatedAt: equipe.updatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao buscar equipe:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const { nome, descricao, ativo } = await request.json();

    const equipe = await prisma.equipe.findUnique({
      where: { id }
    });

    if (!equipe) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se já existe uma equipe com esse nome (exceto a atual)
    if (nome && nome !== equipe.nome) {
      const equipeExistente = await prisma.equipe.findUnique({
        where: { nome }
      });

      if (equipeExistente) {
        return NextResponse.json(
          { error: 'Já existe uma equipe com esse nome' },
          { status: 400 }
        );
      }
    }

    const dadosAtualizacao: Prisma.EquipeUpdateInput = {};
    
    if (nome !== undefined) dadosAtualizacao.nome = nome;
    if (descricao !== undefined) dadosAtualizacao.descricao = descricao || null;
    if (ativo !== undefined) dadosAtualizacao.ativo = ativo;

    const equipeAtualizada = await prisma.equipe.update({
      where: { id },
      data: dadosAtualizacao,
      include: {
        _count: {
          select: { usuarios: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      equipe: {
        id: equipeAtualizada.id,
        nome: equipeAtualizada.nome,
        descricao: equipeAtualizada.descricao,
        ativo: equipeAtualizada.ativo,
        totalUsuarios: equipeAtualizada._count.usuarios,
        createdAt: equipeAtualizada.createdAt,
        updatedAt: equipeAtualizada.updatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar equipe:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    const equipe = await prisma.equipe.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usuarios: true }
        }
      }
    });

    if (!equipe) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se a equipe possui usuários
    if (equipe._count.usuarios > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir uma equipe que possui usuários ativos' },
        { status: 400 }
      );
    }

    await prisma.equipe.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Equipe excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir equipe:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}