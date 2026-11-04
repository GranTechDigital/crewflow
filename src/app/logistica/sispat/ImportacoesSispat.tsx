'use client';

import { useEffect, useRef, useState } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { Download, History, Upload, FileSpreadsheet, RefreshCw, ShieldCheck, AlertTriangle, Check, ArrowRight, LoaderCircle } from 'lucide-react';
import { Badge, Card, Progress } from 'flowbite-react';
import { SISPAT_SITUACOES, SispatImportacaoPagina, SispatImportacaoResumo, SispatSituacao, SispatProgresso } from '@/lib/sispat/shared';
import styles from './sispat.module.css';
import { ActionButton } from './SispatUI';
import SispatDuplicate from './DuplicidadeSispat';
import { readSispatProgress } from '@/lib/sispat/progress';
import { readSispatWorkbookDownload } from '@/lib/sispat/download';

const endpoint = '/api/logistica/sispat';
const runLabels: Record<string, string> = { PREVIA: 'Prévia pronta', INVALIDA: 'Arquivo com erros', APLICADA: 'Importação concluída', CONCLUIDA: 'Concluída sem alterações', ERRO: 'Importação não aplicada', DESFEITA: 'Importação desfeita' };
async function result(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}
function formatDate(value: string) { return new Date(value).toLocaleString('pt-BR'); }

type Props = {
  canDownloadBackup: boolean; actorId: number; busy: boolean; onExport: () => Promise<void>; run: (action: () => Promise<void>) => Promise<void>;
  onChanged: () => void; onFeedback: (message: string) => void;
};
export default function SispatImports({ actorId, canDownloadBackup, busy, run, onChanged, onFeedback, onExport }: Props) {
  const [tab, setTab] = useState(0);
  const [operation, setOperation] = useState<{ action: 'confirm' | 'revert'; progress: SispatProgresso; status: 'running' | 'done' | 'error' } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SispatImportacaoPagina | null>(null);
  const [page, setPage] = useState(1);
  const [situacao, setSituacao] = useState('');
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<{ total: number; importacoes: SispatImportacaoResumo[] }>({ total: 0, importacoes: [] });
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    const controller = new AbortController(); setHistoryLoading(true); setHistoryError('');
    fetch(`${endpoint}?historico=1&page=${historyPage}`, { cache: 'no-store', signal: controller.signal })
      .then(result).then(setHistory)
      .catch(error => { if (!controller.signal.aborted) setHistoryError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [historyPage, revision]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController(); setLoading(true); setDetailError(''); setDetail(null);
    const query = new URLSearchParams({ importacao: selectedId, page: String(page), limit: '50', situacao });
    fetch(`${endpoint}?${query}`, { cache: 'no-store', signal: controller.signal }).then(result).then(setDetail)
      .catch(error => { if (!controller.signal.aborted) setDetailError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedId, page, situacao, revision]);

  function open(id: string) { setOperation(null); setSelectedId(id); setPage(1); setSituacao(''); setDuplicate(null); }
  async function analyze() {
    if (!file) return;
    await run(async () => {
      const form = new FormData(); form.set('file', file); form.set('action', 'preview');
      const data: SispatImportacaoResumo = await result(await fetch(endpoint, { method: 'POST', body: form }));
      open(data.id); setHistoryPage(1); setRevision(v => v + 1);
      onFeedback(data.resumo.ERRO ? `Análise concluída: ${data.resumo.ERRO} linhas com erro. Nenhum SISPAT alterado. Corrija a planilha antes de confirmar.` : `Análise concluída: ${data.total} linhas, ${data.resumo.PENDENTE} alterações previstas e ${data.resumo.SEM_ALTERACAO} já corretas. Nenhum SISPAT alterado. Backup dos valores anteriores salvo.`);
    });
  }
  async function execute(action: 'confirm' | 'revert') {
    if (!detail) return;
    if (action === 'revert' && !window.confirm(`Desfazer esta importação e restaurar os ${detail.resumo.ATUALIZADO} SISPATs anteriores? Se algum cadastro foi alterado depois, a restauração inteira será bloqueada.`)) return;
    await run(async () => {
      setOperation({ action, status: 'running', progress: { fase: 'PREPARANDO', processados: 0, total: action === 'confirm' ? detail.resumo.PENDENTE : detail.resumo.ATUALIZADO } });
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify({ action, importacaoId: detail.id }) });
        const data = await readSispatProgress(response, progress => setOperation({ action, status: 'running', progress }));
        setOperation(current => current ? { ...current, status: 'done', progress: { ...current.progress, processados: current.progress.total } } : null);
        onFeedback(action === 'revert' ? `${data.resumo.DESFEITO} SISPATs restaurados pelo backup. Os demais cadastros foram preservados.` : `Processamento concluído: ${data.resumo.ATUALIZADO} atualizados; ${data.resumo.SEM_ALTERACAO} já corretos, sem gravação; ${data.resumo.IGNORADO} ignorados; ${data.resumo.NAO_ENCONTRADO} matrículas não encontradas; ${data.resumo.ERRO} erros.`);
        if (action === 'confirm') { setFile(null); if (input.current) input.current.value = ''; }
      } catch (error) {
        setOperation(current => current ? { ...current, status: 'error' } : null);
        throw error;
      } finally { onChanged(); setPage(1); setSituacao(''); setRevision(v => v + 1); }
    });
  }
  async function downloadTemplate() {
    await run(async () => {
      const response = await fetch(`${endpoint}?modelo=1`, { cache: 'no-store', credentials: 'same-origin' });
      const blob = await readSispatWorkbookDownload(response);
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'modelo-sispat.xlsx'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  async function downloadBackup(issues = false) {
    if (!detail) return;
    await run(async () => {
      const response = await fetch(`${endpoint}?importacao=${detail.id}&${issues ? 'pendencias=1' : 'download=1'}`, { cache: 'no-store' });
      if (!response.ok) { await result(response); return; }
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = issues ? `sispat-pendencias-${detail.id}.xlsx` : `sispat-backup-${detail.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  const pages = Math.max(1, Math.ceil((detail?.totalItens ?? 0) / 50));
  const historyPages = Math.max(1, Math.ceil(history.total / 10));
  const expired = detail ? Date.now() - new Date(detail.criadoEm).getTime() > 15 * 60 * 1000 : false;

  const progressPercent = operation?.status === 'done' ? 100 : operation?.progress.total ? Math.min(99, Math.round(operation.progress.processados / operation.progress.total * 100)) : 0;
  const metrics = detail ? [
    { label: detail.status === 'APLICADA' ? 'Atualizados' : detail.status === 'DESFEITA' ? 'Restaurados' : 'A atualizar', value: detail.status === 'APLICADA' ? detail.resumo.ATUALIZADO : detail.status === 'DESFEITA' ? detail.resumo.DESFEITO : detail.resumo.PENDENTE, note: `${(detail.novosCadastros ?? 0).toLocaleString('pt-BR')} preenchimentos · ${(detail.substituicoes ?? 0).toLocaleString('pt-BR')} substituições`, accent: true },
    { label: 'Já corretos', value: detail.resumo.SEM_ALTERACAO, note: 'Preservados, sem gravação' },
    { label: 'Ignorados', value: detail.resumo.IGNORADO, note: 'Sem SISPAT na planilha' },
    { label: 'Pendências', value: detail.resumo.ERRO + detail.resumo.NAO_ENCONTRADO + detail.resumo.NAO_APLICADO, note: `${detail.resumo.ERRO} erros · ${detail.resumo.NAO_ENCONTRADO} não encontrados · ${detail.resumo.NAO_APLICADO} não aplicados` },
  ] : [];
  const resultPanel = selectedId && <section className={styles.panel} aria-label="Resultado da importação">
      <div className={styles.sectionHeading}><div><span className={styles.sectionEyebrow}>REVISÃO</span><h2>Resultado da importação</h2></div><ActionButton variant="ghost" disabled={busy || loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={15} aria-hidden="true" />Atualizar resultado</ActionButton></div>
      {operation && <div className={styles.progressPanel} role="status" aria-live="polite">
        <div className={styles.progressHeading}><strong>{operation.status === 'done' ? operation.action === 'confirm' ? 'Importação concluída' : 'Restauração concluída' : operation.status === 'error' ? 'Processamento interrompido. Consulte o resultado abaixo.' : operation.progress.fase === 'CONFIRMANDO' ? 'Confirmando gravação no banco…' : operation.progress.fase === 'PREPARANDO' ? 'Preparando processamento…' : operation.action === 'confirm' ? 'Atualizando SISPATs…' : 'Restaurando SISPATs…'}</strong><span>{progressPercent}%</span></div>
        <Progress progress={progressPercent} size="sm" color="sispat" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-label="Progresso do processamento" theme={{ base: styles.progressTrack, bar: styles.progressBar, color: { sispat: styles.progressColor }, size: { sm: styles.progressSize } }} applyTheme={{ base: 'replace', bar: 'replace', color: { sispat: 'replace' }, size: { sm: 'replace' } }} />
        <small>{operation.status === 'running' && operation.progress.fase === 'PREPARANDO' ? 'Validando a operação no servidor.' : `${operation.progress.processados.toLocaleString('pt-BR')} de ${operation.progress.total.toLocaleString('pt-BR')} registros processados`}{operation.status === 'running' ? ' · A gravação só é concluída após a confirmação final.' : ''}</small>
      </div>}
      {loading && <p role="status">Carregando resultado…</p>}
      {detailError && <p className={styles.error} role="alert">{detailError}</p>}
      {detail && <>
        <div className={styles.fileHeading}>
          <span className={styles.fileIcon}><FileSpreadsheet size={22} aria-hidden="true" /></span>
          <div className={styles.fileHeadingText}><h3 title={detail.nomeArquivo}>{detail.nomeArquivo}</h3><p>{detail.total.toLocaleString('pt-BR')} linhas · {detail.aba} · {formatDate(detail.criadoEm)}</p></div>
          <Badge color="review" theme={{ root: { color: { review: styles.statusBadge } } }}>{runLabels[detail.status] ?? detail.status}</Badge>
        </div>
        <p className={styles.author}>Enviado por <strong>{detail.criadoPorNome || `Usuário #${detail.criadoPorId}`}</strong>{detail.aplicadoEm && ` · Processado em ${formatDate(detail.aplicadoEm)}`}</p>
        {detail.desfeitoEm && <p className={styles.author}>Desfeito por <strong>{detail.restauradoPorNome || `Usuário #${detail.restauradoPorId}`}</strong> em {formatDate(detail.desfeitoEm)}</p>}
        <div className={styles.metricGrid}>{metrics.map(metric => <Card key={metric.label} theme={{ root: { base: metric.accent ? `${styles.metricCard} ${styles.metricAccent}` : styles.metricCard, children: styles.metricBody } }} applyTheme={{ root: { base: 'replace', children: 'replace' } }}>
          <span className={styles.metricLabel}>{metric.label}</span><strong className={styles.metricValue}>{metric.value.toLocaleString('pt-BR')}</strong><span className={styles.metricNote}>{metric.note}</span>
        </Card>)}</div>
        {(!!detail.linhasComAlerta || (!!detail.substituicoes && detail.status === 'PREVIA')) && <div className={styles.reviewNotice}>
          <AlertTriangle size={18} aria-hidden="true" /><div><strong>Revise os vínculos antes de confirmar</strong><p>{detail.substituicoes ?? 0} substituições de número · {detail.numerosDuplicados ?? 0} SISPATs compartilhados em {detail.linhasComAlerta ?? 0} linhas. Duplicidade é um alerta informativo.</p></div>
          <div className={styles.noticeActions}>{!!detail.substituicoes && <ActionButton variant="ghost" disabled={busy} onClick={() => { setSituacao('SUBSTITUICAO'); setPage(1); }}>Ver substituições<ArrowRight size={14} aria-hidden="true" /></ActionButton>}{!!detail.linhasComAlerta && <ActionButton variant="ghost" disabled={busy} onClick={() => { setSituacao('DUPLICIDADE'); setPage(1); }}>Ver duplicidades<ArrowRight size={14} aria-hidden="true" /></ActionButton>}</div>
        </div>}
        {detail.erro && <p role="alert" className={styles.error}>{detail.erro}</p>}
        {detail.status === 'INVALIDA' && <p className={styles.error}>Existem erros na planilha. Nenhum SISPAT foi alterado. Consulte as linhas com erro, corrija o arquivo e analise novamente.</p>}
        <div className={styles.toolbar}><label className={styles.filter}>Situação das linhas<select value={situacao} disabled={busy} onChange={event => { setSituacao(event.target.value); setPage(1); }}><option value="">Todas as situações</option><option value="CADASTRO">Preenchimentos de campo vazio ({detail.novosCadastros ?? 0})</option><option value="SUBSTITUICAO">Substituições de número ({detail.substituicoes ?? 0})</option><option value="DUPLICIDADE">Alertas de duplicidade ({detail.linhasComAlerta ?? 0})</option>{Object.entries(SISPAT_SITUACOES).map(([key, label]) => <option key={key} value={key}>{label} ({detail.resumo[key as SispatSituacao] ?? 0})</option>)}</select></label><span>{detail.totalItens.toLocaleString('pt-BR')} {detail.totalItens === 1 ? 'linha nesta seleção' : 'linhas nesta seleção'}</span></div>
        <div className={`${styles.tableScroll} ${styles.resultScroll}`}><table><caption className={styles.srOnly}>Resultado de cada linha da planilha</caption><thead><tr><th>Linha</th><th>Funcionário / Matrícula</th><th>SISPAT anterior</th><th>SISPAT na planilha</th><th>Situação e motivo</th></tr></thead><tbody>{detail.itens.length ? detail.itens.map(item => <tr key={item.linha}><td>{item.linha}</td><td>{item.nome && <div>{item.nome}</div>}<span className={styles.code}>{item.matricula || 'Não informada'}</span></td><td className={styles.code}>{item.anterior ?? '—'}</td><td><span className={styles.code}>{item.recebido || '—'}</span>{item.tipoAlteracao && <div className={item.tipoAlteracao === 'SUBSTITUICAO' ? styles.replacement : styles.fill}>{item.tipoAlteracao === 'SUBSTITUICAO' ? 'Substitui número existente' : 'Preenche campo vazio'}</div>}</td><td className={styles.outcome}><strong>{SISPAT_SITUACOES[item.status]}</strong><div>{item.motivo}</div>{item.alertaDuplicidade && <ActionButton className={styles.alertButton} disabled={busy} onClick={() => setDuplicate(item.recebido)}>Duplicidade · ver envolvidos</ActionButton>}</td></tr>) : <tr><td colSpan={5}>Nenhuma linha nesta situação.</td></tr>}</tbody></table></div>
        <footer className={styles.pagination}><span>Página {page} de {pages} · até 50 linhas por página</span><div className={styles.actions}><ActionButton disabled={busy || page <= 1} onClick={() => setPage(v => v - 1)}>Linhas anteriores</ActionButton><ActionButton disabled={busy || page >= pages} onClick={() => setPage(v => v + 1)}>Próximas linhas</ActionButton></div></footer>
        {duplicate && <SispatDuplicate key={`${detail.id}-${duplicate}`} importacaoId={detail.id} sispat={duplicate} busy={busy} onClose={() => setDuplicate(null)} />}
        <div className={styles.decisionBar}>
          <div className={styles.backupState}><ShieldCheck size={18} aria-hidden="true" /><span><strong>Backup salvo no servidor</strong><small>{detail.status === 'PREVIA' ? expired ? 'Prévia expirada. Analise novamente.' : detail.criadoPorId !== actorId ? 'A confirmação deve ser feita por quem enviou o arquivo.' : 'Revise os dados. A prévia vale por 15 minutos.' : 'Valores anteriores disponíveis para consulta.'}</small></span></div>
          <div className={styles.decisionActions}>
            {canDownloadBackup && <ActionButton variant="ghost" disabled={busy} onClick={() => downloadBackup()} aria-label="Baixar backup e relatório"><Download size={15} aria-hidden="true" />Backup</ActionButton>}
            <ActionButton variant="secondary" disabled={busy || !(detail.resumo.ERRO + detail.resumo.NAO_ENCONTRADO + detail.resumo.NAO_APLICADO + detail.resumo.IGNORADO + (detail.linhasComAlerta ?? 0))} onClick={() => downloadBackup(true)} aria-label="Baixar pendências (.xlsx)" title="Inclui a aba Corrigir e importar"><Download size={15} aria-hidden="true" />Pendências</ActionButton>
            {detail.status === 'PREVIA' && <ActionButton variant="primary" disabled={busy || expired || detail.criadoPorId !== actorId} onClick={() => execute('confirm')}>{operation?.status === 'running' ? <LoaderCircle size={16} className={styles.spinning} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{operation?.status === 'running' ? 'Processando…' : detail.resumo.PENDENTE ? `Confirmar ${detail.resumo.PENDENTE.toLocaleString('pt-BR')} alterações` : 'Concluir sem alterações'}</ActionButton>}
            {detail.status === 'APLICADA' && <ActionButton variant="danger" disabled={busy} onClick={() => execute('revert')}>Desfazer importação</ActionButton>}
          </div>
        </div>

      </>}
    </section>;
  return <TabGroup selectedIndex={tab} onChange={setTab}>
    <TabList className={styles.tabs} aria-label="Ferramentas de planilha">
      <Tab disabled={busy}><Upload size={15} aria-hidden="true" />Importar</Tab>
      <Tab disabled={busy}><Download size={15} aria-hidden="true" />Exportar</Tab>
      <Tab disabled={busy}><History size={15} aria-hidden="true" />Histórico</Tab>
    </TabList>
    <TabPanels>
      <TabPanel unmount={false}>
    <section className={styles.panel} aria-labelledby="import-title">
      <div className={styles.sectionHeading}><h2 id="import-title">Importar planilha</h2><div className={styles.importTools}><span>XLSX · até 5 MB · 20.000 linhas</span><button type="button" disabled={busy} onClick={downloadTemplate} className={styles.templateLink}><Download size={14} aria-hidden="true" />Baixar modelo (.xlsx)</button></div></div>
      <div className={styles.uploadRow}>
        <label className={styles.filePicker}>
          <span className={styles.fileIcon}><FileSpreadsheet size={24} aria-hidden="true" /></span>
          <span className={styles.filePickerText}><strong title={file?.name}>{file?.name || 'Escolha sua planilha de SISPAT'}</strong><small>{file ? `${(file.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB · Pronto para analisar` : 'Arquivo .xlsx com Matrícula e SISPAT'}</small></span>
          <span className={styles.filePickerAction}>{file ? 'Trocar arquivo' : 'Selecionar arquivo'}</span>
          <input ref={input} type="file" aria-label="Planilha de SISPAT" accept=".xlsx" className={styles.srOnly} disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <ActionButton variant="primary" disabled={busy || !file} onClick={analyze}><Upload size={16} aria-hidden="true" />{busy ? 'Processando…' : 'Analisar planilha'}</ActionButton>
      </div>
      <p className={styles.uploadHint}><ShieldCheck size={14} aria-hidden="true" />Localizamos Matrícula e SISPAT pelos cabeçalhos; outras colunas são ignoradas. A análise não altera cadastros.</p>
    </section>
        {tab === 0 && resultPanel}
      </TabPanel>
      <TabPanel unmount={false}>
        <section className={styles.panel} aria-labelledby="export-title">
          <h2 id="export-title">Exportar SISPATs cadastrados</h2>
          <p>Baixe todos os funcionários com apenas as colunas <strong>Matrícula</strong> e <strong>SISPAT</strong>. O arquivo pode ser corrigido e enviado na aba Importar.</p>
          <p>O download inclui quem ainda não tem SISPAT e preserva os zeros à esquerda dos identificadores.</p>
          <div className={styles.toolbar}><ActionButton variant="primary" disabled={busy} onClick={onExport}><Download size={15} aria-hidden="true" />Baixar planilha (.xlsx)</ActionButton></div>
        </section>
      </TabPanel>
      <TabPanel unmount={false}>
    <section className={styles.panel} aria-label="Histórico de importações">
      <div className={styles.sectionHeading}><h2>Histórico de importações</h2><span>{history.total} importações · backup salvo no servidor</span></div>
      {historyError && <p className={styles.error} role="alert">{historyError}</p>}
      <div className={styles.tableScroll}><table><thead><tr><th>Data</th><th>Arquivo / Responsável</th><th>Resultado</th><th>Linhas</th><th>Ações</th></tr></thead><tbody>{historyLoading ? <tr><td colSpan={5}>Carregando histórico…</td></tr> : history.importacoes.length ? history.importacoes.map(item => <tr key={item.id}><td>{formatDate(item.criadoEm)}</td><td>{item.nomeArquivo}<div className={styles.muted}>Por {item.criadoPorNome || `Usuário #${item.criadoPorId}`}</div>{item.desfeitoEm && <div className={styles.muted}>Desfeito por {item.restauradoPorNome || `Usuário #${item.restauradoPorId}`} · {formatDate(item.desfeitoEm)}</div>}</td><td>{runLabels[item.status] ?? item.status}</td><td>{item.total}</td><td><ActionButton disabled={busy} onClick={() => open(item.id)}>Abrir resultado</ActionButton></td></tr>) : <tr><td colSpan={5}>Nenhuma importação registrada.</td></tr>}</tbody></table></div>
      <footer className={styles.pagination}><span>Página {historyPage} de {historyPages}</span><div className={styles.actions}><ActionButton disabled={busy || historyLoading || historyPage <= 1} onClick={() => setHistoryPage(v => v - 1)}>Importações anteriores</ActionButton><ActionButton disabled={busy || historyLoading || historyPage >= historyPages} onClick={() => setHistoryPage(v => v + 1)}>Próximas importações</ActionButton></div></footer>
    </section>
        {tab === 2 && resultPanel}
      </TabPanel>
    </TabPanels>
  </TabGroup>;
}
