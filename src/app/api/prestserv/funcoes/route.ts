import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { toSlug } from '@/utils/slug';

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Buscar todas as funções da tabela Funcao
    const funcoes = await prisma.funcao.findMany({
      where: {
        ativo: true
      },
      orderBy: {
        funcao: 'asc'
      }
    })

    return NextResponse.json(funcoes)
  } catch (error) {
    console.error('Erro ao buscar funções:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// POST - Criar nova função na tabela Funcao
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { funcao, regime, ativo = true } = body || {};

    if (!funcao || typeof funcao !== 'string' || funcao.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campo "funcao" é obrigatório' },
        { status: 400 }
      );
    }

    const nomeFuncao = funcao.trim();

    // Evitar duplicidade por nome
    const existente = await prisma.funcao.findFirst({
      where: { funcao: nomeFuncao }
    });

    if (existente) {
      // Retorna o existente para idempotência (poderia usar 409 se preferir)
      return NextResponse.json(existente, { status: 200 });
    }

    const novaFuncao = await prisma.funcao.create({
      data: {
        funcao: nomeFuncao.trim(),
        regime: typeof regime === 'string' ? regime.trim() : 'N/A',
        funcao_slug: toSlug(nomeFuncao.trim()),
        ativo: Boolean(ativo)
      }
    });

    return NextResponse.json(novaFuncao, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar função:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}