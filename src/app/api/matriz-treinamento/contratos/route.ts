import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/utils/authUtils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    // Buscar contratos com informações completas
    const contratos = await prisma.contrato.findMany({
      select: {
        id: true,
        nome: true,
        numero: true,
        cliente: true,
        status: true,
        dataInicio: true,
        dataFim: true,
        _count: {
          select: {
            matrizTreinamento: true
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Para cada contrato, buscar as funções com treinamentos
    const contratosComFuncoes = await Promise.all(
      contratos.map(async (contrato) => {
        const funcoes = await prisma.funcao.findMany({
          where: {
            matrizTreinamento: {
              some: {
                contratoId: contrato.id
              }
            }
          },
          select: {
            id: true,
            funcao: true,
            _count: {
              select: {
                matrizTreinamento: {
                  where: {
                    contratoId: contrato.id
                  }
                }
              }
            }
          },
          orderBy: {
            funcao: 'asc'
          },
          take: 5 // Limitar para performance
        });

        const totalFuncoes = await prisma.funcao.count({
          where: {
            matrizTreinamento: {
              some: {
                contratoId: contrato.id
              }
            }
          }
        });

        return {
          ...contrato,
          funcoes,
          totalFuncoes,
          dataInicio: contrato.dataInicio ? new Date(contrato.dataInicio).toISOString().split('T')[0] : null,
          dataFim: contrato.dataFim ? new Date(contrato.dataFim).toISOString().split('T')[0] : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: contratosComFuncoes,
      total: contratos.length
    });

  } catch (error) {
    console.error('Erro ao buscar contratos:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', message: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}