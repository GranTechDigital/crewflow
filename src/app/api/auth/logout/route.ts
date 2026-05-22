import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/authToken';

export async function POST(request: NextRequest) {
  try {
    // Obter token do payload
    const body = await request.json().catch(() => ({}));
    const payloadToken = body.token;
    
    // Obter token do header Authorization
    const authHeader = request.headers.get('Authorization');
    const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Debug: verificar se o token está sendo recebido via cookie, payload, header
    const cookieToken = request.cookies.get('auth-token')?.value;
    const token = headerToken || payloadToken || cookieToken;

    const debugLogout = false;
    if (debugLogout) {
      // console.log('🚪 LOGOUT API - Token via cookie:', cookieToken ? 'SIM' : 'NÃO');
      // console.log('🚪 LOGOUT API - Token via payload:', payloadToken ? 'SIM' : 'NÃO');
      // console.log('🚪 LOGOUT API - Token via header:', headerToken ? 'SIM' : 'NÃO');
      // console.log('🚪 LOGOUT API - Token final usado:', token ? 'SIM' : 'NÃO');
      // console.log('🚪 LOGOUT API - Todos os cookies:', request.cookies.getAll().map(c => `${c.name}=${c.value}`));
    }
    
    // Exigir token presente (usuário deve estar autenticado para realizar logout)
    if (!token) {
      // console.log('🚪 LOGOUT API - Nenhum token encontrado, bloqueando logout');
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    // Validar token (defesa adicional contra requests malformados)
    try {
      await verifyAuthToken(token);
    } catch (e) {
      // console.log('🚪 LOGOUT API - Token inválido no logout');
      return NextResponse.json(
        { error: 'Token de autenticação inválido' },
        { status: 401 }
      );
    }
    
    const response = NextResponse.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

    // Remover o cookie de autenticação de forma consistente
    // console.log('🚪 LOGOUT API - Removendo cookie auth-token...');

    // Definir como vazio e expirar imediatamente
    const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https');
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });

    // Deletar explicitamente
    response.cookies.delete('auth-token');

    // Adicionar headers para evitar cache
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // Clear-Site-Data não é suportado em origens inseguras (HTTP); omitido aqui

    // console.log('🚪 LOGOUT API - Todas as estratégias de remoção aplicadas');
    return response;
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}