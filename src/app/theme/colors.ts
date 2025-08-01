// Paleta de cores do projeto

export const colors = {
  // Cores primárias
  primary: {
    50: '#F8FAFC',  // slate-50
    100: '#F1F5F9', // slate-100
    200: '#E2E8F0', // slate-200
    300: '#CBD5E1', // slate-300
    400: '#94A3B8', // slate-400
    500: '#64748B', // slate-500
    600: '#475569', // slate-600
    700: '#334155', // slate-700
    800: '#1E293B', // slate-800
    900: '#0F172A', // slate-900
    950: '#020617', // slate-950
  },
  
  // Cores de destaque
  accent: {
    50: '#F0F9FF',  // sky-50
    100: '#E0F2FE', // sky-100
    200: '#BAE6FD', // sky-200
    300: '#7DD3FC', // sky-300
    400: '#38BDF8', // sky-400
    500: '#0EA5E9', // sky-500
    600: '#0284C7', // sky-600
    700: '#0369A1', // sky-700
    800: '#075985', // sky-800
    900: '#0C4A6E', // sky-900
    950: '#082F49', // sky-950
  },
  
  // Cores neutras
  neutral: {
    50: '#F9FAFB',  // gray-50
    100: '#F3F4F6', // gray-100
    200: '#E5E7EB', // gray-200
    300: '#D1D5DB', // gray-300
    400: '#9CA3AF', // gray-400
    500: '#6B7280', // gray-500
    600: '#4B5563', // gray-600
    700: '#374151', // gray-700
    800: '#1F2937', // gray-800
    900: '#111827', // gray-900
    950: '#030712', // gray-950
  },
  
  // Cores de estado
  state: {
    success: {
      light: '#D1FAE5', // green-100
      main: '#10B981',  // green-500
      dark: '#065F46',  // green-800
    },
    error: {
      light: '#FEE2E2', // red-100
      main: '#EF4444',  // red-500
      dark: '#991B1B',  // red-800
    },
    warning: {
      light: '#FEF3C7', // yellow-100
      main: '#F59E0B',  // amber-500
      dark: '#92400E',  // amber-800
    },
    info: {
      light: '#E0E7FF', // indigo-100
      main: '#6366F1',  // indigo-500
      dark: '#3730A3',  // indigo-800
    },
  },
};

// Exporta funções de utilidade para acessar cores
export const getColor = (colorPath: string): string => {
  const parts = colorPath.split('.');
  let result: any = colors;
  
  for (const part of parts) {
    if (result[part] === undefined) {
      console.warn(`Color path ${colorPath} not found`);
      return '#000000';
    }
    result = result[part];
  }
  
  return result;
};