import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Buscar todos os funcionários com dados completos (excluindo ADMIN)
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        matricula: {
          not: 'ADMIN001'
        }
      },
      include: {
        contrato: true
      },
    });

    // Buscar apenas o UptimeSheet mais recente por matrícula usando GROUP BY
    const uptimeSheets = await prisma.$queryRaw`
      SELECT 
        u1.matricula,
        u1.status
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

    // Processar dados para os gráficos
    
    // 1. Funcionários por Contrato
    const funcionariosPorContrato: Record<string, number> = {};
    funcionarios.forEach((funcionario) => {
      const contrato = funcionario.contrato?.nome || 'Sem Contrato';
      funcionariosPorContrato[contrato] = (funcionariosPorContrato[contrato] || 0) + 1;
    });

    const funcionariosPorContratoArray = Object.entries(funcionariosPorContrato).map(([contrato, count]) => ({
      contrato,
      count
    }));

    // 2. Funcionários por Status Folha
    const funcionariosPorStatusFolha: Record<string, number> = {};
    funcionarios.forEach((funcionario) => {
      const status = funcionario.status || 'Sem Status';
      funcionariosPorStatusFolha[status] = (funcionariosPorStatusFolha[status] || 0) + 1;
    });

    const funcionariosPorStatusFolhaArray = Object.entries(funcionariosPorStatusFolha).map(([status, count]) => ({
      status,
      count
    }));

    // 3. Funcionários por Status Prestserv (mantém como objeto)
    const funcionariosPorStatusPrestserv: Record<string, number> = {};
    funcionarios.forEach((funcionario) => {
      const status = funcionario.statusPrestserv || 'Sem Status';
      funcionariosPorStatusPrestserv[status] = (funcionariosPorStatusPrestserv[status] || 0) + 1;
    });

    // 4. Funcionários por Função
    const funcionariosPorFuncao: Record<string, number> = {};
    funcionarios.forEach((funcionario) => {
      const funcao = funcionario.funcao || 'Sem Função';
      funcionariosPorFuncao[funcao] = (funcionariosPorFuncao[funcao] || 0) + 1;
    });

    const funcionariosPorFuncaoArray = Object.entries(funcionariosPorFuncao).map(([funcao, count]) => ({
      funcao,
      count
    }));

    // 5. Funcionários por Centro de Custo
    const funcionariosPorCentroCusto: Record<string, number> = {};
    funcionarios.forEach((funcionario) => {
      const centroCusto = funcionario.centroCusto || 'Sem Centro de Custo';
      funcionariosPorCentroCusto[centroCusto] = (funcionariosPorCentroCusto[centroCusto] || 0) + 1;
    });

    const funcionariosPorCentroCustoArray = Object.entries(funcionariosPorCentroCusto).map(([centroCusto, count]) => ({
      centroCusto,
      count
    }));

    // 6. Funcionários por Migração
    const funcionariosPorMigracao: Record<string, number> = {
      'SIM': 0,
      'NÃO': 0
    };
    funcionarios.forEach((funcionario) => {
      const migracao = funcionario.emMigracao ? 'SIM' : 'NÃO';
      funcionariosPorMigracao[migracao]++;
    });

    const funcionariosPorMigracaoArray = Object.entries(funcionariosPorMigracao).map(([migracao, count]) => ({
      migracao,
      count
    }));

    // 7. Funcionários por Status Peoplelog (UptimeSheet)
    const funcionariosPorStatusPeoplelog: Record<string, number> = {};
    funcionarios.forEach((funcionario) => {
      const uptimeSheet = uptimeSheetsMap.get(funcionario.matricula);
      const status = uptimeSheet?.status || 'Sem Status';
      funcionariosPorStatusPeoplelog[status] = (funcionariosPorStatusPeoplelog[status] || 0) + 1;
    });

    const funcionariosPorStatusPeoplelogArray = Object.entries(funcionariosPorStatusPeoplelog).map(([status, count]) => ({
      status,
      count
    }));

    const response = {
      funcionariosPorContrato: funcionariosPorContratoArray,
      funcionariosPorStatusFolha: funcionariosPorStatusFolhaArray,
      funcionariosPorStatusPrestserv: funcionariosPorStatusPrestserv,
      funcionariosPorFuncao: funcionariosPorFuncaoArray,
      funcionariosPorCentroCusto: funcionariosPorCentroCustoArray,
      funcionariosPorMigracao: funcionariosPorMigracaoArray,
      funcionariosPorStatusPeoplelog: funcionariosPorStatusPeoplelogArray,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}