import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify, SignJWT } from 'jose'

const prisma = new PrismaClient()

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
    const { payload } = await jwtVerify(token, secret)
    const userId = (payload as any).userId as number
    if (!userId || userId !== id) {
      return NextResponse.json({ error: 'Sem autorização' }, { status: 403 })
    }

    const body = await request.json()
    const emailPrincipal = (body?.emailPrincipal || '').trim()
    const emailAlternativo = (body?.emailAlternativo || '').trim()

    if (emailPrincipal && !isValidEmail(emailPrincipal)) {
      return NextResponse.json({ error: 'E-mail principal inválido' }, { status: 400 })
    }
    if (emailAlternativo && !isValidEmail(emailAlternativo)) {
      return NextResponse.json({ error: 'E-mail alternativo inválido' }, { status: 400 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { id }, include: { funcionario: true } })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (emailPrincipal) {
      await prisma.funcionario.update({
        where: { id: usuario.funcionarioId },
        data: { email: emailPrincipal }
      })
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: {
        emailSecundario: emailAlternativo ? emailAlternativo : undefined,
        ...(emailAlternativo ? { obrigarAdicionarEmail: false } : {})
      },
      include: { funcionario: true }
    })

    const baseClaims = payload as any
    const newToken = await new SignJWT({
      id: updated.id,
      userId: updated.id,
      funcionarioId: baseClaims.funcionarioId,
      matricula: baseClaims.matricula,
      nome: baseClaims.nome,
      equipe: baseClaims.equipe,
      equipeId: baseClaims.equipeId,
      sessionStart: baseClaims.sessionStart,
      mustAddEmail: updated.obrigarAdicionarEmail === true,
      mustChangePassword: baseClaims.mustChangePassword === true
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secret)

    const response = NextResponse.json({
      success: true,
      usuario: {
        id: updated.id,
        email: updated.funcionario?.email || null,
        emailSecundario: updated.emailSecundario || null
      }
    })
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}