import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type JWTUser = {
  id: string;
  funcionarioId?: string;
  nome?: string;
  iat: number;
  exp: number;
};

// GET - Buscar observações de uma tarefa
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const observacoes = await prisma.observacaoTarefaRemanejamento.findMany({
      where: {
        tarefaId: params.id
      },
      orderBy: {
        dataCriacao: 'desc'
      }
    });

    // Mapear os campos do banco de dados para os nomes esperados pelo frontend
    const observacoesFormatadas = observacoes.map(obs => ({
      id: String(obs.id),
      texto: obs.texto,
      criadoPor: obs.criadoPor,
      criadoEm: obs.dataCriacao.toISOString(),
      modificadoPor: obs.modificadoPor,
      modificadoEm: obs.dataModificacao.toISOString()
    }));

    return NextResponse.json(observacoesFormatadas);
  } catch (error) {
    console.error('Erro ao buscar observações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova observação
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Obter o usuário autenticado
    const { getUserFromRequest } = await import('@/utils/authUtils');
    const usuarioAutenticado = await getUserFromRequest(request);
    console.log('DEBUG - Usuário autenticado na rota de observações:', usuarioAutenticado ? JSON.stringify({
      id: usuarioAutenticado.id,
      nome: usuarioAutenticado.funcionario?.nome,
      funcionarioId: usuarioAutenticado.funcionario?.id
    }) : 'null');
    
    const body = await request.json();
    const { texto, criadoPor: criadoPorRequest } = body;
    
    // Verificar token diretamente para debug
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTUser;
        console.log('DEBUG - Token decodificado diretamente na rota de observações:', JSON.stringify(decoded, null, 2));
      } catch (tokenError) {
        console.error('DEBUG - Erro ao decodificar token na rota de observações:', tokenError);
      }
    } else {
      console.log('DEBUG - Nenhum token encontrado nos cookies na rota de observações');
    }
    
    // Usar o nome do usuário autenticado ou o nome fornecido na requisição ou 'Sistema' como fallback
    const criadoPor = usuarioAutenticado?.funcionario?.nome || criadoPorRequest || 'Sistema';
    console.log('DEBUG - criadoPor definido como:', criadoPor);

    if (!texto) {
      return NextResponse.json(
        { error: 'Texto da observação é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a tarefa existe e buscar dados para histórico
    const tarefa = await prisma.tarefaRemanejamento.findUnique({
      where: { id: params.id },
      include: {
        remanejamentoFuncionario: {
          include: {
            funcionario: {
              select: {
                id: true,
                nome: true,
                matricula: true
              }
            }
          }
        }
      }
    });

    if (!tarefa) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada' },
        { status: 404 }
      );
    }

    const observacao = await prisma.observacaoTarefaRemanejamento.create({
      data: {
        tarefaId: params.id,
        texto,
        criadoPor,
        modificadoPor: criadoPor
      }
    });

    // Registrar no histórico
    try {
      await prisma.historicoRemanejamento.create({
        data: {
          solicitacaoId: tarefa.remanejamentoFuncionario.solicitacaoId,
          remanejamentoFuncionarioId: tarefa.remanejamentoFuncionarioId,
          tipoAcao: 'CRIACAO',
          entidade: 'OBSERVACAO',
          descricaoAcao: `Nova observação adicionada à tarefa "${tarefa.tipo}" para ${tarefa.remanejamentoFuncionario.funcionario.nome} (${tarefa.remanejamentoFuncionario.funcionario.matricula})`,
          usuarioResponsavel: criadoPor,
          observacoes: texto
        }
      });
    } catch (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a criação da observação se o histórico falhar
    }

    return NextResponse.json(observacao, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar observação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}