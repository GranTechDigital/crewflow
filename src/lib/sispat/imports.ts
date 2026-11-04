import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applySispatChanges, funcionarioSelect } from './service';
import { exportSispatIssues, parseSispatWorkbook, SispatError } from './workbook';
import { SISPAT_SITUACOES, SispatAlteracao, SispatImportacaoResumo, SispatRegistro, SispatSituacao, SispatDuplicidade, SispatParticipante, SispatProgresso } from './shared';
import { findSispatDuplicates, isSispatIssue, sispatChangeType } from './review';

type StoredRun = Omit<SispatImportacaoResumo, 'criadoEm' | 'aplicadoEm' | 'desfeitoEm'> & {
  criadoEm: Date; aplicadoEm: Date | null; desfeitoEm: Date | null;
  registros: SispatRegistro[]; alertas: SispatDuplicidade[];
};
function changeTypeSql(item: Prisma.Sql) {
  return Prisma.sql`COALESCE(${item}->>'tipoAlteracao', CASE
    WHEN ${item}->>'funcionarioId' IS NOT NULL AND ${item}->>'recebido' IS NOT NULL
      AND ${item}->>'anterior' IS DISTINCT FROM ${item}->>'recebido'
      AND ${item}->>'status' IN ('PENDENTE', 'ATUALIZADO', 'NAO_APLICADO', 'DESFEITO')
    THEN CASE WHEN COALESCE(BTRIM(${item}->>'anterior'), '') = '' THEN 'CADASTRO' ELSE 'SUBSTITUICAO' END END)`;
}
const metadata = Prisma.sql`"id", "nomeArquivo", "aba", "status", "total", "resumo", "criadoPorId", "criadoEm", "aplicadoEm", "desfeitoEm", "erro", "criadoPorNome", "restauradoPorNome", "restauradoPorId",
  jsonb_array_length("alertas") AS "numerosDuplicados",
  (SELECT COUNT(*)::integer FROM jsonb_array_elements("registros") r WHERE ${changeTypeSql(Prisma.sql`r`)} = 'CADASTRO') AS "novosCadastros",
  (SELECT COUNT(*)::integer FROM jsonb_array_elements("registros") r WHERE ${changeTypeSql(Prisma.sql`r`)} = 'SUBSTITUICAO') AS "substituicoes",
  (SELECT COUNT(*)::integer FROM jsonb_array_elements("registros") r WHERE r->>'alertaDuplicidade' = 'true') AS "linhasComAlerta"`;
const transactionOptions = { timeout: 30000, maxWait: 5000 };
function summarize(registros: SispatRegistro[]) {
  const summary = Object.fromEntries(Object.keys(SISPAT_SITUACOES).map(key => [key, 0])) as Record<SispatSituacao, number>;
  for (const item of registros) summary[item.status]++;
  return summary;
}
function summary(run: StoredRun): SispatImportacaoResumo {
  return { id: run.id, nomeArquivo: run.nomeArquivo, aba: run.aba, status: run.status, total: run.total, resumo: run.resumo,
    criadoPorId: run.criadoPorId, criadoEm: run.criadoEm.toISOString(), aplicadoEm: run.aplicadoEm?.toISOString() ?? null,
    desfeitoEm: run.desfeitoEm?.toISOString() ?? null, erro: run.erro,
    criadoPorNome: run.criadoPorNome ?? null, restauradoPorNome: run.restauradoPorNome ?? null, restauradoPorId: run.restauradoPorId ?? null,
    novosCadastros: run.novosCadastros ?? run.registros?.filter(r => sispatChangeType(r) === 'CADASTRO').length ?? 0,
    substituicoes: run.substituicoes ?? run.registros?.filter(r => sispatChangeType(r) === 'SUBSTITUICAO').length ?? 0,
    linhasComAlerta: run.linhasComAlerta ?? run.registros?.filter(r => r.alertaDuplicidade).length ?? 0,
    numerosDuplicados: run.numerosDuplicados ?? run.alertas?.length ?? 0 };
}
async function readRun(id: string, tx: Prisma.TransactionClient = prisma, lock = false) {
  const rows = await tx.$queryRaw<StoredRun[]>(Prisma.sql`SELECT * FROM "SispatImportacao" WHERE "id" = ${id} ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`);
  if (!rows[0]) throw new SispatError('Importação não encontrada.', 404);
  return rows[0];
}
async function saveRun(tx: Prisma.TransactionClient, run: StoredRun) {
  run.resumo = summarize(run.registros);
  await tx.$executeRaw`UPDATE "SispatImportacao" SET "status" = ${run.status}, "registros" = ${JSON.stringify(run.registros)}::jsonb,
    "resumo" = ${JSON.stringify(run.resumo)}::jsonb, "erro" = ${run.erro}, "aplicadoEm" = ${run.aplicadoEm},
    "desfeitoEm" = ${run.desfeitoEm}, "restauradoPorId" = ${run.restauradoPorId}, "restauradoPorNome" = ${run.restauradoPorNome} WHERE "id" = ${run.id}`;
}

/** Persiste a análise e o backup ANTES de autorizar qualquer alteração de funcionário. */
export async function createSispatImport(parsed: Awaited<ReturnType<typeof parseSispatWorkbook>>, nomeArquivo: string, actorId: number, actorNome: string | null = null) {
  const matriculas = [...new Set(parsed.registros.filter(r => r.matricula && r.status !== 'ERRO').map(r => r.matricula))];
  const byMatricula = new Map<string, { id: number; nome: string; matricula: string; sispat: string | null; atualizadoEm: Date }>();
  for (let i = 0; i < matriculas.length; i += 1000) {
    const found = await prisma.funcionario.findMany({ where: { matricula: { in: matriculas.slice(i, i + 1000) } }, select: funcionarioSelect });
    for (const f of found) byMatricula.set(f.matricula, f);
  }
  const registros = parsed.registros.map(original => {
    const item = { ...original };
    const f = byMatricula.get(item.matricula);
    if (f) Object.assign(item, { funcionarioId: f.id, nome: f.nome, anterior: f.sispat, versaoAntes: f.atualizadoEm.toISOString() });
    if (item.status !== 'PENDENTE') return item;
    if (!f) { item.status = 'NAO_ENCONTRADO'; item.motivo = 'Matrícula não encontrada no Crew. Nenhum cadastro será criado.'; }
    else if (f.sispat === item.recebido) { item.status = 'SEM_ALTERACAO'; item.motivo = 'SISPAT já está correto. Desconsiderado, sem gravação.'; }
    else { item.tipoAlteracao = f.sispat?.trim() ? 'SUBSTITUICAO' : 'CADASTRO'; item.motivo = 'Aguardando confirmação. Valor anterior salvo no backup.'; }
    return item;
  });
  const id = randomUUID();
  if (registros.some(item => item.status === 'ERRO')) {
    for (const item of registros) if (item.status === 'PENDENTE') { item.status = 'NAO_APLICADO'; item.motivo = 'Não atualizado: o arquivo contém erros. Corrija a planilha e analise novamente.'; }
  }
  const numbers = [...new Set(registros.filter(r => r.recebido && /^\d{1,30}$/.test(r.recebido)).map(r => r.recebido!))];
  const holders: { matricula: string; nome: string; sispat: string | null }[] = [];
  for (let i = 0; i < numbers.length; i += 1000) holders.push(...await prisma.funcionario.findMany({
    where: { sispat: { in: numbers.slice(i, i + 1000) } }, select: { matricula: true, nome: true, sispat: true },
  }));
  const alertas = findSispatDuplicates(registros, holders);
  const affected = new Map(alertas.map(group => [group.sispat, new Set(group.participantes.map(p => p.matricula))]));
  for (const item of registros) item.alertaDuplicidade = Boolean(item.recebido && affected.get(item.recebido)?.has(item.matricula));
  const counts = summarize(registros);
  await prisma.$executeRaw`INSERT INTO "SispatImportacao" ("id", "nomeArquivo", "aba", "status", "total", "resumo", "registros", "criadoPorId", "criadoPorNome", "alertas")
    VALUES (${id}, ${nomeArquivo.slice(0, 200)}, ${parsed.aba}, ${counts.ERRO ? 'INVALIDA' : 'PREVIA'}, ${parsed.total}, ${JSON.stringify(counts)}::jsonb, ${JSON.stringify(registros)}::jsonb, ${actorId}, ${actorNome}, ${JSON.stringify(alertas)}::jsonb)`;
  return summary(await readRun(id));
}

export async function getSispatImport(id: string, page = 1, limit = 50, situacao = '') {
  if (situacao && !Object.hasOwn(SISPAT_SITUACOES, situacao) && !['DUPLICIDADE', 'CADASTRO', 'SUBSTITUICAO'].includes(situacao)) throw new SispatError('Situação inválida.');
  const rows = await prisma.$queryRaw<StoredRun[]>(Prisma.sql`SELECT ${metadata} FROM "SispatImportacao" WHERE "id" = ${id}`);
  if (!rows[0]) throw new SispatError('Importação não encontrada.', 404);
  const where = situacao === 'DUPLICIDADE' ? Prisma.sql`AND item->>'alertaDuplicidade' = 'true'` : ['CADASTRO', 'SUBSTITUICAO'].includes(situacao) ? Prisma.sql`AND ${changeTypeSql(Prisma.sql`item`)} = ${situacao}` : situacao ? Prisma.sql`AND item->>'status' = ${situacao}` : Prisma.empty;
  const [count, items] = await Promise.all([
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::integer AS total FROM "SispatImportacao", jsonb_array_elements("registros") AS item WHERE "id" = ${id} ${where}`),
    prisma.$queryRaw<{ item: SispatRegistro }[]>(Prisma.sql`SELECT item FROM "SispatImportacao", jsonb_array_elements("registros") WITH ORDINALITY AS entries(item, seq)
      WHERE "id" = ${id} ${where} ORDER BY seq LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
  ]);
  return { ...summary(rows[0]), itens: items.map(r => ({ ...r.item, tipoAlteracao: sispatChangeType(r.item) })), totalItens: count[0].total, page, limit };
}
export async function listSispatImports(page = 1, limit = 10) {
  const [count, rows] = await Promise.all([
    prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::integer AS total FROM "SispatImportacao"`,
    prisma.$queryRaw<StoredRun[]>(Prisma.sql`SELECT ${metadata} FROM "SispatImportacao" ORDER BY "criadoEm" DESC, "id" DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
  ]);
  return { total: count[0].total, importacoes: rows.map(summary), page, limit };
}
export async function downloadSispatBackup(id: string) {
  const run = await readRun(id);
  return { versaoBackup: 1, ...summary(run), registros: run.registros, alertas: run.alertas };
}
function changesFor(items: SispatRegistro[], restore = false): SispatAlteracao[] {
  return items.map(item => {
    if (!item.funcionarioId || !item.versaoAntes || (restore && !item.versaoDepois)) throw new SispatError('Backup incompleto. Operação cancelada.', 409);
    return { id: item.funcionarioId, nome: item.nome ?? '', matricula: item.matricula,
      sispat: restore ? item.recebido : item.anterior ?? null, novoSispat: restore ? item.anterior ?? null : item.recebido,
      atualizadoEm: restore ? item.versaoDepois! : item.versaoAntes };
  });
}
async function recordFailure(id: string, message: string, restoring: boolean) {
  await prisma.$transaction(async tx => {
    const run = await readRun(id, tx, true);
    if (restoring ? run.status !== 'APLICADA' : run.status !== 'PREVIA') return;
    run.erro = message;
    if (!restoring) {
      run.status = 'ERRO';
      run.registros = run.registros.map(item => item.status === 'PENDENTE' ? { ...item, status: 'NAO_APLICADO', motivo: `Não atualizado: ${message}` } : item);
    }
    await saveRun(tx, run);
  }, transactionOptions);
}

export async function confirmSispatImport(id: string, actorId: number, onProgress?: (progress: SispatProgresso) => void) {
  try {
    return await prisma.$transaction(async tx => {
      const run = await readRun(id, tx, true);
      if (run.criadoPorId !== actorId) throw new SispatError('Somente quem analisou a planilha pode confirmar esta prévia.', 403);
      if (run.status !== 'PREVIA') throw new SispatError('Esta análise já foi concluída ou contém erros. Abra o resultado ou envie uma nova planilha.', 409);
      if (Date.now() - run.criadoEm.getTime() > 15 * 60 * 1000) throw new SispatError('A prévia expirou. Analise novamente antes de confirmar.', 409);
      const pending = run.registros.filter(item => item.status === 'PENDENTE');
      onProgress?.({ fase: 'PROCESSANDO', processados: 0, total: pending.length });
      const updated = await applySispatChanges(tx, changesFor(pending), (processados, total) => onProgress?.({ fase: 'PROCESSANDO', processados, total }));
      onProgress?.({ fase: 'CONFIRMANDO', processados: pending.length, total: pending.length });
      const versions = new Map(updated.map(row => [row.id, row.atualizadoEm.toISOString()]));
      run.registros = run.registros.map(item => item.status === 'PENDENTE' ? { ...item, status: 'ATUALIZADO', versaoDepois: versions.get(item.funcionarioId!), motivo: 'SISPAT atualizado. Valor anterior preservado no backup.' } : item);
      run.status = pending.length ? 'APLICADA' : 'CONCLUIDA'; run.aplicadoEm = new Date(); run.erro = null;
      await saveRun(tx, run);
      return summary(run);
    }, transactionOptions);
  } catch (error) {
    // Erros de autorização não alteram a análise de outra pessoa.
    if (!(error instanceof SispatError && [403, 404].includes(error.status))) {
      try { await recordFailure(id, error instanceof SispatError ? error.message : 'Falha ao gravar. Nenhum lote foi confirmado.', false); }
      catch (auditError) { console.error('[sispat] Falha ao registrar resultado', auditError); }
    }
    throw error;
  }
}

export async function revertSispatImport(id: string, actorId: number, actorNome: string | null = null, onProgress?: (progress: SispatProgresso) => void) {
  try {
    return await prisma.$transaction(async tx => {
      const run = await readRun(id, tx, true);
      if (run.status !== 'APLICADA') throw new SispatError('Somente uma importação aplicada pode ser desfeita, uma única vez.', 409);
      const affected = run.registros.filter(item => item.status === 'ATUALIZADO');
      onProgress?.({ fase: 'PROCESSANDO', processados: 0, total: affected.length });
      try { await applySispatChanges(tx, changesFor(affected, true), (processados, total) => onProgress?.({ fase: 'PROCESSANDO', processados, total })); }
      catch (error) { if (error instanceof SispatError) throw new SispatError('Restauração bloqueada: um cadastro foi alterado após a importação. Nenhum SISPAT foi restaurado.', 409); throw error; }
      onProgress?.({ fase: 'CONFIRMANDO', processados: affected.length, total: affected.length });
      run.registros = run.registros.map(item => item.status === 'ATUALIZADO' ? { ...item, status: 'DESFEITO', motivo: 'Valor anterior restaurado a partir do backup.' } : item);
      run.status = 'DESFEITA'; run.desfeitoEm = new Date(); run.restauradoPorId = actorId; run.restauradoPorNome = actorNome; run.erro = null;
      await saveRun(tx, run);
      return summary(run);
    }, transactionOptions);
  } catch (error) {
    try { await recordFailure(id, error instanceof SispatError ? error.message : 'Falha na restauração. Nenhum SISPAT foi restaurado.', true); }
    catch (auditError) { console.error('[sispat] Falha ao registrar restauração', auditError); }
    throw error;
  }
}

export async function getSispatDuplicate(id: string, sispat: string, page = 1, limit = 50) {
  const groups = await prisma.$queryRaw<{ total: number }[]>`SELECT jsonb_array_length(alerta->'participantes') AS total
    FROM "SispatImportacao", jsonb_array_elements("alertas") AS alerta WHERE "id" = ${id} AND alerta->>'sispat' = ${sispat}`;
  if (!groups[0]) throw new SispatError('Alerta de duplicidade não encontrado.', 404);
  const rows = await prisma.$queryRaw<{ item: SispatParticipante }[]>`SELECT item FROM "SispatImportacao",
    jsonb_array_elements("alertas") AS alerta, jsonb_array_elements(alerta->'participantes') WITH ORDINALITY AS entries(item, seq)
    WHERE "id" = ${id} AND alerta->>'sispat' = ${sispat} ORDER BY seq LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
  return { sispat, itens: rows.map(row => row.item), total: groups[0].total, page, limit };
}
export async function downloadSispatIssues(id: string) {
  const run = await readRun(id);
  return exportSispatIssues(run.registros.filter(isSispatIssue), run.alertas);
}
