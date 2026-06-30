import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";
import { normalizeReportEmail } from "@/lib/relatorios/relatorio-destinatarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 }) };
  }

  if (user.equipe?.nome !== "Administração") {
    return { error: NextResponse.json({ success: false, message: "Acesso restrito à Administração." }, { status: 403 }) };
  }

  return { user };
}

function parseId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = parseId(params);
  if (!id) {
    return NextResponse.json({ success: false, message: "ID inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {
    updatedBy: auth.user.funcionario?.nome || auth.user.funcionario?.matricula || null,
  };

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, message: "Nome é obrigatório." }, { status: 400 });
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = normalizeReportEmail(String(body.email || ""));
    if (!isValidEmail(email)) return NextResponse.json({ success: false, message: "E-mail inválido." }, { status: 400 });
    data.email = email;
  }

  for (const key of ["active", "receivesScheduledEmail", "canRequestByEmail"]) {
    if (body[key] !== undefined) data[key] = body[key] === true;
  }

  if (body.frequency !== undefined) data.frequency = String(body.frequency || "weekly");

  try {
    const recipient = await prisma.relatorioDestinatario.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, recipient });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Este e-mail já está cadastrado para o relatório." }, { status: 409 });
    }
    if (error?.code === "P2025") {
      return NextResponse.json({ success: false, message: "Destinatário não encontrado." }, { status: 404 });
    }

    console.error("Erro ao atualizar destinatário de relatório:", error);
    return NextResponse.json({ success: false, message: "Erro ao atualizar destinatário." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const id = parseId(params);
  if (!id) {
    return NextResponse.json({ success: false, message: "ID inválido." }, { status: 400 });
  }

  try {
    await prisma.relatorioDestinatario.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ success: false, message: "Destinatário não encontrado." }, { status: 404 });
    }

    console.error("Erro ao remover destinatário de relatório:", error);
    return NextResponse.json({ success: false, message: "Erro ao remover destinatário." }, { status: 500 });
  }
}
