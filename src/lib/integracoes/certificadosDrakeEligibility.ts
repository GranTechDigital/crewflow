export type HistoryFact={status:string;validade:Date|null;recebimento:Date|null;importacaoId?:number};
const day=(date:Date|null)=>date?.toISOString().slice(0,10)??"";
export function certificadoHistoryDecision(rows:HistoryFact[],target:{validade:Date|null;recebimento:Date|null},sameBatchId?:number):{status:string;motivo:string}|null {
  const relevant=rows.filter(row=>["ENVIANDO","ENVIADO","CONFIRMADO","NAO_CONFIRMADO"].includes(row.status));
  if(relevant.some(row=>["ENVIANDO","NAO_CONFIRMADO"].includes(row.status)))return {status:"CONFLITO_ATUALIZACAO",motivo:"Há envio em andamento ou não confirmado para este certificado. Confira o Drake antes de reenviar."};
  if(relevant.some(row=>day(row.validade)!==day(target.validade)||day(row.recebimento)!==day(target.recebimento)))return {status:"CONFLITO_ATUALIZACAO",motivo:"Certificado já processado com validade/recebimento diferente. Confira o Drake."};
  if(relevant.length)return {status:"DUPLICADO_JA_PROCESSADO",motivo:"Certificado já processado anteriormente. Sem novo envio."};
  if(sameBatchId!==undefined&&rows.some(row=>row.importacaoId===sameBatchId&&!["CANCELADO","RESOLVIDO_OUTRO_ARQUIVO"].includes(row.status)))return {status:"DUPLICADO_NO_ARQUIVO",motivo:"Já existe outra linha com a mesma matrícula, tipo, qualificação e emissão neste arquivo."};
  return null;
}
