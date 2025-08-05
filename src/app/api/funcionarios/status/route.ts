import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os status únicos no banco de dados
    const statusList = await prisma.funcionario.findMany({
      select: {
        status: true
      },
      distinct: ['status'],
      where: {
        status: {
          not: null
        }
      },
      orderBy: {
        status: 'asc'
      }
    })

    // Extrair apenas os valores de status e filtrar valores vazios
    const statusUnicos = statusList
      .map(item => item.status)
      .filter(Boolean)
      .sort()

    return NextResponse.json({
      success: true,
      data: statusUnicos
    })
  } catch (error) {
    console.error('Erro ao buscar status:', error)
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