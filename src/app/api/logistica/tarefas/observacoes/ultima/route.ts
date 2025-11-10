import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/logistica/tarefas/observacoes/ultima?ids=uuid1,uuid2,uuid3
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

    console.log('[ultima-obs] idsCount:', ids.length);

    // Buscar todas as observações das tarefas informadas e escolher a última por tarefa
    const records = await prisma.observacaoTarefaRemanejamento.findMany({
      where: { tarefaId: { in: ids } },
      select: {
        tarefaId: true,
        texto: true,
        criadoPor: true,
        dataCriacao: true,
        dataModificacao: true
      },
      orderBy: [
        { dataCriacao: 'desc' }
      ]
    });

    console.log('[ultima-obs] recordsCount:', records.length);

    const result: Record<string, { texto: string; criadoPor: string | null; criadoEm: string; modificadoEm?: string }> = {};
    for (const rec of records) {
      // Se ainda não tem entrada para a tarefa, o primeiro (por ordenação) é o mais recente
      if (!result[rec.tarefaId]) {
        result[rec.tarefaId] = {
          texto: rec.texto,
          criadoPor: rec.criadoPor,
          criadoEm: rec.dataCriacao?.toISOString?.() ?? new Date().toISOString(),
          modificadoEm: rec.dataModificacao?.toISOString?.()
        };
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Erro ao obter última observação por tarefa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}