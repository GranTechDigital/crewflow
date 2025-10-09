// src/app/api/funcionarios/leitura/route.ts

import { NextResponse } from 'next/server';

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

export async function GET() {
  const url = "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
  const headers = {
    Authorization: 'Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==',
    Accept: 'application/json',
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error('Erro na resposta externa:', response.status, response.statusText);
      return NextResponse.json({ error: 'Erro ao buscar dados externos.' }, { status: response.status });
    }

    const json = await response.json();

    console.log('Resposta da API externa:', json);

    // Verifique aqui o caminho correto dos dados dentro do json
    // Por exemplo, se os dados estiverem em json.data ou json.resultados
    // Ajuste conforme a estrutura real

    const dadosBrutos = json?.data || json?.resultados || json; // ajuste conforme resposta real

    // Exemplo mapeamento, ajuste os campos conforme sua resposta
    const funcionarios = (Array.isArray(dadosBrutos) ? dadosBrutos : []).map((item: Record<string, unknown>) => ({
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
    }));

    return NextResponse.json(funcionarios);
  } catch (error) {
    console.error('Erro na chamada externa:', error);
    return NextResponse.json({ error: 'Erro ao buscar funcionários.' }, { status: 500 });
  }
}