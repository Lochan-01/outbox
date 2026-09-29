/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const targetBackend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${targetBackend}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
