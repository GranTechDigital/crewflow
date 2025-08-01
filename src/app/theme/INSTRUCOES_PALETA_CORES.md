# Instruções para Aplicar a Paleta de Cores ao Dashboard

Este documento fornece instruções sobre como aplicar a nova paleta de cores ao dashboard de funcionários.

## Paleta de Cores

A nova paleta de cores está definida no arquivo `src/app/theme/colors.ts` e inclui:

- **Cores Primárias**: Slate (tons de cinza azulado)
- **Cores de Destaque**: Sky (tons de azul)
- **Cores Neutras**: Gray (tons de cinza)
- **Cores de Estado**: 
  - Success: Green (verde)
  - Error: Red (vermelho)
  - Warning: Amber (âmbar)
  - Info: Indigo (índigo)

## Como Aplicar as Cores

Um exemplo de como aplicar as cores está disponível em `src/app/theme/dashboard-colors-example.tsx`.

### 1. Atualizar os Cards

Substitua as cores dos cards no arquivo `src/app/prestserv/funcionarios/page.tsx`:

```tsx
// Card de Total de Solicitações
<div className="p-2 bg-slate-100 rounded-md">
  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    ...
  </svg>
</div>

// Card de Total de Funcionários
<div className="p-2 bg-sky-100 rounded-md">
  <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    ...
  </svg>
</div>

// Card de Funcionários Pendentes
<div className="p-2 bg-slate-100 rounded-md">
  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    ...
  </svg>
</div>

// Card de Funcionários Aptos
<div className="p-2 bg-sky-100 rounded-md">
  <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    ...
  </svg>
</div>

// Card de Funcionários Rejeitados
<div className="p-2 bg-slate-100 rounded-md">
  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    ...
  </svg>
</div>
```

### 2. Atualizar os Gráficos

#### Gráfico de Status das Tarefas (Doughnut)

```tsx
backgroundColor: [
  '#94A3B8', // slate-400
  '#0EA5E9', // sky-500
  '#64748B', // slate-500
  '#475569', // slate-600
  '#0284C7', // sky-600
],
hoverBackgroundColor: [
  '#64748B', // slate-500
  '#0284C7', // sky-600
  '#475569', // slate-600
  '#334155', // slate-700
  '#0369A1', // sky-700
],
```

#### Gráfico de Status do Prestserv (Bar)

```tsx
backgroundColor: [
  'rgba(14, 165, 233, 0.7)', // sky-500
  'rgba(100, 116, 139, 0.7)', // slate-500
  'rgba(148, 163, 184, 0.7)', // slate-400
  'rgba(71, 85, 105, 0.7)',   // slate-600
  'rgba(2, 132, 199, 0.7)',   // sky-600
],
borderColor: [
  '#0EA5E9', // sky-500
  '#64748B', // slate-500
  '#94A3B8', // slate-400
  '#475569', // slate-600
  '#0284C7', // sky-600
],
```

#### Gráfico de Funcionários por Responsável (Bar)

```tsx
backgroundColor: [
  'rgba(14, 165, 233, 0.7)',  // sky-500 (Logística)
  'rgba(16, 185, 129, 0.7)',  // green-500 (Setores)
  'rgba(245, 158, 11, 0.7)',  // amber-500 (Outros)
],
borderColor: [
  '#0EA5E9', // sky-500
  '#10B981', // green-500
  '#F59E0B', // amber-500
],
```

#### Gráfico de Tendências Mensais (Line)

```tsx
borderColor: '#0EA5E9', // sky-500
backgroundColor: 'rgba(14, 165, 233, 0.05)',
pointBackgroundColor: '#0EA5E9', // sky-500
```

### 3. Atualizar os Elementos de UI

#### Botões

```tsx
// Botão primário
className="inline-flex items-center px-4 py-2 text-sm font-bold text-white bg-sky-500 border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 shadow-sm transition-colors"

// Botão secundário
className="mt-4 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"

// Botão neutro
className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 shadow-sm transition-colors"
```

#### Textos

```tsx
// Título
className="text-2xl font-bold text-slate-900"

// Subtítulo
className="text-lg font-medium text-slate-700"

// Texto de corpo
className="text-sm text-slate-600"

// Texto secundário
className="text-sm text-slate-500"

// Texto terciário
className="text-xs text-slate-400"
```

#### Filtros e Tags

```tsx
// Tag de filtro
className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800"

// Ícone de filtro
className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400"

// Input de filtro
className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
```

## Importância da Consistência

Ao aplicar a nova paleta de cores, mantenha a consistência em todo o dashboard:

1. Use `slate` para elementos neutros e estruturais
2. Use `sky` para elementos de destaque e ações principais
3. Use as cores de estado (verde, vermelho, âmbar) apenas para indicar status
4. Mantenha o contraste adequado para garantir a acessibilidade

## Próximos Passos

1. Importe o arquivo de cores no componente do dashboard
2. Substitua as cores conforme as instruções acima
3. Teste o dashboard para garantir que as cores estão sendo aplicadas corretamente
4. Ajuste conforme necessário para manter a consistência visual