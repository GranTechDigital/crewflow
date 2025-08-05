import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const funcionarioId = parseInt(id);
    
    if (isNaN(funcionarioId)) {
      return NextResponse.json(
        { error: 'ID do funcionário inválido' },
        { status: 400 }
      );
    }

    const funcionario = await prisma.funcionario.findUnique({
      where: {
        id: funcionarioId
      },
      include: {
        contrato: {
          select: {
            id: true,
            nome: true,
            cliente: true,
            numero: true
          }
        }
      }
    });

    if (!funcionario) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(funcionario);
  } catch (error) {
    console.error('Erro ao buscar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const funcionarioId = parseInt(id);
    
    if (isNaN(funcionarioId)) {
      return NextResponse.json(
        { error: 'ID do funcionário inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Verificar se o funcionário existe
    const funcionarioExistente = await prisma.funcionario.findUnique({
      where: { id: funcionarioId }
    });

    if (!funcionarioExistente) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é o administrador do sistema
    if (funcionarioExistente.matricula === 'ADMIN001') {
      return NextResponse.json(
        { error: 'Não é possível excluir o administrador do sistema' },
        { status: 403 }
      );
    }

    // Atualizar o funcionário
    const funcionarioAtualizado = await prisma.funcionario.update({
      where: {
        id: funcionarioId
      },
      data: {
        nome: body.nome,
        funcao: body.funcao,
        cpf: body.cpf,
        rg: body.rg,
        orgaoEmissor: body.orgaoEmissor,
        uf: body.uf,
        dataNascimento: body.dataNascimento ? new Date(body.dataNascimento) : null,
        email: body.email,
        telefone: body.telefone,
        centroCusto: body.centroCusto,
        departamento: body.departamento,
        status: body.status,
        contratoId: body.contratoId || null,
        atualizadoEm: new Date()
      },
      include: {
        contrato: {
          select: {
            id: true,
            nome: true,
            cliente: true,
            numero: true
          }
        }
      }
    });

    return NextResponse.json(funcionarioAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const funcionarioId = parseInt(id);
    
    if (isNaN(funcionarioId)) {
      return NextResponse.json(
        { error: 'ID do funcionário inválido' },
        { status: 400 }
      );
    }

    // Verificar se o funcionário existe
    const funcionarioExistente = await prisma.funcionario.findUnique({
      where: { id: funcionarioId }
    });

    if (!funcionarioExistente) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Soft delete - marcar como excluído
    const funcionarioExcluido = await prisma.funcionario.update({
      where: {
        id: funcionarioId
      },
      data: {
        excluidoEm: new Date(),
        status: 'INATIVO'
      }
    });

    return NextResponse.json({ 
      message: 'Funcionário excluído com sucesso',
      funcionario: funcionarioExcluido 
    });
  } catch (error) {
    console.error('Erro ao excluir funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}