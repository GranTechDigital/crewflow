import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const equipeId = searchParams.get('equipeId');
    const ativo = searchParams.get('ativo');

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.funcionario = {
        OR: [
          { nome: { contains: search, mode: 'insensitive' } },
          { matricula: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    if (equipeId) {
      where.equipeId = parseInt(equipeId);
    }

    if (ativo !== null && ativo !== undefined) {
      where.ativo = ativo === 'true';
    }

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        include: {
          funcionario: {
            select: {
              id: true,
              matricula: true,
              nome: true,
              email: true,
              funcao: true,
              departamento: true
            }
          },
          equipe: {
            select: {
              id: true,
              nome: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          funcionario: {
            nome: 'asc'
          }
        }
      }),
      prisma.usuario.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      usuarios: usuarios.map(usuario => ({
        id: usuario.id,
        funcionarioId: usuario.funcionarioId,
        matricula: usuario.funcionario.matricula,
        nome: usuario.funcionario.nome,
        email: usuario.funcionario.email,
        funcao: usuario.funcionario.funcao,
        departamento: usuario.funcionario.departamento,
        equipe: usuario.equipe,
        ativo: usuario.ativo,
        ultimoLogin: usuario.ultimoLogin,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { funcionarioId, senha, equipeId } = await request.json();

    if (!funcionarioId || !senha || !equipeId) {
      return NextResponse.json(
        { error: 'Funcionário, senha e equipe são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o funcionário existe
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      include: { usuario: true }
    });

    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    if (funcionario.usuario) {
      return NextResponse.json(
        { error: 'Funcionário já possui usuário cadastrado' },
        { status: 400 }
      );
    }

    // Verificar se a equipe existe
    const equipe = await prisma.equipe.findUnique({
      where: { id: equipeId }
    });

    if (!equipe) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      );
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // Criar usuário
    const novoUsuario = await prisma.usuario.create({
      data: {
        funcionarioId,
        senha: senhaHash,
        equipeId
      },
      include: {
        funcionario: {
          select: {
            id: true,
            matricula: true,
            nome: true,
            email: true,
            funcao: true,
            departamento: true
          }
        },
        equipe: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      usuario: {
        id: novoUsuario.id,
        funcionarioId: novoUsuario.funcionarioId,
        matricula: novoUsuario.funcionario.matricula,
        nome: novoUsuario.funcionario.nome,
        email: novoUsuario.funcionario.email,
        funcao: novoUsuario.funcionario.funcao,
        departamento: novoUsuario.funcionario.departamento,
        equipe: novoUsuario.equipe,
        ativo: novoUsuario.ativo,
        createdAt: novoUsuario.createdAt,
        updatedAt: novoUsuario.updatedAt
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}