import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações para melhorar performance e evitar timeouts
  serverExternalPackages: ['prisma', '@floating-ui/react', '@floating-ui/dom', 'flowbite-react'],
  
  // Desabilitar ESLint durante o build para produção
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignorar erros de TypeScript durante o build para não travar a pipeline
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Configurações de headers para evitar timeout
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Connection',
            value: 'keep-alive',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/sla/relatorio/concluidos', destination: '/sla/relatorio?tab=dias&hideTabs=true' },
      { source: '/sla/relatorio/todos', destination: '/sla/relatorio?tab=dias_all&hideTabs=true' },
      // Legado: manter acesso por "completo" apontando para a visão todos
      { source: '/sla/relatorio/completo', destination: '/sla/relatorio?tab=dias_all&hideTabs=true' },
    ];
  },
  async redirects() {
    return [
      {
        source: '/sla/relatorio/completo',
        destination: '/sla/relatorio/todos',
        permanent: true,
      },
    ];
  },
  webpack(config, { dev, isServer }) {
    // For Docker on Windows, enable polling so file changes are detected reliably
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        poll: 3000,
        aggregateTimeout: 600,
        ignored: /node_modules/,
      };
    }
    // Mantém a configuração padrão de saída de chunks do lado do servidor para evitar inconsistências no runtime
    if (isServer) {
      config.output = {
        ...config.output,
      };
    }
    return config;
  },
};

export default nextConfig;
