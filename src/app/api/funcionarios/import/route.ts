// src/app/api/funcionarios/import/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

export async function POST() {
  try {
    console.log('Iniciando importação de funcionários externos...')

    const url = "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
    const headers = {
      Authorization: 'Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==',
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error('Erro na API externa:', response.status, response.statusText);
      return NextResponse.json({ error: 'Erro ao buscar dados da API externa.' }, { status: response.status });
    }

    const dadosExternos = await response.json();
    console.log(`Dados externos recebidos: ${Array.isArray(dadosExternos) ? dadosExternos.length : 'não é array'}`);

    if (!Array.isArray(dadosExternos)) {
      return NextResponse.json({ error: 'Formato de dados inválido recebido da API externa.' }, { status: 500 });
    }

    const now = new Date();

    await prisma.funcionario.deleteMany();
    console.log('Dados antigos removidos do banco.');

    const dadosParaInserir = dadosExternos.map((item: any) => ({
      matricula: item.MATRICULA,
      cpf: item.CPF,
      nome: item.NOME,
      funcao: item.FUNCAO,
      rg: item.RG,
      orgaoEmissor: item['ORGÃO_EMISSOR'],
      uf: item.UF,
      dataNascimento: item.DATA_NASCIMENTO ? parseDate(item.DATA_NASCIMENTO) : null,
      email: item.EMAIL,
      telefone: item.TELEFONE,
      centroCusto: item.CENTRO_CUSTO,
      departamento: item.DEPARTAMENTO,
      status: item.STATUS,
      criadoEm: now,
      excluidoEm: null,
    }));

    console.log(`Preparando para inserir ${dadosParaInserir.length} registros no banco.`);

    await prisma.funcionario.createMany({
      data: dadosParaInserir,
    });

    console.log('Importação concluída com sucesso.');

    return NextResponse.json({ message: 'Importação concluída com sucesso!' });
  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json(
      { error: 'Erro interno ao importar dados.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}