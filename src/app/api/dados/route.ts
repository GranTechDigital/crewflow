import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        // Excluir o administrador do sistema das listagens
        matricula: {
          not: 'ADMIN001'
        }
      }
    });
    return NextResponse.json(funcionarios);
  } catch (error) {
    console.error('Erro ao buscar funcionários do banco:', error);
    return NextResponse.json({ error: 'Erro ao buscar funcionários.' }, { status: 500 });
  }
}