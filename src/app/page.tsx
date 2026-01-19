"use client";

import Link from "next/link";
import { useAuth, usePermissions } from "./hooks/useAuth";
import {
  LayoutDashboard,
  Boxes,
  Stethoscope,
  Users,
  GraduationCap,
  Settings,
  ArrowRight,
  Activity,
} from "lucide-react";

interface SetorCard {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  equipes: string[]; // Equipes que podem ver o card
  links: {
    label: string;
    href: string;
  }[];
}

const setores: SetorCard[] = [
  {
    key: "Administração",
    title: "Configuração",
    description:
      "Configurações gerais do sistema, sincronização de funcionários e criação de contratos.",
    icon: Settings,
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200 hover:border-gray-300",
    equipes: ["Administração"], // Apenas Administração
    links: [
      { label: "Gerenciar Usuários", href: "/admin/usuarios" },
      { label: "Gerenciar Equipes", href: "/admin/equipes" },
      { label: "Gerenciar Tarefas Padrão", href: "/admin/tarefas-padrao" },
      { label: "Sincronizar Lista de Funcionários", href: "/funcionarios" },
      { label: "Criar Contratos", href: "/planejamento/contratos" },
      { label: "Gerenciar Status", href: "/status" },
    ],
  },
  // {
  //   key: "uptime",
  //   title: "Monitoramento",
  //   description:
  //     "Monitoramento de uptime dos sistemas e serviços da empresa.",
  //   icon: Activity,
  //   color: "text-purple-700",
  //   bgColor: "bg-purple-50",
  //   borderColor: "border-purple-200 hover:border-purple-300",
  //   equipes: ["Administração", "TI"], // Administração e TI
  //   links: [
  //     { label: "Dashboard de Uptime", href: "/uptime" },
  //   ],
  // },
  {
    key: "planejamento",
    title: "Planejamento",
    description:
      "Dashboard, solicitações de remanejamento e visualização de funcionários por contrato.",
    icon: LayoutDashboard,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200 hover:border-blue-300",
    equipes: [
      "Administração",
      "Planejamento",
      "Planejamento (Gestor)",
      "Planejamento (Editor)",
      "Planejamento (Visualizador)",
    ], // Administração e Planejamento
    links: [
      {
        label: "Criar Solicitação",
        href: "/prestserv/funcionarios/planejamento",
      },
      {
        label: "Lista de Funcionários",
        href: "/prestserv/funcionarios-por-contrato",
      },
      // BI removido do card Planejamento
    ],
  },
  {
    key: "cadastro-prestserv",
    title: "Logística",
    description:
      "Gestão de funcionários em processo de remanejamento e criação de tarefas para setores.",
    icon: Boxes,
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200 hover:border-green-300",
    equipes: [
      "Administração",
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Logística (Visualizador)",
    ], // Administração e Planejamento (prestserv)
    links: [
      // { label: 'Dashboard', href: '/prestserv/dashboard' },
      {
        label: "Solicitações de Remanejamento",
        href: "/prestserv/funcionarios",
      },
      { label: "Tarefas dos Setores", href: "/tarefas" },
      // { label: "Funcionários em Processo", href: "/prestserv/funcionarios" },
      // {
      //   label: "Funcionários por Centro de Custo",
      //   href: "/prestserv/funcionarios-por-contrato",
      // },
      // { label: "REPROVAR TAREFAS para os Setores", href: "/prestserv/tarefas" },
      {
        label: "Lista de Funcionários",
        href: "/prestserv/funcionarios-por-contrato",
      },
      { label: "Demitidos", href: "/funcionarios/demitidos" },
      { label: "Upload da Planilha (Uptime)", href: "/uptime" },
      { label: "Sincronizar Lista de Funcionários", href: "/funcionarios" },
    ],
  },
  {
    key: "medicina",
    title: "Medicina",
    description: "Gestão de tarefas médicas e de segurança do trabalho.",
    icon: Stethoscope,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200 hover:border-red-300",
    equipes: [
      "Administração",
      "Medicina",
      "Medicina (Gestor)",
      "Medicina (Editor)",
      "Medicina (Visualizador)",
    ], // Administração e Medicina
    links: [{ label: "Minhas Tarefas", href: "/tarefas?setor=medicina" }],
  },
  {
    key: "rh",
    title: "Recursos Humanos",
    description: "Gestão de tarefas relacionadas aos recursos humanos.",
    icon: Users,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200 hover:border-purple-300",
    equipes: [
      "Administração",
      "RH",
      "RH (Gestor)",
      "RH (Editor)",
      "RH (Visualizador)",
    ], // Administração e RH
    links: [{ label: "Minhas Tarefas", href: "/tarefas?setor=rh" }],
  },
  {
    key: "treinamento",
    title: "Treinamento",
    description: "Gestão de tarefas relacionadas ao treinamento e capacitação.",
    icon: GraduationCap,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200 hover:border-orange-300",
    equipes: [
      "Administração",
      "Treinamento",
      "Treinamento (Gestor)",
      "Treinamento (Editor)",
      "Treinamento (Visualizador)",
    ], // Administração e Treinamento
    links: [
      { label: "Minhas Tarefas", href: "/tarefas?setor=treinamento" },
      { label: "Matriz de Treinamento", href: "/matriz-treinamento/contratos" },
      { label: "Gerenciar Funções", href: "/funcoes" },
      { label: "Cadastrar Treinamentos", href: "/treinamentos" },
    ],
  },
  {
    key: "relatorios",
    title: "Relatórios",
    description: "Painéis e relatórios de SLA.",
    icon: Activity,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200 hover:border-indigo-300",
    equipes: [
      "Administração",
      "Logística",
      "Logística (Gestor)",
      "Logística (Editor)",
      "Logística (Visualizador)",
    ],
    links: [
      {
        label: "Concluídos",
        href: "/sla/relatorio?tab=dias&hideTabs=true",
      },
      { label: "Todos", href: "/sla/relatorio?tab=dias_all&hideTabs=true" },
      { label: "Capacitações", href: "/relatorios/capacitacoes" },
    ],
  },
];

export default function HomePage() {
  const { usuario, loading } = useAuth();
  const { hasPermission } = usePermissions();

  // Mostrar loading enquanto carrega
  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Filtrar setores baseado na equipe do usuário
  const setoresFiltrados = setores.filter((setor) => {
    // Se o usuário tem permissão de admin, mostrar todos os setores
    if (hasPermission("admin")) {
      return true;
    }

    // Caso contrário, mostrar apenas setores da equipe do usuário
    // Buscar a equipe do usuário através do relacionamento
    return setor.equipes.includes(usuario?.equipe || "");
  });

  // Filtrar links baseado nas permissões (ex: ocultar "Criar Solicitação" para visualizadores)
  const filterLinks = (
    links: { label: string; href: string }[],
    equipe: string
  ) => {
    // Se for visualizador, filtrar links de criação
    if (equipe.includes("Visualizador")) {
      return links.filter((link) => !link.label.includes("Criar Solicitação"));
    }
    return links;
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Cards dos Setores */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {setoresFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Nenhum setor disponível para sua equipe.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Entre em contato com o administrador se isso for um erro.
            </p>
            <p className="text-gray-300 text-xs mt-1">
              Sua equipe: {usuario?.equipe || "Não definida"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {setoresFiltrados.map((setor) => {
              const IconComponent = setor.icon;
              const filteredLinks = filterLinks(
                setor.links,
                usuario?.equipe || ""
              );

              return (
                <div
                  key={setor.key}
                  className={`bg-white rounded-lg shadow-sm border-2 ${setor.borderColor} transition-all duration-200 hover:shadow-md`}
                >
                  {/* Header do Card */}
                  <div
                    className={`${setor.bgColor} px-4 py-3 rounded-t-lg border-b border-gray-200`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg bg-white shadow-sm`}>
                        <IconComponent size={20} className={setor.color} />
                      </div>
                      <div>
                        <h3
                          className={`text-base font-semibold ${setor.color}`}
                        >
                          {setor.title}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-600">
                      {setor.description}
                    </p>
                  </div>

                  {/* Links do Card */}
                  <div className="px-4 py-3">
                    <div className="space-y-1">
                      {filteredLinks.map((link, index) => (
                        <Link
                          key={index}
                          href={link.href}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors group"
                        >
                          <span className="text-xs text-gray-700 group-hover:text-gray-900">
                            {link.label}
                          </span>
                          <ArrowRight
                            size={14}
                            className="text-gray-400 group-hover:text-gray-600 transition-colors"
                          />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
