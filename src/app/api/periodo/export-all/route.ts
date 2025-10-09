import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { utils, write } from "xlsx";

export async function GET() {
  try {
    // Buscar todos os dados da PeriodoSheet
    const dados = await prisma.periodoSheet.findMany({
      include: {
        status: true,
        projeto: true,
      },
      orderBy: [
        { anoReferencia: "desc" },
        { mesReferencia: "desc" },
        { nome: "asc" },
      ],
    });

    // Preparar dados para Excel
    const dadosExcel = dados.map((item) => ({
      ID: item.id,
      Nome: item.nome,
      Matrícula: item.matricula,
      Função: item.funcao,
      Embarcação: item.embarcacao,
      "Status Funcionário": item.status?.categoria || "",
      "Status Folha": item.statusFolha || "",
      Código: item.codigo || "",
      Observações: item.observacoes || "",
      "Embarcação Atual": item.embarcacaoAtual || "",
      SISPAT: item.sispat,
      "Regime de Trabalho": item.regimeTrabalho,
      "Total Dias Período": item.totalDiasPeriodo || "",
      Projeto: item.projeto?.nome || "",
      Departamento: item.departamento || "",
      "Mês Referência": item.mesReferencia,
      "Ano Referência": item.anoReferencia,
      "Data Início": item.dataInicio
        ? new Date(item.dataInicio).toLocaleDateString("pt-BR")
        : "",
      "Data Fim": item.dataFim
        ? new Date(item.dataFim).toLocaleDateString("pt-BR")
        : "",
      "Status ID": item.statusId,
      "Projeto ID": item.projetoId,
      "Data Criação": new Date(item.createdAt).toLocaleDateString("pt-BR"),
    }));

    // Criar workbook
    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(dadosExcel);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 10 }, // ID
      { wch: 30 }, // Nome
      { wch: 15 }, // Matrícula
      { wch: 25 }, // Função
      { wch: 20 }, // Embarcação
      { wch: 20 }, // Status Funcionário
      { wch: 15 }, // Status Geral
      { wch: 15 }, // Status Folha
      { wch: 15 }, // Código
      { wch: 30 }, // Observações
      { wch: 20 }, // Embarcação Atual
      { wch: 15 }, // SISPAT
      { wch: 20 }, // Regime de Trabalho
      { wch: 18 }, // Total Dias Período
      { wch: 25 }, // Projeto
      { wch: 15 }, // Centro de Custo
      { wch: 10 }, // Mês Referência
      { wch: 10 }, // Ano Referência
      { wch: 15 }, // Data Início
      { wch: 15 }, // Data Fim
      { wch: 15 }, // Status Mapping ID
      { wch: 20 }, // Centro Custo Projeto ID
      { wch: 15 }, // Upload ID
      { wch: 15 }, // Data Upload
      { wch: 20 }, // Usuário Upload
      { wch: 15 }, // Data Criação
      { wch: 15 }, // Data Atualização
    ];
    worksheet["!cols"] = colWidths;

    utils.book_append_sheet(workbook, worksheet, "Todos os Dados");

    // Gerar buffer do Excel
    const excelBuffer = write(workbook, { type: "buffer", bookType: "xlsx" });

    // Criar nome do arquivo
    const agora = new Date();
    const timestamp = agora.toISOString().slice(0, 19).replace(/[:-]/g, "");
    const nomeArquivo = `periodo_completo_${timestamp}.xlsx`;

    // Retornar arquivo
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": excelBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Erro ao exportar todos os dados:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
