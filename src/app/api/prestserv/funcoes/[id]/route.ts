import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Buscar função específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }

    const funcao = await prisma.funcao.findUnique({
      where: { id }
    })

    if (!funcao) {
      return NextResponse.json(
        { error: 'Função não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(funcao)
  } catch (error) {
    console.error('Erro ao buscar função:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// PUT - Atualizar função
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { funcao, regime, ativo } = body

    if (!funcao || typeof funcao !== 'string' || funcao.trim().length === 0) {
      return NextResponse.json(
        { error: 'Campo "funcao" é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se já existe outra função com o mesmo nome (exceto a atual)
    const existente = await prisma.funcao.findFirst({
      where: { 
        funcao: funcao.trim(),
        id: { not: id }
      }
    })

    if (existente) {
      return NextResponse.json(
        { error: 'Já existe uma função com este nome' },
        { status: 409 }
      )
    }

    const funcaoAtualizada = await prisma.funcao.update({
      where: { id },
      data: {
        funcao: funcao.trim(),
        regime: regime && typeof regime === 'string' ? regime.trim() : null,
        ativo: ativo !== undefined ? Boolean(ativo) : true
      }
    })

    return NextResponse.json(funcaoAtualizada)
  } catch (error: any) {
    console.error('Erro ao atualizar função:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Função não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// DELETE - Excluir função (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      )
    }

    // Verificar se a função está sendo usada por funcionários
    const funcionariosUsandoFuncao = await prisma.funcionario.count({
      where: { 
        funcao: {
          equals: await prisma.funcao.findUnique({
            where: { id },
            select: { funcao: true }
          }).then(f => f?.funcao)
        }
      }
    })

    if (funcionariosUsandoFuncao > 0) {
      // Fazer soft delete (marcar como inativo) se estiver sendo usada
      const funcaoInativada = await prisma.funcao.update({
        where: { id },
        data: { ativo: false }
      })

      return NextResponse.json({
        message: 'Função inativada com sucesso (estava sendo usada por funcionários)',
        funcao: funcaoInativada
      })
    } else {
      // Fazer hard delete se não estiver sendo usada
      await prisma.funcao.delete({
        where: { id }
      })

      return NextResponse.json({
        message: 'Função excluída com sucesso'
      })
    }
  } catch (error: any) {
    console.error('Erro ao excluir função:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Função não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}