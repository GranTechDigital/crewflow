import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getUserFromRequest } from "@/utils/authUtils";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const equipeId = searchParams.get("equipeId");
    const ativo = searchParams.get("ativo");

    const skip = (page - 1) * limit;

    const where: Prisma.UsuarioWhereInput = {};

    // Excluir o administrador do sistema das listagens
    where.funcionario = {
      matricula: {
        not: "ADMIN001",
      },
    };

    if (search) {
      where.AND = [
        { funcionario: where.funcionario },
        {
          OR: [
            { funcionario: { nome: { contains: search } } },
            { funcionario: { matricula: { contains: search } } },
            { funcionario: { email: { contains: search } } },
            { emailSecundario: { contains: search } },
          ],
        },
      ];
      // Limpar where.funcionario para não conflitar com AND
      delete (where as any).funcionario;
    }

    // Aplicar restrição por equipe conforme usuário autenticado (não-admin)
    const usuario = await getUserFromRequest(request);
    const isAdminUser = !!usuario && usuario.equipe?.nome === "Administração";
    const isLeadershipViewer =
      !!usuario && usuario.equipe?.nome === "Liderança (Visualizador)";
    const creatorDept = usuario?.equipe?.nome
      ? usuario.equipe.nome.split(" (")[0]
      : null;

    if (equipeId) {
      // Admin pode filtrar livremente; não-admin será ajustado abaixo para o próprio departamento
      where.equipeId = parseInt(equipeId);
    }

    if (ativo !== null && ativo !== undefined) {
      where.ativo = ativo === "true";
    }

    // Se não for admin, restringir consulta ao departamento do usuário
    if (!isAdminUser && !isLeadershipViewer && creatorDept) {
      (where as any).equipe = {
        nome: { startsWith: creatorDept },
      };
      // Evitar conflito de filtros simultâneos
      delete (where as any).equipeId;
    }

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        include: {
          funcionario: {
            select: {
              id: true,
              matricula: true,
              nome: true,
              email: true,
              funcao: true,
              departamento: true,
            },
          },
          equipe: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          funcionario: {
            nome: "asc",
          },
        },
      }),
      prisma.usuario.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      usuarios: usuarios.map((usuario) => ({
        id: usuario.id,
        funcionarioId: usuario.funcionarioId,
        matricula: usuario.funcionario.matricula,
        nome: usuario.funcionario.nome,
        email: usuario.funcionario.email,
        emailSecundario: (usuario as any).emailSecundario ?? null,
        funcao: usuario.funcionario.funcao,
        departamento: usuario.funcionario.departamento,
        equipe: usuario.equipe,
        ativo: usuario.ativo,
        ultimoLogin: usuario.ultimoLogin,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { funcionarioId, senha, equipeId } = await request.json();
    const usuario = await getUserFromRequest(request);
    if (!usuario) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const isAdminUser = usuario.equipe?.nome === "Administração";
    const isGestor =
      usuario.equipe?.nome && usuario.equipe.nome.includes("(Gestor)");

    if (!funcionarioId || !senha || !equipeId) {
      return NextResponse.json(
        { error: "Funcionário, senha e equipe são obrigatórios" },
        { status: 400 },
      );
    }

    // Verificar se o funcionário existe
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      include: { usuario: true },
    });

    if (!funcionario) {
      return NextResponse.json(
        { error: "Funcionário não encontrado" },
        { status: 404 },
      );
    }

    if (funcionario.usuario) {
      return NextResponse.json(
        { error: "Funcionário já possui usuário cadastrado" },
        { status: 400 },
      );
    }

    // Verificar se a equipe existe
    const equipe = await prisma.equipe.findUnique({
      where: { id: equipeId },
    });

    if (!equipe) {
      return NextResponse.json(
        { error: "Equipe não encontrada" },
        { status: 404 },
      );
    }

    // Restrições: não-admin só pode criar dentro do próprio departamento; e não pode criar usuário com perfil Gestor
    if (!isAdminUser) {
      if (!isGestor) {
        return NextResponse.json(
          { error: "Apenas gestores de setor podem criar usuários" },
          { status: 403 },
        );
      }
      const creatorDept = usuario.equipe!.nome.split(" (")[0];
      const targetDept = equipe.nome.split(" (")[0];
      if (creatorDept !== targetDept) {
        return NextResponse.json(
          {
            error: "Você só pode criar usuários para sua própria equipe/setor",
          },
          { status: 403 },
        );
      }
      if (equipe.nome.includes("(Gestor)")) {
        return NextResponse.json(
          { error: "Não é permitido criar usuários com perfil Gestor" },
          { status: 403 },
        );
      }
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // Criar usuário
    const novoUsuario = await prisma.usuario.create({
      data: {
        funcionarioId,
        senha: senhaHash,
        equipeId,
      },
      include: {
        funcionario: {
          select: {
            id: true,
            matricula: true,
            nome: true,
            email: true,
            funcao: true,
            departamento: true,
          },
        },
        equipe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        usuario: {
          id: novoUsuario.id,
          funcionarioId: novoUsuario.funcionarioId,
          matricula: novoUsuario.funcionario.matricula,
          nome: novoUsuario.funcionario.nome,
          email: novoUsuario.funcionario.email,
          funcao: novoUsuario.funcionario.funcao,
          departamento: novoUsuario.funcionario.departamento,
          equipe: novoUsuario.equipe,
          ativo: novoUsuario.ativo,
          createdAt: novoUsuario.createdAt,
          updatedAt: novoUsuario.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
