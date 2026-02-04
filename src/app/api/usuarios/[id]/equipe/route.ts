import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { equipeId } = await request.json();
    const { id: idParam } = await params;
    const userId = parseInt(idParam);

    if (!equipeId || !userId) {
      return NextResponse.json(
        { success: false, error: 'ID do usuário e ID da equipe são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a equipe existe
    const equipe = await prisma.equipe.findUnique({
      where: { id: equipeId }
    });

    if (!equipe) {
      return NextResponse.json(
        { success: false, error: 'Equipe não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o usuário existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId }
    });

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar a equipe do usuário e reativar caso esteja inativo
    const usuarioAtualizado = await prisma.usuario.update({
      where: { id: userId },
      data: {
        equipeId: equipeId,
        ativo: true
      },
      include: {
        funcionario: true,
        equipe: true
      }
    });

    return NextResponse.json({
      success: true,
      usuario: usuarioAtualizado
    });

  } catch (error) {
    console.error('Erro ao atualizar equipe do usuário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
