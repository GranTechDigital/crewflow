// src/app/api/contratos-centros-custo/[id]/route.ts

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam)
    if (isNaN(id))
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Verificar se a vinculação existe
    const vinculacao = await prisma.contratosCentrosCusto.findUnique({
      where: { id },
      include: {
        contrato: true,
        centroCusto: true
      }
    })

    if (!vinculacao) {
      return NextResponse.json(
        { error: 'Vinculação não encontrada.' },
        { status: 404 }
      )
    }

    await prisma.contratosCentrosCusto.delete({ where: { id } })

    return NextResponse.json({ 
      message: 'Vinculação removida com sucesso.',
      vinculacao
    })
  } catch (error) {
    console.error('Erro ao remover vinculação:', error)
    return NextResponse.json({ error: 'Erro ao remover vinculação.' }, { status: 500 })
  }
}