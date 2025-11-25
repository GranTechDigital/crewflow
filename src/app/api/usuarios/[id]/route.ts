import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        funcionario: {
          select: {
            id: true,
            matricula: true,
            nome: true,
            email: true,
            funcao: true,
            departamento: true,
            telefone: true
          }
        },
        equipe: {
          select: {
            id: true,
            nome: true,
            descricao: true
          }
        }
      }
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      usuario: {
        id: usuario.id,
        funcionarioId: usuario.funcionarioId,
        matricula: usuario.funcionario.matricula,
        nome: usuario.funcionario.nome,
        email: usuario.funcionario.email,
        emailSecundario: (usuario as any).emailSecundario ?? null,
        obrigarAdicionarEmail: (usuario as any).obrigarAdicionarEmail ?? false,
        funcao: usuario.funcionario.funcao,
        departamento: usuario.funcionario.departamento,
        telefone: usuario.funcionario.telefone,
        equipe: usuario.equipe,
        ativo: usuario.ativo,
        ultimoLogin: usuario.ultimoLogin,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const { equipeId, ativo } = await request.json();

    const usuario = await prisma.usuario.findUnique({
      where: { id }
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    const dadosAtualizacao: Prisma.UsuarioUpdateInput = {};

    if (equipeId !== undefined) {
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

      dadosAtualizacao.equipe = {
        connect: { id: equipeId }
      };
    }

    if (ativo !== undefined) {
      dadosAtualizacao.ativo = ativo;
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id },
      data: dadosAtualizacao,
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
        id: usuarioAtualizado.id,
        funcionarioId: usuarioAtualizado.funcionarioId,
        matricula: usuarioAtualizado.funcionario.matricula,
        nome: usuarioAtualizado.funcionario.nome,
        email: usuarioAtualizado.funcionario.email,
        funcao: usuarioAtualizado.funcionario.funcao,
        departamento: usuarioAtualizado.funcionario.departamento,
        equipe: usuarioAtualizado.equipe,
        ativo: usuarioAtualizado.ativo,
        ultimoLogin: usuarioAtualizado.ultimoLogin,
        createdAt: usuarioAtualizado.createdAt,
        updatedAt: usuarioAtualizado.updatedAt
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    const usuario = await prisma.usuario.findUnique({
      where: { id }
    });

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    await prisma.usuario.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}