import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações para melhorar performance e evitar timeouts
  serverExternalPackages: ['prisma'],
  
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
};

export default nextConfig;
