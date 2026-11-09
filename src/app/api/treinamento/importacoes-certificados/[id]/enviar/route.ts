import { NextRequest, NextResponse } from "next/server";
import { enviarCertificadosPendentesDrake, recuperarEnvioCertificados, reanalisarReferenciaCertificados } from "@/lib/integracoes/certificadosDrakeImportacao";
import { authorizeCertificados, certificadoFailure, readCertificadoBody } from "@/lib/integracoes/certificadosDrakeApi";
import { CERTIFICADO_MAX_ROWS, CertificadoError, CertificadoProgresso, publicCertificadoBatch } from "@/lib/integracoes/certificadosDrakeShared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeCertificados(request, true);
    const importacaoId = Number((await params).id);
    if (!Number.isSafeInteger(importacaoId) || importacaoId <= 0) throw new CertificadoError("Importação inválida.");
    let body: { action?: string; limit?: number; confirmar?: boolean; itemIds?: number[]; todosPendentes?: boolean; totalEsperado?: number };
    try { body = JSON.parse((await readCertificadoBody(request, 4096)).toString("utf8")); }
    catch (error) { if (error instanceof CertificadoError) throw error; throw new CertificadoError("Dados inválidos."); }
    if (!body || typeof body !== "object") throw new CertificadoError("Dados inválidos.");
    const actor = { importacaoId, usuarioId: user.id, usuarioNome: user.funcionario.nome };
    if (body.action === "reference") {
      const result = await reanalisarReferenciaCertificados(importacaoId);
      return NextResponse.json({ ...result, importacao: publicCertificadoBatch(result.importacao) });
    }
    if (body.action === "recover") return NextResponse.json({ importacao: publicCertificadoBatch(await recuperarEnvioCertificados(actor)) });
    if (body.action && body.action !== "send") throw new CertificadoError("Operação inválida.");
    if (body.confirmar !== true) throw new CertificadoError("Confirme o envio dos certificados ao Drake.");
    if (body.todosPendentes !== undefined && typeof body.todosPendentes !== "boolean") throw new CertificadoError("Opção de processamento inválida.");
    const todosPendentes = body.todosPendentes === true, totalEsperado = body.totalEsperado;
    if (todosPendentes && (body.itemIds !== undefined || body.limit !== undefined || typeof totalEsperado !== "number" || !Number.isSafeInteger(totalEsperado) || totalEsperado < 1 || totalEsperado > CERTIFICADO_MAX_ROWS)) throw new CertificadoError("Confirme a quantidade de certificados aptos do arquivo, sem seleção individual.");
    const limit = body.limit === undefined ? 5 : body.limit;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new CertificadoError("Informe de 1 a 50 certificados por envio.");
    const itemIds = body.itemIds;
    if (itemIds !== undefined && (!Array.isArray(itemIds) || itemIds.length < 1 || itemIds.length > 50 || itemIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(itemIds).size !== itemIds.length)) throw new CertificadoError("Selecione de 1 a 50 certificados distintos.");
    if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
      const result = await enviarCertificadosPendentesDrake({ ...actor, limit, itemIds, todosPendentes, totalEsperado });
      return NextResponse.json({ ...result, importacao: publicCertificadoBatch(result.importacao) });
    }
    const encoder = new TextEncoder(); let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        function emit(event: unknown) { if (!closed) { try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { closed = true; } } }
        const heartbeat = setInterval(() => emit({ tipo: "heartbeat" }), 10000);
        try {
          const result = await enviarCertificadosPendentesDrake({ ...actor, limit, itemIds, todosPendentes, totalEsperado, onProgress: (progresso: CertificadoProgresso) => emit({ tipo: "progresso", progresso }) });
          emit({ tipo: "concluido", resultado: { ...result, importacao: publicCertificadoBatch(result.importacao) } });
        } catch (error) {
          if (!(error instanceof CertificadoError)) console.error("[certificados] Falha durante envio", error);
          emit({ tipo: "erro", error: error instanceof CertificadoError ? error.message : "Falha no envio. Consulte o histórico antes de tentar novamente." });
        } finally { clearInterval(heartbeat); if (!closed) { closed = true; controller.close(); } }
      },
      cancel() { closed = true; },
    });
    return new NextResponse(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "private, no-store", "X-Accel-Buffering": "no" } });
  } catch (error) { return certificadoFailure(error); }
}
