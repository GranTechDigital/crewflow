import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { getPermissionsByTeam } from '@/lib/permissions';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth-token')?.value;

    if (!token) {
      // Debug removido: logs de token ausente
      return NextResponse.json(
        { error: 'Token não fornecido' },
        { status: 401 }
      );
    }

    // Debug removido: token encontrado
    
    // Verificar e decodificar o token usando jose
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const { payload: decoded } = await jwtVerify(token, secret);
    // Debug removido: token decodificado
    
    // Buscar dados atualizados do usuário
    const funcionarioId = decoded.funcionarioId as number;
    // Debug removido: buscando funcionário
    
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      include: {
        usuario: {
          include: {
            equipe: true
          }
        }
      }
    });
    // Debug removido: funcionário encontrado
    
    if (!funcionario || !funcionario.usuario || !funcionario.usuario.ativo) {
      return NextResponse.json(
        { error: 'Usuário não encontrado ou inativo' },
        { status: 401 }
      );
    }

    // Obter permissões baseadas na equipe usando o sistema centralizado
    const nomeEquipe = funcionario.usuario.equipe.nome;
    let permissoes: string[] = [];
    
    // Verificar se é admin por matrícula (fallback)
    if (funcionario.matricula === 'ADMIN001') {
      permissoes = getPermissionsByTeam('Administração');
    } else {
      // Buscar permissões baseadas na equipe
      permissoes = getPermissionsByTeam(nomeEquipe);
    }

    // Retornar dados do usuário
    return NextResponse.json({
      user: {
        id: funcionario.usuario.id,
        nome: funcionario.nome,
        email: funcionario.email,
        emailSecundario: (funcionario.usuario as any).emailSecundario ?? null,
        obrigarAdicionarEmail: (funcionario.usuario as any).obrigarAdicionarEmail === true,
        obrigarTrocaSenha: (funcionario.usuario as any).obrigarTrocaSenha === true,
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