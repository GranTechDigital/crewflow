import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não encontrado' },
        { status: 401 }
      );
    }

    // Verificar e decodificar o token com jose
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const { payload: decoded } = await jwtVerify(token, secret);
    const userId = (decoded as any).userId || (decoded as any).id;

    // Buscar dados atualizados do usuário
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        funcionario: true,
        equipe: true
      }
    });

    if (!usuario || !usuario.ativo) {
      return NextResponse.json(
        { error: 'Usuário não encontrado ou inativo' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: usuario.id,
        funcionarioId: usuario.funcionario.id,
        matricula: usuario.funcionario.matricula,
        nome: usuario.funcionario.nome,
        email: usuario.funcionario.email,
        equipe: usuario.equipe.nome,
        equipeId: usuario.equipeId,
        ultimoLogin: usuario.ultimoLogin
      }
    });
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return NextResponse.json(
      { error: 'Token inválido' },
      { status: 401 }
    );
  }
}