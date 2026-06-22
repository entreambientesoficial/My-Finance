/** @type {import('next').NextConfig} */
const nextConfig = {
  // Modo standalone: gera bundle otimizado para Docker/Railway
  // Para Cloudflare Pages: o build command usa npx @cloudflare/next-on-pages
  output: process.env.NEXT_OUTPUT_MODE === 'standalone' ? 'standalone' : undefined,

  async rewrites() {
    // Rewrite apenas em desenvolvimento local
    // Em produção (Cloudflare Pages), o frontend chama NEXT_PUBLIC_API_URL diretamente
    return process.env.NODE_ENV === 'production'
      ? []
      : [
          {
            source: '/api/backend/:path*',
            destination: `${process.env.BACKEND_URL || 'http://localhost:3001'}/:path*`,
          },
        ];
  },

  // Permite imagens externas (Supabase Storage CDN)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
