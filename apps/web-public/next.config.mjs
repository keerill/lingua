import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The monorepo root: standalone output must trace pnpm-linked deps from here.
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image; `next dev`
  // is unaffected.
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  // Allow importing the shared @lingua/contracts TypeScript sources, which live
  // outside this app's directory in the Nx workspace.
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
