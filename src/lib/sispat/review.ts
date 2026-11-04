import { SispatDuplicidade, SispatParticipante, SispatRegistro } from './shared';

type Holder = { matricula: string; nome: string; sispat: string | null };
/** Compara a planilha com o resultado previsto no cadastro, inclusive trocas entre funcionários. */
export function findSispatDuplicates(registros: SispatRegistro[], holders: Holder[]): SispatDuplicidade[] {
  const groups = new Map<string, Map<string, SispatParticipante>>();
  const targets = new Map(registros.filter(r => r.status === 'PENDENTE' && r.funcionarioId).map(r => [r.matricula, r.recebido]));
  for (const row of registros) {
    if (row.status === 'ERRO' || row.status === 'IGNORADO' || !row.recebido || !/^\d{1,30}$/.test(row.recebido)) continue;
    const group = groups.get(row.recebido) ?? new Map<string, SispatParticipante>();
    group.set(row.matricula, { matricula: row.matricula, nome: row.nome ?? null, origem: 'PLANILHA' });
    groups.set(row.recebido, group);
  }
  for (const holder of holders) {
    if (!holder.sispat) continue;
    const group = groups.get(holder.sispat);
    if (!group || (targets.has(holder.matricula) && targets.get(holder.matricula) !== holder.sispat)) continue;
    const incoming = group.get(holder.matricula);
    group.set(holder.matricula, { matricula: holder.matricula, nome: holder.nome, origem: incoming ? 'PLANILHA_E_CADASTRO' : 'CADASTRO' });
  }
  return [...groups].filter(([, group]) => group.size > 1).map(([sispat, group]) => ({
    sispat, participantes: [...group.values()].sort((a,b) => a.matricula.localeCompare(b.matricula)),
  })).sort((a,b) => a.sispat.localeCompare(b.sispat));
}

export function isSispatIssue(row: SispatRegistro) {
  return ['ERRO', 'NAO_ENCONTRADO', 'NAO_APLICADO', 'IGNORADO'].includes(row.status) || Boolean(row.alertaDuplicidade);
}

/** Deriva a classificação para análises salvas antes desse metadado existir. */
export function sispatChangeType(row: SispatRegistro): SispatRegistro['tipoAlteracao'] {
  if (row.tipoAlteracao) return row.tipoAlteracao;
  if (!row.funcionarioId || !row.recebido || row.anterior === row.recebido || !['PENDENTE', 'ATUALIZADO', 'NAO_APLICADO', 'DESFEITO'].includes(row.status)) return undefined;
  return row.anterior?.trim() ? 'SUBSTITUICAO' : 'CADASTRO';
}
