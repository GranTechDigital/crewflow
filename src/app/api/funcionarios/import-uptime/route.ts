import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserFromRequest } from "@/utils/authUtils";
import xlsx from "xlsx";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 }
      );
    }

    // Verificar se é admin
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores podem importar funcionários." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo foi enviado" },
        { status: 400 }
      );
    }

    // Ler arquivo Excel
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    // Coletar funcionários únicos
    const funcionariosMap = new Map();
    let processados = 0;

    for (let i = 2; i < data.length; i++) { // Pular cabeçalhos
      const row = data[i];
      if (row && row.length > 2) {
        const nome = row[0] ? row[0].toString().trim() : '';
        const codigo = row[1] ? row[1].toString().trim() : '';
        const matricula = row[2] ? row[2].toString().trim() : '';

        // Verificar se é uma matrícula válida no formato FRI-XX-XXX
        if (matricula && /^FRI-\d{2}-\d+$/.test(matricula) && nome) {
          if (!funcionariosMap.has(matricula)) {
            funcionariosMap.set(matricula, {
              nome: nome,
              matricula: matricula,
              codigo: codigo
            });
          }
        }
        processados++;
      }
    }

    const funcionarios = Array.from(funcionariosMap.values());

    // Verificar funcionários já existentes
    const matriculasExistentes = await prisma.funcionario.findMany({
      select: { matricula: true },
      where: {
        matricula: {
          in: funcionarios.map(f => f.matricula)
        }
      }
    });

    const matriculasJaExistem = new Set(matriculasExistentes.map(f => f.matricula));
    const funcionariosNovos = funcionarios.filter(f => !matriculasJaExistem.has(f.matricula));

    let importados = 0;
    let erros = 0;

    // Importar funcionários em lotes
    for (const func of funcionariosNovos) {
      try {
        await prisma.funcionario.create({
          data: {
            nome: func.nome,
            matricula: func.matricula,
            setor: 'UPTIME',
            cargo: 'FUNCIONARIO',
            status: 'ATIVO'
          }
        });
        importados++;
      } catch (error) {
        console.error(`Erro ao importar ${func.matricula}:`, error);
        erros++;
      }
    }

    // Registrar no histórico
    await prisma.historicoRemanejamento.create({
      data: {
        usuarioId: user.id,
        acao: "IMPORT_FUNCIONARIOS",
        detalhes: `Importados ${importados} funcionários da planilha de uptime. Erros: ${erros}`,
        dataHora: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Funcionários importados com sucesso",
      stats: {
        processados,
        funcionariosEncontrados: funcionarios.length,
        jaExistiam: matriculasJaExistem.size,
        importados,
        erros
      }
    });

  } catch (error) {
    console.error("Erro ao importar funcionários:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}