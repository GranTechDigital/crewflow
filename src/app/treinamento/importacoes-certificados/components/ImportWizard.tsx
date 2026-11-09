"use client";
import type { ReactNode } from "react";
import { DropZone, FileTrigger, Text } from "react-aria-components";
import { UploadCloud, Loader2, Plus, Download, Send, ChevronLeft, ChevronRight, Pencil, Ban, CheckCircle2, AlertCircle } from "lucide-react";
import type { Importacao, ItemImportacao, DetalheResponse } from "../types";
import type { CertificadoProgresso } from "@/lib/integracoes/certificadosDrakeShared";
import { CERTIFICADO_EDITABLE_STATUS, CERTIFICADO_CANCELABLE_STATUS } from "@/lib/integracoes/certificadosDrakeShared";
import { Action, SurfaceDialog, FieldValue } from "./CertificateUi";
import { Badge, formatDateOnly, statusItens, statusLabel, reviewCount } from "./CertificatePresentation";
type WizardState = { uploadOpen: boolean; uploadStage: "select" | "review" | "sending" | "done"; correctionId: number | null; uploadSummary: Importacao | null; uploading: boolean; sending: boolean; busy: boolean; error: string | null; newDescription: string; fileName: string | null; detalhe: DetalheResponse | null; selectedId: number | null; itemStatus: string; itemPage: number; loadingDetalhe: boolean; isSuperseded: boolean; progress: CertificadoProgresso | null; sendPercent: number; sendFinished: boolean; message: string | null; downloading: boolean; commentPanel: ReactNode };
type WizardActions = { setUploadOpen: (value: boolean) => void; setNewDescription: (value: string) => void; uploadFile: (file: File) => Promise<void>; handleSelect: (files: FileList | null) => Promise<void>; baixarPlanilha: (kind: "modelo" | "resultado" | "pendencias") => Promise<void>; changeFilter: (value: string) => void; loadDetalhe: (id: number, page: number) => Promise<unknown>; setEditingItem: (item: ItemImportacao) => void; askCancel: (item?: ItemImportacao) => void; enviarPendentes: () => Promise<void> };
export function ImportWizard({ state, actions }: { state: WizardState; actions: WizardActions }) {
  const { uploadOpen, uploadStage, correctionId, uploadSummary, uploading, sending, busy, error, newDescription, fileName, detalhe, selectedId, itemStatus, itemPage, loadingDetalhe, isSuperseded, progress, sendPercent, sendFinished, message, downloading, commentPanel } = state;
  const { setUploadOpen, setNewDescription, uploadFile, handleSelect, baixarPlanilha, changeFilter, loadDetalhe, setEditingItem, askCancel, enviarPendentes } = actions;
  const needsReview = reviewCount, inputClass = "h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#af261d] focus:ring-2 focus:ring-[#af261d]/10";
  return <SurfaceDialog open={uploadOpen} onOpenChange={setUploadOpen}
    title={uploadStage === "select" ? correctionId ? "Subir atualização" : "Importar certificados" : uploadStage === "review" ? "Conferir e processar planilha" : uploadStage === "sending" ? "Processando certificados" : "Resultado do processamento"}
    description={uploadStage === "select" ? "Carregue a planilha para analisar os certificados antes do envio." : uploadSummary?.nomeArquivo}
    wide={uploadStage !== "select"} busy={uploading || sending}>
    <div className="space-y-5 p-6">
      {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}</p>}
      {uploadStage === "select" && <>
        {!correctionId && <label className="block text-sm font-semibold">Descrição do carregamento <span className="text-[#af261d]">*</span>
          <input type="text" required maxLength={200} value={newDescription} onChange={event => setNewDescription(event.target.value)} disabled={uploading} placeholder="Ex.: Certificados NR-35 • equipe de novembro" className={`${inputClass} mt-2`} />
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Nome curto para identificar este envio. Obrigatório e editável depois.</span>
        </label>}
        {correctionId && <p className="rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">Nova versão do carregamento #{detalhe?.historico?.raizId ?? correctionId}. Envie a planilha completa corrigida. O arquivo anterior será preservado no histórico e ficará sem novos envios. Linhas não incluídas permanecerão apenas na versão anterior. A descrição do carregamento será mantida.</p>}
        <DropZone isDisabled={busy || (!correctionId && !newDescription.trim())} getDropOperation={types => types.has("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ? "copy" : "cancel"} onDrop={async event => { const item = event.items.find(item => item.kind === "file"); if (item?.kind === "file") await uploadFile(await item.getFile()); }} className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center outline-none data-[drop-target]:border-[#af261d] data-[drop-target]:bg-red-50">
          {uploading ? <Loader2 className="mx-auto mb-4 size-8 animate-spin text-[#af261d]" /> : <UploadCloud className="mx-auto mb-4 size-8 text-slate-400" />}
          <Text slot="label" className="block text-sm font-medium text-slate-800">{uploading ? "Carregando e analisando sua planilha…" : "Arraste sua planilha para cá"}</Text>
          <p role={uploading ? "status" : undefined} className="mt-2 text-xs leading-5 text-slate-500">{uploading ? "Validando dados e conferindo possíveis duplicidades. Aguarde; nenhum certificado foi enviado." : "XLSX · Até 5 MB · 20.000 linhas"}</p>
          <FileTrigger acceptedFileTypes={[".xlsx"]} onSelect={handleSelect}>
            <Action variant="primary" className="mt-5" isDisabled={busy || (!correctionId && !newDescription.trim())}>
              <Plus className="size-4" />{uploading ? "Analisando…" : "Selecionar arquivo"}</Action>
          </FileTrigger>
          {fileName && <p className="mt-3 break-all text-xs text-slate-500">{fileName}</p>}
        </DropZone>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Use o modelo para preencher as colunas corretamente.</p>
          <Action variant="ghost" className="!h-8 !px-0 !text-xs hover:!bg-transparent" isDisabled={busy} onPress={() => void baixarPlanilha("modelo")}>
            <Download className="size-3.5" />Baixar modelo XLSX</Action>
        </div>
      </>}
      {uploadStage === "review" && uploadSummary && <>
        <p className="text-sm leading-6 text-slate-600">Analisamos <strong>{uploadSummary.totalLinhas} certificados</strong>. Ao confirmar, o sistema enviará todos os aptos deste arquivo, um por vez. Os demais ficarão disponíveis para revisão.</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Aptos para envio", uploadSummary.totalPendentes, "text-blue-700"], ["Precisam de revisão", needsReview(uploadSummary), "text-amber-800"], ["Já enviados / atendidos", uploadSummary.totalEnviadas + uploadSummary.totalConfirmadas + (uploadSummary.totalResolvidasOutroArquivo ?? 0) + (uploadSummary.totalJaProcessadas ?? 0), "text-emerald-700"], ["Cancelados", uploadSummary.totalCanceladas ?? 0, "text-slate-600"]].map(([label, count, tone]) => <div key={String(label)} className="rounded-md border border-slate-200 p-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className={`mt-2 text-xl font-semibold tabular-nums ${tone}`}>{count}</dd>
          </div>)}
        </dl>
        <p className="text-xs leading-5 text-slate-500">Não serão enviados: dados inválidos ({uploadSummary.totalErroValidacao}), conflitos / possíveis duplicidades / base indisponível ({uploadSummary.totalConflitos}), erros de envio ({uploadSummary.totalErroDrake}) e resultados não confirmados ({uploadSummary.totalNaoConfirmadas}). Duplicados no arquivo exigem revisão. Registros cancelados ou já atendidos em outro carregamento não serão reenviados.</p>
        <div className="rounded-md border border-slate-200 p-4">{commentPanel}<p className="mt-2 text-xs text-slate-500">Se alterado, a descrição será salva junto à confirmação do processamento.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Conferência dos registros</h3>
          <select aria-label="Filtrar prévia da planilha" value={itemStatus} disabled={loadingDetalhe} onChange={e => changeFilter(e.target.value)} className={`${inputClass} !h-9 !w-auto max-w-full`}>{statusItens.map(option => <option key={option} value={option}>{option === "TODOS" ? "Todos os registros" : statusLabel(option)}</option>)}</select>
        </div>
        <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[580px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>{["Profissional", "Certificado", "Situação", ""].map(label => <th key={label} className="px-3 py-2.5 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">{loadingDetalhe ? <tr>
              <td colSpan={4} className="p-6 text-center text-slate-500">Carregando registros…</td>
            </tr> : detalhe?.itens.map(item => <tr key={item.id}>
              <td className="px-3 py-3">
                <p className="font-medium">{item.nome || item.funcionario?.nome || item.matricula}</p>
                <p className="mt-1 text-slate-500">{item.matricula}</p>
              </td>
              <td className="px-3 py-3">
                <p>{item.qualificacao}</p>
                <p className="mt-1 text-slate-500">Emissão {formatDateOnly(item.emissao)}</p>
              </td>
              <td className="max-w-[280px] px-3 py-3">
                <Badge value={item.status} />{item.motivoErro && <p className="mt-1.5 leading-5 text-slate-500">{item.motivoErro}</p>}</td>
              <td className="px-3 py-3">{CERTIFICADO_EDITABLE_STATUS.includes(item.status) && !isSuperseded && <Action className="!h-8 !px-2 !text-xs" isDisabled={busy} onPress={() => setEditingItem(item)}>
                <Pencil className="size-3.5" />Editar</Action>}{CERTIFICADO_CANCELABLE_STATUS.includes(item.status) && !isSuperseded && <Action variant="ghost" className="!h-8 !px-2" aria-label={`Cancelar envio ${item.matricula}, linha ${item.numeroLinha}`} isDisabled={busy} onPress={() => askCancel(item)}>
                  <Ban className="size-3.5" />
                </Action>}</td>
            </tr>)}{!loadingDetalhe && !detalhe?.itens.length && <tr>
              <td colSpan={4} className="p-6 text-center text-slate-500">Nenhum registro nesta situação.</td>
            </tr>}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{detalhe?.totalItens ?? 0} registros · Página {itemPage} de {Math.max(1, detalhe?.totalPages ?? 1)}</p>
          <div className="flex gap-2">
            <Action aria-label="Página anterior da prévia" className="!h-8 !px-2" isDisabled={loadingDetalhe || itemPage <= 1} onPress={() => selectedId && void loadDetalhe(selectedId, itemPage - 1)}>
              <ChevronLeft className="size-4" />
            </Action>
            <Action aria-label="Próxima página da prévia" className="!h-8 !px-2" isDisabled={loadingDetalhe || itemPage >= (detalhe?.totalPages ?? 1)} onPress={() => selectedId && void loadDetalhe(selectedId, itemPage + 1)}>
              <ChevronRight className="size-4" />
            </Action>
          </div>
        </div>
        <p className="rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900">A confirmação inclui todos os {uploadSummary.totalPendentes} aptos do arquivo, independentemente do filtro ou página. Cada certificado será conferido novamente antes do envio. O aceite não garante a execução final no Drake.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Action onPress={() => setUploadOpen(false)}>Revisar depois</Action>
          <Action variant="primary" isDisabled={busy || loadingDetalhe || !uploadSummary.totalPendentes || !!uploadSummary.envioEmAndamento} onPress={() => void enviarPendentes()}>
            <Send className="size-4" />Confirmar e processar {uploadSummary.totalPendentes} aptos</Action>
        </div>
      </>}
      {(uploadStage === "sending" || uploadStage === "done") && <>
        <div className="flex items-center gap-3">{sending ? <Loader2 className="size-6 animate-spin text-[#af261d]" /> : sendFinished ? <CheckCircle2 className="size-6 text-emerald-600" /> : <AlertCircle className="size-6 text-amber-600" />}<div>
          <h3 className="text-sm font-semibold">{sending ? "Enviando um certificado por vez ao Drake…" : sendFinished ? "Processamento finalizado" : "Confira o resultado antes de continuar"}</h3>
          <p role="status" className="mt-1 text-xs text-slate-500">{progress?.processados ?? 0} de {progress?.total ?? uploadSummary?.totalPendentes ?? 0} processados · {sendPercent}%</p>
        </div>
        </div>
        <div role="progressbar" aria-label="Progresso do processamento da planilha" aria-valuenow={sendPercent} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-[#af261d] transition-[width] motion-reduce:transition-none" style={{ width: `${sendPercent}%` }} />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FieldValue label="Enviados">{progress?.enviados ?? 0}</FieldValue>
          <FieldValue label="Com erro">{progress?.falhas ?? 0}</FieldValue>
          <FieldValue label="Não confirmados">{progress?.naoConfirmados ?? 0}</FieldValue>
          <FieldValue label="Desconsiderados após conferência">{progress?.ignorados ?? 0}</FieldValue>
        </dl>
        {sending ? <p className="text-xs leading-5 text-slate-500">Aguarde a conclusão. Cada tentativa fica registrada. Se houver resultado incerto, o envio será interrompido para conferência, sem repetição automática.</p> : <>
          <p role="status" className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{message || "Consulte os resultados de cada certificado na tabela e no histórico antes de tentar novamente."}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Action isDisabled={downloading} onPress={() => void baixarPlanilha("resultado")}>
              <Download className="size-4" />Baixar resultado</Action>
            <Action variant="primary" onPress={() => setUploadOpen(false)}>Ver certificados</Action>
          </div>
        </>}
      </>}
    </div>
  </SurfaceDialog>;
}
