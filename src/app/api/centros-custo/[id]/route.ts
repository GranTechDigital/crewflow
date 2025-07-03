// src/app/api/centros-custo/[id]/route.ts

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (isNaN(id))
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json()
    const { num_centro_custo, nome_centro_custo, status } = body

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

    // Verificar se já existe outro centro de custo com o mesmo número
    const existingCentroCusto = await prisma.centroCusto.findFirst({
      where: {
        num_centro_custo,
        NOT: { id }
      }
    })

    if (existingCentroCusto) {
      return NextResponse.json(
        { error: 'Já existe um centro de custo com este número.' },
        { status: 400 }
      )
    }

    const centroCusto = await prisma.centroCusto.update({
      where: { id },
      data: {
        num_centro_custo,
        nome_centro_custo,
        status,
      },
    })

    return NextResponse.json(centroCusto)
  } catch (error) {
    console.error('Erro ao atualizar centro de custo:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar centro de custo.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (isNaN(id))
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Verificar se o centro de custo está vinculado a algum contrato
    const vinculacoes = await prisma.contratosCentrosCusto.findMany({
      where: { centroCustoId: id }
    })

    if (vinculacoes.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir um centro de custo que está vinculado a contratos.' },
        { status: 400 }
      )
    }

    await prisma.centroCusto.delete({ where: { id } })

    return NextResponse.json({ message: 'Centro de custo deletado com sucesso.' })
  } catch (error) {
    console.error('Erro ao deletar centro de custo:', error)
    return NextResponse.json({ error: 'Erro ao deletar centro de custo.' }, { status: 500 })
  }
}