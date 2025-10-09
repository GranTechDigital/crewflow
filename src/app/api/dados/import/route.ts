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
    const funcionariosData = data.map((item: Record<string, unknown>) => ({
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
      dataAdmissao: parseDate(String(item.dataAdmissao || '')),
      dataDemissao: parseDate(String(item.dataDemissao || ''))
    }));
    
    // Inserir dados no banco
    const result = await prisma.funcionario.createMany({
      data: funcionariosData
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