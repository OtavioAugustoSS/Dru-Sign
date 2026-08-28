import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O Next 16 gera AGENTS.md/CLAUDE.md na raiz em `next dev`; o repo controla isso a mao.
  agentRules: false,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', '@node-rs/argon2'],
}

export default nextConfig
