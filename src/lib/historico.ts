import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function logHistorico(request: NextRequest, data: {
  solicitacaoId?: number | null
  remanejamentoFuncionarioId?: string | null
  tarefaId?: string | null
  tipoAcao: string
  entidade: string
  descricaoAcao: string
  campoAlterado?: string | null
  valorAnterior?: string | null
  valorNovo?: string | null
  observacoes?: string | null
}) {
  let usuarioId: number | undefined
  let usuarioNome: string | undefined
  let equipeId: number | undefined
  try {
    const { getUserFromRequest } = await import('@/utils/authUtils')
    const u = await getUserFromRequest(request as any)
    if (u) {
      usuarioId = u.id
      usuarioNome = u.funcionario?.nome || undefined
      equipeId = u.equipeId
    }
  } catch {}

  return prisma.historicoRemanejamento.create({
    data: {
      solicitacaoId: data.solicitacaoId ?? null,
      remanejamentoFuncionarioId: data.remanejamentoFuncionarioId ?? null,
      tarefaId: data.tarefaId ?? null,
      tipoAcao: data.tipoAcao,
      entidade: data.entidade,
      campoAlterado: data.campoAlterado ?? null,
      valorAnterior: data.valorAnterior ?? null,
      valorNovo: data.valorNovo ?? null,
      descricaoAcao: data.descricaoAcao,
      usuarioResponsavel: usuarioNome || 'Sistema',
      usuarioResponsavelId: usuarioId,
      equipeId: equipeId,
      observacoes: data.observacoes ?? null,
    }
  })
}