import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify, SignJWT } from 'jose'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
    const { payload } = await jwtVerify(token, secret)
    const userId = (payload as any).userId as number

    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    }

    const emailTrim = email.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrim)) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }

    const updated = await prisma.usuario.update({
      where: { id: userId },
      data: { emailSecundario: emailTrim, obrigarAdicionarEmail: false }
    })

    // Reemitir token com flags atualizadas
    const baseClaims = payload as any
    const newToken = await new SignJWT({
      id: updated.id,
      userId: updated.id,
      funcionarioId: baseClaims.funcionarioId,
      matricula: baseClaims.matricula,
      nome: baseClaims.nome,
      equipe: baseClaims.equipe,
      equipeId: baseClaims.equipeId,
      mustAddEmail: false,
      mustChangePassword: updated.obrigarTrocaSenha === true
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secret)

    const response = NextResponse.json({ success: true })
    const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https')
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('Erro ao atualizar e-mail secundário:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}