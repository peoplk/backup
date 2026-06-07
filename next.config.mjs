/** @type {import('next').NextConfig} */
const isCapacitor = process.env.BUILD_MODE === 'capacitor'
const isTauri = process.env.BUILD_MODE === 'tauri'
const isStatic = isCapacitor || isTauri

const nextConfig = {
  output: isStatic ? 'export' : 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: false,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  trailingSlash: isStatic,
  assetPrefix: isStatic ? '.' : undefined,
  distDir: isCapacitor ? 'out' : '.next',
  env: {
    NEXT_PUBLIC_IS_CAPACITOR: isCapacitor ? 'true' : '',
  },
}

export default nextConfig
