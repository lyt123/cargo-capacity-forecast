/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/cargo',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
}

export default nextConfig
