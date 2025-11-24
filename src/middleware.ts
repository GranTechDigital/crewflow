import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicRoutes = ["/login", "/unauthorized", "/api/auth/login", "/dashboard-teste", "/dashboard-data", "/dashboard-sla", "/dashboard-downtime", "/dashboard", "/dashboard-gantt", "/gantt", "/gantt-timeline", "/gantt-dia"];
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
    // Se for a página de login, não redirecionar automaticamente para "/"
    // para evitar loops com tokens antigos. Apenas direcionar
    // para etapas obrigatórias se o token exigir.
    if (pathname === "/login") {
      const token = request.cookies.get("auth-token")?.value;
      if (token) {
        try {
          const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || "fallback-secret"
          );
          const { payload } = await jwtVerify(token, secret);
          const mustAddEmail = (payload as any).mustAddEmail === true;
          const mustChangePassword = (payload as any).mustChangePassword === true;
          if (mustAddEmail) {
            return NextResponse.redirect(new URL("/conta/adicionar-email", request.url));
          }
          if (mustChangePassword) {
            return NextResponse.redirect(new URL("/conta/trocar-senha", request.url));
          }
        } catch (error) {
          // Token inválido: permitir acesso à página de login
        }
      }
    }

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

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret"
    );
    const { payload } = await jwtVerify(token, secret);

    const mustAddEmail = (payload as any).mustAddEmail === true;
    const mustChangePassword = (payload as any).mustChangePassword === true;

    const isOnAddEmail = pathname.startsWith("/conta/adicionar-email") || pathname.startsWith("/api/account/email");
    const isOnChangePassword = pathname.startsWith("/conta/trocar-senha") || pathname.startsWith("/api/account/password");

    const isApi = pathname.startsWith("/api/");

    if (mustAddEmail) {
      if (!isApi && !isOnAddEmail) {
        return NextResponse.redirect(new URL("/conta/adicionar-email", request.url));
      }
      return NextResponse.next();
    }

    if (mustChangePassword) {
      if (!isApi && !isOnChangePassword) {
        return NextResponse.redirect(new URL("/conta/trocar-senha", request.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch (error) {
    // Token inválido
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Token de autenticação inválido" },
        { status: 401 }
      );
    }

    // Redirecionar para login e limpar cookie inválido
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }
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
