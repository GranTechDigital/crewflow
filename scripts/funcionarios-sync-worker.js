/**
 * Worker de sincronização de funcionários
 * Agenda execuções diárias em horários definidos (HH:mm) e chama o endpoint interno
 * '/api/funcionarios/sincronizar' com Authorization: Bearer <TOKEN>.
 *
 * Variáveis de ambiente:
 * - SYNC_TARGET_URL (ex.: http://app-dev:3000/api/funcionarios/sincronizar)
 * - FUNCIONARIOS_SYNC_SERVICE_TOKEN (token de serviço)
 * - FUNCIONARIOS_SYNC_SCHEDULE (ex.: "07:00,12:30")
 * - FUNCIONARIOS_SYNC_TIMEZONE (opcional; se não usar TZ no container)
 * - TZ (recomendado no container, ex.: America/Sao_Paulo)
 */

const TARGET_URL = process.env.SYNC_TARGET_URL || 'http://localhost:3000/api/funcionarios/sincronizar'
const SERVICE_TOKEN = process.env.FUNCIONARIOS_SYNC_SERVICE_TOKEN || ''
+ const INTERVAL_MINUTES = Number(process.env.FUNCIONARIOS_SYNC_INTERVAL_MINUTES || 0)
const SCHEDULE = (process.env.FUNCIONARIOS_SYNC_SCHEDULE || '07:00,12:30')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

if (!SERVICE_TOKEN) {
  console.error('[func-sync-worker] ERRO: FUNCIONARIOS_SYNC_SERVICE_TOKEN não configurado.')
  process.exit(1)
}

function parseHHmm(str) {
  const [hh, mm] = str.split(':').map((v) => parseInt(v, 10))
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error(`Horário inválido: ${str}`)
  }
  return { hh, mm }
}

const scheduleTimes = SCHEDULE.map(parseHHmm).sort((a, b) => a.hh - b.hh || a.mm - b.mm)

async function doSync() {
  const startedAt = new Date().toISOString()
  console.log(`[func-sync-worker] Disparando sync de funcionários @ ${startedAt}`)
  try {
    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ source: 'worker' }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`[func-sync-worker] Falha no sync: status=${res.status} body=${text}`)
    } else {
      console.log(`[func-sync-worker] Sync concluído: status=${res.status} body=${text}`)
    }
  } catch (err) {
    console.error(`[func-sync-worker] Erro no fetch:`, err)
  }
}

function msUntil(hh, mm) {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hh, mm, 0, 0)
  if (next <= now) {
    // horário já passou hoje, agenda para amanhã
    next.setDate(next.getDate() + 1)
  }
  return next.getTime() - now.getTime()
}

let timer = null

function scheduleNext() {
  const now = new Date()
  // encontrar próximo horário no dia
  for (const { hh, mm } of scheduleTimes) {
    const candidate = new Date(now)
    candidate.setHours(hh, mm, 0, 0)
    if (candidate > now) {
      const delay = candidate.getTime() - now.getTime()
      console.log(`[func-sync-worker] Próxima execução hoje às ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} em ${Math.round(delay / 1000)}s`)
      timer = setTimeout(async () => {
        await doSync()
        scheduleNext() // reprograma a próxima após executar
      }, delay)
      return
    }
  }
  // se nenhum horário restante hoje, agenda primeiro horário de amanhã
  const { hh, mm } = scheduleTimes[0]
  const delay = msUntil(hh, mm)
  console.log(`[func-sync-worker] Próxima execução amanhã às ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} em ${Math.round(delay / 1000)}s`)
  timer = setTimeout(async () => {
    await doSync()
    scheduleNext()
  }, delay)
}

function start() {
  console.log('[func-sync-worker] Iniciado. TARGET_URL=', TARGET_URL)
  console.log('[func-sync-worker] Horários configurados:', SCHEDULE.join(', '))
+  if (INTERVAL_MINUTES > 0) {
+    const delayMs = INTERVAL_MINUTES * 60 * 1000
+    console.log(`[func-sync-worker] Modo intervalo: a cada ${INTERVAL_MINUTES} minutos`)
+    const run = async () => {
+      await doSync()
+      timer = setTimeout(run, delayMs)
+    }
+    // primeira execução após 5s para evitar corrida na subida do app
+    timer = setTimeout(run, 5000)
+    return
+  }
  scheduleNext()
}

process.on('SIGINT', () => {
  if (timer) clearTimeout(timer)
  console.log('[func-sync-worker] Encerrado via SIGINT')
  process.exit(0)
})
process.on('SIGTERM', () => {
  if (timer) clearTimeout(timer)
  console.log('[func-sync-worker] Encerrado via SIGTERM')
  process.exit(0)
})

start()