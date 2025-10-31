import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const last = await prisma.funcionario.findFirst({
      where: {
        matricula: {
          not: 'ADMIN001'
        }
      },
      orderBy: { atualizadoEm: 'desc' },
      select: { atualizadoEm: true }
    })
    return NextResponse.json({ lastSyncAt: last?.atualizadoEm ?? null })
  } catch (error) {
    console.error('Erro ao obter última atualização de funcionários:', error)
    return NextResponse.json({ error: 'Erro ao obter última atualização.' }, { status: 500 })
  }
}