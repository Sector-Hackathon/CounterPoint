import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/**
 * With API_PROXY_TARGET set (the deployed API's URL), /api/* is forwarded to it, so the browser
 * talks to one site and the login cookie is first-party. Pair it with NEXT_PUBLIC_API_URL=/api.
 */
const proxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  async rewrites() {
    return proxyTarget ? [{ source: '/api/:path*', destination: `${proxyTarget}/:path*` }] : [];
  },
});

export default nextConfig;
