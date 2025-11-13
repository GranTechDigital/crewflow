// src/app/api/funcionarios/backfill-admissao/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Backfill baseado EXCLUSIVAMENTE na API externa de sincronização (RM)
// Não usa UptimeSheet/legados.
const RM_API_URL = process.env.RM_API_URL;
const RM_API_AUTH = process.env.RM_API_AUTH;

function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function getDataAdmissaoFromApi(item: Record<string, unknown>): Date | null {
  const possibleKeys = ["DATA_ADMISSAO", "DT_ADMISSAO", "DATA_ADM", "ADMISSAO"]; 
  for (const k of possibleKeys) {
    const v = (item as any)[k];
    if (v) {
      const d = parseDate(String(v));
      if (d) return d;
    }
  }
  return null;
}

async function fetchExternalDataWithRetry(maxRetries = 3, timeout = 15000) {
  if (!RM_API_URL || !RM_API_AUTH) {
    throw new Error("Variáveis RM_API_URL e RM_API_AUTH não configuradas");
  }

  const headers = { Authorization: RM_API_AUTH } as Record<string, string>;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(RM_API_URL, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export async function POST() {
  try {
    // 1) Buscar funcionários na API externa
    const dadosExternos: Array<Record<string, unknown>> = await fetchExternalDataWithRetry();

    // 2) Mapear por matrícula com data de admissão
    const admPorMatricula = new Map<string, Date>();
    for (const item of dadosExternos) {
      const mat = String((item as any).MATRICULA || "").trim();
      if (!mat) continue;
      const adm = getDataAdmissaoFromApi(item);
      if (adm) admPorMatricula.set(mat, adm);
    }

    // 3) Selecionar funcionários com dataAdmissao nula
    const semAdmissao = await prisma.funcionario.findMany({
      where: { dataAdmissao: null, matricula: { not: "ADMIN001" } },
      select: { id: true, matricula: true },
    });

    // 4) Atualizar somente quem tem data na API
    let atualizados = 0;
    for (const f of semAdmissao) {
      const adm = admPorMatricula.get(f.matricula);
      if (adm) {
        await prisma.funcionario.update({
          where: { id: f.id },
          data: { dataAdmissao: adm },
        });
        atualizados++;
      }
    }

    return NextResponse.json({
      message: "Backfill de dataAdmissao (via API externa) concluído",
      processados: semAdmissao.length,
      atualizados,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeout = errorMessage.toLowerCase().includes("timeout") || errorMessage.includes("AbortError");
    const status = isTimeout ? 504 : 500;
    return NextResponse.json(
      { error: "Falha no backfill via API externa", details: errorMessage },
      { status }
    );
  }
}