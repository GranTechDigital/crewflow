import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify, SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function isStrongPassword(pwd: string) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd)
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
    const { payload } = await jwtVerify(token, secret)
    const userId = (payload as any).userId as number

    const body = await request.json()
    const senhaAtual = body?.senhaAtual as string
    const novaSenha = body?.novaSenha as string

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json({ error: 'Informe senha atual e nova senha' }, { status: 400 })
    }

    if (!isStrongPassword(novaSenha)) {
      return NextResponse.json({ error: 'A nova senha deve ter 8+ caracteres, com maiúsculas, minúsculas e números' }, { status: 400 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const ok = await bcrypt.compare(senhaAtual, usuario.senha)
    if (!ok) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 })
    }

    const hash = await bcrypt.hash(novaSenha, 10)
    const updated = await prisma.usuario.update({
      where: { id: userId },
      data: { senha: hash, obrigarTrocaSenha: false }
    })

    // Reemitir JWT preservando claims
    const baseClaims = payload as any
    const newToken = await new SignJWT({
      id: updated.id,
      userId: updated.id,
      funcionarioId: baseClaims.funcionarioId,
      matricula: baseClaims.matricula,
      nome: baseClaims.nome,
      equipe: baseClaims.equipe,
      equipeId: baseClaims.equipeId,
      mustAddEmail: baseClaims.mustAddEmail === true,
      mustChangePassword: false
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secret)

    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('Erro ao trocar senha:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}