import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromRequest } from '@/utils/authUtils';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Token de autenticação necessário' }, { status: 401 });
    }

    // Obter parâmetros de filtro
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');
    const regime = searchParams.get('regime'); // 'offshore' ou 'onshore'
    const projetos = searchParams.get('projetos'); // IDs separados por vírgula
    const status = searchParams.get('status'); // IDs separados por vírgula
    const statusFolha = searchParams.get('statusFolha'); // Status da folha específico

    // Construir filtros
    const whereClause: any = {};
    
    if (mes && ano) {
      whereClause.mesReferencia = parseInt(mes);
      whereClause.anoReferencia = parseInt(ano);
    }

    // Filtro de regime de trabalho (usando coluna otimizada)
    if (regime) {
      if (regime === 'offshore') {
        whereClause.regimeTratado = 'OFFSHORE';
      } else if (regime === 'onshore') {
        whereClause.regimeTratado = 'ONSHORE';
      }
    }

    // Filtro de projetos (usando tabela otimizada)
    if (projetos) {
      const projetoIds = projetos.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (projetoIds.length > 0) {
        whereClause.projetoId = { in: projetoIds };
      }
    }

    // Filtro de status (usando tabela otimizada)
    if (status) {
      const statusIds = status.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (statusIds.length > 0) {
        whereClause.statusId = { in: statusIds };
      }
    }

    // Filtro de status da folha
    if (statusFolha) {
      const statusFolhaValues = statusFolha.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (statusFolhaValues.length > 0) {
        whereClause.statusFolha = { in: statusFolhaValues };
      }
    }

    // Buscar dados de período com relacionamentos otimizados
    const dadosPeriodo = await prisma.periodoSheet.findMany({
      where: whereClause,
      include: {
        status: true,
        projeto: true
      }
    });

    console.log(`📊 Total de registros encontrados: ${dadosPeriodo.length}`);

    // NOVA LÓGICA: Agrupar dados APENAS por projeto e status (soma direta do totalDiasPeriodo)
    const dadosAgrupados: { 
      [projeto: string]: { 
        [statusMapeado: string]: {
          totalDias: number;
          funcionarios: Set<string>;
        }
      } 
    } = {};
    
    dadosPeriodo.forEach(registro => {
      const projeto = registro.projeto?.nome || 'Projeto não encontrado';
      const statusMapeado = registro.status?.categoria || 'Status não encontrado';
      const matricula = registro.matricula;
      const totalDiasPeriodo = registro.totalDiasPeriodo || 0;

      if (!dadosAgrupados[projeto]) {
        dadosAgrupados[projeto] = {};
      }

      if (!dadosAgrupados[projeto][statusMapeado]) {
        dadosAgrupados[projeto][statusMapeado] = {
          totalDias: 0,
          funcionarios: new Set()
        };
      }

      // SOMA DIRETA do totalDiasPeriodo (sem agrupar por funcionário)
      dadosAgrupados[projeto][statusMapeado].totalDias += totalDiasPeriodo;
      dadosAgrupados[projeto][statusMapeado].funcionarios.add(matricula);
    });
    
    // Converter para formato de resposta
    const resultado = Object.entries(dadosAgrupados).map(([projeto, statusData]) => {
      const statusTotais: { [status: string]: { totalDias: number, totalFuncionarios: number } } = {};
      
      Object.entries(statusData).forEach(([status, dados]) => {
        statusTotais[status] = {
          totalDias: dados.totalDias,
          totalFuncionarios: dados.funcionarios.size
        };
      });

      // Calcular totais gerais do projeto
      const totalGeralDias = Object.values(statusTotais).reduce((sum, s) => sum + s.totalDias, 0);
      
      // Contar funcionários únicos no projeto
      const funcionariosUnicos = new Set<string>();
      Object.values(statusData).forEach(dados => {
        dados.funcionarios.forEach(matricula => funcionariosUnicos.add(matricula));
      });

      return {
        projeto,
        statusTotais,
        totalGeralDias,
        totalGeralFuncionarios: funcionariosUnicos.size
      };
    });

    // Ordenar por total de dias (maior para menor)
    resultado.sort((a, b) => b.totalGeralDias - a.totalGeralDias);

    // Buscar todos os status mapeados únicos para as colunas
    const statusUnicos = Array.from(
      new Set(dadosPeriodo.map(r => 
        r.status?.categoria || 'Status não encontrado'
      ).filter(Boolean))
    ).sort();

    // Buscar períodos disponíveis para o filtro
    const periodosDisponiveis = await prisma.periodoUpload.findMany({
      select: {
        mesReferencia: true,
        anoReferencia: true
      },
      distinct: ['mesReferencia', 'anoReferencia'],
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' }
      ]
    });

    // Calcular totais gerais
    const totaisGerais = statusUnicos.reduce((acc, status) => {
      // Para dias, podemos somar normalmente
      const totalDias = resultado.reduce((sum, projeto) => 
        sum + (projeto.statusTotais[status]?.totalDias || 0), 0);
      
      // Para funcionários, precisamos contar únicos por status
      const funcionariosUnicos = new Set<string>();
      dadosPeriodo.forEach(registro => {
        const statusMapeado = registro.status?.categoria || 'Status não encontrado';
        if (statusMapeado === status) {
          funcionariosUnicos.add(registro.matricula);
        }
      });
      
      acc[status] = {
        totalDias,
        totalFuncionarios: funcionariosUnicos.size
      };
      return acc;
    }, {} as { [status: string]: { totalDias: number, totalFuncionarios: number } });

    // Buscar opções para os filtros (sem aplicar filtros para ter todas as opções)
    // Buscar projetos únicos
    const projetosRaw = await prisma.projeto.findMany({
      select: {
        id: true,
        nome: true
      },
      orderBy: { nome: 'asc' }
    });

    // Converter para formato esperado pela interface
    const todosProjetos = projetosRaw.map(projeto => ({
      id: projeto.id,
      projeto: projeto.nome
    }));

    // Buscar status únicos dos funcionários que aparecem nos dados do período
    const statusRaw = await prisma.status.findMany({
      where: {
        periodoSheets: {
          some: {} // Apenas status que têm pelo menos um registro em PeriodoSheet
        }
      },
      select: {
        id: true,
        categoria: true
      },
      orderBy: { categoria: 'asc' }
    });

    // Remover duplicatas por categoria de status
    const statusUnicosMap = new Map();
    statusRaw.forEach(status => {
      if (!statusUnicosMap.has(status.categoria)) {
        statusUnicosMap.set(status.categoria, status);
      }
    });
    const todosStatus = Array.from(statusUnicosMap.values());

    // Buscar valores únicos de statusFolha
    const statusFolhaUnicos = await prisma.periodoSheet.findMany({
      where: {
        statusFolha: {
          not: null
        }
      },
      select: {
        statusFolha: true
      },
      distinct: ['statusFolha'],
      orderBy: {
        statusFolha: 'asc'
      }
    });

    const todosStatusFolha = statusFolhaUnicos
      .map(item => item.statusFolha)
      .filter(status => status && status.trim().length > 0);

    return NextResponse.json({
      dados: resultado,
      statusDisponiveis: statusUnicos,
      periodosDisponiveis,
      totaisGerais,
      filtroAtual: { 
        mes: mes ? parseInt(mes) : null, 
        ano: ano ? parseInt(ano) : null,
        regime,
        projetos: projetos ? projetos.split(',').map(id => parseInt(id.trim())) : [],
        status: status ? status.split(',').map(id => parseInt(id.trim())) : [],
        statusFolha: statusFolha ? statusFolha.split(',').map(s => s.trim()) : []
      },
      opcoesFiltros: {
        projetos: todosProjetos,
        status: todosStatus,
        statusFolha: todosStatusFolha,
        regimes: ['Offshore', 'Onshore']
      },
      resumo: {
        totalProjetos: resultado.length,
        totalRegistros: dadosPeriodo.length,
        totalDiasGeral: resultado.reduce((sum, p) => sum + p.totalGeralDias, 0),
        totalFuncionariosGeral: new Set(dadosPeriodo.map(r => r.matricula)).size
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard de projetos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}