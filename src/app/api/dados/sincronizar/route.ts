import { NextRequest, NextResponse } from "next/server";

// Proxy para a rota unificada de sincronização de funcionários
export async function POST(req: NextRequest) {
  try {
    const targetUrl = new URL("/api/funcionarios/sincronizar", req.nextUrl.origin).toString();
    const body = await req.text();
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": req.headers.get("content-type") || "application/json",
        authorization: req.headers.get("authorization") || "",
      },
      body,
      cache: "no-store",
    });

    const responseText = await res.text();
    const headers = new Headers(res.headers);
    return new NextResponse(responseText, { status: res.status, headers });
  } catch (error) {
    console.error("Erro no proxy de sincronização de dados:", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar dados via proxy." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";