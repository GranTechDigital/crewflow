import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const baseWhere: any = {
      capacitacoes: { some: {} },
    };

    if (search) {
      const searchNorm = normalizeText(search);
      const baseResults = await prisma.funcionario.findMany({
        where: {
          ...baseWhere,
          OR: [
            { nome: { contains: search, mode: "insensitive" } },
            { matricula: { contains: search, mode: "insensitive" } },
            { funcao: { contains: search, mode: "insensitive" } },
            { centroCusto: { contains: search, mode: "insensitive" } },
          ],
        },
        include: {
          contrato: { select: { id: true, numero: true, nome: true } },
          _count: { select: { capacitacoes: true } },
          capacitacoes: {
            orderBy: { dataConclusao: "desc" },
            take: 1,
            include: { treinamento: true, tarefaPadrao: true },
          },
        },
        orderBy: [{ atualizadoEm: "desc" }],
      });

      const filtered = baseResults.filter((f) => {
        const tokens = [
          f.nome ?? "",
          f.matricula ?? "",
          f.funcao ?? "",
          f.centroCusto ?? "",
          f.contrato?.nome ?? "",
          f.contrato?.numero ?? "",
        ]
          .map(normalizeText)
          .join(" ");
        return tokens.includes(searchNorm);
      });

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      const data = paginated.map((f) => {
        const last = f.capacitacoes[0] || null;
        const lastResumo = last
          ? {
              tipo: last.tipo,
              responsavel: last.responsavel,
              descricao: last.descricao ?? null,
              dataConclusao: last.dataConclusao,
              dataVencimento: last.dataVencimento ?? null,
              treinamento: last.treinamento?.treinamento ?? null,
              tarefaPadrao: last.tarefaPadrao?.descricao ?? null,
            }
          : null;
        return {
          id: f.id,
          nome: f.nome,
          matricula: f.matricula,
          funcao: f.funcao,
          centroCusto: f.centroCusto,
          contrato: f.contrato,
          totalCapacitacoes: f._count.capacitacoes,
          ultimaCapacitacao: lastResumo,
        };
      });

      return NextResponse.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    const [funcionarios, total] = await Promise.all([
      prisma.funcionario.findMany({
        where: baseWhere,
        skip,
        take: limit,
        include: {
          contrato: { select: { id: true, numero: true, nome: true } },
          _count: { select: { capacitacoes: true } },
          capacitacoes: {
            orderBy: { dataConclusao: "desc" },
            take: 1,
            include: { treinamento: true, tarefaPadrao: true },
          },
        },
        orderBy: [{ atualizadoEm: "desc" }],
      }),
      prisma.funcionario.count({ where: baseWhere }),
    ]);

    const data = funcionarios.map((f) => {
      const last = f.capacitacoes[0] || null;
      const lastResumo = last
        ? {
            tipo: last.tipo,
            responsavel: last.responsavel,
            descricao: last.descricao ?? null,
            dataConclusao: last.dataConclusao,
            dataVencimento: last.dataVencimento ?? null,
            treinamento: last.treinamento?.treinamento ?? null,
            tarefaPadrao: last.tarefaPadrao?.descricao ?? null,
          }
        : null;
      return {
        id: f.id,
        nome: f.nome,
        matricula: f.matricula,
        funcao: f.funcao,
        centroCusto: f.centroCusto,
        contrato: f.contrato,
        totalCapacitacoes: f._count.capacitacoes,
        ultimaCapacitacao: lastResumo,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { success: false, message: "Erro ao listar funcionários com capacitações", error: message },
      { status: 500 }
    );
  }
}