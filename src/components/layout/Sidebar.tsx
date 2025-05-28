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
  Boxes,
  Stethoscope,
  Users,
  GraduationCap,
} from "lucide-react";

export default function Sidebar() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Carregar estado do localStorage ao montar
  useEffect(() => {
    const storedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (storedCollapsed !== null) {
      setCollapsed(storedCollapsed === "true");
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
    setCollapsed((prev) => !prev);
  };

  const sections = [
    {
      key: "planejamento",
      label: "Planejamento",
      icon: LayoutDashboard,
      items: [
        { label: "Geral", href: "/planejamento/geral" },
        { label: "Contratos", href: "/planejamento/contratos" },
        { label: "Minhas Demandas", href: "/planejamento/minhas-demandas" },
      ],
    },
    {
      key: "logistica",
      label: "Logística",
      icon: Boxes,
      items: [
        { label: "Geral", href: "/logistica/geral" },
        { label: "Minhas Demandas", href: "/logistica/minhas-demandas" },
      ],
    },
    {
      key: "medicina",
      label: "Medicina",
      icon: Stethoscope,
      items: [
        { label: "Geral", href: "/medicina/geral" },
        { label: "Segurança", href: "/medicina/seguranca" },
      ],
    },
    {
      key: "rh",
      label: "RH",
      icon: Users,
      items: [
        { label: "Geral", href: "/rh/geral" },
        { label: "Minhas Demandas", href: "/rh/minhas-demandas" },
      ],
    },
    {
      key: "treinamento",
      label: "Treinamento",
      icon: GraduationCap,
      items: [
        { label: "Geral", href: "/treinamento/geral" },
        { label: "Minhas Demandas", href: "/treinamento/minhas-demandas" },
      ],
    },
  ];

  return (
    <div
      className={`
        bg-gray-800 text-white h-screen
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-16" : "w-64"}
        rounded-r-2xl
        overflow-hidden
      `}
    >
      {/* Header com imagem e botão de colapsar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        {!collapsed && (
          <img
            src="/graservices-360x63-1.png"
            alt="Logo"
            className="h-8 object-contain"
          />
        )}
        <button
          onClick={toggleCollapse}
          aria-label="Alternar barra lateral"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex flex-col px-2 py-2 space-y-1 text-sm">
        {/* Página Inicial */}
        <Link
          href="/"
          className="hover:bg-gray-700 flex items-center gap-3 px-3 py-2 rounded transition-colors"
        >
          <Home size={16} />
          {!collapsed && "Página Inicial"}
        </Link>

        {/* Seções com submenu */}
        {sections.map((section) => (
          <div key={section.key}>
            <button
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-700 rounded transition-colors"
              onClick={() => handleToggle(section.key)}
              aria-expanded={activeSection === section.key}
            >
              <span className="flex items-center gap-3">
                <section.icon size={16} />
                {!collapsed && section.label}
              </span>
              {!collapsed &&
                (activeSection === section.key ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                ))}
            </button>

            {/* Sub-itens com transição suave */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                activeSection === section.key && !collapsed
                  ? "max-h-40 opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="ml-7 mt-1 flex flex-col space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:bg-gray-700 px-3 py-1 rounded transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
