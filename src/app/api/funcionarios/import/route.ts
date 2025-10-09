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

    await prisma.funcionario.deleteMany({
      where: {
        matricula: { not: 'ADMIN001' }
      }
    });
    console.log('Dados antigos removidos do banco (exceto administrador).');

    const dadosParaInserir = dadosExternos.map((item: Record<string, unknown>) => ({
      matricula: String(item.MATRICULA),
      cpf: item.CPF ? String(item.CPF) : null,
      nome: String(item.NOME),
      funcao: item.FUNCAO ? String(item.FUNCAO) : null,
      rg: item.RG ? String(item.RG) : null,
      orgaoEmissor: item['ORGÃO_EMISSOR'] ? String(item['ORGÃO_EMISSOR']) : null,
      uf: item.UF ? String(item.UF) : null,
      dataNascimento: item.DATA_NASCIMENTO ? parseDate(String(item.DATA_NASCIMENTO)) : null,
      email: item.EMAIL ? String(item.EMAIL) : null,
      telefone: item.TELEFONE ? String(item.TELEFONE) : null,
      centroCusto: item.CENTRO_CUSTO ? String(item.CENTRO_CUSTO) : null,
      departamento: item.DEPARTAMENTO ? String(item.DEPARTAMENTO) : null,
      status: item.STATUS ? String(item.STATUS) : null,
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