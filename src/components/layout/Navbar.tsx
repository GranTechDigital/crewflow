"use client";

import { Settings } from "lucide-react";
import { Menu } from "@headlessui/react";
import Link from "next/link";

export default function Navbar() {
  return (
    <div className="absolute top-4 right-4 z-20">
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button
          aria-label="Abrir menu de configurações"
          className="p-2 bg-gray-800 border border-black rounded-full hover:bg-gray-700 transition"
        >
          <Settings size={20} className="text-white" />
        </Menu.Button>

        <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right rounded-md bg-white border border-black shadow-md z-50">
          <div className="px-1 py-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  href="/perfil"
                  className={`${
                    active ? "bg-gray-100" : ""
                  } group flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-800`}
                >
                  Perfil
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => alert("Logoff")} // Substitua pela lógica real
                  className={`${
                    active ? "bg-gray-100" : ""
                  } group flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-800`}
                >
                  Logoff
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Menu>
    </div>
  );
}
