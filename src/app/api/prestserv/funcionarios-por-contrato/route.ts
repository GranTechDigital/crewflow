import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Extrair parâmetros de query
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const statusPrestserv = searchParams.get('statusPrestserv') || '';
    const funcao = searchParams.get('funcao') || '';
    const centroCusto = searchParams.get('centroCusto') || '';
    const remanejamento = searchParams.get('remanejamento') || '';
    const migracao = searchParams.get('migracao') || '';
    const contrato = searchParams.get('contrato') || '';
    const isExport = searchParams.get('export') === 'true'; // Flag para exportação

    // Construir filtros para Prisma
    const whereClause: any = {
      // Excluir o administrador do sistema das listagens
      matricula: {
        not: 'ADMIN001'
      }
    };

    // Aplicar filtros
    if (search) {
      whereClause.OR = [
        { nome: { contains: search } },
        { matricula: { contains: search } }
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    if (statusPrestserv) {
      whereClause.statusPrestserv = statusPrestserv;
    }

    if (funcao) {
      whereClause.funcao = { contains: funcao };
    }

    if (centroCusto) {
      whereClause.centroCusto = centroCusto;
    }

    if (remanejamento === 'sim') {
      whereClause.emMigracao = true;
    } else if (remanejamento === 'nao') {
      whereClause.emMigracao = false;
    }

    if (migracao === 'true') {
      whereClause.emMigracao = true;
    } else if (migracao === 'false') {
      whereClause.emMigracao = false;
    }

    if (contrato) {
      if (contrato === 'Sem contrato') {
        whereClause.contrato = null;
      } else {
        whereClause.contrato = {
          nome: contrato
        };
      }
    }

    // Contar total de funcionários que atendem aos filtros
    const totalFuncionarios = await prisma.funcionario.count({
      where: whereClause
    });

    // Calcular paginação (apenas se não for exportação)
    let totalPages = 1;
    let skip = 0;
    let take = undefined;
    
    if (!isExport) {
      totalPages = Math.ceil(totalFuncionarios / limit);
      skip = (page - 1) * limit;
      take = limit;
    }

    // Buscar funcionários com filtros e paginação (se aplicável)
    const funcionariosFiltrados = await prisma.funcionario.findMany({
      where: whereClause,
      include: {
        contrato: {
          select: {
            id: true,
            nome: true,
            cliente: true,
          }
        }
      },
      skip: skip,
      take: take,
      orderBy: {
        nome: 'asc'
      }
    });

    // Buscar todos os funcionários com os mesmos filtros para calcular dados dos contratos
    const todosFuncionarios = await prisma.funcionario.findMany({
      where: whereClause,
      include: {
        contrato: {
          select: {
            id: true,
            nome: true,
            cliente: true,
          }
        }
      }
    });

    // Buscar todos os funcionários (sem filtros) para calcular dados originais dos contratos
    const todosFuncionariosOriginais = await prisma.funcionario.findMany({
      where: {
        matricula: {
          not: 'ADMIN001'
        }
      },
      include: {
        contrato: {
          select: {
            id: true,
            nome: true,
            cliente: true,
          }
        }
      }
    });

    // Buscar apenas o UptimeSheet mais recente por matrícula usando GROUP BY
    const uptimeSheets = await prisma.$queryRaw`
      SELECT 
        u1.matricula,
        u1.status,
        u1.dataInicio,
        u1.dataFim,
        u1.totalDiasPeriodo,
        u1.embarcacao,
        u1.observacoes
      FROM UptimeSheet u1
      INNER JOIN (
        SELECT matricula, MAX(createdAt) as max_created
        FROM UptimeSheet
        GROUP BY matricula
      ) u2 ON u1.matricula = u2.matricula AND u1.createdAt = u2.max_created
    `;

    // Criar um mapa de UptimeSheets por matrícula
    const uptimeSheetsMap = new Map();
    uptimeSheets.forEach(sheet => {
      uptimeSheetsMap.set(sheet.matricula, sheet);
    });

    // Agrupar funcionários por contrato atual (não de destino)
    const contratoMap = new Map();
    const contratoMapOriginal = new Map();

    // Processar todos os funcionários para dados dos contratos
    todosFuncionarios.forEach(funcionario => {
      // Determinar o contrato atual do funcionário
      const contratoAtual = funcionario.contrato;
      const contratoId = contratoAtual ? contratoAtual.id : 'sem_contrato';
      const contratoNome = contratoAtual ? contratoAtual.nome : 'Sem contrato';
      const contratoCliente = contratoAtual ? contratoAtual.cliente : '-';
      
      // Criar entrada no mapa se não existir
      if (!contratoMap.has(contratoId)) {
        contratoMap.set(contratoId, {
          contratoId: contratoId,
          contratoNome: contratoNome,
          contratoCliente: contratoCliente,
          funcionarios: [],
          totalFuncionarios: 0,
          funcionariosAprovados: 0,
          funcionariosPendentes: 0,
          funcionariosRejeitados: 0,
        });
      }

      const contratoData = contratoMap.get(contratoId);
      
      // Usar dados diretamente da tabela Funcionario
      const statusPrestserv = funcionario.statusPrestserv || 'SEM_CADASTRO';
      const emMigracao = funcionario.emMigracao || false;

      const uptimeSheet = uptimeSheetsMap.get(funcionario.matricula);
      
      const funcionarioData = {
        id: funcionario.id,
        nome: funcionario.nome,
        sispat: funcionario.sispat,
        matricula: funcionario.matricula,
        funcao: funcionario.funcao,
        centroCusto: funcionario.centroCusto,
        status: funcionario.status, // Status geral do funcionário (ATIVO, INATIVO, etc.)
        statusPrestserv: statusPrestserv,
        emMigracao: emMigracao, // Campo que indica se está em processo de migração/remanejamento
        statusPeoplelog: uptimeSheet?.status || null, // Status da UptimeSheet
        dataInicio: uptimeSheet?.dataInicio || null,
        dataFim: uptimeSheet?.dataFim || null,
        totalDiasPeriodo: uptimeSheet?.totalDiasPeriodo || null,
        embarcacao: uptimeSheet?.embarcacao || null,
        observacoes: uptimeSheet?.observacoes || null,
        // Novas colunas de período
        periodoInicial: uptimeSheet?.periodoInicial || null,
        periodoFinal: uptimeSheet?.periodoFinal || null,
      };

      contratoData.funcionarios.push(funcionarioData);
      contratoData.totalFuncionarios++;

      // Contar por statusPrestserv do funcionário
      switch (statusPrestserv) {
        case 'ATIVO':
          contratoData.funcionariosAprovados++;
          break;
        case 'EM_MIGRACAO':
          contratoData.funcionariosPendentes++;
          break;
        case 'INATIVO':
          contratoData.funcionariosRejeitados++;
          break;
        case 'SEM_CADASTRO':
        default:
          // Funcionários sem cadastro não são contados em nenhuma categoria específica
          break;
      }
    });

    // Processar todos os funcionários originais para dados dos contratos originais
    todosFuncionariosOriginais.forEach(funcionario => {
      // Determinar o contrato atual do funcionário
      const contratoAtual = funcionario.contrato;
      const contratoId = contratoAtual ? contratoAtual.id : 'sem_contrato';
      const contratoNome = contratoAtual ? contratoAtual.nome : 'Sem contrato';
      const contratoCliente = contratoAtual ? contratoAtual.cliente : '-';
      
      // Criar entrada no mapa se não existir
      if (!contratoMapOriginal.has(contratoId)) {
        contratoMapOriginal.set(contratoId, {
          contratoId: contratoId,
          contratoNome: contratoNome,
          contratoCliente: contratoCliente,
          totalFuncionarios: 0,
          funcionariosAprovados: 0,
          funcionariosPendentes: 0,
          funcionariosRejeitados: 0,
        });
      }

      const contratoDataOriginal = contratoMapOriginal.get(contratoId);
      
      // Usar dados diretamente da tabela Funcionario
      const statusPrestserv = funcionario.statusPrestserv || 'SEM_CADASTRO';

      contratoDataOriginal.totalFuncionarios++;

      // Contar por statusPrestserv do funcionário
      switch (statusPrestserv) {
        case 'ATIVO':
          contratoDataOriginal.funcionariosAprovados++;
          break;
        case 'EM_MIGRACAO':
          contratoDataOriginal.funcionariosPendentes++;
          break;
        case 'INATIVO':
          contratoDataOriginal.funcionariosRejeitados++;
          break;
        case 'SEM_CADASTRO':
        default:
          // Funcionários sem cadastro não são contados em nenhuma categoria específica
          break;
      }
    });

    // Buscar todos os contratos para incluir os vazios
    const todosContratos = await prisma.contrato.findMany({
      select: {
        id: true,
        nome: true,
        cliente: true,
      }
    });

    // Adicionar contratos vazios ao mapa filtrado
    todosContratos.forEach(contrato => {
      if (!contratoMap.has(contrato.id)) {
        contratoMap.set(contrato.id, {
          contratoId: contrato.id,
          contratoNome: contrato.nome,
          contratoCliente: contrato.cliente,
          funcionarios: [],
          totalFuncionarios: 0,
          funcionariosAprovados: 0,
          funcionariosPendentes: 0,
          funcionariosRejeitados: 0,
        });
      }
    });

    // Adicionar contratos vazios ao mapa original
    todosContratos.forEach(contrato => {
      if (!contratoMapOriginal.has(contrato.id)) {
        contratoMapOriginal.set(contrato.id, {
          contratoId: contrato.id,
          contratoNome: contrato.nome,
          contratoCliente: contrato.cliente,
          totalFuncionarios: 0,
          funcionariosAprovados: 0,
          funcionariosPendentes: 0,
          funcionariosRejeitados: 0,
        });
      }
    });

    // Garantir que o contrato "Sem contrato" sempre apareça, mesmo quando filtrado
    if (!contratoMap.has('sem_contrato')) {
      contratoMap.set('sem_contrato', {
        contratoId: 'sem_contrato',
        contratoNome: 'Sem contrato',
        contratoCliente: '-',
        funcionarios: [],
        totalFuncionarios: 0,
        funcionariosAprovados: 0,
        funcionariosPendentes: 0,
        funcionariosRejeitados: 0,
      });
    }

    // Converter Map para Array, combinar com dados originais e ordenar por nome do contrato
    const contratos = Array.from(contratoMap.values()).map(contrato => {
      const contratoOriginal = contratoMapOriginal.get(contrato.contratoId);
      return {
        ...contrato,
        totalOriginal: contratoOriginal ? contratoOriginal.totalFuncionarios : 0,
        aprovadosOriginal: contratoOriginal ? contratoOriginal.funcionariosAprovados : 0,
        pendentesOriginal: contratoOriginal ? contratoOriginal.funcionariosPendentes : 0,
        rejeitadosOriginal: contratoOriginal ? contratoOriginal.funcionariosRejeitados : 0,
      };
    }).sort((a, b) => {
      // Garantir que "Sem contrato" apareça sempre por último
      if (a.contratoId === 'sem_contrato') return 1;
      if (b.contratoId === 'sem_contrato') return -1;
      return a.contratoNome.localeCompare(b.contratoNome);
    });

    // Ordenar funcionários dentro de cada contrato por nome
    contratos.forEach(contrato => {
      contrato.funcionarios.sort((a, b) => a.nome.localeCompare(b.nome));
    });

    // Se for exportação, retornar apenas os funcionários sem dados de contratos e paginação
    if (isExport) {
      return NextResponse.json({
        funcionarios: funcionariosFiltrados,
        totalItems: totalFuncionarios
      });
    }

    return NextResponse.json({
      funcionarios: funcionariosFiltrados,
      contratos: contratos,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalFuncionarios,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Erro ao buscar funcionários por contrato:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}