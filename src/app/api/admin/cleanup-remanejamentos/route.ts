import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simples proteção via token em header. Configure CLEANUP_ADMIN_TOKEN no ambiente.
function validarAdmin(req: NextRequest) {
  const tokenHeader = req.headers.get("x-admin-token") || req.headers.get("X-Admin-Token");
  const expected = process.env.CLEANUP_ADMIN_TOKEN;
  return expected && tokenHeader === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!validarAdmin(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const results = await prisma.$transaction([
      prisma.observacaoTarefaRemanejamento.deleteMany({}),
      prisma.historicoRemanejamento.deleteMany({}),
      prisma.tarefaRemanejamento.deleteMany({}),
      prisma.remanejamentoFuncionario.deleteMany({}),
      prisma.solicitacaoRemanejamento.deleteMany({}),
    ]);

    const resetMigracao = await prisma.funcionario.updateMany({
      where: { emMigracao: true },
      data: { emMigracao: false },
    });

    return NextResponse.json({
      ok: true,
      removidos: {
        observacoesTarefa: results[0].count,
        historico: results[1].count,
        tarefas: results[2].count,
        remanejamentosFuncionario: results[3].count,
        solicitacoesRemanejamento: results[4].count,
        funcionariosResetados: resetMigracao.count,
      },
    });
  } catch (error: any) {
    console.error("Erro na limpeza administrativa:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Erro interno" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // GET retorna uma prévia das quantidades atuais (sem alterar nada)
  try {
    if (!validarAdmin(request)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [obsCount, histCount, tarefasCount, remFuncCount, solCount, emMigracaoCount] = await Promise.all([
      prisma.observacaoTarefaRemanejamento.count(),
      prisma.historicoRemanejamento.count(),
      prisma.tarefaRemanejamento.count(),
      prisma.remanejamentoFuncionario.count(),
      prisma.solicitacaoRemanejamento.count(),
      prisma.funcionario.count({ where: { emMigracao: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      atuais: {
        observacoesTarefa: obsCount,
        historico: histCount,
        tarefas: tarefasCount,
        remanejamentosFuncionario: remFuncCount,
        solicitacoesRemanejamento: solCount,
        funcionariosEmMigracao: emMigracaoCount,
      },
    });
  } catch (error: any) {
    console.error("Erro ao consultar prévia de limpeza:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Erro interno" }, { status: 500 });
  }
}