// src/app/api/dados/sincronizar-funcoes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSlug } from '@/utils/slug';

function normalizeRegime(regime: unknown) {
  const r = String(regime || "ONSHORE").toUpperCase();
  return r.includes("OFFSHORE") ? "OFFSHORE" : "ONSHORE";
}

// Removido toSlug local; usando helper compartilhado
async function fetchExternalDataWithRetry(maxRetries = 3, timeout = 15000) {
  const url =
    "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
  const headers = {
    Authorization: "Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==",
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.log(
        `Tentativa ${attempt}/${maxRetries} falhou:`,
        error instanceof Error ? error.message : "Erro desconhecido"
      );

      if (attempt === maxRetries) {
        throw error;
      }

      // Aguardar antes da próxima tentativa (backoff exponencial)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

export async function POST() {
  try {
    console.log("Iniciando sincronização de funções...");

    // Buscar dados da API externa com retry
    const dadosExternos = await fetchExternalDataWithRetry();
    console.log(`Dados externos obtidos: ${dadosExternos.length} registros`);

    // Extrair funções distintas por (funcao, regime)
    const funcoesDistintas = new Map<
      string,
      { funcao: string; regime: string }
    >();

    dadosExternos.forEach((item: Record<string, unknown>) => {
      const funcao = item.FUNCAO ? String(item.FUNCAO).trim() : "";
      const regime = normalizeRegime(item.EMPREGADO);
      if (funcao) {
        const key = `${funcao}|${regime}`;
        if (!funcoesDistintas.has(key)) {
          funcoesDistintas.set(key, { funcao, regime });
        }
      }
    });

    // Buscar funções existentes no banco (funcao + regime)
    const funcoesExistentes = await prisma.funcao.findMany({
      select: { funcao: true, regime: true },
    });

    // Set com chave composta para verificação rápida
    const funcoesExistentesSet = new Set(
      funcoesExistentes.map((f) => `${f.funcao}|${f.regime}`)
    );

    // Preparar dados para inserção (apenas funções que não existem)
    const funcoesParaInserir: Array<{
      funcao: string;
      regime: string;
      funcao_slug: string;
      ativo: boolean;
    }> = [];

    funcoesDistintas.forEach(({ funcao, regime }, key) => {
      if (!funcoesExistentesSet.has(key)) {
        const funcao_slug = toSlug(funcao);
        funcoesParaInserir.push({ funcao, regime, funcao_slug, ativo: true });
      }
    });

    // Inserir novas funções
    let funcoesInseridas = 0;
    if (funcoesParaInserir.length > 0) {
      const res = await prisma.funcao.createMany({
        data: funcoesParaInserir,
        skipDuplicates: true,
      });
      funcoesInseridas = res.count;
    }

    console.log(
      `Sincronização de funções concluída: ${funcoesInseridas} novas funções inseridas`
    );

    return NextResponse.json({
      message: "Sincronização de funções concluída",
      totalFuncoesDistintas: funcoesDistintas.size,
      funcoesExistentes: funcoesExistentes.length,
      novasFuncoesInseridas: funcoesInseridas,
      funcoes: Array.from(funcoesDistintas.values()).sort(
        (a, b) =>
          a.funcao.localeCompare(b.funcao) || a.regime.localeCompare(b.regime)
      ),
    });
  } catch (error) {
    console.error("Erro na sincronização de funções:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const isTimeoutError =
      errorMessage.includes("AbortError") || errorMessage.includes("timeout");
    const isNetworkError =
      errorMessage.includes("fetch") || errorMessage.includes("network");

    let userMessage = "Erro interno na sincronização de funções.";
    if (isTimeoutError) {
      userMessage =
        "Timeout na sincronização. A API externa demorou muito para responder.";
    } else if (isNetworkError) {
      userMessage = "Erro de conexão com a API externa.";
    }

    return NextResponse.json(
      { error: userMessage, details: errorMessage },
      { status: 500 }
    );
  }
}
