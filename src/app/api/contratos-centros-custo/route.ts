// src/app/api/contratos-centros-custo/route.ts

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const vinculacoes = await prisma.contratosCentrosCusto.findMany({
      include: {
        contrato: true,
        centroCusto: true
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(vinculacoes)
  } catch (error) {
    console.error('Erro ao buscar vinculações:', error)
    return NextResponse.json({ error: 'Erro ao buscar vinculações' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { contratoId, centroCustoId } = body

    // Validação básica dos campos obrigatórios
    if (!contratoId || !centroCustoId) {
      return NextResponse.json(
        { error: 'Contrato e Centro de Custo são obrigatórios.' },
        { status: 400 }
      )
    }

    // Verificar se o contrato existe
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId }
    })

    if (!contrato) {
      return NextResponse.json(
        { error: 'Contrato não encontrado.' },
        { status: 404 }
      )
    }

    // Verificar se o centro de custo existe
    const centroCusto = await prisma.centroCusto.findUnique({
      where: { id: centroCustoId }
    })

    if (!centroCusto) {
      return NextResponse.json(
        { error: 'Centro de custo não encontrado.' },
        { status: 404 }
      )
    }

    // Verificar se a vinculação já existe
    const vinculacaoExistente = await prisma.contratosCentrosCusto.findFirst({
      where: {
        contratoId,
        centroCustoId
      }
    })

    if (vinculacaoExistente) {
      return NextResponse.json(
        { error: 'Esta vinculação já existe.' },
        { status: 400 }
      )
    }

    const vinculacao = await prisma.contratosCentrosCusto.create({
      data: {
        contratoId,
        centroCustoId,
      },
      include: {
        contrato: true,
        centroCusto: true
      }
    })

    return NextResponse.json(vinculacao)
  } catch (error) {
    console.error('Erro ao criar vinculação:', error)
    return NextResponse.json(
      { error: 'Erro ao criar vinculação.', detalhe: String(error) },
      { status: 500 }
    )
  }
}