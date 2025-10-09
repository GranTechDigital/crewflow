import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const funcionarios = await prisma.funcionario.findMany({
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
            numero: true,
            cliente: true
          }
        }
      },
      orderBy: {
        nome: 'asc'
      }
    });

    // Buscar apenas o UptimeSheet mais recente por matrícula usando GROUP BY
    const uptimeSheets = await prisma.$queryRaw`
      SELECT 
        u1.id,
        u1.matricula,
        u1.status,
        u1.nome,
        u1.funcao,
        u1.embarcacao,
        u1.departamento,
        u1.centroCusto,
        u1.dataAdmissao,
        u1.dataDemissao,
        u1.totalDias,
        u1.observacoes,
        u1.createdAt
      FROM UptimeSheet u1
      INNER JOIN (
        SELECT matricula, MAX(createdAt) as max_created
        FROM UptimeSheet
        GROUP BY matricula
      ) u2 ON u1.matricula = u2.matricula AND u1.createdAt = u2.max_created
    ` as Array<{ 
      id: number;
      matricula: string; 
      status: string; 
      nome: string;
      funcao: string;
      embarcacao: string;
      departamento: string;
      centroCusto: string;
      dataAdmissao: Date; 
      dataDemissao: Date; 
      totalDias: number; 
      observacoes: string;
      createdAt: Date;
    }>;

    // Criar um mapa de UptimeSheets por matrícula
    const uptimeSheetsMap = new Map<string, typeof uptimeSheets[0]>();
    uptimeSheets.forEach((sheet: typeof uptimeSheets[0]) => {
      uptimeSheetsMap.set(sheet.matricula, sheet);
    });

    // Mapear os dados para o formato esperado pela interface FuncionarioContrato
    const funcionariosFormatados = funcionarios.map(funcionario => {
      const uptimeSheet = uptimeSheetsMap.get(funcionario.matricula); // Pega o mais recente
      
      return {
        id: funcionario.id.toString(),
        nome: funcionario.nome,
        matricula: funcionario.matricula,
        funcao: funcionario.funcao || '',
        centroCusto: funcionario.centroCusto || '',
        status: funcionario.status || '',
        statusPrestserv: funcionario.statusPrestserv || '',
        emMigracao: funcionario.emMigracao,
        contrato: funcionario.contrato?.nome || null,
        sispat: funcionario.sispat || null,
        // Dados da UptimeSheet (status peoplelog)
        statusPeoplelog: uptimeSheet?.status || null,
      };
    });

    return NextResponse.json(funcionariosFormatados);
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    return NextResponse.json(
      { error: `Erro interno do servidor ${error}` },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}