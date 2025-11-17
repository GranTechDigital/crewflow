import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicRoutes = ["/login", "/unauthorized", "/api/auth/login"];
const publicApiRoutes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/periodo/upload",
  "/api/periodo/dashboard-projetos-simples",
  "/api/dados/sincronizar-funcoes",
  "/api/debug/db",
  "/api/tarefas/dedup",
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
  if (publicRoutes.includes(pathname)) {
    // Se for a página de login, verificar se o usuário já está logado
    if (pathname === "/login") {
      const token = request.cookies.get("auth-token")?.value;

      if (token) {
        try {
          // Verificar se o token é válido
          const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || "fallback-secret"
          );
          await jwtVerify(token, secret);

          // Se o token é válido, redirecionar para a página principal
          return NextResponse.redirect(new URL("/", request.url));
        } catch (error) {
          // Token inválido, permitir acesso à página de login
          return NextResponse.next();
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
    // Verificar se o token é válido usando jose
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret"
    );
    await jwtVerify(token, secret);
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
