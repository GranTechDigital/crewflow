import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = [
  "/login",
  "/unauthorized",
  "/api/auth/login",
  "/dashboard-teste",
  "/dashboard-data",
  "/dashboard-sla",
  "/dashboard-downtime",
  "/dashboard",
  "/dashboard-gantt",
  "/gantt",
  "/gantt-timeline",
  "/gantt-dia",
];
const publicApiRoutes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/periodo/upload",
  "/api/periodo/dashboard-projetos-simples",
  "/api/dados/sincronizar-funcoes",
  "/api/debug/db",
  "/api/tarefas/dedup",
  "/api/sla/overview",
  "/api/sla/monthly",
  "/api/downtime/overview",
  "/api/downtime/all",
  "/api/downtime/gantt",
  "/api/downtime/gantt/all",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir acesso a arquivos estáticos
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  // Verificar se é uma rota pública
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verificar se é uma API pública
  if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Permitir sincronização via token de serviço (worker)
  const serviceToken = process.env.FUNCIONARIOS_SYNC_SERVICE_TOKEN;
  const authHeader = request.headers.get("authorization") || "";
  if (
    pathname.startsWith("/api/funcionarios/sincronizar") &&
    serviceToken &&
    authHeader === `Bearer ${serviceToken}`
  ) {
    return NextResponse.next();
  }

  // Permitir manutenção (deduplicação de tarefas) via token de serviço
  const manutencaoToken = process.env.MANTENCAO_SERVICE_TOKEN;
  if (
    pathname.startsWith("/api/tarefas/dedup") &&
    manutencaoToken &&
    authHeader === `Bearer ${manutencaoToken}`
  ) {
    return NextResponse.next();
  }
  // Permitir sincronização manual de tarefas (logística) via token de manutenção
  if (
    pathname.startsWith("/api/logistica/tarefas/sync") &&
    manutencaoToken &&
    authHeader === `Bearer ${manutencaoToken}`
  ) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/api/logistica/tarefas/sync/undo") &&
    manutencaoToken &&
    authHeader === `Bearer ${manutencaoToken}`
  ) {
    return NextResponse.next();
  }

  // Permitir envio automático do relatório geral via token de serviço
  const relatorioEmailToken = process.env.RELATORIO_EMAIL_SERVICE_TOKEN;
  const relatorioServiceRoutes = [
    "/api/relatorios/geral/enviar-email",
    "/api/relatorios/geral/email",
    "/api/relatorios/geral/snapshots",
  ];
  if (
    relatorioServiceRoutes.some((route) => pathname.startsWith(route)) &&
    relatorioEmailToken &&
    authHeader === `Bearer ${relatorioEmailToken}`
  ) {
    return NextResponse.next();
  }

  // Obter token do cookie
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    // Se for uma rota de API, retornar 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Token de autenticação necessário" },
        { status: 401 }
      );
    }

    // Se for uma rota da web, redirecionar para login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
