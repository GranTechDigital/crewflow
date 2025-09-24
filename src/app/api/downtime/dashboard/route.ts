import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUserFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { message: "Você precisa estar logado para acessar esta página" },
        { status: 401 }
      );
    }

    // Buscar todos os dados de downtime
    const dados = await prisma.downtimeSheet.findMany({
      orderBy: { codProjeto: 'asc' }
    });

    // Buscar a data de upload mais recente
    const ultimoUpload = await prisma.downtimeSheet.findFirst({
      orderBy: { dataUpload: 'desc' },
      select: {
        dataUpload: true,
        nomeArquivo: true,
        uploadPor: true
      }
    });

    // Calcular estatísticas gerais
    const stats = await prisma.downtimeSheet.aggregate({
      _avg: {
        uptime: true,
        downtime: true,
        percentAgEmbarque: true,
        percentCadastro: true,
        percentMedicina: true,
        percentTreinamento: true,
        percentAtestado: true,
        percentFalta: true,
        percentDemissao: true
      },
      _sum: {
        agEmbarque: true,
        cadastro: true,
        medicina: true,
        treinamento: true,
        atestado: true,
        falta: true,
        demissao: true
      },
      _count: {
        id: true
      }
    });

    // Calcular distribuição por categoria de downtime
    const distribuicaoDowntime = dados.map(projeto => ({
      nome: projeto.nomeProjeto,
      codigo: projeto.codProjeto,
      agEmbarque: projeto.agEmbarque || 0,
      cadastro: projeto.cadastro || 0,
      medicina: projeto.medicina || 0,
      treinamento: projeto.treinamento || 0,
      atestado: projeto.atestado || 0,
      falta: projeto.falta || 0,
      demissao: projeto.demissao || 0,
      percentAgEmbarque: (projeto.percentAgEmbarque || 0) * 100,
      percentCadastro: (projeto.percentCadastro || 0) * 100,
      percentMedicina: (projeto.percentMedicina || 0) * 100,
      percentTreinamento: (projeto.percentTreinamento || 0) * 100,
      percentAtestado: (projeto.percentAtestado || 0) * 100,
      percentFalta: (projeto.percentFalta || 0) * 100,
      percentDemissao: (projeto.percentDemissao || 0) * 100,
      uptime: (projeto.uptime || 0) * 100,
      downtime: (projeto.downtime || 0) * 100
    }));

    // Top 5 projetos com maior downtime
    const topDowntime = dados
      .sort((a, b) => (b.downtime || 0) - (a.downtime || 0))
      .slice(0, 5)
      .map(p => ({
        nome: p.nomeProjeto,
        codigo: p.codProjeto,
        downtime: (p.downtime || 0) * 100,
        uptime: (p.uptime || 0) * 100
      }));

    // Totais por categoria
    const totaisPorCategoria = {
      agEmbarque: stats._sum.agEmbarque || 0,
      cadastro: stats._sum.cadastro || 0,
      medicina: stats._sum.medicina || 0,
      treinamento: stats._sum.treinamento || 0,
      atestado: stats._sum.atestado || 0,
      falta: stats._sum.falta || 0,
      demissao: stats._sum.demissao || 0
    };

    // Médias gerais
    const medias = {
      uptime: (stats._avg.uptime || 0) * 100,
      downtime: (stats._avg.downtime || 0) * 100,
      percentAgEmbarque: (stats._avg.percentAgEmbarque || 0) * 100,
      percentCadastro: (stats._avg.percentCadastro || 0) * 100,
      percentMedicina: (stats._avg.percentMedicina || 0) * 100,
      percentTreinamento: (stats._avg.percentTreinamento || 0) * 100,
      percentAtestado: (stats._avg.percentAtestado || 0) * 100,
      percentFalta: (stats._avg.percentFalta || 0) * 100,
      percentDemissao: (stats._avg.percentDemissao || 0) * 100
    };

    return NextResponse.json({
      success: true,
      data: {
        projetos: distribuicaoDowntime,
        topDowntime,
        totaisPorCategoria,
        medias,
        totalProjetos: stats._count.id || 0,
        ultimaAtualizacao: dados.length > 0 ? dados[0].createdAt : null,
        ultimoUpload: ultimoUpload ? {
          dataUpload: ultimoUpload.dataUpload,
          nomeArquivo: ultimoUpload.nomeArquivo,
          uploadPor: ultimoUpload.uploadPor
        } : null
      }
    });

  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}