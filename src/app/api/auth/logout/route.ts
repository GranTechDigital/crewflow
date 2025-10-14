import { NextRequest, NextResponse } from 'next/server';

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
    
    console.log('🚪 LOGOUT API - Token via cookie:', cookieToken ? 'SIM' : 'NÃO');
    console.log('🚪 LOGOUT API - Token via payload:', payloadToken ? 'SIM' : 'NÃO');
    console.log('🚪 LOGOUT API - Token via header:', headerToken ? 'SIM' : 'NÃO');
    console.log('🚪 LOGOUT API - Token final usado:', token ? 'SIM' : 'NÃO');
    console.log('🚪 LOGOUT API - Todos os cookies:', request.cookies.getAll().map(c => `${c.name}=${c.value}`));
    
    if (!token) {
      console.log('🚪 LOGOUT API - ERRO: Nenhum token encontrado!');
      return NextResponse.json({
        success: false,
        message: 'Token não encontrado para logout'
      }, { status: 401 });
    }
    
    const response = NextResponse.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

    // Remover o cookie de autenticação com múltiplas estratégias
    console.log('🚪 LOGOUT API - Removendo cookie auth-token...');
    
    // Estratégia 1: Definir como vazio com maxAge 0 (sem Secure para ambientes HTTP)
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      expires: new Date(0)
    });
    
    // Estratégia 2: Deletar explicitamente
    response.cookies.delete('auth-token');
    
    // Estratégia 3: Definir com data muito antiga (sem Secure para ambientes HTTP)
    response.cookies.set('auth-token', 'deleted', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: -1,
      path: '/',
      expires: new Date('1970-01-01')
    });

    // Adicionar headers para evitar cache
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // Header adicional para forçar limpeza de cookies
    response.headers.set('Clear-Site-Data', '"cookies"');

    console.log('🚪 LOGOUT API - Todas as estratégias de remoção aplicadas');
    return response;
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}