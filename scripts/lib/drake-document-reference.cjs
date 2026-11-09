const { createHash } = require('node:crypto');
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const {Transform}=require('node:stream');

const PARSER_VERSION = '1';
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
const HEADERS = {
  id: 'ID DO DOCUMENTO', emission: 'DATA DE EMISSAO DO DOCUMENTO', expiration: 'DATA DE VALIDADE DO DOCUMENTO',
  qualification: 'NOME DA QUALIFICACAO', acronym: 'SIGLA DA QUALIFICACAO', type: 'TIPO DE DOCUMENTO',
  registration: 'MATRICULA DO TRABALHADOR', name: 'NOME DO TRABALHADOR', created: 'DATA DE CRIACAO DO DOCUMENTO',
  updated: 'ULTIMA ALTERACAO DO DOCUMENTO', online: 'DOCUMENTO E TREINAMENTO ONLINE',
};
const REQUIRED = ['id', 'emission', 'qualification', 'type', 'registration', 'updated'];

function scalar(value) {
  if (value && typeof value === 'object' && !(value instanceof Date)) throw Error('Fórmula ou valor composto não permitido.');
  return value;
}
function dateParts(value) {
  value = scalar(value);
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value >= 2958466) throw Error('Data Excel inválida.');
    value = new Date(Math.round((value - 25569) * 86400000));
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw Error('Data inválida.');
    return value.toISOString().replace(/Z$/, '');
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|[+-]\d{2}:\d{2})?)?$/);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!iso && !br) throw Error('Formato de data não reconhecido.');
  const [year, month, day, hour, minute, second] = iso ? iso.slice(1, 7).map(x => Number(x || 0)) : [br[3], br[2], br[1], br[4] || 0, br[5] || 0, br[6] || 0].map(Number);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 1900 || year > 9999 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) throw Error('Data impossível.');
  if (iso) return text;
  return check.toISOString().replace(/Z$/, '');
}
function instant(value, timeZone) {
  const text = dateParts(value);
  if (!text) return null;
  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return new Date(text).toISOString();
  const wall = text.includes('T') ? text : text + 'T00:00:00';
  const target = new Date(wall + 'Z');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let candidate = target.getTime();
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(x => [x.type, x.value]));
    const displayed = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second), target.getUTCMilliseconds());
    const adjustment = target.getTime() - displayed;
    if (!adjustment) return new Date(candidate).toISOString();
    candidate += adjustment;
  }
  throw Error('Horário local inexistente ou ambíguo para o fuso informado.');
}
function civil(value) { const text = dateParts(value); return text ? text.slice(0, 10) : null; }
function parseDocument(values, columns, timeZone) {
  const get = key => scalar(values[columns[key]]);
  const documentId = String(get('id') ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(documentId)) throw Error('ID do documento inválido.');
  const registrationValue = get('registration');
  if (typeof registrationValue === 'number' && !Number.isSafeInteger(registrationValue)) throw Error('Matrícula numérica não segura.');
  const registration = normalize(registrationValue), qualification = String(get('qualification') ?? '').trim(), type = String(get('type') ?? '').trim();
  if (!registration || !qualification || !type) throw Error('Matrícula, qualificação e tipo são obrigatórios.');
  if (registration.length > 100 || qualification.length > 500 || type.length > 200) throw Error('Campo de identificação excede o tamanho permitido.');
  const emission = civil(get('emission')), expiration = String(get('expiration')??'').trim()==='-' ? null : civil(get('expiration'));
  const updatedAtSource = instant(get('updated'), timeZone), createdAtSource = instant(get('created'), timeZone);
  if (!emission || !updatedAtSource) throw Error('Emissão e última alteração são obrigatórias.');
  if (expiration && expiration < emission) throw Error('Validade anterior à emissão.');
  const onlineRaw = normalize(get('online'));
  if (onlineRaw && !['SIM', 'NAO', 'TRUE', 'FALSE', '1', '0'].includes(onlineRaw)) throw Error('Modalidade online inválida.');
  const data = { documentId, registration, name: String(get('name') ?? '').trim() || null, qualification,
    qualificationNormalized: normalize(qualification), acronym: String(get('acronym') ?? '').trim() || null,
    type, typeNormalized: normalize(type), emission, expiration, createdAtSource, updatedAtSource,
    online: onlineRaw ? ['SIM', 'TRUE', '1'].includes(onlineRaw) : null };
  return { ...data, hash: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}

async function readRows(file, { timeZone, onBatch = async () => {}, onProgress = () => {}, batchSize = 500, allowEmpty = false } = {}) {
  if (!timeZone) throw Error('Informe explicitamente o fuso das datas da fonte.');
  new Intl.DateTimeFormat('en', { timeZone });
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', styles: 'cache', hyperlinks: 'ignore', worksheets: 'emit' });
  const summary = { rows: 0, valid: 0, invalid: 0, errors: [], sheets: [], parserVersion: PARSER_VERSION };
  let batch = [], selected = false;
  for await (const sheet of reader) {
    let columns = null;
    summary.sheets.push(sheet.name);
    for await (const row of sheet) {
      if (!columns) {
        if (row.number > 20) throw Error('Cabeçalho não encontrado nas primeiras 20 linhas.');
        const values = row.values.map(x => normalize(x));
        if (!values.includes(HEADERS.id)) continue;
        if (selected) throw Error('Mais de uma aba de documentos: selecione um arquivo sem ambiguidade.');
        columns = Object.fromEntries(Object.entries(HEADERS).map(([key, label]) => [key, values.indexOf(label)]));
        for (const key of REQUIRED) if (columns[key] < 1) throw Error('Coluna obrigatória ausente: ' + HEADERS[key]);
        for (const label of Object.values(HEADERS)) if (values.filter(x => x === label).length > 1) throw Error('Cabeçalho repetido: ' + label);
        selected = true; continue;
      }
      if (!row.values.some(v => v !== undefined && v !== null && v !== '')) continue;
      summary.rows++;
      try {
        const data = parseDocument(row.values, columns, timeZone);
        batch.push({ row: row.number, ...data }); summary.valid++;
      } catch (error) {
        summary.invalid++;
        if (summary.errors.length < 30) summary.errors.push({ row: row.number, error: error.message });
      }
      if (batch.length >= batchSize) { await onBatch(batch); batch = []; }
      if (summary.rows % 10000 === 0) await onProgress({ rows: summary.rows, valid: summary.valid, invalid: summary.invalid, rssMB: Math.round(process.memoryUsage().rss / 1048576) });
    }
  }
  if (batch.length) await onBatch(batch);
  if (!selected || (!summary.rows&&!allowEmpty)) throw Error('Planilha sem documentos.');
  return summary;
}
async function readCsv(file,{timeZone,onBatch=async()=>{},onProgress=()=>{},batchSize=500,allowEmpty=false}={}) {
 if(!timeZone)throw Error('Informe explicitamente o fuso das datas da fonte.');
 const {csvRecords}=require('./drake-document-csv.cjs');let columns=null,batch=[],number=0;const summary={rows:0,valid:0,invalid:0,errors:[],sheets:['CSV'],parserVersion:PARSER_VERSION};
 for await(const record of csvRecords(file)) {number++;const values=[undefined,...record];if(!columns){if(number>20)throw Error('Cabeçalho CSV não encontrado.');const normalized=values.map(normalize);if(!normalized.includes(HEADERS.id))continue;columns=Object.fromEntries(Object.entries(HEADERS).map(([key,label])=>[key,normalized.indexOf(label)]));for(const key of REQUIRED)if(columns[key]<1)throw Error('Coluna obrigatória ausente: '+HEADERS[key]);for(const label of Object.values(HEADERS))if(normalized.filter(x=>x===label).length>1)throw Error('Cabeçalho repetido: '+label);continue;}
  if(record.every(value=>!value.trim()))continue;summary.rows++;try{batch.push({row:number,...parseDocument(values,columns,timeZone)});summary.valid++;}catch(error){summary.invalid++;if(summary.errors.length<30)summary.errors.push({row:number,error:error.message});}
  if(batch.length>=batchSize){await onBatch(batch);batch=[];}if(summary.rows%10000===0)await onProgress({rows:summary.rows,valid:summary.valid,invalid:summary.invalid});
 }
 if(batch.length)await onBatch(batch);if(!columns||(!summary.rows&&!allowEmpty))throw Error('CSV sem documentos.');return summary;
}
async function readReference(file, options) {
  if(path.extname(file).toLowerCase()==='.csv')return readCsv(file,options);
  // A exportação .NET do Drake usa descritores ZIP que o parser sequencial não lê.
  // Abrir pelo diretório central e reempacotar em fluxo preserva os XMLs originais.
  // São as dependências ZIP já instaladas pelo ExcelJS; não há nova instalação.
  const dependencies = { paths: [path.dirname(require.resolve('exceljs/package.json'))] };
  const unzipper = require(require.resolve('unzipper', dependencies));
  const archiver = require(require.resolve('archiver', dependencies));
  const entries = await unzipper.Open.file(file);
  if (entries.files.length > 1000 || entries.files.reduce((n, e) => n + e.uncompressedSize, 0) > 512 * 1024 * 1024) throw Error('Estrutura XLSX excede o limite de leitura.');
  for (const entry of entries.files) if (entry.path.startsWith('/') || entry.path.split(/[\\/]/).includes('..') || entry.flags & 1) throw Error('Entrada ZIP não permitida.');
  const first = ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/sharedStrings.xml'];
  const rank = name => { const i = first.indexOf(name); return i < 0 ? first.length : i; };
  entries.files.sort((a, b) => rank(a.path) - rank(b.path));
  const root = path.resolve(__dirname, '../../tmp/drake-document-reference');
  await fsp.mkdir(root, { recursive: true });
  const temporary = await fsp.mkdtemp(path.join(root, 'zip-'));
  const normalized = path.join(temporary, 'normalized.xlsx');
  try {
    const archive = archiver('zip', { store: true });
    const output = pipeline(archive, fs.createWriteStream(normalized, { flags: 'wx', mode: 0o600 }));
    // Attach the rejection handler before starting entry streams.
    output.catch(() => {});
    let expandedBytes=0;
    for (const entry of entries.files) {
      if (entry.type === 'File') {
        const input = entry.stream();
        input.on('error', error => archive.destroy(error));
        const limit=new Transform({transform(chunk,_encoding,callback){expandedBytes+=chunk.length;callback(expandedBytes>512*1024*1024?Error('Conteúdo XLSX expandido excede 512 MB.'):null,chunk);}});
        limit.on('error',error=>{input.destroy();archive.destroy(error);});
        archive.append(input.pipe(limit), { name: entry.path });
      }
    }
    await archive.finalize(); await output;
    return await readRows(normalized, options);
  } finally {
    await fsp.unlink(normalized).catch(() => {});
    await fsp.rmdir(temporary).catch(() => {});
  }
}
module.exports = { PARSER_VERSION, normalize, parseDocument, readReference, instant, civil };
