// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Home,
  LayoutDashboard,
  Stethoscope,
  Users,
  GraduationCap,
  Shield,
} from "lucide-react";
import { useAuth, usePermissions } from "@/app/hooks/useAuth";
import { PERMISSIONS, hasFullAccess } from "@/lib/permissions";

export default function Sidebar() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(true); // Iniciar colapsado por padrão
  const [userLoaded, setUserLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { usuario, loading } = useAuth();
  const permissions = usePermissions();

  // Detectar quando o usuário é carregado
  useEffect(() => {
    if (usuario && !loading) {
      setUserLoaded(true);
    } else {
      setUserLoaded(false);
    }
  }, [usuario, loading]);

  // Carregar estado do localStorage ao montar
  useEffect(() => {
    const storedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (storedCollapsed !== null) {
      setCollapsed(storedCollapsed === "true");
    } else {
      setCollapsed(true); // Padrão colapsado se não houver valor salvo
    }
  }, []);

  // Salvar estado do colapso no localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const handleToggle = (section: string) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const newCollapsed = !prev;
      // Se estiver colapsando, fechar todas as seções abertas
      if (newCollapsed) {
        setActiveSection(null);
      }
      return newCollapsed;
    });
  };

  const allSections = [
    {
      key: "planejamento",
      label: "Planejamento",
      icon: LayoutDashboard,
      items: [
        // { label: "Dashboard", h
        // ref: "/prestserv/dashboard" },
        //{ label: "Minhas Solicitações de Remanejamento", href: "/prestserv/remanejamentos/tabela" },
        // { label: "Criar Solicitação", href: "/prestserv/remanejamentos/novo" },
        {
          label: "Solicitações de Remanejamento",
          href: "/prestserv/funcionarios/planejamento",
        },
        {
          label: "Lista de Funcionários",
          href: "/prestserv/funcionarios-por-contrato",
        },
        {
          label: "BI",
          href: "/prestserv/bi",
        },
        // { label: "Visualizar Funcionários por Centro de Custo (Folha)", href: "/planejamento/funcionarios" },
      ],
      permission: "canAccessPlanejamento",
    },
    {
      key: "prestserv",
      label: "Logística",
      icon: Stethoscope,
      items: [
        // { label: "Dashboard", href: "/prestserv/dashboard" },
        {
          label: "Solicitações de Remanejamento",
          href: "/prestserv/funcionarios",
        },

        //{ label: "Criar Solicitação", href: "/prestserv/remanejamentos/novo" },

        // {
        //   label: "Visualizar Funcionários por Centro de Custo (Folha)",
        //   href: "/prestserv/funcionarios-por-contrato",
        // },
        { label: "Tarefas dos Setores", href: "/tarefas" },
        {
          label: "Lista de Funcionários",
          href: "/prestserv/funcionarios-por-contrato",
        },
        {
          label: "Desligados",
          href: "/funcionarios/demitidos",
        },
        {
          label: "Upload da Planilha (Uptime)",
          href: "/uptime",
        },
        // {
        //   label: "Upload do Downtime",
        //   href: "/downtime",
        // },
        // {
        //   label: "Upload de Período",
        //   href: "/periodo",
        // },
        // {
        //   label: "Business Intelligence",
        //   href: "/prestserv/bi",
        // },
        {
          label: "Matriz de Treinamento",
          href: "/matriz-treinamento/contratos",
        },
        // {
        //   label: "Matriz de Status",
        //   href: "/prestserv/funcionarios/matriz-status",
        // },
      ],
      permission: "canAccessPrestServ",
    },
    {
      key: "rh",
      label: "Recursos Humanos",
      icon: Users,
      items: [{ label: "Minhas Tarefas", href: "/tarefas?setor=rh" }],
      permission: "canAccessRH",
    },
    {
      key: "treinamento",
      label: "Treinamento",
      icon: GraduationCap,
      items: [
        { label: "Minhas Tarefas", href: "/tarefas?setor=treinamento" },
        { label: "Matriz de Treinamento", href: "/matriz-treinamento/contratos" },
      ],
      permission: "canAccessTreinamento",
    },
    {
      key: "medicina",
      label: "Medicina",
      icon: Stethoscope,
      items: [
        // { label: "Geral", href: "/medicina/geral" },
        // { label: "Segurança", href: "/medicina/seguranca" },
        { label: "Minhas Tarefas", href: "/tarefas?setor=medicina" },
      ],
      permission: "canAccessMedicina",
    },
    // {
    //   key: "logistica",
    //   label: "Logística",
    //   icon: Boxes,
    //   items: [
    //     { label: "Minhas Tarefas", href: "/tarefas/logistica" },
    //   ],
    //   permission: "canAccessLogistica",
    // },
    {
      key: "administracao",
      label: "Administração",
      icon: Shield,
      items: [
        { label: "Gerenciar Usuários", href: "/admin/usuarios" },
        { label: "Gerenciar Equipes", href: "/admin/equipes" },
        { label: "Gerenciar Tarefas Padrão", href: "/admin/tarefas-padrao" },
        { label: "Sincronizar Lista de Funcionários", href: "/funcionarios" },
        { label: "Criar Contratos", href: "/planejamento/contratos" },
        { label: "Gerenciar Status", href: "/status" },
        //{ label: "Centros de Custo - Projetos", href: "/centros-custo-projetos" },
      ],
      permission: PERMISSIONS.ACCESS_ADMIN,
    },
  ];

  // Verificar se o usuário tem acesso total (admin)
  const isAdmin = hasFullAccess(usuario?.permissoes || []);

  // Filtrar seções baseado nas permissões do usuário
  const sections = isAdmin
    ? allSections
    : allSections.filter(section => {
      if (!usuario) return false;
      return permissions.hasPermission(section.permission);
    });

  // Se ainda estiver carregando ou usuário não foi carregado
  if (loading || !userLoaded || !usuario) {
    return (
      <div
        className={`
          bg-gradient-to-b from-gray-800 via-gray-750 to-gray-700 text-white h-full
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-20" : "w-64"}
          border-r border-gray-600/50
          overflow-hidden
          flex flex-col
          shadow-xl
          backdrop-blur-sm
        `}
      >
        {/* Header com loading */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-600/50 bg-gray-700/30 backdrop-blur-sm">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-sm font-semibold text-gray-100 tracking-wide">
                CARREGANDO...
              </span>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            aria-label="Alternar barra lateral"
            className={`p-1.5 hover:bg-gray-600/50 rounded-md transition-all duration-200 ${
              collapsed ? "mx-auto" : ""
            }`}
          >
            {collapsed ? <ChevronRight size={14} className="text-gray-300" /> : <ChevronLeft size={14} className="text-gray-300" />}
          </button>
        </div>

        {/* Loading spinner */}
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-gradient-to-b from-gray-800 via-gray-750 to-gray-700 text-white h-full
        transition-all duration-300 ease-in-out
        ${collapsed && !isHovered ? "w-20" : "w-64"}
        border-r border-gray-600/50
        overflow-hidden
        flex flex-col
        shadow-xl
        backdrop-blur-sm
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header integrado com navbar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-600/50 bg-gray-700/30 backdrop-blur-sm">
        {!(collapsed && !isHovered) && (
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-sm"></div>
            <span className="text-sm font-semibold text-gray-100 tracking-wide">
              {isAdmin ? "ADMIN - NAVEGAÇÃO" : "NAVEGAÇÃO"}
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          aria-label="Alternar barra lateral"
          className={`p-1.5 hover:bg-gray-600/50 rounded-md transition-all duration-200 hover:shadow-md border border-transparent hover:border-gray-500/30 ${
            collapsed && !isHovered ? "mx-auto" : ""
            }`}
        >
          {collapsed && !isHovered ? <ChevronRight size={14} className="text-gray-300" /> : <ChevronLeft size={14} className="text-gray-300" />}
        </button>
      </div>

      {/* Navegação com scrollbar customizada mais fina */}
      <nav className={`flex flex-col space-y-0.5 text-sm flex-1 overflow-y-auto custom-scrollbar ${
        collapsed && !isHovered ? "px-2 py-3" : "px-3 py-3"
        }`}>
        {/* Página Inicial */}
        <Link
          href="/"
          className={`hover:bg-gray-600/40 flex items-center rounded-lg transition-all duration-200 hover:shadow-lg group border border-transparent hover:border-gray-500/20 backdrop-blur-sm ${
            collapsed && !isHovered ? "gap-0 px-2 py-2 justify-center" : "gap-2.5 px-3 py-2"
            }`}
          title={collapsed && !isHovered ? "Página Inicial" : ""}
        >
          <Home size={16} className="text-blue-400 group-hover:text-blue-300 transition-colors" />
          {!(collapsed && !isHovered) && (
            <span className="font-medium group-hover:text-white transition-colors text-sm">Página Inicial</span>
          )}
        </Link>

        {/* Seções com submenu */}
        {sections.map((section) => (
          <div key={section.key} className="space-y-0.5">
            <button
              className={`flex items-center justify-between w-full hover:bg-gray-600/40 rounded-lg transition-all duration-200 hover:shadow-lg group border border-transparent hover:border-gray-500/20 backdrop-blur-sm ${
                collapsed && !isHovered ? "px-2 py-2" : "px-3 py-2"
              }`}
              onClick={() => {
                if (collapsed && !isHovered) {
                  // Se estiver colapsado e não hover, expandir primeiro
                  setCollapsed(false);
                  // Aguardar a animação antes de abrir a seção
                  setTimeout(() => {
                    handleToggle(section.key);
                  }, 150);
                } else {
                  // Se não estiver colapsado ou estiver em hover, toggle normal
                  handleToggle(section.key);
                }
              }}
              aria-expanded={activeSection === section.key}
              title={collapsed && !isHovered ? section.label : ""}
            >
              <span className={`flex items-center ${
                collapsed && !isHovered ? "gap-0 justify-center w-full" : "gap-2.5"
              }`}>
                <section.icon size={16} className="text-gray-300 group-hover:text-white transition-colors" />
                {!(collapsed && !isHovered) && (
                  <span className="font-medium group-hover:text-white transition-colors text-sm">{section.label}</span>
                )}
              </span>
              {!(collapsed && !isHovered) &&
                (activeSection === section.key ? (
                  <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
                ))}
            </button>

            {/* Sub-itens com transição suave */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                activeSection === section.key && !(collapsed && !isHovered)
                  ? "max-h-96 opacity-100"
                  : "max-h-0 opacity-0"
                }`}
            >
              <div className="ml-5 mt-0.5 flex flex-col space-y-0.5 border-l-2 border-gray-600/50 pl-3 relative">
                {/* Linha decorativa */}
                <div className="absolute left-0 top-0 w-0.5 h-full bg-gradient-to-b from-blue-400/50 to-transparent"></div>
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:bg-gray-600/30 px-2.5 py-1.5 rounded-md transition-all duration-200 text-xs text-gray-300 hover:text-white hover:shadow-md border border-transparent hover:border-gray-500/20 backdrop-blur-sm"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </nav>

      {/* Footer com informações do usuário (quando colapsado) */}
      {usuario && collapsed && !isHovered && (
        <div className="px-2 py-4 border-t border-gray-600/50 bg-gray-700/30 backdrop-blur-sm">
          <div className="flex justify-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg border ${
                isAdmin
                ? "bg-gradient-to-br from-red-500 to-red-600 border-red-400/30"
                : "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400/30"
              }`}
              title={`${usuario.nome} - ${usuario.equipe}`}
            >
              {usuario.nome.charAt(0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
