// src/app/api/funcionarios/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Buscar funcionários com seus contratos
    const funcionarios = await prisma.funcionario.findMany({
      include: {
        contrato: {
          select: {
            id: true,
            numero: true,
            nome: true,
            cliente: true
          }
        }
      }
    });
    
    return NextResponse.json(funcionarios);
  } catch (error) {
    console.error('Erro ao buscar funcionários do banco:', error);
    return NextResponse.json({ error: 'Erro ao buscar funcionários.' }, { status: 500 });
  }
}