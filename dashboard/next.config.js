/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8000/auth/:path*',
      },
      {
        source: '/route/:path*',
        destination: 'http://localhost:8000/route/:path*',
      },
      {
        source: '/dashboard/:path*',
        destination: 'http://localhost:8000/dashboard/:path*',
      },
    ]
  },
}

module.exports = nextConfig