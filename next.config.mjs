/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'pino'],
    instrumentationHook: true,
    staleTimes: { dynamic: 0, static: 0 },
  },
  images: {
    // Next's built-in optimizer (`/_next/image`, requires `sharp` in standalone
    // mode) only recognizes files present under `public/` at process boot —
    // anything written there afterwards (every real upload, since `uploads/`
    // is a runtime-mounted volume, not a build-time asset) 400s until the next
    // restart. Disabling optimization makes every `<Image>` render a plain
    // `<img src>` instead, sidestepping that limitation entirely — see AD-14
    // in deploy/AGENTS.md for the full story.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'googleusercontent.com',
      }
    ],
  },
  reactStrictMode: true,
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://drive.google.com https://lh3.googleusercontent.com https://googleusercontent.com",
      "font-src 'self' data:",
      `connect-src 'self'${isDev ? ' ws:' : ''} https://challenges.cloudflare.com`,
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;

