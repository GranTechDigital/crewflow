import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Status prestserv padrão (valores do banco)
    const statusPrestserv = [
      "PENDENTE",
      "APROVADO",
      "REPROVADO",
      "CRIADO",
      "SUBMETIDO",
      "EM VALIDAÇÃO",
      "VALIDADO",
      "INVALIDADO",
      "CANCELADO",
      "REJEITADO"
    ];

    // Status de tarefas
    const statusTarefas = [
      "SUBMETER RASCUNHO",
      "TAREFAS PENDENTES",
      "ATENDER TAREFAS",
      "SOLICITAÇÃO CONCLUÍDA",
      "APROVAR SOLICITAÇÃO",
      "REPROVAR TAREFAS"
    ];

    // Combinar todos os status
    const todosStatus = [...statusPrestserv, ...statusTarefas].sort();

    return NextResponse.json(todosStatus)
  } catch (error) {
    console.error('Erro ao buscar status:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    )
  }
}