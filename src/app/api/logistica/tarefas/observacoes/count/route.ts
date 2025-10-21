import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/logistica/tarefas/observacoes/count?ids=uuid1,uuid2,uuid3
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json({}, { status: 200 });
    }

    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    // Agrupar por tarefaId e contar observações
    const grouped = await prisma.observacaoTarefaRemanejamento.groupBy({
      by: ['tarefaId'],
      where: {
        tarefaId: { in: ids }
      },
      _count: { id: true }
    });

    // Mapear para { [tarefaId]: count }
    const result: Record<string, number> = {};
    grouped.forEach((g) => {
      result[g.tarefaId] = g._count.id;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Erro ao contar observações por tarefa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}