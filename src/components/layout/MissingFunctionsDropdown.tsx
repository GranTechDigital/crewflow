"use client";

import { useState, useEffect, Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MissingFunctionsDropdown() {
  const [missingFunctions, setMissingFunctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMissingFunctions = async () => {
    try {
      const response = await fetch("/api/notificacoes");
      if (response.ok) {
        const data = await response.json();
        setMissingFunctions(data.missingFunctions || []);
      }
    } catch (error) {
      console.error("Erro ao buscar funções faltantes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissingFunctions();
    const interval = setInterval(fetchMissingFunctions, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, []);

  if (missingFunctions.length === 0 && !loading) return null;

  return (
    <Menu as="div" className="relative inline-block text-left mr-2">
      {({ open }) => (
        <>
          <Menu.Button
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-600 transition-colors relative text-yellow-500 hover:text-yellow-400"
            aria-label="Funções Faltantes"
          >
            <AlertTriangle size={20} />
            {missingFunctions.length > 0 && (
              <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-yellow-500 ring-2 ring-gray-800" />
            )}
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-96 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-[80vh] overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-yellow-50">
                <p className="text-sm font-bold text-yellow-800 flex items-center">
                  <AlertTriangle size={16} className="mr-2" />
                  Funções Não Cadastradas
                </p>
                <button
                  onClick={fetchMissingFunctions}
                  className="text-xs text-yellow-700 hover:underline"
                >
                  Atualizar
                </button>
              </div>

              <div className="py-1">
                {loading ? (
                  <div className="px-4 py-4 text-center text-sm text-gray-500">
                    Carregando...
                  </div>
                ) : missingFunctions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 flex flex-col items-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                    <p>Todas as funções cadastradas!</p>
                  </div>
                ) : (
                  <>
                    {missingFunctions.map((item: any, idx: number) => (
                      <Menu.Item key={`missing-${idx}`}>
                        {({ active }) => (
                          <Link
                            href="/funcoes"
                            className={`${
                              active ? "bg-yellow-50" : ""
                            } block px-4 py-3 border-b border-gray-100 last:border-0 transition-colors`}
                          >
                            <div className="flex items-start">
                              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {item.funcao}
                                </p>
                                <p className="text-xs text-gray-700 mt-0.5">
                                  <span className="font-semibold">CC:</span>{" "}
                                  {item.centroCusto || "N/A"}
                                </p>
                                <p className="text-xs text-yellow-600 font-bold mt-1 uppercase">
                                  Cadastrar na Matriz ({item.quantidade}{" "}
                                  func.)
                                </p>
                              </div>
                            </div>
                          </Link>
                        )}
                      </Menu.Item>
                    ))}
                  </>
                )}
              </div>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}
