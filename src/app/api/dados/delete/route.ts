import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  try {
    await prisma.funcionario.deleteMany()
    return NextResponse.json({ message: 'Todos os dados foram excluídos.' })
  } catch (error) {
    console.error('Erro ao deletar dados:', error)
    return NextResponse.json(
      { error: 'Erro interno ao excluir dados.' },
      { status: 500 }
    )
  }
}
