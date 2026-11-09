"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SearchField, Input } from "react-aria-components";
import { Action, SurfaceDialog, FieldValue } from "./components/CertificateUi";
import type { Importacao, ItemImportacao, ImportacoesResponse, DetalheResponse } from "./types";
import { statusItens, statusLabel, formatDate, formatDateOnly, validityLabel, reviewCount, FileProgress, Badge } from "./components/CertificatePresentation";
import { ImportWizard } from "./components/ImportWizard";
import { FilesOverview } from "./components/FilesOverview";
import { CertificateEditor } from "./components/CertificateEditor";
import { CarregamentoComment } from "./components/CarregamentoComment";
import { ReferenceDocuments } from "./components/ReferenceDocuments";
import { CERTIFICADO_MAX_BYTES, CERTIFICADO_EDITABLE_STATUS, CERTIFICADO_CANCELABLE_STATUS, CertificadoProgresso, readCertificadoDownload, readCertificadoProgress } from "@/lib/integracoes/certificadosDrakeShared";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FolderOpen, Pencil, Ban, Loader2, Plus, RefreshCw, Search, Send, UploadCloud } from "lucide-react";

export function CertificateWorkspace() {
  const [data, setData] = useState<ImportacoesResponse | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const actionLock = useRef(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [cancelTarget, setCancelTarget] = useState<{ item?: ItemImportacao } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [correctionId, setCorrectionId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<ItemImportacao | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentVersion, setCommentVersion] = useState<string | null>(null);
  const [commentDirty, setCommentDirty] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState<"select" | "review" | "sending" | "done">("select");
  const [uploadSummary, setUploadSummary] = useState<Importacao | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"files" | "batch">("files");
  const detailRequest = useRef(0);
  const listRequest = useRef(0);
  const descriptionOwner = useRef<number | null>(null);
  const descriptionDirty = useRef(false);
  const [progress, setProgress] = useState<CertificadoProgresso | null>(null);
  const [sendFinished, setSendFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState("TODOS");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [itemStatus, setItemStatus] = useState("TODOS");
  const [itemQ, setItemQ] = useState("");
  const [itemPage, setItemPage] = useState(1);

  const importacoes = useMemo(() => data?.importacoes ?? [], [data]);
  const selectedImportacao =
    detalhe?.importacao ?? importacoes.find((item) => item.id === selectedId);

  async function loadImportacoes(nextPage = page, preserveError = false) {
    const request = ++listRequest.current;
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", "20");

      if (status !== "TODOS") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());

      const response = await fetch(`/api/treinamento/importacoes-certificados?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar importações.");
      if (request !== listRequest.current) return;
      setData(payload);
      setPage(nextPage);
    } catch (err) {
      if (request !== listRequest.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }

  async function loadDetalhe(id: number, nextPage = itemPage, preserveError = false, statusOverride = itemStatus, queryOverride = itemQ) {
    const request = ++detailRequest.current;
    if (id !== selectedId) { setDetalhe(null); setReviewId(null); }
    setSelectedId(id);
    setLoadingDetalhe(true);
    if (!preserveError) setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", "50");
      if (statusOverride !== "TODOS") params.set("status", statusOverride);
      if (queryOverride.trim()) params.set("q", queryOverride.trim());

      const response = await fetch(`/api/treinamento/importacoes-certificados/${id}?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar itens.");
      if (request !== detailRequest.current) return;
      setDetalhe(payload);
      if (descriptionOwner.current !== id || !descriptionDirty.current) {
        descriptionOwner.current = id; descriptionDirty.current = false;
        setCommentText(payload.historico?.comentario?.texto ?? "");
        setCommentVersion(payload.historico?.comentario?.atualizadoEm ?? null);
        setCommentDirty(false);
      }
      setSelectedId(id);
      setItemPage(nextPage);
      return payload as DetalheResponse;
    } catch (err) {
      if (request !== detailRequest.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      if (request === detailRequest.current) setLoadingDetalhe(false);
    }
  }

  async function uploadFile(file: File) {
    if (actionLock.current) return;
    if (!correctionId && !newDescription.trim()) { setError("Preencha a descrição do novo carregamento antes de selecionar o arquivo."); return; }
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > CERTIFICADO_MAX_BYTES) { setError("Selecione um XLSX de até 5 MB."); return; }
    actionLock.current = true;
    setUploading(true);
    setProgress(null); setSendFinished(false);
    setError(null);
    setMessage(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.set("file", file);
      if(!data?.ambiente)throw new Error("Aguarde a configuração do ambiente.");
      form.set("ambiente", data.ambiente);
      if (correctionId) form.set("substituiImportacaoId", String(correctionId));
      else form.set("descricao", newDescription.trim());
      const response = await fetch("/api/treinamento/importacoes-certificados", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao importar planilha.");
      const importacao = payload.importacao as { id: number };
      setMessage(
        payload.jaExistia
          ? "Esta planilha já havia sido importada. Abrimos o lote existente."
          : "Planilha importada e analisada.",
      );
      await loadImportacoes(1);
      setWorkspaceView("batch");
      setItemStatus("TODOS"); setItemQ(""); setReviewId(null);
      const analysis = await loadDetalhe(importacao.id, 1, false, "TODOS", "");
      if (!analysis) throw new Error("O arquivo foi carregado, mas não foi possível abrir a análise. Consulte o histórico.");
      setUploadSummary(analysis.importacao);
      setUploadStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      actionLock.current = false;
      setUploading(false);
    }
  }

  async function enviarPendentes() {
    if (!uploadSummary || actionLock.current || !uploadSummary.totalPendentes) return;
    const importacaoId = uploadSummary.id;
    setUploadStage("sending");
    actionLock.current = true;
    setSending(true);
    setSendFinished(false);
    setProgress({ fase: "PREPARANDO", processados: 0, total: uploadSummary.totalPendentes, enviados: 0, falhas: 0, naoConfirmados: 0, ignorados: 0 });
    setError(null);
    setMessage(null);
    try {
      if (commentDirty) await persistComment(importacaoId);
      const response = await fetch(
        `/api/treinamento/importacoes-certificados/${importacaoId}/enviar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
          body: JSON.stringify({ todosPendentes: true, totalEsperado: uploadSummary.totalPendentes, confirmar: true }),
        },
      );
      const payload = await readCertificadoProgress<{ processados: number; totalSelecionado: number; enviados: number; falhas: number; naoConfirmados: number; ignorados: number; interrompido: boolean }>(response, setProgress);
      setSendFinished(!payload.interrompido);

      setMessage(
        `${payload.interrompido ? "Envio interrompido para conferência" : "Execução finalizada"}: ${payload.processados}/${payload.totalSelecionado} processados, ${payload.enviados} enviados, ${payload.falhas} com erro, ${payload.naoConfirmados} não confirmados e ${payload.ignorados} desconsiderados. Enviado não significa confirmado no Drake.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      actionLock.current = false;
      setSending(false);
      setUploadStage("done");
      await loadImportacoes(page, true);
      await loadDetalhe(importacaoId, 1, true, "TODOS", "");
      setItemStatus("TODOS"); setItemQ("");
    }
  }

  async function baixarPlanilha(kind: "modelo" | "resultado" | "pendencias") {
    if (actionLock.current || (kind !== "modelo" && !selectedId)) return;
    actionLock.current = true; setDownloading(true); setError(null);
    try {
      const url = kind === "modelo" ? "/api/treinamento/importacoes-certificados?modelo=1" : `/api/treinamento/importacoes-certificados/${selectedId}?relatorio=${kind}`;
      const blob = await readCertificadoDownload(await fetch(url, { cache: "no-store", credentials: "same-origin" }));
      const objectUrl = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = objectUrl; link.download = kind === "modelo" ? "modelo-certificados.xlsx" : `certificados-${kind}-${selectedId}.xlsx`; link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha no download."); }
    finally { actionLock.current = false; setDownloading(false); }
  }

  async function conferirReferencia() {
    if (!selectedId || actionLock.current) return;
    actionLock.current = true; setChecking(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/treinamento/importacoes-certificados/${selectedId}/enviar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reference" }) });
      const body = await response.json(); if (!response.ok) throw Error(body.error || "Falha ao conferir referência.");
      setMessage(`${body.analisados} item(ns) conferido(s). Nenhum envio ao Drake foi realizado.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao conferir referência."); }
    finally { actionLock.current = false; setChecking(false); await loadImportacoes(page, true); await loadDetalhe(selectedId, itemPage, true); }
  }

  async function recuperarExecucao() {
    if (!selectedId || actionLock.current || !window.confirm("Recuperar a execução interrompida? Itens cujo resultado é desconhecido ficarão como Não confirmado e não serão reenviados. Confira-os no Drake.")) return;
    actionLock.current = true; setSending(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/treinamento/importacoes-certificados/${selectedId}/enviar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recover" }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Falha ao recuperar execução.");
      setMessage("Execução recuperada. Itens não confirmados exigem conferência no Drake antes de qualquer novo envio.");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao recuperar execução."); }
    finally { actionLock.current = false; setSending(false); await loadImportacoes(page, true); await loadDetalhe(selectedId, itemPage, true); }
  }

  async function handleSelect(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  useEffect(() => {
    loadImportacoes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sending || !selectedId || !selectedImportacao?.envioEmAndamento) return;
    const timer = setInterval(() => { loadDetalhe(selectedId, itemPage, true); loadImportacoes(page, true); }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, sending, selectedImportacao?.envioEmAndamento, itemPage, page]);

  function submitFiltrosItens(event: FormEvent) {
    event.preventDefault();
    if (selectedId) loadDetalhe(selectedId, 1);
  }

  const busy = uploading || sending || downloading || checking || reviewBusy || commentSaving || cancelling;
  const isSuperseded = selectedImportacao?.status === "SUBSTITUIDO";
  const batchBusy = busy || !!selectedImportacao?.envioEmAndamento;
  const review = detalhe?.itens.find(item => item.id === reviewId);
  const needsReview = reviewCount;
  function newUpload() { setNewDescription(""); setCorrectionId(null); setUploadStage("select"); setUploadSummary(null); setFileName(null); setError(null); setProgress(null); setMessage(null); setUploadOpen(true); }
  async function correctionUpload() {
    if (!selectedId || batchBusy || isSuperseded) return;
    if (!commentText.trim()) { setError("Defina e salve a descrição deste carregamento antes de subir uma atualização."); return; }
    if (commentDirty) { actionLock.current = true; setCommentSaving(true); try { await persistComment(selectedId); } catch (error) { setError(error instanceof Error ? error.message : "Falha ao salvar descrição."); return; } finally { actionLock.current = false; setCommentSaving(false); } }
    newUpload(); setCorrectionId(selectedId);
  }
  async function persistComment(id: number) {
    const response = await fetch(`/api/treinamento/importacoes-certificados/${id}/comentario`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: commentText, atualizadoEm: commentVersion }) });
    const body = await response.json(); if (!response.ok) throw Error(body.error || "Não foi possível salvar a descrição.");
    setCommentText(body.historico.comentario?.texto ?? ""); setCommentVersion(body.historico.comentario?.atualizadoEm ?? null); setCommentDirty(false); descriptionDirty.current = false;
    setDetalhe(current => current ? { ...current, importacao: { ...current.importacao, descricao: body.historico.comentario?.texto ?? "" }, historico: body.historico } : current);
    return body.mensagem as string;
  }
  async function saveComment() {
    if (!selectedId || actionLock.current) return; actionLock.current = true; setCommentSaving(true); setError(null);
    try { setMessage(await persistComment(selectedId)); await loadImportacoes(page, true); } catch (error) { setError(error instanceof Error ? error.message : "Falha ao salvar descrição."); }
    finally { actionLock.current = false; setCommentSaving(false); }
  }
  async function edited(message: string) {
    setMessage(message); await loadImportacoes(page, true);
    if (selectedId) { const analysis = await loadDetalhe(selectedId, itemPage, true); if (analysis && uploadOpen) setUploadSummary(analysis.importacao); }
  }
  function askCancel(item?: ItemImportacao) { setCancelReason(""); setCancelTarget({ item }); setError(null); }
  async function cancelItems() {
    if (!selectedId || !cancelTarget || actionLock.current) return; actionLock.current = true; setCancelling(true); setError(null);
    try { const response = await fetch(`/api/treinamento/importacoes-certificados/${selectedId}/cancelar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmar: true, motivo: cancelReason, ...(cancelTarget.item ? { itemId: cancelTarget.item.id } : {}) }) }); const body = await response.json(); if (!response.ok) throw Error(body.error || "Não foi possível cancelar."); setCancelTarget(null); await edited(body.mensagem); } catch (error) { setError(error instanceof Error ? error.message : "Falha ao cancelar."); } finally { actionLock.current = false; setCancelling(false); }
  }
  const commentPanel = <CarregamentoComment value={commentText} onChange={value => { descriptionDirty.current = true; setCommentText(value); setCommentDirty(true); }} onSave={() => void saveComment()} disabled={busy || isSuperseded || !!selectedImportacao?.envioEmAndamento} saving={commentSaving} dirty={commentDirty} author={detalhe?.historico?.comentario ? `${detalhe.historico.comentario.usuarioNome} · ${formatDate(detalhe.historico.comentario.atualizadoEm)}` : undefined} />;
  async function reviewBatch() {
    if (!selectedId || batchBusy || isSuperseded) return;
    setUploadStage("review"); setUploadSummary(selectedImportacao ?? null); setError(null); setMessage(null); setProgress(null); setSendFinished(false); setUploadOpen(true);
    setItemStatus("TODOS"); setItemQ("");
    const analysis = await loadDetalhe(selectedId, 1, false, "TODOS", "");
    if (analysis) setUploadSummary(analysis.importacao);
  }
  const sendPercent = sendFinished ? 100 : progress?.total ? Math.min(99, Math.round(progress.processados / progress.total * 100)) : 0;
  function changeFilter(value: string) { setItemStatus(value); if (selectedId) void loadDetalhe(selectedId, 1, false, value); }
  function openBatch(id: number) { setWorkspaceView("batch"); setItemStatus("TODOS"); setItemQ(""); setProgress(null); setReviewId(null); void loadDetalhe(id, 1, false, "TODOS", ""); }
  const inputClass = "h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#af261d] focus:ring-2 focus:ring-[#af261d]/10";

  return <main className="min-h-full bg-white px-3 py-2 text-slate-900 sm:px-5 lg:px-6" style={{ colorScheme: "light" }}>
    <div className="mx-auto max-w-[1600px] space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-0.5 text-[11px] font-medium text-slate-500">Treinamento / Integrações</p>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-950">Certificados</h1>
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{data?.ambiente === "prd" ? "PRODUÇÃO" : data?.ambiente === "hmg" ? "HMG" : "Carregando"}</span>
          </div>

        </div>
        <div className="flex items-center gap-2">

          {workspaceView === "files" && <Action variant="primary" isDisabled={batchBusy || !data?.ambiente} onPress={newUpload}>
            <Plus className="size-4" />Nova importação</Action>}
        </div>
      </header>
      {error && <div role="alert" className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </div>}
      {message && <div role="status" className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
        <CheckCircle2 className="mt-1 size-4 shrink-0" />
        <span>{message}</span>
      </div>}
      {progress && <section aria-label="Progresso do envio" className="space-y-2 rounded-md bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <strong className="font-medium">{sending ? "Enviando ao Drake…" : sendFinished ? "Execução finalizada" : "Confira o resultado do envio"}</strong>
          <span className="text-slate-500">{progress.processados} de {progress.total} · {sendPercent}%</span>
        </div>
        <div role="progressbar" aria-label="Certificados processados" aria-valuenow={sendPercent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-[#af261d] transition-[width] motion-reduce:transition-none" style={{ width: `${sendPercent}%` }} />
        </div>
        <p role="status" className="text-xs text-slate-500">{progress.enviados} enviados · {progress.falhas} erros · {progress.naoConfirmados} não confirmados · {progress.ignorados} desconsiderados</p>
      </section>}
      {workspaceView === "files" ? <FilesOverview data={data} loading={loading} busy={busy} criteria={{ q, status }} onCriteriaChange={value => { setQ(value.q); setStatus(value.status); }} onSearch={() => void loadImportacoes(1)} onOpen={openBatch} onPage={next => void loadImportacoes(next)} onRefresh={() => void loadImportacoes(page)} /> : selectedImportacao ? <section aria-label="Revisão da importação" className="min-w-0">
        <Action variant="ghost" className="!h-8 !px-0" isDisabled={batchBusy} onPress={() => { setWorkspaceView("files"); void loadImportacoes(page); }}>
          <ChevronLeft className="size-4" />Arquivos importados</Action>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-2">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <FileSpreadsheet className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold">{selectedImportacao.descricao || selectedImportacao.nomeArquivo}</h2>
              {selectedImportacao.descricao && selectedImportacao.descricao !== selectedImportacao.nomeArquivo && <p className="truncate text-[11px] text-slate-500" title={selectedImportacao.nomeArquivo}>{selectedImportacao.nomeArquivo}</p>}
              <p className="mt-1 text-xs leading-5 text-slate-500">Importação #{selectedImportacao.id} · {formatDate(selectedImportacao.createdAt)} · {selectedImportacao.usuario.funcionario.nome}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Badge value={selectedImportacao.status} />{detalhe?.historico && (isSuperseded ? <Action onPress={() => openBatch(detalhe.historico!.atualId)}>Abrir versão atual<ArrowRight className="size-4" />
              </Action> : <Action isDisabled={batchBusy} onPress={correctionUpload}>
                <UploadCloud className="size-4" />Subir atualização</Action>)}</div>
        </div>
        <details key={selectedId} className="border-b border-slate-200 pb-2">
          <summary className="cursor-pointer rounded text-xs font-medium text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-[#af261d]/30">Descrição e versões{commentDirty ? " · alterações não salvas" : ""}</summary>
          <div className="space-y-3 pt-3">
        {detalhe?.historico && <section className="space-y-2" aria-label="Versões do carregamento">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-600">Carregamento #{detalhe.historico.raizId} · {detalhe.historico.versoes.length} versão(ões)</p>{isSuperseded && <p className="mt-1 text-xs leading-5 text-amber-800">Esta versão foi substituída e permanece somente para consulta. Os envios anteriores continuam preservados.</p>}</div></div>{detalhe.historico.versoes.length > 1 && <div className="flex flex-wrap gap-2">{detalhe.historico.versoes.map((version, index) =>
                  <Action key={version.id} variant={version.id === selectedId ? "secondary" : "ghost"} className="!h-8 !text-xs" isDisabled={busy || version.id === selectedId} onPress={() => openBatch(version.id)}>Versão {index + 1} · #{version.id}{version.id === detalhe.historico!.atualId ? " · Atual" : ""}</Action>)}</div>}</section>}
            {(!uploadOpen || uploadStage !== "review") && commentPanel}
          </div>
        </details>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <p className={detalhe?.referencia?.disponivel ? "text-slate-500" : "text-amber-800"}>
            <span className={`mr-2 inline-block size-1.5 rounded-full ${detalhe?.referencia?.disponivel ? "bg-emerald-500" : "bg-amber-500"}`} />{detalhe?.referencia?.disponivel ? `Base Drake v${detalhe.referencia.versao} · ${formatDate(detalhe.referencia.atualizadoEm)}` : detalhe?.referencia?.motivo || "Carregando base de conferência…"}</p>
          <div className="w-44 shrink-0"><FileProgress batch={selectedImportacao} compact /></div>
          <Action variant="ghost" className="!h-8 !px-2 !text-xs" isDisabled={batchBusy || loadingDetalhe || isSuperseded} onPress={() => void conferirReferencia()}>
            <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} />{checking ? "Conferindo…" : "Conferir base"}</Action>
        </div>
        <div className="mt-2 flex gap-4 overflow-x-auto border-b border-slate-200" aria-label="Filtrar certificados">
          {[["TODOS", "Todos", selectedImportacao.totalLinhas], ["PENDENTE_ENVIO", "Prontos para envio", selectedImportacao.totalPendentes], ["PENDENCIAS", "Requerem revisão", null], ["ENVIADO", "Enviados", selectedImportacao.totalEnviadas], ["CONFIRMADO", "Confirmados", selectedImportacao.totalConfirmadas]].map(([value, label, count]) =>
            <Action key={String(value)} variant="ghost" className={`!h-9 !rounded-none !text-xs !border-x-0 !border-t-0 !px-0 hover:!bg-transparent ${itemStatus === value ? "!border-b-2 !border-[#af261d] !text-[#af261d]" : "!border-b-2 !border-transparent !text-slate-500"}`} aria-pressed={itemStatus === value} isDisabled={batchBusy || loadingDetalhe} onPress={() => changeFilter(String(value))}>{label}{count !== null && <span className={`rounded px-1.5 py-0.5 text-xs ${itemStatus === value ? "bg-red-50" : "bg-slate-100"}`}>{count}</span>}</Action>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          <form onSubmit={submitFiltrosItens} className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto xl:flex-1">
            <SearchField aria-label="Buscar certificado" value={itemQ} onChange={setItemQ} isDisabled={batchBusy} className="relative w-full min-w-[200px] flex-auto sm:w-auto sm:flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input placeholder="Nome, matrícula ou qualificação" className={`${inputClass} !pl-9`} />
            </SearchField>
            <select aria-label="Situação do certificado" value={itemStatus} disabled={batchBusy} onChange={e => changeFilter(e.target.value)} className={`${inputClass} !w-auto min-w-[180px] flex-1 sm:flex-none`}>{statusItens.map(option =>
              <option key={option} value={option}>{option === "TODOS" ? "Todas as situações" : statusLabel(option)}</option>)}</select>
            <Action type="submit" isDisabled={batchBusy || loadingDetalhe} aria-label="Aplicar busca">
              <Search className="size-4" />
            </Action>
          </form>
          <div className="flex gap-2">
            <Action isDisabled={batchBusy || loadingDetalhe} onPress={() => void baixarPlanilha("resultado")}>
              <Download className="size-4" />
              <span className="hidden sm:inline">Resultado</span>
            </Action>
            <Action isDisabled={batchBusy || loadingDetalhe} onPress={() => void baixarPlanilha("pendencias")}>Exportar pendências</Action>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-600">
            <strong className="text-slate-900">{selectedImportacao.totalPendentes}</strong> aptos para envio · {needsReview(selectedImportacao)} precisam de revisão</p>
          <div className="flex flex-wrap gap-2">{!isSuperseded && selectedImportacao.totalPendentes + needsReview(selectedImportacao) - selectedImportacao.totalNaoConfirmadas > 0 && <Action isDisabled={batchBusy || loadingDetalhe} onPress={() => askCancel()}>
            <Ban className="size-4" />Encerrar sem enviar</Action>}
            <Action variant="primary" isDisabled={batchBusy || loadingDetalhe || isSuperseded || !selectedImportacao.totalPendentes} onPress={() => void reviewBatch()}>
              <Send className="size-4" />Processar aptos</Action>
          </div>
        </div>
        <div className="max-h-[65vh] overflow-auto lg:max-h-[calc(100dvh-380px)] lg:min-h-[280px] border-x border-slate-200" aria-busy={loadingDetalhe}>
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                {["Profissional", "Certificado", "Emissão", "Validade", "Situação", ""].map((title, index) =>
                  <th key={index} className="px-3 py-2 font-medium">{title}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingDetalhe ? <tr>
                <td colSpan={6} className="h-48 text-center text-slate-500">
                  <Loader2 className="mx-auto mb-3 size-5 animate-spin" />Carregando certificados…</td>
              </tr> : detalhe?.itens.length ? detalhe.itens.map(item =>
                <tr key={item.id} className="transition-colors hover:bg-slate-50">
                  <td className="max-w-[240px] px-3 py-2">
                    <p className="font-medium text-slate-900">{item.funcionario?.nome || item.nome || "Nome não informado"}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.matricula}</p>
                  </td>
                  <td className="max-w-[270px] px-3 py-2">
                    <p className="font-medium text-slate-800">{item.qualificacao}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.tipoDocumento} · Linha {item.numeroLinha}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateOnly(item.emissao)}</td>
                  <td className="max-w-[160px] px-3 py-2 text-slate-600">{validityLabel(item.validade, item.status)}</td>
                  <td className="max-w-[260px] px-3 py-2">
                    <Badge value={item.status} />{item.motivoErro && <p title={item.motivoErro} className="mt-1.5 line-clamp-1 text-xs text-slate-500">{item.motivoErro}</p>}</td>
                  <td className="px-2 py-2">
                    <Action variant="ghost" className="!h-8 !px-2" isDisabled={busy} aria-label={`Revisar certificado ${item.matricula}, linha ${item.numeroLinha}`} onPress={() => setReviewId(item.id)}>Revisar<ArrowRight className="size-3.5" />
                    </Action>
                  </td>
                </tr>) : <tr>
                <td colSpan={6} className="h-48 text-center">
                  <Search className="mx-auto mb-3 size-6 text-slate-300" />
                  <p className="font-medium text-slate-700">Nenhum certificado encontrado</p>
                  <p className="mt-1 text-xs text-slate-500">Ajuste a busca ou escolha outra situação.</p>
                </td>
              </tr>}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-md border border-slate-200 px-3 py-2">
          <p className="text-xs text-slate-500">{detalhe?.totalItens ?? 0} certificado(s) · Página {itemPage} de {Math.max(1, detalhe?.totalPages ?? 1)}</p>
          <div className="flex gap-2">
            <Action aria-label="Página anterior de certificados" className="!h-8 !px-2" isDisabled={batchBusy || loadingDetalhe || itemPage <= 1} onPress={() => selectedId && void loadDetalhe(selectedId, itemPage - 1)}>
              <ChevronLeft className="size-4" />
            </Action>
            <Action aria-label="Próxima página de certificados" className="!h-8 !px-2" isDisabled={batchBusy || loadingDetalhe || itemPage >= (detalhe?.totalPages ?? 1)} onPress={() => selectedId && void loadDetalhe(selectedId, itemPage + 1)}>
              <ChevronRight className="size-4" />
            </Action>
          </div>
        </footer>
        {selectedImportacao.envioEmAndamento && <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          <p>{selectedImportacao.envioInterrompido ? "Uma execução foi interrompida. Confira os resultados antes de continuar." : "Há um envio em andamento. A página atualiza o resultado automaticamente."}</p>{selectedImportacao.envioInterrompido && <Action isDisabled={busy} onPress={() => void recuperarExecucao()}>Recuperar execução</Action>}</div>}
        <p className="mt-4 text-xs leading-5 text-slate-400">O envio fica registrado por certificado. A confirmação da execução deve ser conferida no Drake.</p>
      </section> : <section className="flex min-h-80 flex-col items-center justify-center border-t border-slate-200 py-16 text-center">
        <FolderOpen className="mb-4 size-9 text-slate-300" />
        <h2 className="text-base font-semibold">{loading || loadingDetalhe ? "Carregando importações…" : "Comece com uma planilha de certificados"}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Selecione um carregamento na lista de arquivos.</p>
      </section>}
    </div>

    <ImportWizard state={{ uploadOpen, uploadStage, correctionId, uploadSummary, uploading, sending, busy, error, newDescription, fileName, detalhe, selectedId, itemStatus, itemPage, loadingDetalhe, isSuperseded, progress, sendPercent, sendFinished, message, downloading, commentPanel }} actions={{ setUploadOpen, setNewDescription, uploadFile, handleSelect, baixarPlanilha, changeFilter, loadDetalhe, setEditingItem, askCancel, enviarPendentes }} />

    <SurfaceDialog open={!!review} onOpenChange={open => { if (!open) setReviewId(null); }} title="Revisar certificado" description={review ? `${review.funcionario?.nome || review.nome || "Profissional"} · ${review.matricula}` : undefined} drawer busy={reviewBusy}>
      {review && <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Badge value={review.status} />
          <span className="text-xs text-slate-400">Linha {review.numeroLinha}</span>
        </div>
        {CERTIFICADO_CANCELABLE_STATUS.includes(review.status) && !isSuperseded && <Action variant="ghost" isDisabled={batchBusy} onPress={() => askCancel(review)}>
          <Ban className="size-4" />Cancelar este envio</Action>}
        {CERTIFICADO_EDITABLE_STATUS.includes(review.status) && !isSuperseded && <Action isDisabled={batchBusy} onPress={() => setEditingItem(review)}>
          <Pencil className="size-4" />Editar dados</Action>}
        <dl className="grid grid-cols-2 gap-x-5 gap-y-5">
          <div className="col-span-2">
            <FieldValue label="Qualificação">{review.qualificacao}</FieldValue>
          </div>
          <FieldValue label="Tipo de documento">{review.tipoDocumento}</FieldValue>
          <FieldValue label="Matrícula">{review.matricula}</FieldValue>
          <FieldValue label="Emissão">{formatDateOnly(review.emissao)}</FieldValue>
          <FieldValue label="Validade">{validityLabel(review.validade, review.status)}</FieldValue>
          <FieldValue label="Recebimento">{formatDateOnly(review.recebimento)}</FieldValue>
          <FieldValue label="Tentativas de envio">{review.tentativas}</FieldValue>
        </dl>
        {review.confirmacaoDrake && <section className={`space-y-2 rounded-md border p-4 text-sm ${review.confirmacaoDrake.status === "CONFIRMADO" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} aria-label="Conferência do relatório Drake">
          <p className="flex items-center gap-2 font-semibold">{review.confirmacaoDrake.status === "CONFIRMADO" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}{review.confirmacaoDrake.status === "CONFIRMADO" ? "Confirmado pelo relatório do Drake" : "Relatório requer conferência"}</p>
          <p>{review.confirmacaoDrake.motivo}</p>
          <p className="text-xs">Observado em {formatDate(review.confirmacaoDrake.referenciaEm)}</p>
          {review.confirmacaoDrake.documentoId && <p className="select-all break-all text-xs">ID Drake: {review.confirmacaoDrake.documentoId}</p>}
          <p className="text-xs">Conferência dos campos disponíveis no relatório. Recebimento, anexos e comentários não são verificados por esse arquivo.</p>
        </section>}
        {review.motivoErro && <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <AlertCircle className="mt-1 size-4 shrink-0" />
          <p className="break-words">{review.motivoErro}</p>
        </div>}
        {review.status === "POSSIVEL_DUPLICIDADE" && selectedId && !isSuperseded && <div className="border-t border-slate-200 pt-5">
          <ReferenceDocuments allowDestructive={data?.ambiente === "hmg"} key={review.id} importacaoId={selectedId} itemId={review.id} onBusyChange={setReviewBusy} />
        </div>}
        {!!review.historicoEdicoes?.length && <section className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold">Histórico de alterações e decisões</h3>
          <ol className="mt-3 space-y-3">{review.historicoEdicoes.map(edit =>
            <li key={edit.id} className="border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-600">
              <p className="font-medium">{edit.usuarioNome} · {formatDate(edit.criadoEm)}</p>
              <p>Campos alterados: {edit.camposAlterados.map(key => ({ status: "situação", motivoErro: "motivo", matricula: "matrícula", qualificacao: "qualificação", emissao: "emissão", validade: "validade", recebimento: "recebimento", tipoDocumento: "tipo de documento", nome: "nome", certificadora: "certificadora", resolvidoPorItemId: "registro de origem", resolvidoPorImportacaoId: "carregamento de origem" } as Record<string, string>)[key] ?? key).join(", ") || "Revalidação sem alteração dos valores"}.</p>
            </li>)}</ol>
        </section>}
        <section className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold">Histórico de envio</h3>{review.tentativasEnvio.length ? <ol className="mt-4 space-y-4">{review.tentativasEnvio.map(attempt =>
            <li key={attempt.id} className="border-l-2 border-slate-200 pl-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge value={attempt.status} />
                <span className="text-xs text-slate-500">{formatDate(attempt.iniciadoEm)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{attempt.usuarioNome || "Usuário não informado"} · HTTP {attempt.httpStatus ?? "—"}</p>{attempt.erro && <p className="mt-2 break-words text-xs leading-5 text-slate-600">{attempt.erro}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">Nenhum envio realizado para este certificado.</p>}</section>
      </div>}
    </SurfaceDialog>

    <SurfaceDialog open={!!cancelTarget} onOpenChange={open => { if (!open) setCancelTarget(null); }} title={cancelTarget?.item ? "Cancelar envio deste certificado" : "Encerrar pendências sem enviar"} description="O cancelamento ocorre somente no Crew e não exclui documentos no Drake." busy={cancelling}>
      <div className="space-y-4 p-6">{cancelTarget?.item ? <p className="rounded-md bg-slate-50 p-3 text-sm">{cancelTarget.item.matricula} · {cancelTarget.item.qualificacao} · Emissão {formatDateOnly(cancelTarget.item.emissao)}</p> : <p className="text-sm leading-6 text-slate-600">Serão encerradas apenas as pendências elegíveis deste arquivo. Enviados, confirmados e resultados incertos serão preservados. Uma pendência já atendida em outro arquivo será conciliada antes do cancelamento.</p>}
        <label className="block text-sm font-medium">Motivo do cancelamento<textarea maxLength={1000} rows={3} value={cancelReason} disabled={cancelling} onChange={event => setCancelReason(event.target.value)} placeholder="Ex.: Certificado não era necessário neste carregamento" className="mt-2 block w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-[#af261d]" />
        </label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<p className="text-xs leading-5 text-slate-500">A decisão fica no histórico. Para retomar um registro cancelado, use Editar dados e salve para passar por nova análise.</p>
        <div className="flex justify-end gap-2">
          <Action isDisabled={cancelling} onPress={() => setCancelTarget(null)}>Voltar</Action>
          <Action variant="primary" isDisabled={cancelling || cancelReason.trim().length < 3} onPress={() => void cancelItems()}>{cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}{cancelling ? "Cancelando…" : "Confirmar cancelamento"}</Action>
        </div>
      </div>
    </SurfaceDialog>
    {editingItem && selectedId && <CertificateEditor key={editingItem.id} item={editingItem} importacaoId={selectedId} onClose={() => setEditingItem(null)} onSaved={edited} onBeforeSend={async () => { if (commentDirty && selectedId) await persistComment(selectedId); }} />}
  </main>;
}
