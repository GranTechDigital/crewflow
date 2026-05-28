import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';
import ExcelJS from 'exceljs';

const OBRIGATORIEDADE_OPTIONS = ['RA', 'AP', 'C', 'SD', 'N/A'];
const TARGET_TOTAL_ROWS = 300;
const TARGET_TRAINING_CAPACITY = 50;

type FuncaoExport = {
  id: number;
  funcao: string | null;
  regime: string | null;
  matrizTreinamento: Array<{
    tipoObrigatoriedade: string | null;
    treinamento: { id: number } | null;
  }>;
};

type TreinamentoExport = {
  id: number;
  treinamento: string | null;
  cargaHoraria: number | null;
  validadeValor: number | null;
  validadeUnidade: string | null;
};

function filenameSafe(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_');
}

function columnLetter(worksheet: ExcelJS.Worksheet, row: number, col: number) {
  return worksheet.getCell(row, col).address.replace(/\d/g, '');
}

function funcaoLabel(funcao: { id: number; funcao: string | null; regime: string | null }) {
  return `${funcao.id} - ${funcao.funcao || 'N/A'} - ${funcao.regime || 'N/A'}`;
}

function treinamentoLabel(treinamento: { id: number; treinamento: string | null }) {
  return `${treinamento.id} - ${treinamento.treinamento || 'N/A'}`;
}

function styleHeaderCell(cell: ExcelJS.Cell, fill: string, fontColor = 'FF000000') {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: fontColor } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function addValidation(cell: ExcelJS.Cell, formula: string, allowBlank: boolean, error: string) {
  cell.dataValidation = {
    type: 'list',
    allowBlank,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Valor inválido',
    error,
  };
}

function addAuxiliarySheets(
  workbook: ExcelJS.Workbook,
  treinamentos: TreinamentoExport[],
  funcoes: Array<{ id: number; funcao: string | null; regime: string | null }>
) {
  const wsTreinamentos = workbook.addWorksheet('Treinamentos');
  wsTreinamentos.columns = [
    { header: 'TreinamentoID', key: 'id', width: 16 },
    { header: 'Treinamento', key: 'treinamento', width: 48 },
    { header: 'CargaHoraria', key: 'cargaHoraria', width: 16 },
    { header: 'Label', key: 'label', width: 56 },
    { header: 'ValidadeValor', key: 'validadeValor', width: 16 },
    { header: 'ValidadeUnidade', key: 'validadeUnidade', width: 18 },
  ];
  wsTreinamentos.addRows(
    treinamentos.map((t) => ({
      id: t.id,
      treinamento: t.treinamento || '',
      cargaHoraria: t.cargaHoraria ?? '',
      label: treinamentoLabel(t),
      validadeValor: t.validadeValor ?? '',
      validadeUnidade: t.validadeUnidade ?? '',
    }))
  );
  for (let c = 1; c <= 6; c++) styleHeaderCell(wsTreinamentos.getCell(1, c), 'FFE5E0EC');
  wsTreinamentos.views = [{ state: 'frozen', ySplit: 1 }];

  const wsFuncoes = workbook.addWorksheet('Funcoes');
  wsFuncoes.columns = [
    { header: 'FuncaoID', key: 'id', width: 12 },
    { header: 'Funcao', key: 'funcao', width: 48 },
    { header: 'Regime', key: 'regime', width: 18 },
    { header: 'Label', key: 'label', width: 64 },
  ];
  wsFuncoes.addRows(
    funcoes.map((f) => ({
      id: f.id,
      funcao: f.funcao || 'N/A',
      regime: f.regime || 'N/A',
      label: funcaoLabel(f),
    }))
  );
  for (let c = 1; c <= 4; c++) styleHeaderCell(wsFuncoes.getCell(1, c), 'FFFCE4D6');
  wsFuncoes.views = [{ state: 'frozen', ySplit: 1 }];

  const wsTipos = workbook.addWorksheet('TiposObrigatoriedade');
  wsTipos.columns = [{ header: 'TipoObrigatoriedade', key: 'tipo', width: 24 }];
  wsTipos.addRows(OBRIGATORIEDADE_OPTIONS.map((tipo) => ({ tipo })));
  styleHeaderCell(wsTipos.getCell(1, 1), 'FFFFF2CC');
  wsTipos.views = [{ state: 'frozen', ySplit: 1 }];

  return {
    lastTreinamentosRow: Math.max(wsTreinamentos.rowCount, 2),
    lastFuncoesRow: Math.max(wsFuncoes.rowCount, 2),
    lastTiposRow: Math.max(wsTipos.rowCount, 2),
  };
}

function addSummarySheets(workbook: ExcelJS.Workbook, contrato: { numero: string; nome: string; cliente: string }) {
  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Campo', key: 'campo', width: 24 },
    { header: 'Valor', key: 'valor', width: 50 },
  ];
  resumo.addRows([
    { campo: 'Contrato Número', valor: contrato.numero },
    { campo: 'Contrato Nome', valor: contrato.nome },
    { campo: 'Cliente', valor: contrato.cliente },
  ]);
  styleHeaderCell(resumo.getCell(1, 1), 'FFDDEBF7');
  styleHeaderCell(resumo.getCell(1, 2), 'FFDDEBF7');

  const legenda = workbook.addWorksheet('Legenda');
  legenda.columns = [
    { header: 'Campo', key: 'campo', width: 30 },
    { header: 'Descrição', key: 'descricao', width: 90 },
  ];
  legenda.addRows([
    {
      campo: 'Funcao',
      descricao: 'Use a coluna A no formato "ID - Nome - Regime".',
    },
    {
      campo: 'Treinamentos',
      descricao: 'Use a linha 4, a partir da coluna C, no formato "ID - Nome".',
    },
    {
      campo: 'Obrigatoriedade',
      descricao: 'Valores aceitos: RA, AP, C, SD e N/A.',
    },
  ]);
  styleHeaderCell(legenda.getCell(1, 1), 'FFD9EAD3');
  styleHeaderCell(legenda.getCell(1, 2), 'FFD9EAD3');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const contratoId = Number.parseInt(id, 10);
    if (!Number.isFinite(contratoId)) {
      return NextResponse.json(
        { success: false, error: 'ID do contrato inválido' },
        { status: 400 }
      );
    }

    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { id: true, nome: true, numero: true, cliente: true },
    });
    if (!contrato) {
      return NextResponse.json(
        { success: false, error: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    const [funcoesDoContrato, todasFuncoes, treinamentos] = await Promise.all([
      prisma.funcao.findMany({
        where: { ativo: true, matrizTreinamento: { some: { contratoId } } },
        select: {
          id: true,
          funcao: true,
          regime: true,
          matrizTreinamento: {
            where: { contratoId },
            select: {
              tipoObrigatoriedade: true,
              treinamento: { select: { id: true } },
            },
          },
        },
        orderBy: { funcao: 'asc' },
      }),
      prisma.funcao.findMany({
        where: { ativo: true },
        select: { id: true, funcao: true, regime: true },
        orderBy: { funcao: 'asc' },
      }),
      prisma.treinamentos.findMany({
        select: {
          id: true,
          treinamento: true,
          cargaHoraria: true,
          validadeValor: true,
          validadeUnidade: true,
        },
        orderBy: { treinamento: 'asc' },
      }),
    ]);

    const treinamentoIdsContrato = new Set<number>();
    for (const funcao of funcoesDoContrato as FuncaoExport[]) {
      for (const item of funcao.matrizTreinamento) {
        if (item.treinamento?.id) treinamentoIdsContrato.add(item.treinamento.id);
      }
    }

    const treinamentosOrdenadosPorId = [...(treinamentos as TreinamentoExport[])].sort((a, b) => a.id - b.id);
    const treinamentosDoContrato = (treinamentos as TreinamentoExport[]).filter((t) =>
      treinamentoIdsContrato.has(t.id)
    );
    const extraTrainingColumns = Math.max(TARGET_TRAINING_CAPACITY - treinamentosDoContrato.length, 0);
    const totalTrainingColumns = treinamentosDoContrato.length + extraTrainingColumns;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CrewFlow';
    workbook.created = new Date();
    workbook.calcProperties = { fullCalcOnLoad: true } as any;

    const ws = workbook.addWorksheet('Matriz V2');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }];
    ws.properties.defaultRowHeight = 18;
    ws.getColumn(1).width = 56;
    ws.getColumn(2).width = 24;
    for (let col = 3; col < 3 + totalTrainingColumns; col++) {
      ws.getColumn(col).width = 22;
    }

    ws.mergeCells('A1:A3');
    ws.getCell('A1').value = 'Matriz de Treinamento';
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };

    ws.getCell('B1').value = 'ID >';
    ws.getCell('B2').value = 'Carga Horária >';
    ws.getCell('B3').value = 'Vigência >';
    ws.getCell('A4').value = 'Funcao (ID - Nome - Regime)';
    ws.getCell('B4').value = 'Treinamento >';

    for (let row = 1; row <= 4; row++) {
      styleHeaderCell(ws.getCell(row, 2), 'FFFFE5E5');
      ws.getRow(row).height = row === 4 ? 24 : 22;
    }
    styleHeaderCell(ws.getCell(4, 1), 'FFFFE5E5');

    for (let i = 0; i < totalTrainingColumns; i++) {
      const col = 3 + i;
      const treinamento = treinamentosDoContrato[i];
      const headerCell = ws.getCell(4, col);
      headerCell.value = treinamento ? treinamentoLabel(treinamento) : '';
      styleHeaderCell(headerCell, 'FF9E9E9E', 'FFFFFFFF');
      headerCell.protection = { locked: false };

      const colName = columnLetter(ws, 4, col);
      ws.getCell(1, col).value = { formula: `IFERROR(VALUE(TRIM(LEFT(${colName}4,FIND(" - ",${colName}4)-1))),"")` };
      ws.getCell(1, col).numFmt = '0';
      ws.getCell(2, col).value = { formula: `IFERROR(VLOOKUP(VALUE(${colName}1),Treinamentos!$A:$C,3,FALSE),"")` };
      ws.getCell(3, col).value = {
        formula: `IFERROR(VLOOKUP(VALUE(${colName}1),Treinamentos!$A:$E,5,FALSE),"")&" "&IFERROR(VLOOKUP(VALUE(${colName}1),Treinamentos!$A:$F,6,FALSE),"")`,
      };

      for (let row = 1; row <= 3; row++) {
        ws.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        ws.getCell(row, col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    }

    const obrigatoriedadePorFuncaoTreino = new Map<string, string>();
    for (const funcao of funcoesDoContrato as FuncaoExport[]) {
      for (const item of funcao.matrizTreinamento) {
        if (!item.treinamento?.id) continue;
        obrigatoriedadePorFuncaoTreino.set(
          `${funcao.id}_${item.treinamento.id}`,
          item.tipoObrigatoriedade || 'N/A'
        );
      }
    }

    let currentRow = 5;
    for (const funcao of funcoesDoContrato as FuncaoExport[]) {
      ws.getCell(currentRow, 1).value = funcaoLabel(funcao);
      ws.getCell(currentRow, 1).protection = { locked: false };
      ws.getCell(currentRow, 2).value = '';

      for (let i = 0; i < totalTrainingColumns; i++) {
        const col = 3 + i;
        const treinamento = treinamentosDoContrato[i];
        const value = treinamento
          ? obrigatoriedadePorFuncaoTreino.get(`${funcao.id}_${treinamento.id}`) || 'N/A'
          : '';
        ws.getCell(currentRow, col).value = value;
        ws.getCell(currentRow, col).protection = { locked: false };
      }
      currentRow += 1;
    }

    while (currentRow <= TARGET_TOTAL_ROWS) {
      ws.getCell(currentRow, 1).value = '';
      ws.getCell(currentRow, 1).protection = { locked: false };
      ws.getCell(currentRow, 2).value = '';
      for (let col = 3; col < 3 + totalTrainingColumns; col++) {
        const colName = columnLetter(ws, 4, col);
        ws.getCell(currentRow, col).value = {
          formula: `IF($A${currentRow}<>"",IF($${colName}$4<>"","N/A",""),"")`,
        };
        ws.getCell(currentRow, col).protection = { locked: false };
      }
      currentRow += 1;
    }

    const aux = addAuxiliarySheets(workbook, treinamentosOrdenadosPorId, todasFuncoes);
    const treinamentoListFormula = `=Treinamentos!$D$2:$D$${aux.lastTreinamentosRow}`;
    const funcaoListFormula = `=Funcoes!$D$2:$D$${aux.lastFuncoesRow}`;
    const tipoListFormula = `=TiposObrigatoriedade!$A$2:$A$${aux.lastTiposRow}`;

    for (let col = 3; col < 3 + totalTrainingColumns; col++) {
      addValidation(
        ws.getCell(4, col),
        treinamentoListFormula,
        col >= 3 + treinamentosDoContrato.length,
        'Selecione um treinamento válido.'
      );
    }

    for (let row = 5; row <= TARGET_TOTAL_ROWS; row++) {
      addValidation(ws.getCell(row, 1), funcaoListFormula, true, 'Selecione uma função válida.');
      ws.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
      ws.getCell(row, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

      for (let col = 3; col < 3 + totalTrainingColumns; col++) {
        addValidation(ws.getCell(row, col), tipoListFormula, true, 'Selecione um tipo válido.');
        ws.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
      }
    }

    for (let row = 1; row <= TARGET_TOTAL_ROWS; row++) {
      for (let col = 1; col < 3 + totalTrainingColumns; col++) {
        ws.getCell(row, col).border = {
          top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        };
      }
    }

    ws.mergeCells(`B5:B${TARGET_TOTAL_ROWS}`);
    ws.getCell('B5').value = '';
    ws.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

    addSummarySheets(workbook, contrato);

    const filename = filenameSafe(`matriz-treinamento_${contrato.numero}_v2.xlsx`);
    console.log('[matriz-export-v2]', {
      contratoId,
      funcoesDoContrato: funcoesDoContrato.length,
      todasFuncoes: todasFuncoes.length,
      treinamentos: treinamentos.length,
      treinamentosDoContrato: treinamentosDoContrato.length,
      totalTrainingColumns,
      elapsedMs: Date.now() - startedAt,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erro ao exportar matriz v2:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
