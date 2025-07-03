'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Boxes,
  Stethoscope,
  Users,
  GraduationCap,
  Settings,
  ArrowRight,
} from 'lucide-react';

interface SetorCard {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  links: {
    label: string;
    href: string;
  }[];
}

const setores: SetorCard[] = [
  {
    key: 'configuracao',
    title: 'Configuração',
    description: 'Configurações gerais do sistema, sincronização de funcionários e criação de contratos.',
    icon: Settings,
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200 hover:border-gray-300',
    links: [
      { label: 'Sincronizar Lista de Funcionários', href: '/funcionarios' },
      { label: 'Criar Contratos', href: '/planejamento/contratos' },
    ],
  },
  {
    key: 'planejamento',
    title: 'Planejamento',
    description: 'Dashboard, solicitações de remanejamento e visualização de funcionários por contrato.',
    icon: LayoutDashboard,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200 hover:border-blue-300',
    links: [
      { label: 'Dashboard', href: '/prestserv/dashboard' },
      { label: 'Minhas Solicitações de Remanejamento', href: '/prestserv/remanejamentos/tabela' },
      { label: 'Solicitar Remanejamento/Alocação', href: '/prestserv/remanejamentos/novo' },
      { label: 'Funcionários por Contrato (Prestserv)', href: '/prestserv/funcionarios-por-contrato' },
      { label: 'Funcionários por Centro de Custo (Folha)', href: '/planejamento/funcionarios' },
    ],
  },
  {
    key: 'cadastro-prestserv',
    title: 'Cadastro Prestserv',
    description: 'Gestão de funcionários em processo de remanejamento e criação de tarefas para setores.',
    icon: Boxes,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200 hover:border-green-300',
    links: [
      { label: 'Dashboard', href: '/prestserv/dashboard' },
      { label: 'Solicitações de Remanejamento', href: '/prestserv/remanejamentos/tabela' },
      { label: 'Funcionários em Processo', href: '/prestserv/funcionarios' },
      { label: 'Funcionários por Centro de Custo', href: '/prestserv/funcionarios-por-contrato' },
      { label: 'Criar Tarefas para os Setores', href: '/prestserv/tarefas' },
    ],
  },
  {
    key: 'medicina',
    title: 'Medicina',
    description: 'Gestão de tarefas médicas e de segurança do trabalho.',
    icon: Stethoscope,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200 hover:border-red-300',
    links: [
      { label: 'Minhas Tarefas', href: '/tarefas/medicina' },
    ],
  },
  {
    key: 'rh',
    title: 'Recursos Humanos',
    description: 'Gestão de tarefas relacionadas aos recursos humanos.',
    icon: Users,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200 hover:border-purple-300',
    links: [
      { label: 'Minhas Tarefas', href: '/tarefas/rh' },
    ],
  },
  {
    key: 'treinamento',
    title: 'Treinamento',
    description: 'Gestão de tarefas relacionadas ao treinamento e capacitação.',
    icon: GraduationCap,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200 hover:border-orange-300',
    links: [
      { label: 'Minhas Tarefas', href: '/tarefas/treinamento' },
    ],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">Gran System</h1>
            {/* <p className="mt-2 text-gray-600">
              Sistema de gestão integrada para recursos humanos e operações
            </p> */}
          </div>
        </div>
      </div>

      {/* Cards dos Setores */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {setores.map((setor) => {
            const IconComponent = setor.icon;
            return (
              <div
                key={setor.key}
                className={`bg-white rounded-lg shadow-sm border-2 ${setor.borderColor} transition-all duration-200 hover:shadow-md`}
              >
                {/* Header do Card */}
                <div className={`${setor.bgColor} px-6 py-4 rounded-t-lg border-b border-gray-200`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                      <IconComponent size={24} className={setor.color} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${setor.color}`}>
                        {setor.title}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    {setor.description}
                  </p>
                </div>

                {/* Links do Card */}
                <div className="px-6 py-4">
                  <div className="space-y-2">
                    {setor.links.map((link, index) => (
                      <Link
                        key={index}
                        href={link.href}
                        className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">
                          {link.label}
                        </span>
                        <ArrowRight 
                          size={16} 
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
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>© 2024 Gran System. Sistema de gestão integrada.</p>
          </div>
        </div>
      </div>
    </div>
  );
}