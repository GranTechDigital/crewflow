// src/app/api/funcionarios/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const SYNC_INTERVAL_MS = Number(process.env.FUNCIONARIOS_AUTO_SYNC_INTERVAL_MS || 15 * 60 * 1000);
const __GLOBAL_SYNC_STATE__ = (globalThis as any).__FUNCIONARIOS_AUTO_SYNC_STATE__ || { lastRun: 0, inProgress: false };
(globalThis as any).__FUNCIONARIOS_AUTO_SYNC_STATE__ = __GLOBAL_SYNC_STATE__;

export async function GET(request: NextRequest) {
  try {
    // Disparar sincronização automática em background se passou do intervalo
    const origin = new URL(request.url).origin;
    const now = Date.now();
    if (!__GLOBAL_SYNC_STATE__.inProgress && now - __GLOBAL_SYNC_STATE__.lastRun > SYNC_INTERVAL_MS) {
      __GLOBAL_SYNC_STATE__.inProgress = true;
      __GLOBAL_SYNC_STATE__.lastRun = now;
      // Fire-and-forget: não aguardar para não bloquear resposta desta API
      fetch(new URL('/api/funcionarios/sincronizar', origin).toString(), { method: 'POST' })
        .catch((err) => console.error('Auto-sync de funcionários falhou:', err))
        .finally(() => { __GLOBAL_SYNC_STATE__.inProgress = false; });
    }

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
    
    // Buscar funcionários com seus contratos e, se existir, o usuário vinculado (apenas dados essenciais)
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
        },
        usuario: {
          select: {
            id: true,
            equipe: {
              select: {
                id: true,
                nome: true
              }
            }
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
