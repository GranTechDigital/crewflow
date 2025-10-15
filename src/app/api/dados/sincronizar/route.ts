import { NextResponse } from "next/server";
import { POST as funcionariosSyncPOST } from "@/app/api/funcionarios/sincronizar/route";

// Proxy para a rota unificada de sincronização de funcionários
export async function POST(_request: Request) {
  try {
    const response = await funcionariosSyncPOST();
    return response;
  } catch (error) {
    console.error("Erro no proxy de sincronização de dados:", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar dados via proxy." },
      { status: 500 }
    );
  }
}
