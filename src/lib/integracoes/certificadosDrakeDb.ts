import { summarize } from "../../../scripts/lib/certificate-batch-summary.cjs";
import { Prisma, PrismaClient } from "@prisma/client";
export type CertificadoDb = PrismaClient | Prisma.TransactionClient;

/** Serializa apenas a reserva no banco; nenhuma chamada externa ocorre nesta transação. */
export async function lockCertificadoEnvironment(db: CertificadoDb, ambiente: string) {
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('crew-certificados'), hashtext(${ambiente}))::text AS locked`;
}

export async function resumirImportacaoCertificadosDrake(db: CertificadoDb, importacaoId: number) {
  const grupos = await db.importacaoCertificadoDrakeItem.groupBy({ by: ["status"], where: { importacaoId }, _count: { _all: true } });
  const batch = await db.importacaoCertificadoDrake.findUniqueOrThrow({ where: { id: importacaoId }, select: { envioToken: true, status: true } });
  return db.importacaoCertificadoDrake.update({ where: { id: importacaoId }, data: summarize(grupos,batch) });
}
