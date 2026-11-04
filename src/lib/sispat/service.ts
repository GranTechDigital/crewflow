import { Prisma } from '@prisma/client';
import { SispatAlteracao } from './shared';
import { SispatError } from './workbook';

export const funcionarioSelect = { id: true, nome: true, matricula: true, sispat: true, atualizadoEm: true } as const;

/** Atualização parametrizada e atômica; um conflito desfaz todos os lotes. */
export async function applySispatChanges(tx: Prisma.TransactionClient, changes: SispatAlteracao[], onProgress?: (processados: number, total: number) => void) {
  const results: { id: number; atualizadoEm: Date }[] = [];
  const sorted = [...changes].sort((a,b) => a.id - b.id);
  for (let i = 0; i < sorted.length; i += 300) {
    const batch = sorted.slice(i, i + 300);
    const values = batch.map(row => Prisma.sql`(${row.id}::integer, ${row.sispat}::text, ${row.novoSispat}::text, ${new Date(row.atualizadoEm)}::timestamp)`);
    const updated = await tx.$queryRaw<{ id: number; atualizadoEm: Date }[]>(Prisma.sql`
      UPDATE "Funcionario" AS f
      SET "sispat" = v.novo, "atualizadoEm" = GREATEST(clock_timestamp()::timestamp(3), f."atualizadoEm" + interval '1 millisecond')
      FROM (VALUES ${Prisma.join(values)}) AS v(id, anterior, novo, versao)
      WHERE f."id" = v.id AND f."sispat" IS NOT DISTINCT FROM v.anterior AND f."atualizadoEm" = v.versao
      RETURNING f."id", f."atualizadoEm"
    `);
    results.push(...updated);
    if (updated.length !== batch.length) throw new SispatError('Um cadastro foi alterado durante a importação. Nenhuma alteração desta importação foi salva. Analise novamente.', 409);
    onProgress?.(results.length, sorted.length);
  }
  return results;
}
