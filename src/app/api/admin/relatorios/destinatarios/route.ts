import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/utils/authUtils";
import { GENERAL_PENDING_REPORT_KEY, normalizeReportEmail } from "@/lib/relatorios/relatorio-destinatarios";

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

function serializeRecipient(recipient: Awaited<ReturnType<typeof prisma.relatorioDestinatario.findMany>>[number]) {
  return {
    id: recipient.id,
    reportKey: recipient.reportKey,
    name: recipient.name,
    email: recipient.email,
    active: recipient.active,
    receivesScheduledEmail: recipient.receivesScheduledEmail,
    canRequestByEmail: recipient.canRequestByEmail,
    frequency: recipient.frequency,
    lastSentAt: recipient.lastSentAt,
    createdBy: recipient.createdBy,
    updatedBy: recipient.updatedBy,
    createdAt: recipient.createdAt,
    updatedAt: recipient.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const recipients = await prisma.relatorioDestinatario.findMany({
    where: { reportKey: GENERAL_PENDING_REPORT_KEY },
    orderBy: [{ active: "desc" }, { name: "asc" }, { email: "asc" }],
  });

  return NextResponse.json({
    success: true,
    recipients: recipients.map(serializeRecipient),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = normalizeReportEmail(String(body.email || ""));

  if (!name) {
    return NextResponse.json({ success: false, message: "Nome é obrigatório." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ success: false, message: "E-mail inválido." }, { status: 400 });
  }

  try {
    const recipient = await prisma.relatorioDestinatario.create({
      data: {
        reportKey: GENERAL_PENDING_REPORT_KEY,
        name,
        email,
        active: body.active !== false,
        receivesScheduledEmail: body.receivesScheduledEmail !== false,
        canRequestByEmail: body.canRequestByEmail === true,
        frequency: String(body.frequency || "weekly"),
        createdBy: auth.user.funcionario?.nome || auth.user.funcionario?.matricula || null,
        updatedBy: auth.user.funcionario?.nome || auth.user.funcionario?.matricula || null,
      },
    });

    return NextResponse.json({ success: true, recipient: serializeRecipient(recipient) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, message: "Este e-mail já está cadastrado para o relatório." }, { status: 409 });
    }

    console.error("Erro ao criar destinatário de relatório:", error);
    return NextResponse.json({ success: false, message: "Erro ao criar destinatário." }, { status: 500 });
  }
}
