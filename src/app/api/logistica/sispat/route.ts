import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';
import { canManageSispat, canDownloadSispatBackup, SispatEvento, SispatProgresso, SispatImportacaoResumo } from '@/lib/sispat/shared';
import { exportSispatWorkbook, MAX_FILE_BYTES, parseSispatWorkbook, SispatError, validateSispat } from '@/lib/sispat/workbook';
import { funcionarioSelect } from '@/lib/sispat/service';
import { createSispatImport, getSispatImport, listSispatImports, downloadSispatBackup, confirmSispatImport, revertSispatImport, getSispatDuplicate, downloadSispatIssues } from '@/lib/sispat/imports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: privateHeaders }); }

async function authorize(request: NextRequest, mutation = false) {
  const user = await getUserFromRequest(request);
  if (!user) throw new SispatError('Sessão inválida. Entre novamente.', 401);
  if (!user.equipe.ativo || !canManageSispat(user.equipe.nome)) throw new SispatError('Acesso permitido à Administração e à Logística (Editor ou Gestor).', 403);
  if (mutation) {
    const origin = request.headers.get('origin');
    let sameOrigin = true;
    try { if (origin) sameOrigin = new URL(origin).host === request.headers.get('host'); } catch { sameOrigin = false; }
    if (request.headers.get('sec-fetch-site') === 'cross-site' || !sameOrigin) throw new SispatError('Origem da requisição não permitida.', 403);
  }
  return user;
}
function fail(error: unknown) {
  if (error instanceof SispatError) return json({ error: error.message }, error.status);
  console.error('[sispat] Falha na operação', error);
  return json({ error: 'Não foi possível concluir a operação de SISPAT. Tente novamente.' }, 500);
}
function int(value: string | null, fallback: number, max: number) {
  const n = Number(value ?? fallback);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const user = await authorize(request);
    const params = request.nextUrl.searchParams;
    if (params.get('modelo') === '1') {
      const bytes = await exportSispatWorkbook([]);
      return new NextResponse(new Uint8Array(bytes), { headers: { ...privateHeaders, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="modelo-sispat.xlsx"' } });
    }
    const importacaoId = params.get('importacao');
    if (importacaoId) {
      if (!/^[0-9a-f-]{36}$/i.test(importacaoId)) throw new SispatError('Identificador da importação inválido.');
      if (params.get('pendencias') === '1') {
        const bytes = await downloadSispatIssues(importacaoId);
        return new NextResponse(new Uint8Array(bytes), { headers: { ...privateHeaders, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="sispat-pendencias-${importacaoId}.xlsx"` } });
      }
      if (params.get('duplicidade')) return json(await getSispatDuplicate(importacaoId, validateSispat(params.get('duplicidade')), int(params.get('page'), 1, 1000000), int(params.get('limit'), 50, 100)));
      if (params.get('download') === '1') {
        if (!canDownloadSispatBackup(user.equipe.nome)) throw new SispatError('Download do backup permitido somente à Administração.', 403);
        return new NextResponse(JSON.stringify(await downloadSispatBackup(importacaoId), null, 2), { headers: { ...privateHeaders, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="sispat-backup-${importacaoId}.json"` } });
      }
      return json(await getSispatImport(importacaoId, int(params.get('page'), 1, 1000000), int(params.get('limit'), 50, 100), params.get('situacao') ?? ''));
    }
    if (params.get('historico') === '1') return json(await listSispatImports(int(params.get('page'), 1, 1000000), 10));
    if (params.get('export') === '1') {
      const rows = await prisma.funcionario.findMany({ select: { matricula: true, sispat: true }, orderBy: { matricula: 'asc' } });
      const bytes = await exportSispatWorkbook(rows);
      return new NextResponse(new Uint8Array(bytes), { headers: { ...privateHeaders, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="matricula-sispat.xlsx"' } });
    }
    const page = int(params.get('page'), 1, 1000000);
    const limit = int(params.get('limit'), 50, 100);
    const q = (params.get('q') ?? '').trim().slice(0, 100);
    const where = q ? { OR: [{ nome: { contains: q, mode: 'insensitive' as const } }, { matricula: { contains: q, mode: 'insensitive' as const } }, { sispat: { contains: q, mode: 'insensitive' as const } }] } : {};
    const [total, funcionarios] = await prisma.$transaction([
      prisma.funcionario.count({ where }),
      prisma.funcionario.findMany({ where, select: funcionarioSelect, orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: limit, skip: (page - 1) * limit }),
    ]);
    return json({ funcionarios, total, page, limit });
  } catch (error) { return fail(error); }
}

// Corpo limitado durante a leitura, inclusive quando Content-Length não é enviado.
async function readBounded(request: NextRequest, max: number) {
  if (Number(request.headers.get('content-length')) > max) throw new SispatError('Arquivo ou requisição muito grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SispatError('Corpo da requisição vazio.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new SispatError('Arquivo ou requisição muito grande.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

/** O progresso não confirma lotes; sucesso só é enviado após o commit da transação. */
function streamOperation(operation: (report: (progress: SispatProgresso) => void) => Promise<SispatImportacaoResumo>) {
  const encoder = new TextEncoder();
  let connected = true;
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SispatEvento) => {
        if (!connected) return;
        try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); } catch { connected = false; }
      };
      emit({ tipo: 'progresso', progresso: { fase: 'PREPARANDO', processados: 0, total: 0 } });
      try { emit({ tipo: 'concluido', resultado: await operation(progresso => emit({ tipo: 'progresso', progresso })) }); }
      catch (error) {
        if (!(error instanceof SispatError)) console.error('[sispat] Falha na operação com progresso', error);
        emit({ tipo: 'erro', erro: error instanceof SispatError ? error.message : 'Falha no processamento. Consulte o histórico antes de repetir a operação.' });
      } finally { if (connected) { try { controller.close(); } catch { /* Cliente já desconectado. */ } } }
    },
    // A desconexão não dispara uma nova operação nem desfaz um commit concluído.
    cancel() { connected = false; },
  });
  return new Response(stream, { headers: { ...privateHeaders, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' } });
}

export async function POST(request: NextRequest) {
  try {
    const user = await authorize(request, true);
    if (request.headers.get('content-type')?.includes('application/json')) {
      let data: { action?: string; importacaoId?: string };
      try { data = JSON.parse((await readBounded(request, 4096)).toString('utf8')); }
      catch (error) { if (error instanceof SispatError) throw error; throw new SispatError('Dados inválidos.'); }
      if (!data || typeof data.importacaoId !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.importacaoId)) throw new SispatError('Informe a importação.');
      if (request.headers.get('accept')?.includes('application/x-ndjson')) {
        const id = data.importacaoId;
        if (data.action === 'confirm') return streamOperation(report => confirmSispatImport(id, user.id, report));
        if (data.action === 'revert') return streamOperation(report => revertSispatImport(id, user.id, user.funcionario.nome, report));
      }
      if (data.action === 'confirm') return json(await confirmSispatImport(data.importacaoId, user.id));
      if (data.action === 'revert') return json(await revertSispatImport(data.importacaoId, user.id, user.funcionario.nome));
      throw new SispatError('Operação inválida.');
    }
    const body = await readBounded(request, MAX_FILE_BYTES + 65536);
    let form: FormData;
    try { form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') ?? '' }, body: new Uint8Array(body) }).formData(); }
    catch { throw new SispatError('Envie o arquivo como formulário multipart.'); }
    const file = form.get('file');
    if (!file || typeof file === 'string' || !file.name.toLowerCase().endsWith('.xlsx')) throw new SispatError('Selecione uma planilha .xlsx.');
    if (file.size > MAX_FILE_BYTES) throw new SispatError('O arquivo deve ter no máximo 5 MB.', 413);
    if (form.get('action') !== 'preview') throw new SispatError('Analise a planilha antes de importar.');
    const parsed = await parseSispatWorkbook(Buffer.from(await file.arrayBuffer()), true);
    return json(await createSispatImport(parsed, file.name, user.id, user.funcionario.nome), 201);
  } catch (error) { return fail(error); }
}

async function change(request: NextRequest, remove: boolean) {
  try {
    const user = await authorize(request, true);
    let data: { id?: unknown; sispat?: unknown; anterior?: unknown; atualizadoEm?: unknown };
    try { data = JSON.parse((await readBounded(request, 4096)).toString('utf8')); }
    catch (error) { if (error instanceof SispatError) throw error; throw new SispatError('Dados inválidos.'); }
    if (!data || !Number.isSafeInteger(data.id) || Number(data.id) < 1 || !(data.anterior === null || typeof data.anterior === 'string') || typeof data.atualizadoEm !== 'string' || !Number.isFinite(Date.parse(data.atualizadoEm))) throw new SispatError('Informe o funcionário e a versão atual do cadastro.');
    const novo = remove ? null : validateSispat(data.sispat);
    if (novo === data.anterior) {
      const found = await prisma.funcionario.findFirst({ where: { id: Number(data.id), sispat: data.anterior, atualizadoEm: new Date(data.atualizadoEm) }, select: { id: true } });
      if (!found) throw new SispatError('Cadastro alterado ou não encontrado. Atualize a lista e tente novamente.', 409);
      return json({ ok: true, semAlteracao: true });
    }
    const updated = await prisma.funcionario.updateMany({
      where: { id: Number(data.id), sispat: data.anterior as string | null, atualizadoEm: new Date(data.atualizadoEm) },
      data: { sispat: novo },
    });
    if (updated.count !== 1) throw new SispatError('Cadastro alterado por outra pessoa ou não encontrado. Atualize a lista e tente novamente.', 409);
    console.info('[sispat]', JSON.stringify({ operacao: remove ? 'exclusao' : 'edicao', usuarioId: user.id, funcionarioId: data.id, anterior: data.anterior, novo }));
    return json({ ok: true });
  } catch (error) { return fail(error); }
}
export async function PUT(request: NextRequest) { return change(request, false); }
export async function DELETE(request: NextRequest) { return change(request, true); }
