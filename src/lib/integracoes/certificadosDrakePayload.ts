import { Prisma } from "@prisma/client";
import { CertificadoError } from "./certificadosDrakeShared";

/** Explicita as estratégias sem trocar seletores, valores ou modalidade do documento. */
export function explicitCertificatePayload(command: unknown, fallbackExternalId?: string): Prisma.InputJsonObject {
  if (!command || typeof command !== "object" || Array.isArray(command)) throw new CertificadoError("Comando de certificado inválido.");
  const source = command as Record<string, unknown>;
  if (!source.Payload || typeof source.Payload !== "object" || Array.isArray(source.Payload)) throw new CertificadoError("Payload de certificado inválido.");
  const payload = { ...source.Payload } as Record<string, unknown>;
  if (!source.Selector || typeof source.Selector !== "object" || Array.isArray(source.Selector)) throw new CertificadoError("Seletor de certificado inválido.");
  const selector = { ...source.Selector } as Record<string, unknown>;
  const externalId = selector.ExternalId ?? fallbackExternalId;
  if (typeof externalId !== "string" || !externalId.trim()) throw new CertificadoError("Certificado sem identificador externo.");
  selector.ExternalId = externalId;
  payload.ExternalId = { Value: externalId };
  if (payload.Attachments === undefined) payload.Attachments = { Value: [] };
  const references = new Set(["Worker", "Qualification", "DocumentType"]);
  for (const field of ["Worker", "Qualification", "DocumentType", "IssueDate", "ExpirationDate", "ReceiptDate", "OnlineTraining"]) {
    const value = payload[field];
    if (value === undefined) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CertificadoError(`Campo ${field} inválido no payload.`);
    payload[field] = { ...value, SyncStrategy: { OnInsert: "Replace", OnUpdate: "Replace" }, ...(references.has(field) ? { OnError: "Fail" } : {}) };
  }
  return { ...source, Selector: selector, Payload: payload } as Prisma.InputJsonObject;
}
