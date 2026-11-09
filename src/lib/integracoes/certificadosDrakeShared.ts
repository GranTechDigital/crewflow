export const CERTIFICADO_MAX_BYTES = 5 * 1024 * 1024;
export const CERTIFICADO_MAX_ROWS = 20000;
export const CERTIFICADO_LEASE_MS = 5 * 60 * 1000;
export const CERTIFICADO_COLUNAS = ["Matricula", "Nome", "Certificadora", "Qualificacao", "Tipo Documento", "Emissao", "Validade", "Recebimento"] as const;
export function publicCertificadoBatch<T extends { envioToken?: string | null; envioHeartbeatEm?: Date | null }>(batch: T) {
  const { envioToken, ...visible } = batch;
  return { ...visible, envioEmAndamento: Boolean(envioToken), envioInterrompido: Boolean(envioToken && (!batch.envioHeartbeatEm || Date.now() - batch.envioHeartbeatEm.getTime() >= CERTIFICADO_LEASE_MS)) };
}
export type CertificadoProgresso = { fase: "PREPARANDO" | "ENVIANDO" | "FINALIZANDO"; processados: number; total: number; enviados: number; falhas: number; naoConfirmados: number; ignorados: number };

export class CertificadoError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function certificadoPage(value: string | null, fallback: number, max: number) {
  const number = Number(value ?? fallback);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

export async function readCertificadoProgress<T>(response: Response, progress: (value: CertificadoProgresso) => void): Promise<T> {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Não foi possível enviar certificados.");
    return body as T;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Conexão sem resultado. Consulte o histórico antes de tentar novamente.");
  const decoder = new TextDecoder(); let pending = "", completed = false, result: T | undefined;
  function line(text: string) {
    if (!text.trim()) return;
    const event = JSON.parse(text);
    if (event.tipo === "progresso") progress(event.progresso);
    if (event.tipo === "erro") throw new Error(event.error);
    if (event.tipo === "concluido") { result = event.resultado as T; completed = true; }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) { line(pending.slice(0, end)); pending = pending.slice(end + 1); }
      if (pending.length > 1024 * 1024) throw new Error("Resposta inválida. Consulte o histórico.");
      if (done) break;
    }
    line(pending);
    if (!completed) throw new Error("Conexão interrompida. Consulte o histórico antes de tentar novamente.");
    return result as T;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function readCertificadoDownload(response: Response): Promise<Blob> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(response.status === 401 ? "Sessão expirada. Entre novamente." : body?.error || "Não foi possível baixar a planilha.");
  }
  if (!response.headers.get("content-type")?.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) throw new Error("O servidor não retornou um XLSX.");
  const blob = await response.blob(), bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4) throw new Error("A planilha recebida não é um XLSX válido.");
  return blob;
}

export const CERTIFICADO_EDITABLE_STATUS = ["CANCELADO","PENDENTE_ENVIO","ERRO_VALIDACAO","ERRO_DRAKE","DUPLICADO_NO_ARQUIVO","DUPLICADO_JA_PROCESSADO","CONFLITO_ATUALIZACAO","POSSIVEL_DUPLICIDADE","REFERENCIA_INDISPONIVEL"];

export {cancelableStatuses as CERTIFICADO_CANCELABLE_STATUS} from "../../../scripts/lib/certificate-status.cjs";
