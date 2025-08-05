import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os centros de custo únicos no banco de dados
    const centrosCusto = await prisma.funcionario.findMany({
      select: {
        centroCusto: true
      },
      distinct: ['centroCusto'],
      where: {
        centroCusto: {
          not: null
        }
      },
      orderBy: {
        centroCusto: 'asc'
      }
    })

    // Extrair apenas os valores de centro de custo e filtrar valores vazios
    const centrosCustoUnicos = centrosCusto
      .map(item => item.centroCusto)
      .filter(Boolean)
      .sort()

    return NextResponse.json({
      success: true,
      data: centrosCustoUnicos
    })
  } catch (error) {
    console.error('Erro ao buscar centros de custo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}