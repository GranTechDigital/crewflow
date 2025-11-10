import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";
import { read, utils } from "xlsx";

function normalizeObrigatoriedade(value: string): string {
  const v = (value || "").trim().toUpperCase();
  const legacyMap: Record<string, string> = { OB: "AP", RC: "C", AD: "SD" };
  const mapped = legacyMap[v] || v;
  const valid = ["RA", "AP", "C", "SD", "N/A"];
  if (!valid.includes(mapped)) return "AP";
  return mapped;
}

function parseBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  const s = String(val || "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "sim" || s === "yes";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Token de autenticação necessário" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const contratoId = parseInt(id);
    if (isNaN(contratoId)) {
      return NextResponse.json(
        { success: false, error: "ID do contrato inválido" },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    // Em runtime Node.js, File pode não existir; aceitar Blob/Undici File
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json(
        { success: false, error: "Arquivo XLSX não enviado ou inválido (campo file)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { success: false, error: "Arquivo XLSX vazio ou não lido." },
        { status: 400 }
      );
    }

    let workbook;
    try {
      workbook = read(Buffer.from(arrayBuffer), { type: "buffer" });
    } catch (e) {
      return NextResponse.json(
        { success: false, error: `Não foi possível ler o arquivo XLSX: ${(e as Error)?.message || e}` },
        { status: 400 }
      );
    }

    const sheetName = workbook.SheetNames.find((n) => n === 'Matriz V2') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: `Aba da planilha não encontrada: ${sheetName}` },
        { status: 400 }
      );
    }

    // Utilitários para ler célula por índice (0-based)
    const ref = (sheet as any)['!ref'] || 'A1';
    const range = utils.decode_range(ref);
    const readCell = (r: number, c: number): string => {
      // Limitar ao range para evitar exceções
      if (r < range.s.r || r > range.e.r || c < range.s.c || c > range.e.c) return '';
      const addr = utils.encode_cell({ r, c });
      const cell = (sheet as any)[addr];
      if (!cell) return '';
      // Preferir valor formatado/texto quando disponível
      const raw = cell.w ?? cell.v ?? '';
      try {
        return String(raw).trim();
      } catch {
        return '';
      }
    };

    // Garantir que há ao menos 4 linhas (cabeçalho na linha 4)
    if (range.e.r < 3) {
      return NextResponse.json(
        { success: false, error: 'Formato inválido: cabeçalho esperado na linha 4.' },
        { status: 400 }
      );
    }

    // Mapear colunas de treinamento a partir do cabeçalho (linha 4 => r=3), começando em C (c=2)
    const trainingCols: { colIndex: number; treinamentoId: number }[] = [];
    for (let c = 2; c <= range.e.c; c++) {
      const header = readCell(3, c); // ex: "123 - Treinamento XYZ"
      if (!header) continue;
      const idStr = header.split(' - ')[0]?.trim();
      const idNum = Number(idStr);
      if (!idNum || isNaN(idNum)) continue;
      trainingCols.push({ colIndex: c, treinamentoId: idNum });
    }
    if (trainingCols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cabeçalhos de treinamentos não encontrados. Preencha/seleciona o cabeçalho (linha 4) com "ID - Nome" antes de importar.' },
        { status: 400 }
      );
    }

    // Inicializar contadores ANTES de qualquer uso
    let criados = 0,
      atualizados = 0,
      removidos = 0,
      ignorados = 0,
      erros = 0;

    // Remoção em massa de treinamentos cuja coluna foi removida do cabeçalho
    const trainingIdsHeaderSet = new Set(trainingCols.map((c) => c.treinamentoId));
    const trainingsInDb = await prisma.matrizTreinamento.findMany({
      where: { contratoId, treinamentoId: { not: null } },
      select: { treinamentoId: true },
    });
    const trainingIdsInDbUnique = Array.from(
      new Set(
        trainingsInDb
          .map((t) => t.treinamentoId as number)
          .filter((id) => typeof id === 'number')
      )
    );
    const trainingIdsToRemove = trainingIdsInDbUnique.filter((id) => !trainingIdsHeaderSet.has(id));
    if (trainingIdsToRemove.length > 0) {
      const delRes = await prisma.matrizTreinamento.deleteMany({
        where: { contratoId, treinamentoId: { in: trainingIdsToRemove } },
      });
      removidos += delRes.count;
    }

    // Valid codes
    const validObrig = new Set(['RA', 'AP', 'C', 'SD']);

    const operacoes: Array<{ funcaoId: number; treinamentoId: number; valor: string }> = [];
    const funcoesNaPlanilha = new Set<number>();

    // Linhas de dados iniciam na linha 5 (r=4)
    for (let r = 4; r <= range.e.r; r++) {
      const funcaoLabel = readCell(r, 0); // coluna A (ID - Nome - Regime)
      if (!funcaoLabel) continue; // linha em branco
      const funcaoIdStr = funcaoLabel.split(' - ')[0]?.trim();
      const funcaoId = Number(funcaoIdStr);
      if (!funcaoId || isNaN(funcaoId)) {
        ignorados += 1;
        continue;
      }
      funcoesNaPlanilha.add(funcaoId);

      for (const { colIndex, treinamentoId } of trainingCols) {
        const raw = readCell(r, colIndex).toUpperCase();
        const valor = normalizeObrigatoriedade(raw || '');
        if (valor === '' || valor === 'N/A') {
          // Considerar remoção se existir no banco
          operacoes.push({ funcaoId, treinamentoId, valor: '' });
        } else if (validObrig.has(valor)) {
          operacoes.push({ funcaoId, treinamentoId, valor });
        } else {
          // Valor inválido
          ignorados += 1;
        }
      }
    }

    // Buscar registros existentes para o contrato e funções presentes na planilha
    const existentes = await prisma.matrizTreinamento.findMany({
      where: {
        contratoId,
        funcaoId: { in: Array.from(funcoesNaPlanilha) },
      },
      select: { id: true, funcaoId: true, treinamentoId: true, tipoObrigatoriedade: true },
    });

    const mapaExistentes = new Map<string, { id: number; tipo: string | null }>();
    const temSemTreinamento = new Map<number, number | null>(); // funcaoId -> id entry com treinamentoId null
    for (const e of existentes) {
      if (e.treinamentoId == null) {
        temSemTreinamento.set(e.funcaoId, e.id);
      } else {
        mapaExistentes.set(`${e.funcaoId}_${e.treinamentoId}`, { id: e.id, tipo: e.tipoObrigatoriedade });
      }
    }

    const errosDetalhes: string[] = [];

    for (const op of operacoes) {
      try {
        const chave = `${op.funcaoId}_${op.treinamentoId}`;
        const existente = mapaExistentes.get(chave);

        if (!op.valor) {
          // Remoção se existir
          if (existente) {
            await prisma.matrizTreinamento.delete({ where: { id: existente.id } });
            removidos += 1;
            mapaExistentes.delete(chave);

            // Se não restou nenhum treinamento para a função, garantir entrada "sem treinamento"
            const aindaTem = Array.from(mapaExistentes.keys()).some((k) => k.startsWith(`${op.funcaoId}_`));
            if (!aindaTem) {
              const idSem = temSemTreinamento.get(op.funcaoId) || null;
              if (!idSem) {
                const criado = await prisma.matrizTreinamento.create({
                  data: {
                    contratoId,
                    funcaoId: op.funcaoId,
                    treinamentoId: null,
                    tipoObrigatoriedade: 'N/A',
                  },
                  select: { id: true },
                });
                temSemTreinamento.set(op.funcaoId, criado.id);
              }
            }
          }
          continue;
        }

        // Upsert com regra de conversão de "sem treinamento" para o primeiro treinamento
        if (existente) {
          if ((existente.tipo || '').toUpperCase() !== op.valor.toUpperCase()) {
            await prisma.matrizTreinamento.update({
              where: { id: existente.id },
              data: { tipoObrigatoriedade: op.valor, ativo: true },
            });
            atualizados += 1;
          }
        } else {
          const idSem = temSemTreinamento.get(op.funcaoId) || null;
          if (idSem) {
            // Converter entrada "sem treinamento" para este treinamento
            await prisma.matrizTreinamento.update({
              where: { id: idSem },
              data: { treinamentoId: op.treinamentoId, tipoObrigatoriedade: op.valor, ativo: true },
            });
            atualizados += 1;
            temSemTreinamento.set(op.funcaoId, null); // deixou de ser "sem treinamento"
            mapaExistentes.set(chave, { id: idSem, tipo: op.valor });
          } else {
            await prisma.matrizTreinamento.create({
              data: {
                contratoId,
                funcaoId: op.funcaoId,
                treinamentoId: op.treinamentoId,
                tipoObrigatoriedade: op.valor,
                ativo: true,
              },
            });
            criados += 1;
          }
        }
      } catch (e) {
        console.error('Erro ao aplicar operação:', e);
        erros += 1;
        errosDetalhes.push(`Funcao ${op.funcaoId}, Treinamento ${op.treinamentoId}: ${(e as Error)?.message || e}`);
      }
    }

    // Remoção em massa de funções cujo linha foi removida da planilha
    const funcoesExistentesContrato = await prisma.funcao.findMany({
      where: { matrizTreinamento: { some: { contratoId } } },
      select: { id: true },
    });
    const funcoesExistentesIds = funcoesExistentesContrato.map((f) => f.id);
    const funcoesParaRemover = funcoesExistentesIds.filter((id) => !funcoesNaPlanilha.has(id));
    if (funcoesParaRemover.length > 0) {
      const delRes = await prisma.matrizTreinamento.deleteMany({
        where: { contratoId, funcaoId: { in: funcoesParaRemover } },
      });
      removidos += delRes.count;
    }

    return NextResponse.json({
      success: true,
      message: 'Importação concluída',
      stats: { criados, atualizados, removidos, ignorados, erros },
      errors: errosDetalhes,
    });
  } catch (error) {
    console.error("Erro ao importar matriz:", error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
