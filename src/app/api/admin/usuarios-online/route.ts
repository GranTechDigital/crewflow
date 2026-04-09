import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";
import { getPresenceSnapshot } from "@/lib/onlinePresenceStore";

const DEFAULT_ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdmin = currentUser.equipe?.nome === "Administração";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const onlineWindowMinutes = Number(searchParams.get("window") || "2");
    const onlineWindowMs = Number.isFinite(onlineWindowMinutes)
      ? Math.max(1, onlineWindowMinutes) * 60 * 1000
      : DEFAULT_ONLINE_WINDOW_MS;

    const snapshot = getPresenceSnapshot(onlineWindowMs);
    const onlineIds = snapshot.onlineNow.map((record) => record.usuarioId);

    const users =
      onlineIds.length > 0
        ? await prisma.usuario.findMany({
            where: { id: { in: onlineIds } },
            include: {
              funcionario: {
                select: {
                  nome: true,
                  matricula: true,
                  email: true,
                },
              },
              equipe: {
                select: {
                  nome: true,
                },
              },
            },
          })
        : [];

    const usersMap = new Map(users.map((user) => [user.id, user]));

    const onlineUsers = snapshot.onlineNow.map((presence) => {
      const dbUser = usersMap.get(presence.usuarioId);
      return {
        usuarioId: presence.usuarioId,
        nome: dbUser?.funcionario?.nome || presence.nome || "Usuário",
        matricula: dbUser?.funcionario?.matricula || presence.matricula || "-",
        email: dbUser?.funcionario?.email || null,
        equipe: dbUser?.equipe?.nome || presence.equipe || "-",
        ativo: dbUser?.ativo ?? true,
        ultimoLogin: dbUser?.ultimoLogin || null,
        sessionStart: presence.sessionStart || null,
        firstSeenAt: new Date(presence.firstSeenAt).toISOString(),
        lastSeenAt: new Date(presence.lastSeenAt).toISOString(),
        currentPath: presence.currentPath || null,
      };
    });

    const totalUsuariosAtivos = await prisma.usuario.count({
      where: { ativo: true },
    });

    return NextResponse.json({
      success: true,
      meta: {
        fetchedAt: new Date(snapshot.now).toISOString(),
        onlineWindowMinutes: Math.floor(onlineWindowMs / 60000),
        onlineCount: onlineUsers.length,
        trackedCount: snapshot.totalTracked,
        totalUsuariosAtivos,
      },
      onlineUsers,
    });
  } catch (error) {
    console.error("Erro ao listar usuários online:", error);
    return NextResponse.json(
      { error: "Erro ao buscar usuários online" },
      { status: 500 },
    );
  }
}

