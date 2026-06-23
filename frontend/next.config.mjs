/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Força HTTPS por 2 anos (só activado em produção via HSTS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Impede que a página seja carregada em iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Desabilita sniffing de MIME type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Envia apenas origem no Referer (sem path)
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Desabilita funcionalidades sensíveis não utilizadas
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // CSP: permite self + Google Fonts + brapi.dev (cotações) + supabase (storage)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval necessário para Next.js dev
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co https://brapi.dev",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  // Permite imagens externas do Supabase Storage CDN
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
