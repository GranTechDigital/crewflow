import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// API de diagnóstico para confirmar a conexão do banco em desenvolvimento
export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        db: string;
        user: string;
        version: string;
        server_addr: string | null;
        server_port: number | null;
      }>
    >(
      `SELECT current_database() AS db,
              current_user AS user,
              version() AS version,
              inet_server_addr() AS server_addr,
              inet_server_port() AS server_port`
    );

    const info = rows && rows.length > 0 ? rows[0] : null;
    return NextResponse.json({ ok: true, info, envDatabaseUrl: process.env.DATABASE_URL || null });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}