import { NextRequest } from "next/server";
import { PUT as concluirLotePut } from "@/app/api/logistica/tarefas/concluir-lote/route";

export async function PUT(request: NextRequest) {
  return concluirLotePut(request);
}

