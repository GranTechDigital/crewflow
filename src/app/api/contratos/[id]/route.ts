// src/app/api/contratos/[id]/route.ts

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
    const { numero, nome, cliente, dataInicio, dataFim, centroDeCusto, status } =
      body

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

    const contrato = await prisma.contrato.update({
      where: { id },
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
    console.error('Erro ao atualizar contrato:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar contrato.' },
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

    await prisma.contrato.delete({ where: { id } })

    return NextResponse.json({ message: 'Contrato deletado com sucesso.' })
  } catch (error) {
    console.error('Erro ao deletar contrato:', error)
    return NextResponse.json({ error: 'Erro ao deletar contrato.' }, { status: 500 })
  }
}
