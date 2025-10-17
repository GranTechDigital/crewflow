import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const publicRoutes = ['/login', '/unauthorized', '/api/auth/login']
const publicApiRoutes = ['/api/auth/login', '/api/auth/register', '/api/periodo/upload', '/api/periodo/dashboard-projetos-simples', '/api/dados/sincronizar-funcoes', '/api/debug/db']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir acesso a arquivos estáticos
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next()
  }

  // Verificar se é uma rota pública
  if (publicRoutes.includes(pathname)) {
    // Se for a página de login, verificar se o usuário já está logado
    if (pathname === '/login') {
      const token = request.cookies.get('auth-token')?.value
      
      if (token) {
        try {
          // Verificar se o token é válido
          const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
          await jwtVerify(token, secret)
          
          // Se o token é válido, redirecionar para a página principal
          return NextResponse.redirect(new URL('/', request.url))
        } catch (error) {
          // Token inválido, permitir acesso à página de login
          return NextResponse.next()
        }
      }
    }
    
    return NextResponse.next()
  }

  // Verificar se é uma API pública
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Obter token do cookie
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    // Se for uma rota de API, retornar 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      )
    }
    
    // Se for uma rota da web, redirecionar para login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Verificar se o token é válido usando jose
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
    const { payload } = await jwtVerify(token, secret)
    
    // Renovação de sessão (sliding session) se estiver próximo de expirar
    const nowSec = Math.floor(Date.now() / 1000)
    const expSec = payload.exp ? Number(payload.exp) : undefined
    const renewThreshold = parseInt(process.env.JWT_RENEW_THRESHOLD_SECONDS || String(3 * 24 * 60 * 60), 10)

    if (expSec && expSec > nowSec && (expSec - nowSec) <= renewThreshold) {
      const remember = Boolean((payload as any).remember)
      const expiration = remember
        ? (process.env.JWT_EXPIRATION_REMEMBER || '30d')
        : (process.env.JWT_EXPIRATION || '14d')
      const cookieMaxAge = remember
        ? parseInt(process.env.JWT_COOKIE_MAX_AGE_REMEMBER || String(30 * 24 * 60 * 60), 10)
        : parseInt(process.env.JWT_COOKIE_MAX_AGE || String(14 * 24 * 60 * 60), 10)

      const newToken = await new SignJWT({
        id: (payload as any).id,
        userId: (payload as any).userId,
        funcionarioId: (payload as any).funcionarioId,
        matricula: (payload as any).matricula,
        nome: (payload as any).nome,
        equipe: (payload as any).equipe,
        equipeId: (payload as any).equipeId,
        remember
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(expiration)
        .sign(secret)

      const response = NextResponse.next()
      response.cookies.set('auth-token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: cookieMaxAge
      })
      return response
    }

    return NextResponse.next()
  } catch (error) {
    // Token inválido
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Token de autenticação inválido' },
        { status: 401 }
      )
    }
    
    // Redirecionar para login e limpar cookie inválido
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth-token')
    return response
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}