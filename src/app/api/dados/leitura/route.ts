import { NextResponse } from 'next/server';

type funcionario = {
  matricula: string;
  cpf: string;
  nome: string;
  funcao: string;
  centroCusto: string;
  email: string;
  telefone: string;
  dataAdmissao: string;
  dataDemissao: string;
  status: string;
}

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  const [day, month, year] = dateString.split('/');
  if (!day || !month || !year) return null;
  
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

export async function GET() {
  try {
    console.log('Buscando dados da API externa...');
    
    // Buscar dados da API externa
    const response = await fetch('http://192.168.1.100:8080/api/funcionarios');
    
    if (!response.ok) {
      throw new Error(`Erro na API externa: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Mapear os dados para o formato esperado
    const funcionariosData = data.map((item: funcionario) => ({
      matricula: item.matricula,
      cpf: item.cpf,
      nome: item.nome,
      funcao: item.funcao,
      centroCusto: item.centroCusto,
      email: item.email || null,
      telefone: item.telefone || null,
      dataAdmissao: parseDate(item.dataAdmissao),
      dataDemissao: parseDate(item.dataDemissao),
      status: item.status,
    }));
    
    return NextResponse.json(funcionariosData);
    
  } catch (error) {
    console.error('Erro ao buscar dados da API externa:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados da API externa.' },
      { status: 500 }
    );
  }
}