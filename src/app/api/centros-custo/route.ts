// src/app/api/centros-custo/route.ts

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const centrosCusto = await prisma.centroCusto.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        contratos: {
          include: {
            contrato: true
          }
        }
      }
    })
    return NextResponse.json(centrosCusto)
  } catch (error) {
    console.error('Erro ao buscar centros de custo:', error)
    return NextResponse.json({ error: 'Erro ao buscar centros de custo' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      num_centro_custo,
      nome_centro_custo,
      status,
    } = body

    // Validação básica dos campos obrigatórios
    if (
      !num_centro_custo ||
      !nome_centro_custo ||
      !status
    ) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      )
    }

    // Verificar se já existe um centro de custo com o mesmo número
    const existingCentroCusto = await prisma.centroCusto.findUnique({
      where: { num_centro_custo }
    })

    if (existingCentroCusto) {
      return NextResponse.json(
        { error: 'Já existe um centro de custo com este número.' },
        { status: 400 }
      )
    }

    const centroCusto = await prisma.centroCusto.create({
      data: {
        num_centro_custo,
        nome_centro_custo,
        status,
      },
    })

    return NextResponse.json(centroCusto)
  } catch (error) {
    console.error('Erro ao criar centro de custo:', error)
    return NextResponse.json(
      { error: 'Erro ao criar centro de custo.', detalhe: String(error) },
      { status: 500 }
    )
  }
}