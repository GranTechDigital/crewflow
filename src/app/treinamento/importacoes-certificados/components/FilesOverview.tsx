"use client";
import { SearchField, Input } from "react-aria-components";
import { RefreshCw, Search, FileSpreadsheet, FolderOpen, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ImportacoesResponse } from "../types";
import { Action } from "./CertificateUi";
import { Badge, FileProgress, formatDate, reviewCount, statusImportacao, statusLabel } from "./CertificatePresentation";

export function FilesOverview({ data, loading, busy, criteria, onCriteriaChange, onSearch, onOpen, onPage, onRefresh }: { data: ImportacoesResponse | null; loading: boolean; busy: boolean; criteria: { q: string; status: string }; onCriteriaChange: (value: { q: string; status: string }) => void; onSearch: () => void; onOpen: (id: number) => void; onPage: (page: number) => void; onRefresh: () => void }) {
  const { q, status } = criteria, importacoes = data?.importacoes ?? [], page = data?.page ?? 1;
  const inputClass = "h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#af261d] focus:ring-2 focus:ring-[#af261d]/10";
  return <section aria-label="Arquivos de certificados" className="min-w-0 space-y-3">
    <form onSubmit={event => { event.preventDefault(); onSearch(); }} className="flex flex-wrap items-center gap-2">
      <SearchField aria-label="Buscar arquivo importado" value={q} onChange={value => onCriteriaChange({ ...criteria, q: value })} className="relative min-w-[160px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" /><Input placeholder="Buscar arquivo ou descrição" className={`${inputClass} w-full !pl-9`} />
      </SearchField>
      <select aria-label="Situação dos arquivos" value={status} onChange={e => onCriteriaChange({ ...criteria, status: e.target.value })} className={`${inputClass} max-w-full flex-1 sm:flex-none`}>{statusImportacao.map(option => <option key={option} value={option}>{option === "TODOS" ? "Todas as situações" : statusLabel(option)}</option>)}</select>
      <Action type="submit" isDisabled={busy || loading}><Search className="size-3.5" />Buscar</Action>
      <Action aria-label="Atualizar arquivos" variant="ghost" isDisabled={busy || loading} onPress={onRefresh}><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Atualizar</span></Action>
    </form>
    <div className="overflow-x-auto rounded-md border border-slate-200" aria-busy={loading}>
      <table className="w-full min-w-[920px] table-fixed text-left text-xs">
        <caption className="sr-only">Arquivos importados de certificados</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500"><tr>
          <th className="w-[32%] px-3 py-2 font-medium">Arquivo / descrição</th><th className="w-[17%] px-3 py-2 font-medium">Situação</th><th className="w-[20%] px-3 py-2 font-medium">Progresso no Crew</th><th className="w-[8%] px-3 py-2 text-right font-medium">Revisão</th><th className="w-[13%] px-3 py-2 font-medium">Atualizado</th><th className="w-[10%] px-3 py-2 font-medium"><span className="sr-only">Ações</span></th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{importacoes.map(batch => <tr key={batch.id} className="hover:bg-slate-50/80">
          <td className="px-3 py-2.5"><div className="flex min-w-0 items-center gap-2.5"><FileSpreadsheet className="size-4 shrink-0 text-slate-400" /><div className="min-w-0" title={`${batch.nomeArquivo} · Criado em ${formatDate(batch.createdAt)}`}><p className="truncate text-[13px] font-medium text-slate-900">{batch.descricao || batch.nomeArquivo}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">#{batch.id} · {batch.usuario.funcionario.nome}{batch.descricao && batch.descricao !== batch.nomeArquivo ? ` · ${batch.nomeArquivo}` : ""}</p></div></div></td>
          <td className="px-3 py-2.5"><Badge value={batch.status} /></td>
          <td className="px-3 py-2.5"><FileProgress batch={batch} compact /></td>
          <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${reviewCount(batch) ? "text-amber-800" : "text-slate-400"}`}>{reviewCount(batch)}</td>
          <td className="px-3 py-2.5 text-[11px] tabular-nums text-slate-500">{formatDate(batch.updatedAt)}</td>
          <td className="px-2 py-2.5 text-right"><Action variant="ghost" aria-label={`Ver certificados do arquivo #${batch.id}`} isDisabled={busy || loading} onPress={() => onOpen(batch.id)} className="!h-8 !px-2 !text-xs">Abrir<ArrowRight className="size-3.5" /></Action></td>
        </tr>)}{!importacoes.length && <tr><td colSpan={6} className="py-12 text-center text-slate-500"><FolderOpen className="mx-auto mb-2 size-6 text-slate-300" />{loading ? "Carregando arquivos…" : "Nenhum arquivo encontrado"}</td></tr>}</tbody>
      </table>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>{data?.total ?? 0} arquivos · Página {page} de {Math.max(1, data?.totalPages ?? 1)}</p><div className="flex gap-1"><Action aria-label="Página anterior de arquivos" className="!h-8 !px-2" isDisabled={loading || page <= 1} onPress={() => onPage(page - 1)}><ChevronLeft className="size-4" /></Action><Action aria-label="Próxima página de arquivos" className="!h-8 !px-2" isDisabled={loading || page >= (data?.totalPages ?? 1)} onPress={() => onPage(page + 1)}><ChevronRight className="size-4" /></Action></div></footer>
  </section>;
}
