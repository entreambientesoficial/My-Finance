/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
