import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Obtém o usuário autenticado a partir do token nos cookies da requisição
 */
export async function getUserFromRequest(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      console.log('DEBUG - Token não encontrado nos cookies');
      return null;
    }

    // Verificar e decodificar o token com jose
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const { payload: decoded } = await jwtVerify(token, secret);
    
    // Debug para verificar o conteúdo do token
    console.log('DEBUG - Token decodificado:', JSON.stringify(decoded, null, 2));

    // Buscar dados atualizados do usuário
    // Verificar se temos userId ou id no token
    const userId = (decoded as any).userId || (decoded as any).id;
    
    if (!userId) {
      console.log('DEBUG - ID do usuário não encontrado no token');
      return null;
    }
    
    console.log('DEBUG - Buscando usuário com ID:', userId);
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        funcionario: true,
        equipe: true
      }
    });

    if (!usuario) {
      console.log('DEBUG - Usuário não encontrado no banco de dados');
      return null;
    }
    
    if (!usuario.ativo) {
      console.log('DEBUG - Usuário encontrado, mas está inativo');
      return null;
    }

    console.log('DEBUG - Usuário encontrado:', usuario.funcionario.nome);
    return usuario;
  } catch (error) {
    console.error('Erro ao obter usuário do token:', error);
    return null;
  }
}