import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  const [day, month, year] = dateString.split('/');
  if (!day || !month || !year) return null;
  
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

export async function POST() {
  try {
    console.log('Iniciando importação de dados...');
    
    // Buscar dados da API externa
    const response = await fetch('http://192.168.1.100:8080/api/funcionarios');
    
    if (!response.ok) {
      throw new Error(`Erro na API externa: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Deletar todos os registros existentes (exceto o administrador do sistema)
    await prisma.funcionario.deleteMany({
      where: {
        matricula: {
          not: 'ADMIN001'
        }
      }
    });
    console.log('Registros existentes deletados (preservando administrador)');
    
    // Mapear e inserir os novos dados
    const funcionariosData = data.map((item: any) => ({
      matricula: item.matricula,
      cpf: item.cpf,
      nome: item.nome,
      funcao: item.funcao,
      centroCusto: item.centroCusto,
      email: item.email || null,
      telefone: item.telefone || null,
      dataAdmissao: parseDate(item.dataAdmissao),
      dataDemissao: parseDate(item.dataDemissao),
      status: item.status
    }));
    
    // Inserir dados no banco
    const result = await prisma.funcionario.createMany({
      data: funcionariosData,
      skipDuplicates: true
    });
    
    console.log(`${result.count} funcionários inseridos com sucesso`);
    
    return NextResponse.json({ 
      message: 'Dados importados com sucesso!', 
      count: result.count 
    });
    
  } catch (error) {
    console.error('Erro ao importar dados:', error);
    return NextResponse.json(
      { error: 'Erro ao importar dados da API externa.' },
      { status: 500 }
    );
  }
}