import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function buildNomeToUsuarioMap() {
  const funcionarios = await prisma.funcionario.findMany({
    select: { id: true, nome: true }
  })
  const nomeToIds = new Map()
  for (const f of funcionarios) {
    const n = (f.nome || '').trim()
    if (!n) continue
    if (!nomeToIds.has(n)) nomeToIds.set(n, [])
    nomeToIds.get(n).push(f.id)
  }
  const nomeToUsuario = new Map()
  for (const [nome, ids] of nomeToIds.entries()) {
    if (ids.length !== 1) continue
    const u = await prisma.usuario.findUnique({
      where: { funcionarioId: ids[0] },
      select: { id: true, equipeId: true }
    })
    if (u) nomeToUsuario.set(nome, u)
  }
  return nomeToUsuario
}

async function buildChainLatestMaps() {
  const withActor = await prisma.historicoRemanejamento.findMany({
    where: { usuarioResponsavelId: { not: null } },
    select: {
      usuarioResponsavelId: true,
      equipeId: true,
      remanejamentoFuncionarioId: true,
      solicitacaoId: true,
      dataAcao: true,
    },
    orderBy: { dataAcao: 'asc' }
  })
  const mapRF = new Map()
  const mapSol = new Map()
  for (const h of withActor) {
    if (h.remanejamentoFuncionarioId) {
      mapRF.set(h.remanejamentoFuncionarioId, h)
    }
    if (typeof h.solicitacaoId === 'number') {
      mapSol.set(h.solicitacaoId, h)
    }
  }
  return { mapRF, mapSol }
}

async function backfillAll() {
  const nomeMap = await buildNomeToUsuarioMap()
  const { mapRF, mapSol } = await buildChainLatestMaps()

  const batchSize = 1000
  let cursor = null
  let totalUpdates = 0
  for (;;) {
    const historicos = await prisma.historicoRemanejamento.findMany({
      where: {
        OR: [
          { usuarioResponsavelId: null },
          { equipeId: null },
        ]
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        usuarioResponsavel: true,
        usuarioResponsavelId: true,
        equipeId: true,
        solicitacaoId: true,
        remanejamentoFuncionarioId: true,
      }
    })
    if (historicos.length === 0) break

    const ops = []
    for (const h of historicos) {
      let actor = null
      const nome = (h.usuarioResponsavel || '').trim()
      if (!h.usuarioResponsavelId && nome && !nome.toLowerCase().includes('sistema')) {
        actor = nomeMap.get(nome) || null
      }
      if (!actor) {
        const chain = (h.remanejamentoFuncionarioId && mapRF.get(h.remanejamentoFuncionarioId))
          || (typeof h.solicitacaoId === 'number' && mapSol.get(h.solicitacaoId))
        if (chain) actor = { id: chain.usuarioResponsavelId, equipeId: chain.equipeId }
      }
      if (!actor) continue
      ops.push(
        prisma.historicoRemanejamento.update({
          where: { id: h.id },
          data: {
            usuarioResponsavelId: actor.id ?? undefined,
            equipeId: actor.equipeId ?? undefined,
          }
        })
      )
    }
    if (ops.length > 0) {
      await prisma.$transaction(ops, { timeout: 60000 })
      totalUpdates += ops.length
    }
    cursor = historicos[historicos.length - 1].id
  }
  return totalUpdates
}

async function main() {
  const total = await backfillAll()
  console.log(`Backfill concluído. Registros atualizados: ${total}`)
}

main()
  .catch((e) => {
    console.error('Erro no backfill:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })