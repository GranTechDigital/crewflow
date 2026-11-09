import { CertificadoDb } from "./certificadosDrakeDb";
import { CertificadoError } from "./certificadosDrakeShared";
/** Chamado sob a trava do ambiente, inclusive antes de reservar envio/exclusão/recriação. */
export async function assertNoDestructiveOperation(db:CertificadoDb,importacaoId:number) {
  const [row]=await db.$queryRaw<{active:boolean}[]>`SELECT EXISTS(
    SELECT 1 FROM "DrakeDocumentoExclusao" d JOIN "ImportacaoCertificadoDrakeItem" i ON i.id=d."itemId"
    WHERE i."importacaoId"=${importacaoId} AND (d.status='EM_EXECUCAO' OR EXISTS(SELECT 1 FROM "DrakeDocumentoRestauracao" r WHERE r."exclusaoId"=d.id AND r.status='EM_EXECUCAO'))
  ) AS active`;
  if(row?.active)throw new CertificadoError("Há uma exclusão ou recriação em andamento neste carregamento. Aguarde o retorno antes de alterar, enviar ou substituir.",409);
}
