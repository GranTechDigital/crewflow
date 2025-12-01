"use client";

import { LogOut, User } from "lucide-react";
import { Menu } from "@headlessui/react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/hooks/useAuth";

export default function Navbar() {
  const { usuario, logout } = useAuth();

  const handleLogout = async () => {
    // console.log('🚪 NAVBAR - Botão de logout clicado');
    try {
      await logout();
      // console.log('🚪 NAVBAR - Logout concluído');
    } catch (error) {
      console.error('🚪 NAVBAR - Erro no logout:', error);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-gray-800 to-gray-700 border-b border-gray-600 h-12 px-4 flex items-center justify-between shadow-lg z-30">
      {/* Logo/Título */}
      <div className="flex items-center">
        <Image
          src="/graservices-360x63-1.png"
          alt="Gran System"
          width={180}
          height={31}
          priority
          className="mr-3"
        />
        {/* <h1 className="text-lg font-bold text-white">Gran System</h1> */}
      </div>

      {/* Informações do usuário */}
      {usuario && (
        <div className="flex items-center gap-3">
          {/* Dados do usuário */}
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {usuario.nome}
            </div>
            <div className="text-xs text-gray-300">
              {usuario.equipe} • {usuario.matricula}
            </div>
          </div>

          {/* Menu dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button
              aria-label="Menu do usuário"
              className="flex items-center justify-center w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-full transition-colors border-2 border-gray-500"
            >
              <User size={16} className="text-white" />
            </Menu.Button>

            <Menu.Items className="absolute right-0 mt-2 w-44 origin-top-right rounded-lg bg-white border border-gray-200 shadow-xl py-1 z-50">
              <Menu.Item>
                {({ active }) => (
                  <Link
                    href="/perfil"
                    className={`${
                      active ? "bg-gray-50" : ""
                    } flex items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors`}
                  >
                    <User size={14} className="mr-2 text-gray-400" />
                    Meu Perfil
                  </Link>
                )}
              </Menu.Item>
              <div className="border-t border-gray-100 my-0.5"></div>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleLogout}
                    className={`${
                      active ? "bg-red-50 text-red-700" : "text-gray-700"
                    } flex items-center w-full px-3 py-1.5 text-sm hover:bg-red-50 hover:text-red-700 transition-colors`}
                  >
                    <LogOut size={14} className="mr-2" />
                    Sair
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
      )}
    </nav>
  );
}
