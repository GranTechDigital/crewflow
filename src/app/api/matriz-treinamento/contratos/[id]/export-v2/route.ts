import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/utils/authUtils';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const contratoId = parseInt(id);

    if (isNaN(contratoId)) {
      return NextResponse.json(
        { success: false, error: 'ID do contrato inválido' },
        { status: 400 }
      );
    }

    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { id: true, nome: true, numero: true, cliente: true }
    });

    if (!contrato) {
      return NextResponse.json(
        { success: false, error: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    const funcoesDoContrato = await prisma.funcao.findMany({
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
          }
        }
      },
      orderBy: { funcao: 'asc' }
    });

    // NOVO: buscar todas as funções ativas para o dropdown da planilha (não apenas as já na matriz)
    const todasFuncoes = await prisma.funcao.findMany({
      where: { ativo: true },
      select: { id: true, funcao: true, regime: true },
      orderBy: { funcao: 'asc' }
    });

    const treinamentos = await prisma.treinamentos.findMany({
      select: { id: true, treinamento: true, cargaHoraria: true, validadeValor: true, validadeUnidade: true },
      orderBy: { treinamento: 'asc' }
    });
    const treinamentosOrdenadosPorId = [...treinamentos].sort((a, b) => a.id - b.id);
    // Apenas treinamentos vinculados ao contrato para as colunas iniciais
    const treinamentoIdsContrato = Array.from(
      new Set(
        funcoesDoContrato.flatMap((f) => f.matrizTreinamento.map((m) => m.treinamento?.id).filter(Boolean))
      )
    ) as number[];
    const treinamentosDoContrato = treinamentos.filter((t) => treinamentoIdsContrato.includes(t.id));

    const tiposObrigatoriedade = ['RA', 'AP', 'C', 'SD', 'N/A'];

    // Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CrewFlow';
    workbook.created = new Date();
    workbook.calcProperties = { fullCalcOnLoad: true } as any;
    
    // Worksheet: Matriz V2
    const ws = workbook.addWorksheet('Matriz V2');

    // Construção dinâmica de colunas: 3 base + 1 por treinamento (inicialmente apenas os do contrato)
    const trainingCols = treinamentosDoContrato.map((t) => ({
      header: t.treinamento,
      key: `T_${t.id}`,
      width: Math.max(16, (t.treinamento || '').length + 4)
    }));
    // Capacidade alvo de colunas de treinamento: 50
    const TARGET_TRAINING_CAPACITY = 50;
    const EXTRA_TRAINING_COLUMNS = Math.max(TARGET_TRAINING_CAPACITY - treinamentosDoContrato.length, 0);
    const extraTrainingCols = Array.from({ length: EXTRA_TRAINING_COLUMNS }, (_, idx) => ({
      header: '',
      key: `T_extra_${idx + 1}`,
      width: 18,
    }));
    const totalTrainingCols = trainingCols.length + extraTrainingCols.length;
 
    ws.columns = [
      { header: 'Funcao (ID - Nome - Regime)', key: 'FuncaoLabel', width: 42 },
      { header: 'Treinamento >', key: 'TreinamentosHeader', width: 18 },
      ...trainingCols,
      ...extraTrainingCols,
    ];

    // Linhas 1 a 3: valores acima do cabeçalho de treinamento
    // Inserir TRÊS linhas acima do cabeçalho para que os nomes dos treinamentos fiquem na linha 4
    ws.spliceRows(1, 0, [], [], []);
    // Deixa a coluna A vazia nas linhas 1, 2 e 3
    ws.getCell(1, 1).value = '';
    ws.getCell(2, 1).value = '';
    ws.getCell(3, 1).value = '';
    // Mesclar A1:A3 para área do logo e aplicar fundo branco
    ws.mergeCells('A1:A3');
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    ws.getCell(3, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    ws.getRow(1).height = 24;
    ws.getRow(2).height = 24;
    ws.getRow(3).height = 24;
    // Tentar carregar o logo a partir de candidatos conhecidos
    let logoBuffer: Buffer | null = null;
    const logoCandidates = [
      path.resolve(process.cwd(), 'graservices-logo.png'),
      path.resolve(process.cwd(), 'public', 'graservices-360x63-1.png'),
    ];
    for (const p of logoCandidates) {
      if (fs.existsSync(p)) {
        logoBuffer = fs.readFileSync(p);
        break;
      }
    }
    if (logoBuffer) {
      const imageId = workbook.addImage({ base64: logoBuffer.toString('base64'), extension: 'png' });
      // Dimensões do logo fixas: 7,80 cm (largura) x 1,60 cm (altura)
      const CM_TO_PX = 96 / 2.54; // conversão cm -> px
      const imgWidthPx = Math.round(7.80 * CM_TO_PX);
      const imgHeightPx = Math.round(1.60 * CM_TO_PX);
      
      // Área da mescla A1:A3 em pixels (aproximação)
      const colAWidthChars = ws.getColumn(1).width || 52; // largura em caracteres
      const areaWidthPx = Math.round(colAWidthChars * 7); // ~7 px por caractere
      const r1h = ws.getRow(1).height || 24; // pontos
      const r2h = ws.getRow(2).height || 24;
      const r3h = ws.getRow(3).height || 24;
      const areaHeightPx = Math.round((r1h + r2h + r3h) * (96 / 72)); // pontos -> pixels
      
      // Centralização e ajuste fino horizontal
      const offsetX = Math.max(0, Math.round((areaWidthPx - imgWidthPx) / 2));
      const offsetY = Math.max(0, Math.round((areaHeightPx - imgHeightPx) / 2));
      const tlCol = offsetX / areaWidthPx; // 0..1 dentro da coluna A
      const tlRow = (offsetY / areaHeightPx) * 3; // 0..3 ao longo das linhas 1-3
      
      // Mantém deslocamento adicional à direita conforme solicitações anteriores
      const adjustX = 0.20;
      const adjTlCol = Math.min(0.98, tlCol + adjustX);
      
      ws.addImage(imageId, {
        tl: { col: adjTlCol, row: tlRow },
        ext: { width: imgWidthPx, height: imgHeightPx },
      });
    }
    // Coluna A mais larga para acomodar o logo e os textos de função
    ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 42, 52);
    // Coluna B mais larga para acomodar rótulos (ID, Carga Horária, Vigência)
    ws.getColumn(2).width = Math.max(ws.getColumn(2).width || 18, 24);
    // Coluna B como rótulo das linhas superiores
    ws.getCell(1, 2).value = 'ID >';
    ws.getCell(2, 2).value = 'Carga Horária >';
    ws.getCell(3, 2).value = 'Vigência >';
    [1,2,3].forEach(r => {
      ws.getCell(r, 2).alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
      ws.getCell(r, 2).font = { bold: true, color: { argb: 'FF000000' } };
      ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    });
    
    // Valores (ID, carga e vigência) por treinamento nas linhas 1, 2 e 3, SEM rótulos
    const treinosLastRowNum = 1 + treinamentosDoContrato.length; // header + dados (apenas iniciais)
    for (let i = 0; i < totalTrainingCols; i++) {
      const col = 3 + i;
      const headerAddr = ws.getCell(4, col).address; // cabeçalho agora está na linha 4
      const colLetter = headerAddr.replace(/\d/g, '');
      // Linha 1: ID extraído do cabeçalho "ID - Nome" (como NÚMERO)
      ws.getCell(1, col).value = { formula: `IFERROR(VALUE(TRIM(LEFT(${colLetter}4,FIND(" - ",${colLetter}4)-1))),"")` };
      ws.getCell(1, col).numFmt = '0';
      ws.getCell(1, col).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      // Linha 2: carga horária via ID (PROCV com VALUE para garantir tipo numérico)
      ws.getCell(2, col).value = { formula: `IFERROR(VLOOKUP(VALUE(${colLetter}1),Treinamentos!$A:$C,3,FALSE),"")` };
      ws.getCell(2, col).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      // Linha 3: vigência (valor + unidade) via ID (PROCV com VALUE) — agora E & F
      ws.getCell(3, col).value = { formula: `IFERROR(VLOOKUP(VALUE(${colLetter}1),Treinamentos!$A:$E,5,FALSE),"")&" "&IFERROR(VLOOKUP(VALUE(${colLetter}1),Treinamentos!$A:$F,6,FALSE),"")` };
      ws.getCell(3, col).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    }
    
    // Linha 4: Cabeçalho normal
    const headerRow = ws.getRow(4);
    headerRow.font = { bold: true, color: { argb: 'FF1F4E78' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;
    // Destacar especificamente B4 em preto negrito
    ws.getCell(4, 2).font = { bold: true, color: { argb: 'FF000000' } };
    // Aplicar mesma cor e alinhamento de B3
    ws.getCell(4, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
    ws.getCell(4, 2).alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
    // Cores de grupo
    const setHeaderFill = (row: number, col: number, argb: string) => {
      ws.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    };
    // Grupo Função: coluna 1 no cabeçalho (linha 4)
    [1].forEach((c) => setHeaderFill(4, c, 'FFFFE5E5'));
    // Texto em negrito e alinhamento central preservado pelo headerRow
    ws.getCell(4, 1).font = { bold: true };
    // Grupo Treinamentos: colunas C..AZ no cabeçalho (linha 4) com cinza mais escuro e texto branco
    for (let c = 3; c < 3 + totalTrainingCols; c++) {
      setHeaderFill(4, c, 'FF9E9E9E');
      ws.getCell(4, c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }
    // Linhas 1, 2 e 3 (valores) com cinza claro nas colunas C→AZ
    for (let c = 3; c < 3 + totalTrainingCols; c++) {
      setHeaderFill(1, c, 'FFEFEFEF');
      setHeaderFill(2, c, 'FFEFEFEF');
      setHeaderFill(3, c, 'FFEFEFEF');
    }

    // Dados
    // Map para acesso rápido de obrigatoriedade por (funcaoId, treinamentoId)
    const obrigMap = new Map<string, string>();
    for (const f of funcoesDoContrato) {
      for (const m of f.matrizTreinamento) {
        const key = `${f.id}_${m.treinamento?.id}`;
        if (key) obrigMap.set(key, m.tipoObrigatoriedade || '');
      }
    }

    // Adiciona linhas
    for (const f of funcoesDoContrato) {
      const base = { FuncaoLabel: `${f.id} - ${f.funcao || 'N/A'} - ${(f.regime ?? '') || 'N/A'}` } as Record<string, any>;
      for (const t of treinamentosDoContrato) {
        const key = `T_${t.id}`;
        const obrig = obrigMap.get(`${f.id}_${t.id}`) || 'N/A';
        base[key] = obrig;
      }
      ws.addRow(base);
    }

    // Linhas extras para novos lançamentos
    const TARGET_TOTAL_ROWS = 300;
    const rowsToAdd = Math.max(0, TARGET_TOTAL_ROWS - ws.rowCount);
    for (let i = 0; i < rowsToAdd; i++) ws.addRow({});

    // Congelar cabeçalho quádruplo e colunas de função
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }];

    // Destaque visual das colunas editáveis (treinamentos) e informativas (função)
    const setDataFillForColumn = (col: number, argb: string) => {
      for (let r = 5; r <= ws.rowCount; r++) { // dados começam na linha 5
        ws.getCell(r, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      }
    };
    // Regime (derivada): usar branco na coluna 2
    [2].forEach((c) => setDataFillForColumn(c, 'FFFFFFFF'));
    // Editáveis em cinza claro
    setDataFillForColumn(1, 'FFF7F7F7');
    for (let c = 3; c < 3 + totalTrainingCols; c++) setDataFillForColumn(c, 'FFF7F7F7');

    // Bordas finas
    const setThinBorders = (col: number) => {
      for (let r = 1; r <= ws.rowCount; r++) {
        ws.getCell(r, col).border = {
          top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        };
      }
    };
    for (let c = 1; c < 3 + totalTrainingCols; c++) setThinBorders(c);

    // Validação de dados nas colunas de treinamentos
    // Criar/Popular abas auxiliares visíveis e protegidas
    const wsTreinamentos = workbook.addWorksheet('Treinamentos');
    wsTreinamentos.addTable({
      name: 'tblTreinamentos',
      ref: 'A1',
      headerRow: true,
      columns: [
        { name: 'TreinamentoID' },
        { name: 'Treinamento' },
        { name: 'CargaHoraria' },
        { name: 'Label' },
        { name: 'ValidadeValor' },
        { name: 'ValidadeUnidade' },
      ],
      rows: treinamentosOrdenadosPorId.map((t) => [t.id, t.treinamento, t.cargaHoraria ?? '', `${t.id} - ${t.treinamento}`, t.validadeValor ?? '', t.validadeUnidade ?? '']),
      style: { theme: 'TableStyleMedium2', showRowStripes: true, showColumnStripes: false }
    });
    // Preenchimento apenas nas células do cabeçalho da tabela (A1:F1)
    for (let c = 1; c <= 6; c++) {
      wsTreinamentos.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E0EC' } };
    }
    wsTreinamentos.getRow(1).font = { bold: true };
    // Largura de colunas conforme conteúdo (evitar wsTreinamentos.columns para prevenir corrupção)
    wsTreinamentos.getColumn(1).width = 14;
    wsTreinamentos.getColumn(2).width = 42;
    wsTreinamentos.getColumn(3).width = 16;
    wsTreinamentos.getColumn(4).width = 22;
    wsTreinamentos.getColumn(5).width = 16;
    wsTreinamentos.getColumn(6).width = 18;
    wsTreinamentos.views = [{ state: 'frozen', ySplit: 1 }];
    wsTreinamentos.protect();
    wsTreinamentos.state = 'visible';

    // Reverter: remover aba SelecaoCabecalhos e usar lista direta da aba Treinamentos
    const lastTreinosRow = wsTreinamentos.rowCount;
    for (let i = 0; i < treinamentosDoContrato.length; i++) {
      const col = 3 + i;
      const headerCell = ws.getCell(4, col);
      headerCell.value = `${treinamentosDoContrato[i].id} - ${treinamentosDoContrato[i].treinamento}`;
      headerCell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`=Treinamentos!$D$2:$D$${lastTreinosRow}`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valor inválido',
        error: 'Selecione um treinamento válido.'
      };
      headerCell.protection = { locked: false };
    }
    // Cabeçalhos extras (vazios inicialmente) com dropdown livre (permite duplicados)
    for (let i = 0; i < EXTRA_TRAINING_COLUMNS; i++) {
      const col = 3 + treinamentosDoContrato.length + i;
      const headerCell = ws.getCell(4, col);
      headerCell.value = '';
      headerCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=Treinamentos!$D$2:$D$${lastTreinosRow}`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valor inválido',
        error: 'Selecione um treinamento válido.'
      };
      headerCell.protection = { locked: false };
    }
 
    const wsFuncoes = workbook.addWorksheet('Funcoes');
  wsFuncoes.addTable({
    name: 'tblFuncoes',
    ref: 'A1',
    headerRow: true,
    columns: [ { name: 'FuncaoID' }, { name: 'Funcao' }, { name: 'Regime' }, { name: 'Label' } ],
    rows: todasFuncoes.map((f) => {
      const regimeLabel = (f.regime ?? '') || 'N/A';
      const funcaoLabel = f.funcao || 'N/A';
      return [f.id, funcaoLabel, regimeLabel, `${f.id} - ${funcaoLabel} - ${regimeLabel}`];
    }),
    style: { theme: 'TableStyleMedium9', showRowStripes: true, showColumnStripes: false }
  });
  // Cabeçalho: preencher apenas A1:D1 e aplicar negrito
  for (let c = 1; c <= 4; c++) {
    wsFuncoes.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
  }
  wsFuncoes.getRow(1).font = { bold: true };
  // Larguras das colunas conforme conteúdo
  wsFuncoes.getColumn(1).width = 12;  // FuncaoID
  wsFuncoes.getColumn(2).width = 40;  // Funcao
  wsFuncoes.getColumn(3).width = 18;  // Regime
  wsFuncoes.getColumn(4).width = 42;  // Label
  wsFuncoes.views = [{ state: 'frozen', ySplit: 1 }];
  wsFuncoes.protect();
  wsFuncoes.state = 'visible';

    const wsTipos = workbook.addWorksheet('TiposObrigatoriedade');
  wsTipos.addTable({
    name: 'tblTiposObrigatoriedade',
    ref: 'A1',
    headerRow: true,
    columns: [{ name: 'TipoObrigatoriedade' }],
    rows: tiposObrigatoriedade.map((v) => [v]),
    style: { theme: 'TableStyleLight9', showRowStripes: true, showColumnStripes: false }
  });
  // Cabeçalho: preencher apenas A1 e aplicar negrito
  wsTipos.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  wsTipos.getRow(1).font = { bold: true };
  // Largura da coluna
  wsTipos.getColumn(1).width = 24;
  wsTipos.views = [{ state: 'frozen', ySplit: 1 }];
  wsTipos.protect();
  wsTipos.state = 'visible';

    // Validações
    const lastTiposRow = wsTipos.rowCount;
    const lastFuncoesRow = wsFuncoes.rowCount;
    const matrizDataStartRow = 5; // após linhas de valores (1-3) e cabeçalho (4)
    const matrizDataEndRow = ws.rowCount;
    const existingRowsEnd = 4 + funcoesDoContrato.length; // até aqui são funções já existentes
    for (let r = matrizDataStartRow; r <= matrizDataEndRow; r++) {
      // Validação de Função (ID - Nome - Regime) via lista da aba Funcoes (Label)
      ws.getCell(r, 1).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=Funcoes!$D$2:$D$${lastFuncoesRow}`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valor inválido',
        error: 'Selecione uma função válida.'
      };
      // Coluna 2 é apenas cabeçalho de grupo; deixa vazia e bloqueada
      ws.getCell(r, 2).value = '';
      ws.getCell(r, 2).protection = { locked: true };
  
      for (let c = 3; c < 3 + totalTrainingCols; c++) {
        ws.getCell(r, c).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`=TiposObrigatoriedade!$A$2:$A$${lastTiposRow}`],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Valor inválido',
          error: 'Selecione um tipo válido.'
        };
        ws.getCell(r, c).protection = { locked: false };
  
        // Preenchimento automático com 'N/A':
        // aplica para todas as linhas de funções (existentes e novas),
        // apenas quando a célula está vazia e há função selecionada.
        const cell = ws.getCell(r, c);
        const colLetter = ws.getCell(4, c).address.replace(/\d/g, '');
        if (!cell.value || (typeof cell.value === 'string' && cell.value === '')) {
          cell.value = { formula: `IF($A${r}<>"",IF($${colLetter}$4<>"","N/A",""),"")` };
        }
      }
      ws.getCell(r, 1).protection = { locked: false };
    }

    // Destaque visual para obrigatoriedade 'AP' (inicial). Observação: alterações manuais não atualizam cor sem formatação condicional.
    for (let r = matrizDataStartRow; r <= matrizDataEndRow; r++) {
      for (let c = 3; c < 3 + totalTrainingCols; c++) {
        const val = ws.getCell(r, c).value;
        if (typeof val === 'string' && val.trim().toUpperCase() === 'AP') {
          ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7E1CD' } };
        }
      }
    }

    // Mesclar faixa B5:B300 e aplicar fundo branco
    ws.mergeCells('B5:B300');
    const b5 = ws.getCell('B5');
    b5.value = '';
    b5.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    b5.protection = { locked: true };

    // Proteger planilha mantendo edição nas células desbloqueadas
    ws.protect(undefined, { selectLockedCells: true, selectUnlockedCells: true });

    // Resumo do Contrato
    const resumo = workbook.addWorksheet('Resumo');
    resumo.columns = [
      { header: 'Campo', key: 'Campo', width: 24 },
      { header: 'Valor', key: 'Valor', width: 40 },
    ];
    resumo.addRows([
      { Campo: 'Contrato Número', Valor: contrato.numero },
      { Campo: 'Contrato Nome', Valor: contrato.nome },
      { Campo: 'Cliente', Valor: contrato.cliente },
    ]);
    resumo.getRow(1).font = { bold: true };
    resumo.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    resumo.getCell(1, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    resumo.views = [{ state: 'frozen', ySplit: 1 }];
    resumo.protect();

    // Legenda
    const legenda = workbook.addWorksheet('Legenda');
    legenda.columns = [
      { header: 'Campo', key: 'Campo', width: 22 },
      { header: 'Tipo', key: 'Tipo', width: 14 },
      { header: 'Descrição', key: 'Descricao', width: 60 },
    ];
    legenda.addRows([
      { Campo: 'Funcao (ID - Nome - Regime)', Tipo: 'Editável', Descricao: 'Selecione a função usando o rótulo "ID - Nome - Regime" na coluna em verde.' },
      { Campo: 'Treinamentos', Tipo: 'Cabeçalho', Descricao: 'Coluna de cabeçalho do grupo de treinamentos. As colunas à direita representam cada treinamento.' },
      { Campo: 'Cabeçalho Treinamento', Tipo: 'Editável', Descricao: 'No cabeçalho de cada coluna de treinamento, selecione o item "ID - Nome" (dropdown). A carga horária e a vigência são atualizadas automaticamente na linha acima.' },
      { Campo: 'Treinamentos (colunas)', Tipo: 'Editável', Descricao: 'Selecione o tipo de obrigatoriedade por função x treinamento (lista). A carga horária e a vigência aparecem na linha acima do cabeçalho.' },
      { Campo: 'Abas auxiliares', Tipo: 'Somente leitura', Descricao: 'Treinamentos, Funcoes e TiposObrigatoriedade estão visíveis para consulta e protegidas contra edição.' },
      { Campo: 'Linhas em branco', Tipo: 'Editável', Descricao: 'Use as linhas vazias depois dos dados para adicionar novas relações conforme necessário.' },
    ]);
    legenda.views = [{ state: 'frozen', ySplit: 1 }];

    // Buffer e resposta
    const buf = await workbook.xlsx.writeBuffer();
    const filename = `matriz-treinamento_${contrato.numero}_v2.xlsx`;
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
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