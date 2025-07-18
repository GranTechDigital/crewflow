import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const equipes = await prisma.equipe.findMany({
      where: { ativo: true },
      include: {
        _count: {
          select: { usuarios: true }
        }
      },
      orderBy: { nome: 'asc' }
    });

    return NextResponse.json({
      success: true,
      equipes: equipes.map(equipe => ({
        id: equipe.id,
        nome: equipe.nome,
        descricao: equipe.descricao,
        ativo: equipe.ativo,
        totalUsuarios: equipe._count.usuarios,
        createdAt: equipe.createdAt,
        updatedAt: equipe.updatedAt
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar equipes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nome, descricao } = await request.json();

    if (!nome) {
      return NextResponse.json(
        { error: 'Nome da equipe é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se já existe uma equipe com esse nome
    const equipeExistente = await prisma.equipe.findUnique({
      where: { nome }
    });

    if (equipeExistente) {
      return NextResponse.json(
        { error: 'Já existe uma equipe com esse nome' },
        { status: 400 }
      );
    }

    const novaEquipe = await prisma.equipe.create({
      data: {
        nome,
        descricao: descricao || null
      }
    });

    return NextResponse.json({
      success: true,
      equipe: {
        id: novaEquipe.id,
        nome: novaEquipe.nome,
        descricao: novaEquipe.descricao,
        ativo: novaEquipe.ativo,
        createdAt: novaEquipe.createdAt,
        updatedAt: novaEquipe.updatedAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar equipe:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}