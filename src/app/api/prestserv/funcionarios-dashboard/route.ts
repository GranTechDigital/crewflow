import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

    // Buscar o UptimeSheet mais recente por matrícula com Prisma (evita problemas de case no SQL)
    const matriculas = funcionarios.map(f => f.matricula);
    const uptimeSheetsAll = await prisma.uptimeSheet.findMany({
      where: {
        matricula: { in: matriculas },
      },
      select: {
        matricula: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Criar um mapa com o registro mais recente por matrícula
    const uptimeSheetsMap = new Map<string, { matricula: string; status: string | null }>();
    for (const sheet of uptimeSheetsAll) {
      if (!uptimeSheetsMap.has(sheet.matricula)) {
        uptimeSheetsMap.set(sheet.matricula, { matricula: sheet.matricula, status: sheet.status ?? null });
      }
    }

    // Processar dados para os gráficos
    
    // 1. Funcionários por Contrato
    const funcionariosPorContrato: Record<string, number> = {};
    funcionarios.forEach((funcionario: typeof funcionarios[0]) => {
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