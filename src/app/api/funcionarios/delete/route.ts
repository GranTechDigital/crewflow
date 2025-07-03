// src/app/api/funcionarios/delete/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  try {
    await prisma.funcionario.deleteMany()
    return NextResponse.json({ message: 'Todos os funcionários foram excluídos.' })
  } catch (error) {
    console.error('Erro ao deletar funcionários:', error)
    return NextResponse.json(
      { error: 'Erro interno ao excluir funcionários.' },
      { status: 500 }
    )
  }
}