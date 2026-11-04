'use client';
import { useEffect, useState } from 'react';
import { SispatDuplicidadePagina } from '@/lib/sispat/shared';
import styles from './sispat.module.css';
import { ActionButton } from './SispatUI';

export default function SispatDuplicate({ importacaoId, sispat, busy, onClose }: { importacaoId: string; sispat: string; busy: boolean; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SispatDuplicidadePagina | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const query = new URLSearchParams({ importacao: importacaoId, duplicidade: sispat, page: String(page), limit: '50' });
    fetch(`/api/logistica/sispat?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Falha ao carregar envolvidos.'); return body;
    }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [importacaoId, sispat, page]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));
  const origins = { PLANILHA: 'Planilha', CADASTRO: 'Cadastro atual', PLANILHA_E_CADASTRO: 'Planilha e cadastro' };
  return <section className={styles.duplicatePanel} aria-label="Envolvidos na duplicidade">
    <div className={styles.sectionHeading}><h3>SISPAT {sispat} · envolvidos na análise</h3><ActionButton disabled={busy} onClick={onClose}>Fechar envolvidos</ActionButton></div>
    <p>Alerta informativo sobre a planilha e o resultado previsto nos cadastros. Confira os vínculos antes de confirmar.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.tableScroll}><table><thead><tr><th>Matrícula</th><th>Funcionário</th><th>Origem</th></tr></thead><tbody>{loading ? <tr><td colSpan={3}>Carregando envolvidos…</td></tr> : data?.itens.map(item => <tr key={item.matricula}><td className={styles.code}>{item.matricula}</td><td>{item.nome || 'Nome não encontrado'}</td><td>{origins[item.origem]}</td></tr>)}</tbody></table></div>
    <footer className={styles.pagination}><span>{data?.total ?? 0} envolvidos · página {page} de {pages}</span><div className={styles.actions}><ActionButton disabled={busy || loading || page <= 1} onClick={() => setPage(p => p - 1)}>Envolvidos anteriores</ActionButton><ActionButton disabled={busy || loading || page >= pages} onClick={() => setPage(p => p + 1)}>Próximos envolvidos</ActionButton></div></footer>
  </section>;
}
