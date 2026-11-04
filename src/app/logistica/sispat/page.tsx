'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { ArrowUpDown, X } from 'lucide-react';
import { useAuth } from '@/app/hooks/useAuth';
import { canManageSispat, canDownloadSispatBackup, SispatFuncionario } from '@/lib/sispat/shared';
import styles from './sispat.module.css';
import { ActionButton } from './SispatUI';
import SispatImports from './ImportacoesSispat';

const endpoint = '/api/logistica/sispat';
async function result(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SispatPage() {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="p-6" role="status">Verificando acesso…</div>;
  if (!usuario || !canManageSispat(usuario.equipe)) return <div className="p-6" role="alert">Acesso permitido à Administração e à Logística (Editor ou Gestor).</div>;
  return <SispatWorkspace actorId={usuario.id} canDownloadBackup={canDownloadSispatBackup(usuario.equipe)} />;
}

function SispatWorkspace({ actorId, canDownloadBackup }: { actorId: number; canDownloadBackup: boolean }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [rows, setRows] = useState<SispatFuncionario[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<SispatFuncionario | null>(null);
  const [value, setValue] = useState('');
  const editInput = useRef<HTMLInputElement>(null);
  const actionLock = useRef(false);
  const limit = 50;
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`${endpoint}?${new URLSearchParams({ page: String(page), limit: String(limit), q: query })}`, { cache: 'no-store', signal: controller.signal })
      .then(result).then(data => { setRows(data.funcionarios); setTotal(data.total); })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setRows([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, reload]);
  useEffect(() => { if (editing) editInput.current?.focus(); }, [editing]);

  async function run(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Falha na operação.'); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    await run(async () => {
      await result(await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, anterior: editing.sispat, atualizadoEm: editing.atualizadoEm, sispat: value.trim() }) }));
      setEditing(null); setMessage('SISPAT salvo.'); setReload(n => n + 1);
    });
  }
  async function remove(row: SispatFuncionario) {
    if (!window.confirm(`Excluir o SISPAT ${row.sispat} de ${row.nome} (${row.matricula})? O funcionário será mantido.`)) return;
    await run(async () => {
      await result(await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, anterior: row.sispat, atualizadoEm: row.atualizadoEm }) }));
      setEditing(null); setMessage('SISPAT excluído.'); setReload(n => n + 1);
    });
  }
  async function exportAll() {
    await run(async () => {
      const response = await fetch(`${endpoint}?export=1`, { cache: 'no-store' });
      if (!response.ok) { await result(response); return; }
      download(await response.blob(), 'matricula-sispat.xlsx');
    });
  }

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>LOGÍSTICA</p><h1>SISPAT dos funcionários</h1><p>Consulte, cadastre e corrija o número de SISPAT dos funcionários.</p></div>
      <ActionButton variant="primary" disabled={busy} onClick={() => setToolsOpen(true)}><ArrowUpDown size={16} aria-hidden="true" />Importar / exportar</ActionButton>
    </header>
    <div aria-live="polite">{!toolsOpen && error && <p role="alert" className={styles.error}>{error}</p>}{!toolsOpen && message && <p role="status" className={styles.success}>{message}</p>}</div>
    <section className={styles.panel} aria-labelledby="employees-title">
      <div className={styles.sectionHeading}><h2 id="employees-title">Funcionários <span>({total.toLocaleString('pt-BR')})</span></h2><label className={styles.search}>Buscar funcionário<input type="search" maxLength={100} placeholder="Nome, matrícula ou SISPAT" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      {editing && <form className={styles.editForm} onSubmit={save}>
        <div><h3>{editing.sispat ? 'Editar' : 'Cadastrar'} SISPAT</h3><p>{editing.nome} · <span className={styles.code}>{editing.matricula}</span></p></div>
        <label>Número do SISPAT<input ref={editInput} inputMode="numeric" pattern="[0-9]{1,30}" maxLength={30} required value={value} disabled={busy} onChange={e => setValue(e.target.value)} /></label>
        <ActionButton variant="primary" disabled={busy} type="submit">Salvar SISPAT</ActionButton><ActionButton disabled={busy} type="button" onClick={() => setEditing(null)}>Cancelar</ActionButton>
      </form>}
      <div className={styles.tableScroll}><table aria-busy={loading}><caption className={styles.srOnly}>Todos os funcionários cadastrados, incluindo quem ainda não tem SISPAT</caption><thead><tr><th>Funcionário</th><th>Matrícula</th><th>SISPAT cadastrado</th><th>Ações</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={4}>Carregando funcionários…</td></tr> : rows.length ? rows.map(row => <tr key={row.id}><td>{row.nome}</td><td className={styles.code}>{row.matricula}</td><td className={styles.code}>{row.sispat || <span className={styles.muted}>Não cadastrado</span>}</td><td><div className={styles.actions}><ActionButton disabled={busy} aria-label={`${row.sispat ? 'Editar' : 'Cadastrar'} SISPAT de ${row.nome}`} onClick={() => { setEditing(row); setValue(row.sispat ?? ''); }}>{row.sispat ? 'Editar' : 'Cadastrar'}</ActionButton>{row.sispat && <ActionButton variant="danger" disabled={busy} aria-label={`Excluir SISPAT de ${row.nome}`} onClick={() => remove(row)}>Excluir</ActionButton>}</div></td></tr>) : <tr><td colSpan={4}>{error ? 'Não foi possível carregar a lista.' : 'Nenhum funcionário encontrado.'}</td></tr>}
      </tbody></table></div>
      <footer className={styles.pagination}><span>Página {page} de {pages} · {total.toLocaleString('pt-BR')} {total === 1 ? 'funcionário' : 'funcionários'}</span><div className={styles.actions}><ActionButton disabled={page <= 1 || loading || busy} onClick={() => setPage(p => p - 1)}>Anterior</ActionButton><ActionButton disabled={page >= pages || loading || busy} onClick={() => setPage(p => p + 1)}>Próxima</ActionButton><ActionButton disabled={loading || busy} onClick={() => setReload(n => n + 1)}>Atualizar</ActionButton></div></footer>
    </section>
    {toolsOpen && <Dialog open={toolsOpen} onClose={() => { if (!busy) setToolsOpen(false); }} className={styles.dialog}>
      <DialogBackdrop className={styles.modalBackdrop} />
      <div className={styles.modalViewport}>
        <DialogPanel className={`${styles.page} ${styles.modalPanel}`}>
          <div className={styles.modalHeader}><div><DialogTitle>Planilhas de SISPAT</DialogTitle><Description>Importação, exportação e histórico em um só lugar.</Description></div><ActionButton aria-label="Fechar ferramentas de SISPAT" disabled={busy} onClick={() => setToolsOpen(false)}><X size={18} aria-hidden="true" /></ActionButton></div>
          <div className={styles.modalBody}>
            <div aria-live="polite">{error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}</div>
            <SispatImports canDownloadBackup={canDownloadBackup} actorId={actorId} busy={busy} run={run} onChanged={() => setReload(n => n + 1)} onFeedback={setMessage} onExport={exportAll} />
          </div>
        </DialogPanel>
      </div>
    </Dialog>}
  </div>;
}
