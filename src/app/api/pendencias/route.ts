import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// // GET: Listar pendências (com filtros opcionais)
// export async function GET(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
//   const funcionarioId = searchParams.get('funcionarioId');
//   const equipe = searchParams.get('equipe');
//   const status = searchParams.get('status');

//   const where: Prisma.PendenciaWhereInput = {};
//   if (funcionarioId) where.funcionarioId = Number(funcionarioId);
//   if (equipe) where.equipe = equipe;
//   if (status) where.status = status;

//   const pendencias = await prisma.pendencia.findMany({
//     where,
//     include: { observacoes: true }
//   });

//   return NextResponse.json(pendencias);
// }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || undefined;
    const equipe = searchParams.get('equipe') || undefined;
    const prioridade = searchParams.get('prioridade') || undefined;
    const tipo = searchParams.get('tipo') || undefined;
    const busca = searchParams.get('busca') || undefined;

    const dataLimiteAntes = searchParams.get('dataLimiteAntes');
    const dataLimiteDepois = searchParams.get('dataLimiteDepois');

    const filtros: any = {};

    if (status) filtros.status = status;
    if (equipe) filtros.equipe = equipe;
    if (prioridade) filtros.prioridade = prioridade;
    if (tipo) filtros.tipo = tipo;
    
    if (busca) {
      filtros.OR = [
        { tipo: { contains: busca, mode: 'insensitive' } },
        { descricao: { contains: busca, mode: 'insensitive' } },
        { equipe: { contains: busca, mode: 'insensitive' } },
        { status: { contains: busca, mode: 'insensitive' } },
        { prioridade: { contains: busca, mode: 'insensitive' } },
        { criadoPor: { contains: busca, mode: 'insensitive' } },
        { atualizadoPor: { contains: busca, mode: 'insensitive' } },
        { funcionario: { 
          nome: { contains: busca, mode: 'insensitive' },
          matricula: { contains: busca, mode: 'insensitive' }
        }}
      ];
    }

    if (dataLimiteAntes || dataLimiteDepois) {
      filtros.dataLimite = {};
      if (dataLimiteAntes) {
        filtros.dataLimite.lte = new Date(dataLimiteAntes);
      }
      if (dataLimiteDepois) {
        filtros.dataLimite.gte = new Date(dataLimiteDepois);
      }
    }

    const pendencias = await prisma.pendencia.findMany({
      where: filtros,
      orderBy: { id: 'desc' },
    });

    return NextResponse.json(pendencias);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao buscar pendências', details: message }, { status: 500 });
  }
}

// POST: Criar nova pendência
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const pendencia = await prisma.pendencia.create({
      data: {
        funcionarioId: data.funcionarioId,
        tipo: data.tipo,
        descricao: data.descricao,
        equipe: data.equipe,
        status: data.status || 'Pendente',
        prioridade: data.prioridade || 'Média',
        dataLimite: data.dataLimite ? new Date(data.dataLimite) : undefined,
        criadoPor: data.criadoPor || 'Sistema',
        atualizadoPor: data.atualizadoPor || 'Sistema',
      }
    });

    return NextResponse.json(pendencia);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao criar pendência', details: message }, { status: 500 });
  }
}
