import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
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

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    // Buscar dados atualizados do usuário
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
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