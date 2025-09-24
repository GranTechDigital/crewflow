import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Buscar todas as funções únicas no banco de dados
    const funcoes = await prisma.funcionario.findMany({
      select: {
        funcao: true
      },
      distinct: ['funcao'],
      where: {
        funcao: {
          not: null
        }
      },
      orderBy: {
        funcao: 'asc'
      }
    })

    // Extrair apenas os valores de função e filtrar valores vazios
    const funcoesUnicas = funcoes
      .map(item => item.funcao)
      .filter(Boolean)
      .sort()

    return NextResponse.json(funcoesUnicas)
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