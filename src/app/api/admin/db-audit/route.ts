import { NextResponse } from 'next/server'
import prisma from '@/src/lib/prisma'
import bcrypt from 'bcryptjs'

function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 401 })
}

function badRequest(message = 'Bad Request') {
  return NextResponse.json({ ok: false, error: message }, { status: 400 })
}

async function listTables() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;"
    )
    return NextResponse.json({ ok: true, tables: rows?.map((r: any) => r.table_name) ?? [] })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

async function listMigrations() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT migration_name, applied_at, rolled_back_at FROM _prisma_migrations ORDER BY applied_at DESC;'
    )
    return NextResponse.json({ ok: true, migrations: rows ?? [] })
  } catch (err: any) {
    if (String(err?.message ?? '').includes('relation "_prisma_migrations" does not exist')) {
      return NextResponse.json({ ok: true, migrations: [], note: 'no _prisma_migrations table' })
    }
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

async function ensureAdmin() {
  try {
    const existingFuncionario = await prisma.funcionario.findUnique({
      where: { matricula: 'ADMIN001' },
      include: { usuario: true },
    })

    if (existingFuncionario) {
      if (existingFuncionario.usuario) {
        const hashedPassword = await bcrypt.hash('admin123', 10)
        await prisma.usuario.update({
          where: { funcionarioId: existingFuncionario.id },
          data: { senha: hashedPassword, ativo: true },
        })
        return NextResponse.json({ ok: true, action: 'update-password' })
      } else {
        const hashedPassword = await bcrypt.hash('admin123', 10)
        await prisma.usuario.create({
          data: {
            senha: hashedPassword,
            ativo: true,
            funcionarioId: existingFuncionario.id,
            equipeId: 1,
          },
        })
        return NextResponse.json({ ok: true, action: 'create-user-for-existing' })
      }
    } else {
      const adminFuncionario = await prisma.funcionario.create({
        data: {
          nome: 'Administrador do Sistema',
          cpf: '00000000000',
          email: 'admin@gransystem.com',
          telefone: '(11) 99999-9999',
          matricula: 'ADMIN001',
          funcao: 'Administrador',
          departamento: 'TI',
          centroCusto: 'ADMIN',
          status: 'ATIVO',
        },
      })

      const hashedPassword = await bcrypt.hash('admin123', 10)
      await prisma.usuario.create({
        data: {
          senha: hashedPassword,
          ativo: true,
          funcionarioId: adminFuncionario.id,
          equipeId: 1,
        },
      })

      return NextResponse.json({ ok: true, action: 'create-funcionario-and-user' })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

function isAuthorized(req: Request) {
  const token = req.headers.get('x-maintenance-token') || ''
  const expected = process.env.JWT_SECRET || ''
  return token && expected && token === expected
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized()
  const { searchParams } = new URL(req.url)
  const action = (searchParams.get('action') || 'check').toLowerCase()

  switch (action) {
    case 'tables':
      return listTables()
    case 'migrations':
      return listMigrations()
    case 'check':
      try {
        const tablesResp = await listTables()
        const tablesData = await tablesResp.json()
        const migResp = await listMigrations()
        const migData = await migResp.json()
        return NextResponse.json({ ok: true, tables: tablesData.tables ?? [], migrations: migData.migrations ?? [], note: migData.note })
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
      }
    default:
      return badRequest('Unknown action')
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized()
  const { searchParams } = new URL(req.url)
  const action = (searchParams.get('action') || '').toLowerCase()

  switch (action) {
    case 'ensure-admin':
      return ensureAdmin()
    default:
      return badRequest('Unknown action')
  }
}