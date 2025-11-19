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

    // Em vez de apagar (o que pode apagar usuários por cascata),
    // marcamos como DEMITIDO quem não está na fonte e fazemos upsert dos demais
    const existentes = await prisma.funcionario.findMany({
      select: { id: true, matricula: true, status: true }
    });
    const setApi = new Set<string>(dadosExternos.map((i: any) => String(i.MATRICULA)));
    const now = new Date();
    const paraDemitir = existentes
      .filter(f => !setApi.has(f.matricula) && f.matricula !== 'ADMIN001' && f.status !== 'DEMITIDO')
      .map(f => f.matricula);
    if (paraDemitir.length > 0) {
      await prisma.funcionario.updateMany({
        where: { matricula: { in: paraDemitir } },
        data: { status: 'DEMITIDO', atualizadoEm: now, excluidoEm: now }
      });
    }
    console.log(`Marcados como DEMITIDO: ${paraDemitir.length}`);

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

    // Upsert: atualizar existentes e criar novos
    let atualizados = 0;
    let criados = 0;
    for (const d of dadosParaInserir) {
      const found = existentes.find(e => e.matricula === d.matricula);
      if (found) {
        await prisma.funcionario.update({
          where: { matricula: d.matricula },
          data: {
            cpf: d.cpf,
            nome: d.nome,
            funcao: d.funcao,
            rg: d.rg,
            orgaoEmissor: d.orgaoEmissor as any,
            uf: d.uf as any,
            dataNascimento: d.dataNascimento as any,
            email: d.email as any,
            telefone: d.telefone as any,
            centroCusto: d.centroCusto as any,
            departamento: d.departamento as any,
            status: d.status as any,
            atualizadoEm: now,
            excluidoEm: null,
          }
        });
        atualizados++;
      } else {
        await prisma.funcionario.create({ data: d as any });
        criados++;
      }
    }

    console.log('Importação concluída com sucesso.');

    return NextResponse.json({ message: 'Importação concluída com sucesso!', criados, atualizados, demitidos: paraDemitir.length });
  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json(
      { error: 'Erro interno ao importar dados.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}