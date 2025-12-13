import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
// Remover: import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Parse do corpo com proteção contra JSON inválido
    let matricula: string | undefined;
    let senha: string | undefined;
    let email: string | undefined;
    let login: string | undefined;
    try {
      const body = await request.json();
      matricula = body?.matricula;
      senha = body?.senha;
      email = body?.email;
      login = body?.login;
    } catch (err) {
      return NextResponse.json(
        { error: 'Payload inválido. Envie JSON com campos "login" (ou "email"/"matricula") e "senha".' },
        { status: 400 }
      );
    }
    const identifier = (login ?? email ?? matricula)?.toString().trim();

    if (!identifier || !senha) {
      return NextResponse.json(
        { error: 'Matrícula e senha são obrigatórios' },
        { status: 400 }
      );
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

    if (isEmail) {
      // Primeiro, tentar pelo emailSecundario do usuário
      let usuario = await prisma.usuario.findFirst({
        where: { emailSecundario: identifier },
        include: { equipe: true, funcionario: true }
      });

      // Fallback: se não encontrado, tentar pelo email do funcionário
      if (!usuario) {
        const funcByEmail = await prisma.funcionario.findFirst({
          where: { email: identifier },
          include: { usuario: { include: { equipe: true } } }
        });
        if (funcByEmail && funcByEmail.usuario) {
          usuario = {
            ...funcByEmail.usuario,
            funcionario: funcByEmail,
          } as any;
        }
      }

      if (!usuario || !usuario.funcionario) {
        return NextResponse.json(
          { error: 'Usuário não encontrado ou não possui acesso ao sistema' },
          { status: 401 }
        );
      }

      if (!usuario.ativo) {
        return NextResponse.json(
          { error: 'Usuário inativo' },
          { status: 401 }
        );
      }

      // Validar existência de senha no cadastro
      if (!usuario.senha || typeof usuario.senha !== 'string') {
        return NextResponse.json(
          { error: 'Senha não configurada. Solicite redefinição de senha ao administrador.' },
          { status: 401 }
        );
      }
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return NextResponse.json(
          { error: 'Senha incorreta' },
          { status: 401 }
        );
      }

      const isPrimeiroAcesso = !usuario.ultimoLogin;
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          ultimoLogin: new Date(),
          ...(isPrimeiroAcesso ? { obrigarAdicionarEmail: true, obrigarTrocaSenha: true } : {})
        }
      });

      const equipeNome = usuario.equipe?.nome ?? 'Sem equipe';
      const equipeId = usuario.equipeId ?? null;

      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
      const token = await new SignJWT({
        id: usuario.id,
        userId: usuario.id,
        funcionarioId: usuario.funcionario.id,
        matricula: usuario.funcionario.matricula,
        nome: usuario.funcionario.nome,
        equipe: equipeNome,
        equipeId: equipeId,
        sessionStart: new Date().toISOString(),
        mustAddEmail: isPrimeiroAcesso
          ? true
          : ((usuario as any).obrigarAdicionarEmail === true || !(usuario as any).emailSecundario),
        mustChangePassword: isPrimeiroAcesso ? true : (usuario as any).obrigarTrocaSenha || false
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('8h')
        .sign(secret);

      const response = NextResponse.json({
        success: true,
        user: {
          id: usuario.id,
          funcionarioId: usuario.funcionario.id,
          matricula: usuario.funcionario.matricula,
          nome: usuario.funcionario.nome,
          email: usuario.funcionario.email,
          equipe: equipeNome,
          equipeId: equipeId
        }
      });

      const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https');
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
        path: '/'
      });

      return response;
    }

    const funcionario = await prisma.funcionario.findUnique({
      where: { matricula: identifier },
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

    if (!funcionario.usuario.senha || typeof funcionario.usuario.senha !== 'string') {
      return NextResponse.json(
        { error: 'Senha não configurada. Solicite redefinição de senha ao administrador.' },
        { status: 401 }
      );
    }
    const senhaValida = await bcrypt.compare(senha, funcionario.usuario.senha);
    if (!senhaValida) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      );
    }

    const isPrimeiroAcesso = !funcionario.usuario.ultimoLogin;
    await prisma.usuario.update({
      where: { id: funcionario.usuario.id },
      data: {
        ultimoLogin: new Date(),
        ...(isPrimeiroAcesso ? { obrigarAdicionarEmail: true, obrigarTrocaSenha: true } : {})
      }
    });

    const equipeNome = funcionario.usuario.equipe?.nome ?? 'Sem equipe';
    const equipeId = funcionario.usuario.equipeId ?? null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const token = await new SignJWT({
      id: funcionario.usuario.id,
      userId: funcionario.usuario.id,
      funcionarioId: funcionario.id,
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      equipe: equipeNome,
      equipeId: equipeId,
      sessionStart: new Date().toISOString(),
      mustAddEmail: isPrimeiroAcesso
        ? true
        : ((funcionario.usuario as any).obrigarAdicionarEmail === true || !(funcionario.usuario as any).emailSecundario),
      mustChangePassword: isPrimeiroAcesso ? true : (funcionario.usuario as any).obrigarTrocaSenha || false
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      user: {
        id: funcionario.usuario.id,
        funcionarioId: funcionario.id,
        matricula: funcionario.matricula,
        nome: funcionario.nome,
        email: funcionario.email,
        equipe: equipeNome,
        equipeId: equipeId
      }
    });

      const isSecure2 = (process.env.NEXTAUTH_URL || '').startsWith('https');
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: isSecure2,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
        path: '/'
      });

    return response;
  } catch (error: any) {
    console.error('Erro no login:', error);
    // Prisma erros comuns
    const msg = (error && error.message) ? String(error.message) : '';
    if (msg.includes('PrismaClientInitializationError') || msg.includes('Invalid `prisma.`')) {
      return NextResponse.json(
        { error: 'Falha ao conectar ao banco de dados (dev). Verifique as variáveis de ambiente e o serviço postgres.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}