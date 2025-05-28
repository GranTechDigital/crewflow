import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

export async function POST() {
  try {
    // Buscar dados da API externa
    const url = "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
    const headers = { Authorization: 'Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==' };
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return NextResponse.json({ error: 'Erro ao buscar dados da API externa.' }, { status: response.status });
    }

    const dadosExternos = await response.json();

    // Buscar dados atuais do banco
    const dadosBanco = await prisma.funcionario.findMany();

    const now = new Date();

    // Criar maps para facilitar a comparação por matrícula
    const mapApi = new Map<string, any>();
    dadosExternos.forEach((item: any) => mapApi.set(item.MATRICULA, item));

    const mapBanco = new Map<string, any>();
    dadosBanco.forEach((item) => mapBanco.set(item.matricula, item));

    // 1) Atualizar status para "DEMITIDO" para funcionários que tem no banco mas NÃO tem na API
    const matriculasParaDemitir = dadosBanco
      .filter(f => !mapApi.has(f.matricula) && f.status !== 'DEMITIDO')
      .map(f => f.matricula);

    if (matriculasParaDemitir.length > 0) {
      await prisma.funcionario.updateMany({
        where: { matricula: { in: matriculasParaDemitir } },
        data: {
          status: 'DEMITIDO',
          atualizadoEm: now,
          excluidoEm: now,
        },
      });
    }

    // 2) Inserir funcionários que tem na API mas NÃO tem no banco
    const novosFuncionarios = dadosExternos.filter((item: any) => !mapBanco.has(item.MATRICULA));

    if (novosFuncionarios.length > 0) {
      const dadosParaInserir = novosFuncionarios.map((item: any) => ({
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
        atualizadoEm: now,
        excluidoEm: null,
      }));

      await prisma.funcionario.createMany({ data: dadosParaInserir });
    }

    // 3) Atualizar funcionários cujo status mudou de "ADMISSÃO PROX.MÊS" para "ATIVO"
    // e também atualizar status se mudou na API (exceto casos já tratados acima)
    const paraAtualizar: any[] = [];

    dadosBanco.forEach((func) => {
      const dadosApi = mapApi.get(func.matricula);
      if (!dadosApi) return;

      const statusApi = dadosApi.STATUS;
      const statusBanco = func.status;

      // Se status é diferente e não é "DEMITIDO" (que já tratamos)
      if (statusBanco !== statusApi && statusApi !== 'DEMITIDO') {
        // Se mudou de ADMISSÃO PROX.MÊS para ATIVO, atualizar atualizadoEm
        if (statusBanco === 'ADMISSÃO PROX.MÊS' && statusApi === 'ATIVO') {
          paraAtualizar.push({
            matricula: func.matricula,
            status: 'ATIVO',
            atualizadoEm: now,
            excluidoEm: null,
          });
        } else {
          // Qualquer outra mudança de status que não demitido, só atualiza status e atualizadoEm
          paraAtualizar.push({
            matricula: func.matricula,
            status: statusApi,
            atualizadoEm: now,
            excluidoEm: null,
          });
        }
      }
    });

    // Atualizar os registros
    for (const f of paraAtualizar) {
      await prisma.funcionario.update({
        where: { matricula: f.matricula },
        data: {
          status: f.status,
          atualizadoEm: f.atualizadoEm,
          excluidoEm: f.excluidoEm,
        },
      });
    }

    return NextResponse.json({
      message: 'Sincronização concluída',
      demitidos: matriculasParaDemitir.length,
      adicionados: novosFuncionarios.length,
      atualizados: paraAtualizar.length,
    });
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return NextResponse.json({ error: 'Erro interno na sincronização.' }, { status: 500 });
  }
}
