import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');
    const regime = searchParams.get('regime');
    const projetos = searchParams.get('projetos');
    const status = searchParams.get('status');
    const statusFolha = searchParams.get('statusFolha');

    // Construir filtros
    const whereClause: any = {};
    
    if (mes && ano) {
      whereClause.mesReferencia = parseInt(mes);
      whereClause.anoReferencia = parseInt(ano);
    }

    // Filtro de regime de trabalho
    if (regime) {
      if (regime === 'offshore') {
        whereClause.regimeTrabalho = { contains: 'OFFSHORE' };
      } else if (regime === 'onshore') {
        whereClause.regimeTrabalho = { not: { contains: 'OFFSHORE' } };
      }
    }

    // Filtro de projetos
    if (projetos) {
      const projetoIds = projetos.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (projetoIds.length > 0) {
        whereClause.projetoId = { in: projetoIds };
      }
    }

    // Filtro de status
    if (status) {
      const statusIds = status.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (statusIds.length > 0) {
        whereClause.statusId = { in: statusIds };
      }
    }

    // Filtro de status da folha
    if (statusFolha) {
      const statusFolhaValues = statusFolha.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (statusFolhaValues.length > 0) {
        whereClause.statusFolha = { in: statusFolhaValues };
      }
    }

    // Buscar dados filtrados
    const dados = await prisma.periodoSheet.findMany({
      where: whereClause,
      include: {
        status: true,
        projeto: true
      },
      orderBy: [
        { anoReferencia: 'desc' },
        { mesReferencia: 'desc' },
        { nome: 'asc' }
      ]
    });

    // Preparar dados para Excel
    const dadosExcel = dados.map(item => ({
      'Nome': item.nome,
      'Matrícula': item.matricula,
      'Função': item.funcao,
      'Embarcação': item.embarcacao,
      'Status Funcionário': item.status?.categoria || '',
      'Status Folha': item.statusFolha || '',
      'Código': item.codigo || '',
      'Observações': item.observacoes || '',
      'Embarcação Atual': item.embarcacaoAtual || '',
      'SISPAT': item.sispat,
      'Regime de Trabalho': item.regimeTrabalho,
      'Total Dias Período': item.totalDiasPeriodo || '',
      'Projeto': item.projeto?.nome || '',
      'Centro de Custo': item.centroCusto || '',
      'Mês Referência': item.mesReferencia,
      'Ano Referência': item.anoReferencia
    }));

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, // Nome
      { wch: 15 }, // Matrícula
      { wch: 25 }, // Função
      { wch: 20 }, // Embarcação
      { wch: 20 }, // Status Funcionário
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
      { wch: 10 }  // Ano Referência
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados Filtrados');

    // Gerar buffer do Excel
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Criar nome do arquivo
    const agora = new Date();
    const timestamp = agora.toISOString().slice(0, 19).replace(/[:-]/g, '');
    const nomeArquivo = `periodo_filtrado_${timestamp}.xlsx`;

    // Retornar arquivo
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Content-Length': excelBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Erro ao exportar dados filtrados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}