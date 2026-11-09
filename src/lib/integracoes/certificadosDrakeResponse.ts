import { DrakeResponse } from "./drakeClient";
/** Só resultados explicitamente observados/contratados encerram uma tentativa. */
export function certificadoResponseOutcome(response:DrakeResponse<unknown>) {
  const data=response.data;
  const value=data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:null;
  const type=typeof(value?.type??value?.Type)==="string"?String(value?.type??value?.Type).toLowerCase():"";
  const accepted=response.status===200&&["inserted","updated","alreadyuptodate"].includes(type);
  const rejected=response.status===200&&type==="error";
  return {accepted,status:accepted?"ENVIADO":rejected?"ERRO_DRAKE":"NAO_CONFIRMADO",error:accepted?null:rejected?"Drake retornou erro de negócio. Consulte o retorno registrado antes de corrigir e enviar novamente.":"Resposta sem aceite explícito de sincronização. Confira o Drake; não repita automaticamente."} as const;
}
