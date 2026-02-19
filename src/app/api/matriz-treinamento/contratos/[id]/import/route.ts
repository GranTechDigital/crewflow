import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";
import { sincronizarTarefasPadrao } from "@/lib/tarefasPadraoSync";
import { read, utils } from "xlsx";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

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
    // Em runtime Node.js, garantir Blob/File para usar arrayBuffer
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error: "Arquivo XLSX não enviado ou inválido (campo file)",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await (file as Blob).arrayBuffer();
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
        {
          success: false,
          error: `Não foi possível ler o arquivo XLSX: ${
            (e as Error)?.message || e
          }`,
        },
        { status: 400 }
      );
    }

    const sheetName =
      workbook.SheetNames.find((n) => n === "Matriz V2") ||
      workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json(
        {
          success: false,
          error: `Aba da planilha não encontrada: ${sheetName}`,
        },
        { status: 400 }
      );
    }

    // Utilitários para ler célula por índice (0-based)
    const ref = (sheet as any)["!ref"] || "A1";
    const range = utils.decode_range(ref);
    const readCell = (r: number, c: number): string => {
      // Limitar ao range para evitar exceções
      if (r < range.s.r || r > range.e.r || c < range.s.c || c > range.e.c)
        return "";
      const addr = utils.encode_cell({ r, c });
      const cell = (sheet as any)[addr];
      if (!cell) return "";
      // Preferir valor formatado/texto quando disponível
      const raw = cell.w ?? cell.v ?? "";
      try {
        return String(raw).trim();
      } catch {
        return "";
      }
    };

    // Garantir que há ao menos 4 linhas (cabeçalho na linha 4)
    if (range.e.r < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "Formato inválido: cabeçalho esperado na linha 4.",
        },
        { status: 400 }
      );
    }

    // Mapear colunas de treinamento a partir do cabeçalho (linha 4 => r=3), começando em C (c=2)
    const trainingCols: { colIndex: number; treinamentoId: number }[] = [];
    for (let c = 2; c <= range.e.c; c++) {
      const header = readCell(3, c); // ex: "123 - Treinamento XYZ"
      if (!header) continue;
      const idStr = header.split(" - ")[0]?.trim();
      const idNum = Number(idStr);
      if (!idNum || isNaN(idNum)) continue;
      trainingCols.push({ colIndex: c, treinamentoId: idNum });
    }
    if (trainingCols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Cabeçalhos de treinamentos não encontrados. Preencha/seleciona o cabeçalho (linha 4) com "ID - Nome" antes de importar.',
        },
        { status: 400 }
      );
    }

    const headerTrainingIds = trainingCols.map((c) => c.treinamentoId);
    const trainingsFound = await prisma.treinamentos.findMany({
      where: { id: { in: headerTrainingIds } },
      select: { id: true },
    });
    const validIds = new Set(trainingsFound.map((t) => t.id));
    const invalidTrainingIds = headerTrainingIds.filter(
      (id) => !validIds.has(id)
    );
    if (invalidTrainingIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `IDs de treinamento inválidos no cabeçalho: ${invalidTrainingIds.join(
            ", "
          )}`,
          details: {
            invalidTrainingIds,
            hint: 'Use a lista no cabeçalho (linha 4) e selecione "ID - Nome" da aba Treinamentos. Se necessário, exporte novamente a planilha V2.',
          },
        },
        { status: 400 }
      );
    }

    // Inicializar contadores ANTES de qualquer uso
    let criados = 0,
      atualizados = 0,
      removidos = 0,
      ignorados = 0,
      erros = 0;
    const detalhesOperacoes: Array<{
      acao: "CRIADO" | "ATUALIZADO" | "REMOVIDO" | "CONVERTIDO";
      funcaoId: number;
      funcao?: string | null;
      regime?: string | null;
      treinamentoId: number | null;
      treinamento?: string | null;
      de?: string | null;
      para?: string | null;
    }> = [];

    // Remoção em massa de treinamentos cuja coluna foi removida do cabeçalho
    const trainingIdsHeaderSet = new Set(
      trainingCols.map((c) => c.treinamentoId)
    );
    const trainingsInDb = await prisma.matrizTreinamento.findMany({
      where: { contratoId, treinamentoId: { not: null } },
      select: { treinamentoId: true },
    });
    const trainingIdsInDbUnique = Array.from(
      new Set(
        trainingsInDb
          .map((t) => t.treinamentoId as number)
          .filter((id) => typeof id === "number")
      )
    );
    const trainingIdsToRemove = trainingIdsInDbUnique.filter(
      (id) => !trainingIdsHeaderSet.has(id)
    );
    let colunasRemovidasResumo: Array<{
      treinamentoId: number;
      treinamento?: string | null;
      removidos: number;
    }> = [];
    if (trainingIdsToRemove.length > 0) {
      const antesRemover = await prisma.matrizTreinamento.findMany({
        where: { contratoId, treinamentoId: { in: trainingIdsToRemove } },
        select: { funcaoId: true, treinamentoId: true },
      });
      const agrup: Record<number, number> = {};
      for (const r of antesRemover) {
        const tid = r.treinamentoId as number;
        agrup[tid] = (agrup[tid] || 0) + 1;
      }
      const treinosInfoHead = await prisma.treinamentos.findMany({
        where: { id: { in: trainingIdsToRemove } },
        select: { id: true, treinamento: true },
      });
      const treinosMapHead = new Map<number, string | null>(
        treinosInfoHead.map((t) => [t.id, t.treinamento ?? null])
      );
      colunasRemovidasResumo = Object.keys(agrup).map((k) => {
        const idNum = Number(k);
        return {
          treinamentoId: idNum,
          treinamento: treinosMapHead.get(idNum) ?? null,
          removidos: agrup[idNum],
        };
      });
      const delRes = await prisma.matrizTreinamento.deleteMany({
        where: { contratoId, treinamentoId: { in: trainingIdsToRemove } },
      });
      removidos += delRes.count;
    }

    // Valid codes
    const validObrig = new Set(["RA", "AP", "C", "SD"]);

    const operacoes: Array<{
      funcaoId: number;
      treinamentoId: number;
      valor: string;
    }> = [];
    const funcoesNaPlanilha = new Set<number>();

    // Linhas de dados iniciam na linha 5 (r=4)
    for (let r = 4; r <= range.e.r; r++) {
      const funcaoLabel = readCell(r, 0); // coluna A (ID - Nome - Regime)
      if (!funcaoLabel) continue; // linha em branco
      const funcaoIdStr = funcaoLabel.split(" - ")[0]?.trim();
      const funcaoId = Number(funcaoIdStr);
      if (!funcaoId || isNaN(funcaoId)) {
        ignorados += 1;
        continue;
      }
      funcoesNaPlanilha.add(funcaoId);

      for (const { colIndex, treinamentoId } of trainingCols) {
        const rawCell = readCell(r, colIndex);
        const raw = (rawCell || "").trim().toUpperCase();
        if (raw === "") {
          operacoes.push({ funcaoId, treinamentoId, valor: "" });
          continue;
        }
        const valor = normalizeObrigatoriedade(raw);
        if (valor === "N/A") {
          operacoes.push({ funcaoId, treinamentoId, valor: "" });
        } else if (validObrig.has(valor)) {
          operacoes.push({ funcaoId, treinamentoId, valor });
        } else {
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
      select: {
        id: true,
        funcaoId: true,
        treinamentoId: true,
        tipoObrigatoriedade: true,
      },
    });

    const gruposDuplicados = new Map<
      string,
      Array<(typeof existentes)[number]>
    >();
    for (const e of existentes) {
      if (e.treinamentoId == null) continue;
      const chave = `${e.funcaoId}_${e.treinamentoId}`;
      const arr = gruposDuplicados.get(chave) || [];
      arr.push(e);
      gruposDuplicados.set(chave, arr);
    }
    const idsParaExcluir: number[] = [];
    for (const [_, arr] of gruposDuplicados.entries()) {
      if (arr.length <= 1) continue;
      const manter = arr[0];
      for (const e of arr) {
        if (e.id !== manter.id) idsParaExcluir.push(e.id);
      }
    }
    if (idsParaExcluir.length > 0) {
      const delDup = await prisma.matrizTreinamento.deleteMany({
        where: { id: { in: idsParaExcluir } },
      });
      removidos += delDup.count;
    }

    const mapaExistentes = new Map<
      string,
      { id: number; tipo: string | null }
    >();
    const temSemTreinamento = new Map<number, number | null>(); // funcaoId -> id entry com treinamentoId null
    for (const e of existentes) {
      if (e.treinamentoId == null) {
        temSemTreinamento.set(e.funcaoId, e.id);
      } else {
        mapaExistentes.set(`${e.funcaoId}_${e.treinamentoId}`, {
          id: e.id,
          tipo: e.tipoObrigatoriedade,
        });
      }
    }

    const errosDetalhes: string[] = [];
    // Map para nomes e regimes de funções presentes na planilha
    const funcoesInfo = await prisma.funcao.findMany({
      where: { id: { in: Array.from(funcoesNaPlanilha) } },
      select: { id: true, funcao: true, regime: true },
    });
    const funcoesMap = new Map<
      number,
      { funcao: string | null; regime: string | null }
    >(
      funcoesInfo.map((f) => [
        f.id,
        { funcao: f.funcao ?? null, regime: f.regime ?? null },
      ])
    );
    // Map de nomes de treinamentos (do cabeçalho)
    const treinosInfo = await prisma.treinamentos.findMany({
      where: { id: { in: headerTrainingIds } },
      select: { id: true, treinamento: true },
    });
    const treinosMap = new Map<number, string | null>(
      treinosInfo.map((t) => [t.id, t.treinamento ?? null])
    );

    for (const op of operacoes) {
      try {
        const chave = `${op.funcaoId}_${op.treinamentoId}`;
        const existente = mapaExistentes.get(chave);

        if (!op.valor) {
          // Remoção se existir
          if (existente) {
            await prisma.matrizTreinamento.delete({
              where: { id: existente.id },
            });
            removidos += 1;
            detalhesOperacoes.push({
              acao: "REMOVIDO",
              funcaoId: op.funcaoId,
              funcao: funcoesMap.get(op.funcaoId)?.funcao ?? null,
              regime: funcoesMap.get(op.funcaoId)?.regime ?? null,
              treinamentoId: op.treinamentoId,
              treinamento: treinosMap.get(op.treinamentoId) ?? null,
              de: existente.tipo || null,
              para: null,
            });
            mapaExistentes.delete(chave);

            // Se não restou nenhum treinamento para a função, garantir entrada "sem treinamento"
            const aindaTem = Array.from(mapaExistentes.keys()).some((k) =>
              k.startsWith(`${op.funcaoId}_`)
            );
            if (!aindaTem) {
              const idSem = temSemTreinamento.get(op.funcaoId) || null;
              if (!idSem) {
                const criado = await prisma.matrizTreinamento.create({
                  data: {
                    contratoId,
                    funcaoId: op.funcaoId,
                    treinamentoId: null,
                    tipoObrigatoriedade: "N/A",
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
          if ((existente.tipo || "").toUpperCase() !== op.valor.toUpperCase()) {
            await prisma.matrizTreinamento.update({
              where: { id: existente.id },
              data: { tipoObrigatoriedade: op.valor, ativo: true },
            });
            atualizados += 1;
            detalhesOperacoes.push({
              acao: "ATUALIZADO",
              funcaoId: op.funcaoId,
              funcao: funcoesMap.get(op.funcaoId)?.funcao ?? null,
              regime: funcoesMap.get(op.funcaoId)?.regime ?? null,
              treinamentoId: op.treinamentoId,
              treinamento: treinosMap.get(op.treinamentoId) ?? null,
              de: existente.tipo || null,
              para: op.valor,
            });
          }
        } else {
          const idSem = temSemTreinamento.get(op.funcaoId) || null;
          if (idSem) {
            // Converter entrada "sem treinamento" para este treinamento
            await prisma.matrizTreinamento.update({
              where: { id: idSem },
              data: {
                treinamentoId: op.treinamentoId,
                tipoObrigatoriedade: op.valor,
                ativo: true,
              },
            });
            atualizados += 1;
            temSemTreinamento.set(op.funcaoId, null); // deixou de ser "sem treinamento"
            mapaExistentes.set(chave, { id: idSem, tipo: op.valor });
            detalhesOperacoes.push({
              acao: "CONVERTIDO",
              funcaoId: op.funcaoId,
              funcao: funcoesMap.get(op.funcaoId)?.funcao ?? null,
              regime: funcoesMap.get(op.funcaoId)?.regime ?? null,
              treinamentoId: op.treinamentoId,
              treinamento: treinosMap.get(op.treinamentoId) ?? null,
              de: "N/A",
              para: op.valor,
            });
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
            detalhesOperacoes.push({
              acao: "CRIADO",
              funcaoId: op.funcaoId,
              funcao: funcoesMap.get(op.funcaoId)?.funcao ?? null,
              regime: funcoesMap.get(op.funcaoId)?.regime ?? null,
              treinamentoId: op.treinamentoId,
              treinamento: treinosMap.get(op.treinamentoId) ?? null,
              de: null,
              para: op.valor,
            });
          }
        }
      } catch (e) {
        console.error("Erro ao aplicar operação:", e);
        erros += 1;
        errosDetalhes.push(
          `Funcao ${op.funcaoId}, Treinamento ${op.treinamentoId}: ${
            (e as Error)?.message || e
          }`
        );
      }
    }

    // Remoção em massa de funções cujo linha foi removida da planilha
    const funcoesExistentesContrato = await prisma.funcao.findMany({
      where: { matrizTreinamento: { some: { contratoId } } },
      select: { id: true },
    });
    const funcoesExistentesIds = funcoesExistentesContrato.map((f) => f.id);
    const funcoesParaRemover = funcoesExistentesIds.filter(
      (id) => !funcoesNaPlanilha.has(id)
    );
    let funcoesRemovidasResumo: Array<{
      funcaoId: number;
      funcao?: string | null;
      regime?: string | null;
      removidos: number;
    }> = [];
    if (funcoesParaRemover.length > 0) {
      const antesRemoverFunc = await prisma.matrizTreinamento.findMany({
        where: { contratoId, funcaoId: { in: funcoesParaRemover } },
        select: { funcaoId: true },
      });
      const agrupFun: Record<number, number> = {};
      for (const r of antesRemoverFunc) {
        agrupFun[r.funcaoId] = (agrupFun[r.funcaoId] || 0) + 1;
      }
      const funInfo = await prisma.funcao.findMany({
        where: { id: { in: funcoesParaRemover } },
        select: { id: true, funcao: true, regime: true },
      });
      const funMapRem = new Map<
        number,
        { funcao: string | null; regime: string | null }
      >(
        funInfo.map((f) => [
          f.id,
          { funcao: f.funcao ?? null, regime: f.regime ?? null },
        ])
      );
      funcoesRemovidasResumo = Object.keys(agrupFun).map((k) => {
        const idNum = Number(k);
        const meta = funMapRem.get(idNum);
        return {
          funcaoId: idNum,
          funcao: meta?.funcao ?? null,
          regime: meta?.regime ?? null,
          removidos: agrupFun[idNum],
        };
      });
      const delRes = await prisma.matrizTreinamento.deleteMany({
        where: { contratoId, funcaoId: { in: funcoesParaRemover } },
      });
      removidos += delRes.count;
    }

    // Gerar planilha de resultado
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { id: true, nome: true, numero: true, cliente: true },
    });
    const wb = new ExcelJS.Workbook();
    wb.creator = "CrewFlow";
    wb.created = new Date();
    const wsResumo = wb.addWorksheet("Resumo");
    wsResumo.columns = [
      { header: "Campo", key: "Campo", width: 28 },
      { header: "Valor", key: "Valor", width: 48 },
    ];
    wsResumo.addRows([
      { Campo: "Contrato Número", Valor: contrato?.numero ?? "" },
      { Campo: "Contrato Nome", Valor: contrato?.nome ?? "" },
      { Campo: "Cliente", Valor: contrato?.cliente ?? "" },
      {
        Campo: "Importado por",
        Valor: (user as any)?.login ?? (user as any)?.email ?? "",
      },
      { Campo: "Data/Hora (UTC)", Valor: new Date().toISOString() },
      { Campo: "Criados", Valor: String(criados) },
      { Campo: "Atualizados", Valor: String(atualizados) },
      { Campo: "Removidos", Valor: String(removidos) },
      { Campo: "Ignorados", Valor: String(ignorados) },
      { Campo: "Erros", Valor: String(erros) },
    ]);
    wsResumo.getRow(1).font = { bold: true };

    const wsOps = wb.addWorksheet("Operacoes");
    wsOps.columns = [
      { header: "Acao", key: "Acao", width: 14 },
      { header: "FuncaoID", key: "FuncaoID", width: 12 },
      { header: "Funcao", key: "Funcao", width: 40 },
      { header: "Regime", key: "Regime", width: 16 },
      { header: "TreinamentoID", key: "TreinamentoID", width: 16 },
      { header: "Treinamento", key: "Treinamento", width: 44 },
      { header: "De", key: "De", width: 12 },
      { header: "Para", key: "Para", width: 12 },
    ];
    wsOps.addRows(
      detalhesOperacoes.map((d) => ({
        Acao: d.acao,
        FuncaoID: d.funcaoId,
        Funcao: d.funcao ?? "",
        Regime: d.regime ?? "",
        TreinamentoID: d.treinamentoId ?? "",
        Treinamento: d.treinamento ?? "",
        De: d.de ?? "",
        Para: d.para ?? "",
      }))
    );
    wsOps.getRow(1).font = { bold: true };

    const wsColsRem = wb.addWorksheet("ColunasRemovidas");
    wsColsRem.columns = [
      { header: "TreinamentoID", key: "TreinamentoID", width: 16 },
      { header: "Treinamento", key: "Treinamento", width: 44 },
      { header: "Removidos", key: "Removidos", width: 12 },
    ];
    wsColsRem.addRows(
      colunasRemovidasResumo.map((r) => ({
        TreinamentoID: r.treinamentoId,
        Treinamento: r.treinamento ?? "",
        Removidos: r.removidos,
      }))
    );
    wsColsRem.getRow(1).font = { bold: true };

    const wsFunRem = wb.addWorksheet("FuncoesRemovidas");
    wsFunRem.columns = [
      { header: "FuncaoID", key: "FuncaoID", width: 12 },
      { header: "Funcao", key: "Funcao", width: 40 },
      { header: "Regime", key: "Regime", width: 16 },
      { header: "Removidos", key: "Removidos", width: 12 },
    ];
    wsFunRem.addRows(
      (funcoesRemovidasResumo || []).map((r) => ({
        FuncaoID: r.funcaoId,
        Funcao: r.funcao ?? "",
        Regime: r.regime ?? "",
        Removidos: r.removidos,
      }))
    );
    wsFunRem.getRow(1).font = { bold: true };

    const wsErros = wb.addWorksheet("Erros");
    wsErros.columns = [{ header: "Detalhe", key: "Detalhe", width: 120 }];
    wsErros.addRows(errosDetalhes.map((e) => ({ Detalhe: e })));
    wsErros.getRow(1).font = { bold: true };

    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `resultado_import_contrato_${contratoId}_${ts.getUTCFullYear()}${pad(
      ts.getUTCMonth() + 1
    )}${pad(ts.getUTCDate())}_${pad(ts.getUTCHours())}${pad(
      ts.getUTCMinutes()
    )}${pad(ts.getUTCSeconds())}.xlsx`;
    const reportBuffer = await wb.xlsx.writeBuffer();
    // Converter o buffer do relatório para base64 de forma compatível com Node 20+
    // ExcelJS pode retornar ArrayBuffer ou Buffer dependendo do ambiente
    const reportBase64 = (
      reportBuffer instanceof Buffer
        ? reportBuffer
        : Buffer.from(reportBuffer as unknown as Uint8Array)
    ).toString("base64");
    let reportUrl: string | null = null;
    try {
      const reportsDir = path.resolve(
        process.cwd(),
        "public",
        "import-reports"
      );
      if (!fs.existsSync(reportsDir))
        fs.mkdirSync(reportsDir, { recursive: true });
      const filePath = path.join(reportsDir, filename);
      await wb.xlsx.writeFile(filePath);
      reportUrl = `/import-reports/${filename}`;
      try {
        const retentionDays = Number.parseInt(
          process.env.IMPORT_REPORTS_RETENTION_DAYS || "30",
          10
        );
        if (Number.isFinite(retentionDays) && retentionDays > 0) {
          const now = Date.now();
          const threshold = now - retentionDays * 24 * 60 * 60 * 1000;
          const entries = fs.readdirSync(reportsDir);
          for (const entry of entries) {
            const full = path.join(reportsDir, entry);
            try {
              const st = fs.statSync(full);
              if (st.isFile() && st.mtime.getTime() < threshold) {
                fs.unlinkSync(full);
              }
            } catch {}
          }
        }
      } catch {}
    } catch {}

    try {
      await sincronizarTarefasPadrao({
        setores: ["TREINAMENTO"],
        usuarioResponsavel:
          (user as any)?.funcionario?.nome ||
          "Sistema - Importação de Matriz de Treinamento",
        usuarioResponsavelId: (user as any)?.id,
        equipeId: (user as any)?.equipeId,
      });
    } catch (syncErr) {
      console.error(
        "Erro na sincronização automática após importação de matriz:",
        syncErr
      );
    }

    return NextResponse.json({
      success: true,
      message: "Importação concluída",
      stats: { criados, atualizados, removidos, ignorados, erros },
      errors: errosDetalhes,
      reportUrl,
      reportBase64,
      reportFilename: filename,
    });
  } catch (error) {
    console.error("Erro ao importar matriz:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error)?.message || "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
