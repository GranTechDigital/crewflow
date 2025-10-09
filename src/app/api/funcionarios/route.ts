// src/app/api/funcionarios/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'alocacao', 'realocacao' ou 'desligamento'
    
    const whereClause: Prisma.FuncionarioWhereInput = {
      // Excluir o administrador do sistema das listagens
      matricula: {
        not: 'ADMIN001'
      },
      // Excluir funcionários que estão em processo de migração
      emMigracao: false
    };
    
    if (tipo === 'alocacao') {
      // Para alocação: funcionários com statusPrestserv SEM_CADASTRO
      whereClause.statusPrestserv = 'SEM_CADASTRO';
    } else if (tipo === 'realocacao') {
      // Para realocação: funcionários com statusPrestserv ATIVO ou INATIVO
      whereClause.statusPrestserv = {
        in: ['ATIVO', 'INATIVO']
      };
    } else if (tipo === 'desligamento') {
      // Para desligamento: apenas funcionários com statusPrestserv ATIVO
      whereClause.statusPrestserv = 'ATIVO';
    } else {
      // Se não especificar tipo, excluir apenas funcionários em migração
      whereClause.statusPrestserv = {
        not: 'EM_MIGRACAO'
      };
    }
    
    // Buscar funcionários com seus contratos
    const funcionarios = await prisma.funcionario.findMany({
      where: whereClause,
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