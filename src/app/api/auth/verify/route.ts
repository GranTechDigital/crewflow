import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    // Verificar e decodificar o token usando jose
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const { payload: decoded } = await jwtVerify(token, secret);

    // Buscar dados atualizados do usuário
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: decoded.funcionarioId as number },
      include: {
        usuario: {
          include: {
            equipe: true
          }
        }
      }
    });

    if (!funcionario || !funcionario.usuario || !funcionario.usuario.ativo) {
      return NextResponse.json(
        { error: 'Usuário não encontrado ou inativo' },
        { status: 401 }
      );
    }

    // Definir permissões baseadas na equipe
    let permissoes: string[] = [];
    
    // Mapeamento de equipes para permissões
    const equipePermissoes: { [key: string]: string[] } = {
      'Administração': [
        'admin',
        'canAccessFuncionarios',
        'canAccessPrestServ',
        'canAccessPlanejamento',
        'canAccessLogistica',
        'canAccessAdmin',
        'canAccessRH',
        'canAccessTreinamento',
        'canAccessMedicina'
      ],
      'RH': [
        'canAccessFuncionarios',
        'canAccessRH'
      ],
      'Treinamento': [
        'canAccessFuncionarios',
        'canAccessTreinamento'
      ],
      'Medicina': [
        'canAccessFuncionarios',
        'canAccessMedicina'
      ],
      'Logistica': [
        'canAccessFuncionarios',
        'canAccessLogistica'
      ],
      'Planejamento': [
        'canAccessFuncionarios',
        'canAccessPlanejamento'
      ],
      'Prestserv': [
        'canAccessFuncionarios',
        'canAccessPrestServ'
      ]
    };
    
    // Verificar se é admin por matrícula (fallback)
    if (funcionario.matricula === 'ADMIN001') {
      permissoes = equipePermissoes['Administração'];
    } else {
      // Buscar permissões baseadas na equipe
      const nomeEquipe = funcionario.usuario.equipe.nome;
      permissoes = equipePermissoes[nomeEquipe] || ['canAccessFuncionarios'];
    }

    // Retornar dados do usuário
    return NextResponse.json({
      user: {
        id: funcionario.usuario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        equipe: funcionario.usuario.equipe.nome,
        equipeId: funcionario.usuario.equipe.id,
        matricula: funcionario.matricula,
        funcionarioId: funcionario.id,
        permissoes: permissoes
      }
    });
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    return NextResponse.json(
      { error: 'Token inválido' },
      { status: 401 }
    );
  }
}