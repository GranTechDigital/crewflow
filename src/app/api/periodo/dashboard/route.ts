import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    // Estatísticas gerais
    const totalRegistros = await prisma.periodoSheet.count();
    const totalUploads = await prisma.periodoUpload.count();
    
    // Último upload
    const ultimoUpload = await prisma.periodoUpload.findFirst({
      orderBy: { dataUpload: 'desc' }
    });

    // Estatísticas por mês/ano
    const estatisticasPorPeriodo = await prisma.periodoUpload.groupBy({
      by: ['mesReferencia', 'anoReferencia'],
      _count: {
        id: true
      },
      _sum: {
        registros: true,
        atualizados: true,
        naoEncontrados: true
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' }
      ]
    });

    // Estatísticas por status dos funcionários (usando tabela otimizada)
    const estatisticasPorStatusFormatado = await prisma.periodoSheet.groupBy({
      by: ['statusId'],
      _count: {
        id: true
      },
      where: {
        statusId: { not: null },
        ...(ultimoUpload && {
          mesReferencia: ultimoUpload.mesReferencia,
          anoReferencia: ultimoUpload.anoReferencia
        })
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    // Buscar os nomes dos status para o resultado (usando tabela otimizada)
    const statusList = await prisma.status.findMany({
      where: {
        id: {
          in: estatisticasPorStatusFormatado.map(item => item.statusId).filter((id): id is number => id !== null)
        }
      }
    });

    const statusMap = new Map(statusList.map(s => [s.id, s.categoria]));
    
    const estatisticasPorStatusComNomes = estatisticasPorStatusFormatado.map(item => ({
      status: item.statusId ? (statusMap.get(item.statusId) || 'Status não encontrado') : 'Status não definido',
      _count: item._count
    }));

    // Estatísticas por função
    const estatisticasPorFuncao = await prisma.periodoSheet.groupBy({
      by: ['funcao'],
      _count: {
        id: true
      },
      where: {
        funcao: { not: null },
        ...(ultimoUpload && {
          mesReferencia: ultimoUpload.mesReferencia,
          anoReferencia: ultimoUpload.anoReferencia
        })
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Estatísticas por embarcação
    const estatisticasPorEmbarcacao = await prisma.periodoSheet.groupBy({
      by: ['embarcacao'],
      _count: {
        id: true
      },
      where: {
        embarcacao: { not: null },
        ...(ultimoUpload && {
          mesReferencia: ultimoUpload.mesReferencia,
          anoReferencia: ultimoUpload.anoReferencia
        })
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Média de dias trabalhados
    const mediaDias = await prisma.periodoSheet.aggregate({
      _avg: {
        totalDias: true,
        totalDiasPeriodo: true
      },
      where: {
        ...(ultimoUpload && {
          mesReferencia: ultimoUpload.mesReferencia,
          anoReferencia: ultimoUpload.anoReferencia
        })
      }
    });

    // Distribuição de total de dias
    const distribuicaoDias = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN totalDiasPeriodo = 0 THEN '0 dias'
          WHEN totalDiasPeriodo BETWEEN 1 AND 15 THEN '1-15 dias'
          WHEN totalDiasPeriodo BETWEEN 16 AND 30 THEN '16-30 dias'
          WHEN totalDiasPeriodo > 30 THEN '30+ dias'
          ELSE 'Não informado'
        END as faixa,
        COUNT(*) as quantidade
      FROM PeriodoSheet 
      WHERE ${ultimoUpload ? `mesReferencia = ${ultimoUpload.mesReferencia} AND anoReferencia = ${ultimoUpload.anoReferencia}` : '1=1'}
      GROUP BY 
        CASE 
          WHEN totalDiasPeriodo = 0 THEN '0 dias'
          WHEN totalDiasPeriodo BETWEEN 1 AND 15 THEN '1-15 dias'
          WHEN totalDiasPeriodo BETWEEN 16 AND 30 THEN '16-30 dias'
          WHEN totalDiasPeriodo > 30 THEN '30+ dias'
          ELSE 'Não informado'
        END
      ORDER BY 
        CASE 
          WHEN faixa = '0 dias' THEN 1
          WHEN faixa = '1-15 dias' THEN 2
          WHEN faixa = '16-30 dias' THEN 3
          WHEN faixa = '30+ dias' THEN 4
          ELSE 5
        END
    ` as Array<{ faixa: string; quantidade: number }>;

    // Histórico de uploads (últimos 12 meses)
    const historicoUploads = await prisma.periodoUpload.findMany({
      select: {
        mesReferencia: true,
        anoReferencia: true,
        dataUpload: true,
        registros: true,
        atualizados: true,
        naoEncontrados: true
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
        { dataUpload: 'desc' }
      ],
      take: 12
    });

    return NextResponse.json({
      success: true,
      data: {
        resumo: {
          totalRegistros,
          totalUploads,
          ultimoUpload: ultimoUpload ? {
            ...ultimoUpload,
            dataUpload: ultimoUpload.dataUpload.toISOString(),
            dataRelatorio: ultimoUpload.dataRelatorio ? ultimoUpload.dataRelatorio.toISOString() : null,
            periodoInicial: ultimoUpload.periodoInicial.toISOString(),
            periodoFinal: ultimoUpload.periodoFinal.toISOString()
          } : null,
          mediaDias: {
            totalDias: mediaDias._avg.totalDias || 0,
            totalDiasPeriodo: mediaDias._avg.totalDiasPeriodo || 0
          }
        },
        estatisticas: {
          porPeriodo: estatisticasPorPeriodo,
          porStatus: estatisticasPorStatusComNomes,
          porFuncao: estatisticasPorFuncao,
          porEmbarcacao: estatisticasPorEmbarcacao,
          distribuicaoDias
        },
        historico: historicoUploads.map(upload => ({
          ...upload,
          dataUpload: upload.dataUpload.toISOString()
        }))
      }
    });
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard de período:", error);
    return NextResponse.json(
      { 
        message: "Erro interno do servidor", 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}