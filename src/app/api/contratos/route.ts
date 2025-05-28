// src/app/api/contratos/route.ts

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const contratos = await prisma.contrato.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(contratos)
  } catch (error) {
    console.error('Erro ao buscar contratos:', error)
    return NextResponse.json({ error: 'Erro ao buscar contratos' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      numero,
      nome,
      cliente,
      dataInicio,
      dataFim,
      centroDeCusto,
      status,
    } = body

    // Validação básica dos campos obrigatórios
    if (
      !numero ||
      !nome ||
      !cliente ||
      !dataInicio ||
      !dataFim ||
      !centroDeCusto ||
      !status
    ) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      )
    }

    const contrato = await prisma.contrato.create({
      data: {
        numero,
        nome,
        cliente,
        dataInicio: new Date(`${dataInicio}T00:00:00Z`),
        dataFim: new Date(`${dataFim}T00:00:00Z`),
        centroDeCusto,
        status,
      },
    })

    return NextResponse.json(contrato)
  } catch (error) {
    console.error('Erro ao criar contrato:', error)
    return NextResponse.json(
      { error: 'Erro ao criar contrato.', detalhe: String(error) },
      { status: 500 }
    )
  }
}
