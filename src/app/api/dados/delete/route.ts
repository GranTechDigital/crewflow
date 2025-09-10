import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
  try {
    const result = await prisma.funcionario.deleteMany({
      where: {
        matricula: { not: 'ADMIN001' }
      }
    });
    return NextResponse.json({ 
      message: 'Todos os funcionários foram deletados com sucesso!', 
      count: result.count 
    });
  } catch (error) {
    console.error('Erro ao deletar funcionários:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar funcionários.' },
      { status: 500 }
    );
  }
}