import { SispatEvento, SispatImportacaoResumo, SispatProgresso } from './shared';

/** Lê eventos mesmo quando a rede separa uma linha JSON em vários pacotes. */
export async function readSispatProgress(response: Response, report: (progress: SispatProgresso) => void): Promise<SispatImportacaoResumo> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Falha no processamento.');
    return body;
  }
  if (!response.body) throw new Error('Não foi possível acompanhar o processamento. Consulte o histórico antes de repetir.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let completed: SispatImportacaoResumo | undefined;
  let serverError = false;
  function consume(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as SispatEvento;
    if (event.tipo === 'erro') { serverError = true; throw new Error(event.erro); }
    if (event.tipo === 'progresso') report(event.progresso);
    if (event.tipo === 'concluido') completed = event.resultado;
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) { consume(pending.slice(0, newline)); pending = pending.slice(newline + 1); }
    }
    consume(pending + decoder.decode());
  } catch (error) {
    if (completed) return completed;
    if (serverError) throw error;
    throw new Error('Conexão interrompida. Consulte o histórico antes de repetir a operação.');
  } finally {
    try { await reader.cancel(); } catch { /* A conexão já pode estar encerrada. */ }
    reader.releaseLock();
  }
  if (!completed) throw new Error('Conexão interrompida. Consulte o histórico antes de repetir a operação.');
  return completed;
}
