// Carga de referência local HMG. Não contém cliente HTTP nem envio ao Drake.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { readReference, PARSER_VERSION } = require('./lib/drake-document-reference.cjs');
const repository = require('./lib/drake-document-reference-db.cjs');

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (['--execute', '--retry'].includes(key)) result[key.slice(2)] = true;
    else if (['--file', '--env-file', '--ambiente', '--source-time-zone', '--recover-load', '--generated-at'].includes(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) result[key.slice(2)] = argv[++i];
    else throw Error('Argumento inválido: ' + key);
  }
  return result;
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function main() {
  const options = args(process.argv.slice(2));
  const environment=require('./lib/certificate-environment.cjs').normalizeCertificateEnvironment(options.ambiente);
  if(!environment)throw Error('Informe --ambiente hmg ou prd.');
  const timeZone = options['source-time-zone'];
  if (timeZone !== 'America/Sao_Paulo') throw Error('Informe --source-time-zone America/Sao_Paulo para esta fonte.');
  if (options['env-file']) process.loadEnvFile(path.resolve(options['env-file']));
  if (options['recover-load'] && !options.execute) throw Error('Recuperação exige --execute.');
  let db, load, summary = {};
  try {
    if (options.execute) {
      const url = new URL(process.env.DATABASE_URL || '');
      if (!(environment==='prd'?['postgres-prod','127.0.0.1','localhost']:['postgres-dev','127.0.0.1','localhost']).includes(url.hostname) || decodeURIComponent(url.pathname) !== '/projetogran' || (url.port && url.port !== '5432')) throw Error('Execução restrita ao banco local projetogran na porta 5432.');
      if (require('./lib/certificate-environment.cjs').normalizeCertificateEnvironment(process.env.DRAKE_ENVIRONMENT)!==environment) throw Error('Configuração Drake deve identificar HMG.');
      const tenantId = process.env.DRAKE_TENANT_ID;
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenantId || '')) throw Error('Tenant HMG inválido.');
      if(url.hostname==='postgres-dev')url.hostname='127.0.0.1';
      const { PrismaClient } = require('@prisma/client');
      db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
      if (options['recover-load']) { await repository.recoverLoad(db, options['recover-load']); console.log(JSON.stringify({ recuperada: options['recover-load'] })); return; }
    }
    if (!options.file) throw Error('Informe --file com a planilha XLSX.');
    const file = path.resolve(options.file), stat = await fsp.stat(file);
    if (!stat.isFile() || !['.xlsx','.csv'].includes(path.extname(file).toLowerCase()) || stat.size > 100 * 1024 * 1024) throw Error('Use arquivo XLSX de até 100 MB.');
    const hash = await hashFile(file);
    let generatedAt;
    if(options['generated-at']){if(!/(Z|[+-]\d{2}:\d{2})$/.test(options['generated-at']))throw Error('Data de geracao exige fuso.');generatedAt=new Date(options['generated-at']);if(!Number.isFinite(+generatedAt)||Date.now()-generatedAt>48*3600000||generatedAt>Date.now()+300000)throw Error('Data de geracao invalida ou antiga.');}
    if(db&&environment==='prd'&&!generatedAt)throw Error('Carga inicial de producao exige --generated-at com data real do relatorio.');
    let input = file;
    if (db) {
      const archive = path.resolve(__dirname, '../backups/drake-documentos', hash + path.extname(file).toLowerCase());
      await fsp.mkdir(path.dirname(archive), { recursive: true });
      try { await fsp.copyFile(file, archive, fs.constants.COPYFILE_EXCL); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      if (await hashFile(archive) !== hash) throw Error('Cópia privada não confere com o arquivo de origem.');
      input = archive;
      load = await repository.beginLoad(db, { environment, tenantId: process.env.DRAKE_TENANT_ID, hash,
        parserVersion: PARSER_VERSION, filename: path.basename(file), archive, timeZone, retry: options.retry });
      if (load.skipped) { console.log(JSON.stringify({ cargaId: load.id, resultado: 'ARQUIVO_JA_APLICADO', novos: 0, atualizados: 0 })); return; }
    }
    console.log(JSON.stringify({ modo: db ? 'CARGA_LOCAL_HMG' : 'VALIDACAO_SEM_BANCO', arquivo: path.basename(file), bytes: stat.size, sha256: hash }));
    summary = await readReference(input, { timeZone, onBatch: db ? rows => repository.stageBatch(db, load, rows) : undefined,
      onProgress: progress => console.log(JSON.stringify({ progresso: progress })) });
    if (summary.invalid) throw Error(`${summary.invalid} linhas inválidas; a base não foi alterada.`);
    const result = db ? await repository.applyLoad(db, load, summary, {confirmSends:true,generatedAt}) : summary;
    const report = path.resolve(__dirname, '../tmp/drake-document-reference', `${load?.id || hash}.json`);
    await fsp.mkdir(path.dirname(report), { recursive: true });
    await fsp.writeFile(report, JSON.stringify({ cargaId: load?.id, hash, ambiente:environment, result }, null, 2));
    console.log(JSON.stringify({ concluido: true, cargaId: load?.id, resultado: result, relatorio: report }));
  } catch (error) {
    if (db && load && !load.skipped) await repository.failLoad(db, load, summary, error.message).catch(() => {});
    console.error(JSON.stringify({ erro: error.message, resumo: summary })); process.exitCode = 1;
  } finally { await db?.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
