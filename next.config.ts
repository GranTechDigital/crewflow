import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações para melhorar performance e evitar timeouts
  serverExternalPackages: ['prisma'],
  
  // Desabilitar ESLint durante o build para produção
  eslint: {
    ignoreDuringBuilds: true,
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
  webpack(config, { dev }) {
    // For Docker on Windows, enable polling so file changes are detected reliably
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        poll: 3000, // Reduzido de 1000ms para 3000ms para melhor performance
        aggregateTimeout: 600, // Aumentado para reduzir recompilações frequentes
        ignored: /node_modules/, // Ignorar node_modules para melhor performance
      };
    }
    return config;
  },
};

export default nextConfig;
