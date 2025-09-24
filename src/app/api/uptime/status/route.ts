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
    const dataReferencia = url.searchParams.get('data') 
      ? new Date(url.searchParams.get('data') as string) 
      : new Date(); // Se não for fornecida, usa a data atual
    
    // Buscar todos os funcionários
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        status: { not: 'Inativo' }
      },
      select: {
        id: true,
        matricula: true,
        nome: true,
        funcao: true,
        status: true,
        uptimeSheets: true
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Processar os dados de cada funcionário para determinar o status atual
    const funcionariosComStatus = funcionarios.map(funcionario => {
      // Encontrar o registro de uptime válido para a data de referência
      const registrosUptime = funcionario.uptimeSheets;
      let statusAtual = null;
      let dataInicio = null;
      let dataFim = null;
      let embarcacao = null;
      let observacoes = null;
      
      if (registrosUptime && registrosUptime.length > 0) {
        // Verificar cada registro para encontrar o válido para a data de referência
        for (const registro of registrosUptime) {
          // Verificar se o registro é válido para a data de referência
          const isAtual = (
            (registro.dataInicio === null || dataReferencia >= registro.dataInicio) &&
            (registro.dataFim === null || dataReferencia <= registro.dataFim)
          );
          
          if (isAtual) {
            // Extrair status e embarcação
            statusAtual = registro.status;
            dataInicio = registro.dataInicio;
            dataFim = registro.dataFim;
            embarcacao = registro.embarcacao;
            observacoes = registro.observacoes;
            break; // Encontrou o registro atual, não precisa continuar
          }
        }
      }
      
      return {
        id: funcionario.id,
        matricula: funcionario.matricula,
        nome: funcionario.nome,
        funcao: funcionario.funcao,
        statusSistema: funcionario.status,
        statusUptime: statusAtual,
        dataInicio: dataInicio ? dataInicio.toISOString() : null,
        dataFim: dataFim ? dataFim.toISOString() : null,
        embarcacao,
        observacoes
      };
    });

    return NextResponse.json({
      funcionarios: funcionariosComStatus,
      dataReferencia: dataReferencia.toISOString(),
      total: funcionariosComStatus.length
    });
  } catch (error: any) {
    console.error('Erro ao buscar status de Uptime dos funcionários:', error);
    return NextResponse.json(
      { message: `Erro ao buscar dados: ${error.message}` },
      { status: 500 }
    );
  }
}