// Exemplo de como aplicar a paleta de cores no dashboard

import { colors } from './colors';

// Exemplo de uso das cores nos gráficos
export const chartColors = {
  // Cores para o gráfico de Status das Tarefas (Doughnut)
  statusTarefas: {
    backgroundColor: [
      colors.primary[400], // slate-400
      colors.accent[500],  // sky-500
      colors.primary[500], // slate-500
      colors.primary[600], // slate-600
      colors.accent[600],  // sky-600
    ],
    hoverBackgroundColor: [
      colors.primary[500], // slate-500
      colors.accent[600],  // sky-600
      colors.primary[600], // slate-600
      colors.primary[700], // slate-700
      colors.accent[700],  // sky-700
    ],
  },
  
  // Cores para o gráfico de Status do Prestserv (Bar)
  statusPrestserv: {
    backgroundColor: [
      `rgba(14, 165, 233, 0.7)`, // sky-500
      `rgba(100, 116, 139, 0.7)`, // slate-500
      `rgba(148, 163, 184, 0.7)`, // slate-400
      `rgba(71, 85, 105, 0.7)`,   // slate-600
      `rgba(2, 132, 199, 0.7)`,   // sky-600
    ],
    borderColor: [
      colors.accent[500],  // sky-500
      colors.primary[500], // slate-500
      colors.primary[400], // slate-400
      colors.primary[600], // slate-600
      colors.accent[600],  // sky-600
    ],
  },
  
  // Cores para o gráfico de Funcionários por Responsável (Bar)
  funcionariosResponsavel: {
    backgroundColor: [
      `rgba(14, 165, 233, 0.7)`,  // sky-500 (Logística)
      `rgba(16, 185, 129, 0.7)`,  // green-500 (Setores)
      `rgba(245, 158, 11, 0.7)`,  // amber-500 (Outros)
    ],
    borderColor: [
      colors.accent[500],       // sky-500
      colors.state.success.main, // green-500
      colors.state.warning.main, // amber-500
    ],
  },
  
  // Cores para o gráfico de Tendências Mensais (Line)
  tendenciasMensais: {
    borderColor: colors.accent[500], // sky-500
    backgroundColor: `rgba(14, 165, 233, 0.05)`,
    pointBackgroundColor: colors.accent[500], // sky-500
  },
};

// Exemplo de uso das cores nos cards
export const cardColors = {
  // Card de Total de Solicitações
  totalSolicitacoes: {
    iconBackground: 'bg-sky-100',
    iconColor: 'text-sky-600',
  },
  
  // Card de Total de Funcionários
  totalFuncionarios: {
    iconBackground: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  
  // Card de Funcionários Pendentes
  funcionariosPendentes: {
    iconBackground: 'bg-slate-100',
    iconColor: 'text-slate-600',
  },
  
  // Card de Funcionários Aptos
  funcionariosAptos: {
    iconBackground: 'bg-sky-100',
    iconColor: 'text-sky-600',
  },
  
  // Card de Funcionários Rejeitados
  funcionariosRejeitados: {
    iconBackground: 'bg-slate-100',
    iconColor: 'text-slate-600',
  },
};

// Exemplo de uso das cores nos elementos de UI
export const uiColors = {
  // Cores para os filtros
  filtros: {
    tag: 'bg-slate-100 text-slate-800',
    icon: 'text-slate-400',
    hover: 'hover:bg-slate-50',
    focus: 'focus:ring-slate-400 focus:border-slate-400',
  },
  
  // Cores para os botões
  botoes: {
    primario: 'bg-sky-500 hover:bg-sky-600 focus:ring-sky-500',
    secundario: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500',
    neutro: 'bg-slate-100 hover:bg-slate-200 text-slate-600 focus:ring-slate-300',
  },
  
  // Cores para os textos
  textos: {
    titulo: 'text-slate-900',
    subtitulo: 'text-slate-700',
    corpo: 'text-slate-600',
    secundario: 'text-slate-500',
    terciario: 'text-slate-400',
  },
};