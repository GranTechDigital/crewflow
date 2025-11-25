import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify, SignJWT } from 'jose'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret')
    const { payload } = await jwtVerify(token, secret)

    const funcionarioId = (payload as any).funcionarioId as number
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      include: { usuario: { include: { equipe: true } } }
    })

    if (!funcionario || !funcionario.usuario || !funcionario.usuario.ativo) {
      return NextResponse.json({ error: 'Usuário não encontrado ou inativo' }, { status: 401 })
    }

    const equipeNome = funcionario.usuario.equipe?.nome ?? 'Sem equipe'
    const equipeId = funcionario.usuario.equipeId ?? null

    const maxDays = Number(process.env.JWT_SESSION_MAX_DAYS || 5)
    const startStr = (payload as any).sessionStart as string | undefined
    const sessionStart = startStr ? new Date(startStr) : new Date()
    const now = new Date()
    const maxMs = maxDays * 24 * 60 * 60 * 1000
    if (now.getTime() - sessionStart.getTime() > maxMs) {
      const resp = NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
      resp.cookies.delete('auth-token')
      return resp
    }

    const mustAddEmailFlag = funcionario.usuario.obrigarAdicionarEmail === true || !funcionario.usuario.emailSecundario
    const newToken = await new SignJWT({
      id: funcionario.usuario.id,
      userId: funcionario.usuario.id,
      funcionarioId: funcionario.id,
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      equipe: equipeNome,
      equipeId: equipeId,
      sessionStart: sessionStart.toISOString(),
      mustAddEmail: mustAddEmailFlag,
      mustChangePassword: funcionario.usuario.obrigarTrocaSenha === true
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secret)

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
    })

    const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https')
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60
    })

    return response
  } catch (error) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }
}