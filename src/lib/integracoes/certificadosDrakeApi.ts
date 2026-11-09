import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUtils";
import { canManageDrakeCertificates } from "./certificadosDrakeAccess";
import { CertificadoError } from "./certificadosDrakeShared";

export async function authorizeCertificados(request: NextRequest, mutation = false) {
  const user = await getUserFromRequest(request);
  if (!user) throw new CertificadoError("Usuário não autenticado", 401);
  if (!user.equipe.ativo || !canManageDrakeCertificates(user.equipe.nome)) throw new CertificadoError("Acesso permitido à Administração e ao Treinamento (Editor ou Gestor).", 403);
  if (mutation) {
    const origin = request.headers.get("origin"); let same = true;
    try { if (origin) same = new URL(origin).host === request.headers.get("host"); } catch { same = false; }
    if (!same || request.headers.get("sec-fetch-site") === "cross-site") throw new CertificadoError("Origem da requisição não permitida.", 403);
  }
  return user;
}

export async function readCertificadoBody(request: NextRequest, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new CertificadoError("Requisição muito grande.", 413);
  const reader = request.body?.getReader(); if (!reader) throw new CertificadoError("Requisição vazia.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > limit) { await reader.cancel(); throw new CertificadoError("Requisição muito grande.", 413); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

export function certificadoFailure(error: unknown) {
  if (error instanceof CertificadoError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  console.error("[certificados] Falha na operação", error);
  return NextResponse.json({ error: "Não foi possível concluir a operação de certificados. Consulte o resultado antes de tentar novamente." }, { status: 500 });
}

export function certificadoXlsx(bytes: ArrayBuffer | Uint8Array, filename: string) {
  return new NextResponse(new Uint8Array(bytes), { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"` } });
}
