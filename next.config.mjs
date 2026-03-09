/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/cargo',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // 防止部署后浏览器缓存旧 HTML 导致 ChunkLoadError（chunk 带 hash 可长期缓存）
  async headers() {
    return [
      {
        source: '/cargo/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/cargo/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
