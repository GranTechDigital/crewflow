import { certificateEnvironment } from "./certificadosDrakeEnvironment";
import { assertNoDestructiveOperation } from "./certificadosDrakeOperations";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CertificadoDb, lockCertificadoEnvironment } from "./certificadosDrakeDb";
import { CertificadoError } from "./certificadosDrakeShared";

export async function certificadoVersionInfo(db: CertificadoDb, importacaoId: number) {
  const roots = await db.$queryRaw<{ id: number }[]>`WITH RECURSIVE pais(id) AS (
    SELECT ${importacaoId}::integer UNION ALL SELECT v."anteriorId" FROM "DrakeCertificadoVersao" v JOIN pais p ON v."novaId"=p.id
  ) SELECT id FROM pais ORDER BY id LIMIT 1`;
  const raizId = roots[0]?.id ?? importacaoId;
  const versoes = await db.$queryRaw<{ id:number; nomeArquivo:string; status:string; createdAt:Date; usuarioNome:string|null }[]>`WITH RECURSIVE familia(id) AS (
    SELECT ${raizId}::integer UNION ALL SELECT v."novaId" FROM "DrakeCertificadoVersao" v JOIN familia f ON v."anteriorId"=f.id
  ) SELECT b.id,b."nomeArquivo",b.status,b."createdAt",v."usuarioNome" FROM familia f JOIN "ImportacaoCertificadoDrake" b ON b.id=f.id LEFT JOIN "DrakeCertificadoVersao" v ON v."novaId"=b.id ORDER BY b.id`;
  const [comentario] = await db.$queryRaw<{texto:string;usuarioNome:string;atualizadoEm:Date}[]>`SELECT texto,"usuarioNome","atualizadoEm" FROM "DrakeCertificadoCarregamentoNota" WHERE "raizId"=${raizId}`;
  return { raizId, atualId: versoes.at(-1)?.id ?? importacaoId, versoes, comentario: comentario ?? null };
}

export async function assertCertificadoVersionEditable(db: CertificadoDb, importacaoId:number) {
  const batch = await db.importacaoCertificadoDrake.findUnique({where:{id:importacaoId}});
  if (!batch || batch.ambiente !== certificateEnvironment()) throw new CertificadoError("Carregamento não encontrado.",404);
  if (batch.envioToken) throw new CertificadoError("Aguarde o processamento em andamento.",409);
  if (batch.status === "SUBSTITUIDO") throw new CertificadoError("Este arquivo foi substituído. Abra a versão atual.",409);
  await assertNoDestructiveOperation(db,importacaoId);
  return batch;
}

export async function linkCertificadoVersion(db:CertificadoDb, anteriorId:number, novaId:number, usuarioId:number, usuarioNome:string) {
  await assertCertificadoVersionEditable(db,anteriorId);
  await db.$executeRaw`INSERT INTO "DrakeCertificadoVersao" (id,"anteriorId","novaId","usuarioId","usuarioNome") VALUES (${randomUUID()}::uuid,${anteriorId},${novaId},${usuarioId},${usuarioNome})`;
  await db.importacaoCertificadoDrake.update({where:{id:anteriorId},data:{status:"SUBSTITUIDO"}});
}

export async function salvarComentarioCarregamento({importacaoId,texto,atualizadoEm,usuarioId,usuarioNome,db=prisma}:{importacaoId:number;texto:unknown;atualizadoEm:unknown;usuarioId:number;usuarioNome:string;db?:PrismaClient}) {
  if(typeof texto!=="string"||!texto.trim()||texto.trim().length>200)throw new CertificadoError("Informe uma descrição de 1 a 200 caracteres.");
  if(atualizadoEm!==null&&(typeof atualizadoEm!=="string"||!Number.isFinite(Date.parse(atualizadoEm))))throw new CertificadoError("Versão da descrição inválida.");
  return db.$transaction(async tx=>{
    const batch=await tx.importacaoCertificadoDrake.findUnique({where:{id:importacaoId}});
    if(!batch||batch.ambiente!==certificateEnvironment())throw new CertificadoError("Carregamento não encontrado.",404);
    await lockCertificadoEnvironment(tx,batch.ambiente);
    await assertCertificadoVersionEditable(tx,importacaoId);
    const info=await certificadoVersionInfo(tx,importacaoId);
    const expected=atualizadoEm===null?null:new Date(atualizadoEm as string).getTime();
    if((info.comentario?.atualizadoEm.getTime()??null)!==expected)throw new CertificadoError("A descrição foi alterada por outra pessoa. Atualize antes de salvar.",409);
    await tx.$executeRaw`INSERT INTO "DrakeCertificadoCarregamentoNota" ("raizId",texto,"usuarioId","usuarioNome") VALUES (${info.raizId},${texto.trim()},${usuarioId},${usuarioNome}) ON CONFLICT ("raizId") DO UPDATE SET texto=EXCLUDED.texto,"usuarioId"=EXCLUDED."usuarioId","usuarioNome"=EXCLUDED."usuarioNome","atualizadoEm"=clock_timestamp()`;
    return certificadoVersionInfo(tx,importacaoId);
  });
}

export async function certificadoEdicoes(db:CertificadoDb,itemIds:number[]) {
  if(!itemIds.length)return [];
  return db.$queryRaw<{id:string;itemId:number;usuarioNome:string;anterior:Record<string,unknown>;novo:Record<string,unknown>;criadoEm:Date}[]>(Prisma.sql`SELECT id,"itemId","usuarioNome",anterior,novo,"criadoEm" FROM (SELECT *,row_number() OVER(PARTITION BY "itemId" ORDER BY "criadoEm" DESC,id DESC) AS ordem FROM "DrakeCertificadoItemEdicao" WHERE "itemId" IN (${Prisma.join(itemIds)})) historico WHERE ordem<=5`);
}


export async function certificadoDescricoes(db:CertificadoDb,ids:number[]) {
  if(!ids.length)return new Map<number,string>();
  const rows=await db.$queryRaw<{arquivoId:number;texto:string|null}[]>(Prisma.sql`WITH RECURSIVE pais("arquivoId",id) AS (
    SELECT id,id FROM "ImportacaoCertificadoDrake" WHERE id IN (${Prisma.join(ids)})
    UNION ALL SELECT p."arquivoId",v."anteriorId" FROM pais p JOIN "DrakeCertificadoVersao" v ON v."novaId"=p.id
  ) SELECT DISTINCT ON(p."arquivoId") p."arquivoId",n.texto FROM pais p LEFT JOIN "DrakeCertificadoCarregamentoNota" n ON n."raizId"=p.id ORDER BY p."arquivoId",p.id`);
  return new Map(rows.map(row=>[row.arquivoId,row.texto??""]));
}
