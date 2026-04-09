import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import {
  markPresenceOffline,
  upsertPresence,
  getPresenceSnapshot,
} from "@/lib/onlinePresenceStore";

type HeartbeatPayload = {
  status?: "online" | "offline";
  path?: string;
};

function extractToken(request: NextRequest) {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;
  const cookieToken = request.cookies.get("auth-token")?.value;
  return bearerToken || cookieToken;
}

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret",
    );
    const { payload } = await jwtVerify(token, secret);

    const usuarioId = Number((payload as any).userId ?? (payload as any).id);
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    let body: HeartbeatPayload = {};
    try {
      body = (await request.json()) as HeartbeatPayload;
    } catch {
      body = {};
    }

    if (body.status === "offline") {
      markPresenceOffline(usuarioId);
      return NextResponse.json({ success: true, online: false });
    }

    upsertPresence({
      usuarioId,
      nome: String((payload as any).nome || ""),
      matricula: String((payload as any).matricula || ""),
      equipe: String((payload as any).equipe || ""),
      sessionStart:
        typeof (payload as any).sessionStart === "string"
          ? (payload as any).sessionStart
          : undefined,
      currentPath: body.path || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const snapshot = getPresenceSnapshot(2 * 60 * 1000);
    return NextResponse.json({
      success: true,
      online: true,
      onlineCount: snapshot.onlineNow.length,
    });
  } catch (error) {
    console.error("Erro no heartbeat de presença:", error);
    return NextResponse.json(
      { error: "Erro ao registrar presença" },
      { status: 500 },
    );
  }
}

