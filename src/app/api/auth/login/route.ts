import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
// Remover: import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { matricula, senha } = await request.json();

    if (!matricula || !senha) {
      return NextResponse.json(
        { error: 'Matrícula e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar funcionário pela matrícula
    const funcionario = await prisma.funcionario.findUnique({
      where: { matricula },
      include: {
        usuario: {
          include: {
            equipe: true
          }
        }
      }
    });

    if (!funcionario || !funcionario.usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado ou não possui acesso ao sistema' },
        { status: 401 }
      );
    }

    if (!funcionario.usuario.ativo) {
      return NextResponse.json(
        { error: 'Usuário inativo' },
        { status: 401 }
      );
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, funcionario.usuario.senha);
    
    if (!senhaValida) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      );
    }

    // Atualizar último login
    await prisma.usuario.update({
      where: { id: funcionario.usuario.id },
      data: { ultimoLogin: new Date() }
    });

    // Parâmetros de expiração configuráveis
    const tokenExpiration = process.env.JWT_EXPIRATION || '30d'; // padrão: 30 dias
    const cookieMaxAge = parseInt(process.env.JWT_COOKIE_MAX_AGE || String(30 * 24 * 60 * 60), 10); // padrão: 30 dias em segundos
    const cookieSecure = process.env.NODE_ENV === 'production';

    // Gerar token JWT usando jose
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    console.log('DEBUG - Gerando token com dados:', JSON.stringify({
      id: funcionario.usuario.id, // Adicionando id para compatibilidade
      userId: funcionario.usuario.id,
      funcionarioId: funcionario.id,
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      equipe: funcionario.usuario.equipe.nome,
      equipeId: funcionario.usuario.equipeId
    }));
    
    const token = await new SignJWT({
      id: funcionario.usuario.id, // Adicionando id para compatibilidade
      userId: funcionario.usuario.id,
      funcionarioId: funcionario.id,
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      equipe: funcionario.usuario.equipe.nome,
      equipeId: funcionario.usuario.equipeId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(tokenExpiration)
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      user: {
        id: funcionario.usuario.id,
        funcionarioId: funcionario.id,
        matricula: funcionario.matricula,
        nome: funcionario.nome,
        email: funcionario.email,
        equipe: funcionario.usuario.equipe.nome,
        equipeId: funcionario.usuario.equipeId
      }
    });

    // Definir cookie com o token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: cookieSecure, // true em produção
      sameSite: 'lax',
      path: '/',
      maxAge: cookieMaxAge
    });

    return response;
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}