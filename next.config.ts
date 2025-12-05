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
    // Garantir que os chunks do servidor fiquem em /server/chunks para combinar com o runtime
    if (isServer) {
      // Ajusta o template de nomes de chunks do webpack no lado do servidor
      // Isso faz o runtime emitir require para "chunks/<id>.js" em vez de "./<id>.js"
      config.output = {
        ...config.output,
        chunkFilename: dev ? 'chunks/[id].js' : 'chunks/[contenthash].js',
        hotUpdateChunkFilename: 'chunks/[id].hot-update.js',
        hotUpdateMainFilename: 'chunks/[runtime].hot-update.json',
      };
    }
    return config;
  },
};

export default nextConfig;
