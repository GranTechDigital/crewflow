import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/utils/authUtils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const usuario = await getUserFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { message: 'Você precisa estar logado para realizar esta ação' },
        { status: 401 }
      );
    }

    // Obter parâmetros da requisição
    const url = new URL(request.url);
    const matricula = url.searchParams.get('matricula');
    const dataReferencia = url.searchParams.get('data') 
      ? new Date(url.searchParams.get('data') as string) 
      : new Date(); // Se não for fornecida, usa a data atual

    if (!matricula) {
      return NextResponse.json(
        { message: 'Matrícula é obrigatória' },
        { status: 400 }
      );
    }

    // Buscar todos os registros do funcionário
    const registros = await prisma.uptimeSheet.findMany({
      where: {
        matricula: matricula
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!registros || registros.length === 0) {
      return NextResponse.json(
        { message: 'Nenhum registro encontrado para esta matrícula' },
        { status: 404 }
      );
    }

    // Buscar dados do funcionário
    const funcionario = await prisma.funcionario.findUnique({
      where: {
        matricula: matricula
      }
    });

    // Processar os registros para encontrar o status atual
    const registrosProcessados = registros.map(registro => {
      // Verificar se o registro é atual (data de referência está entre início e fim)
      const isAtual = (
        (registro.dataInicio === null || dataReferencia >= registro.dataInicio) &&
        (registro.dataFim === null || dataReferencia <= registro.dataFim)
      );
      
      return {
        id: registro.id,
        matricula: registro.matricula,
        dataInicio: registro.dataInicio ? registro.dataInicio.toISOString() : null,
        dataFim: registro.dataFim ? registro.dataFim.toISOString() : null,
        dataAdmissao: registro.dataAdmissao ? registro.dataAdmissao.toISOString() : null,
        dataDemissao: registro.dataDemissao ? registro.dataDemissao.toISOString() : null,
        totalDias: registro.totalDias,
        totalDiasPeriodo: registro.totalDiasPeriodo,
        nome: registro.nome,
        funcao: registro.funcao,
        status: registro.status,
        embarcacao: registro.embarcacao,
        observacoes: registro.observacoes,
        sispat: registro.sispat,
        departamento: registro.departamento,
        centroCusto: registro.centroCusto,
        isAtual
      };
    });

    // Retornar os dados do funcionário e seus registros
    return NextResponse.json({
      funcionario,
      registros: registrosProcessados
    });
  } catch (error: any) {
    console.error('Erro ao buscar dados do funcionário:', error);
    return NextResponse.json(
      { message: `Erro ao buscar dados: ${error.message}` },
      { status: 500 }
    );
  }
}