import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // User textbooks and queues are runtime volumes, never deployment assets.
  outputFileTracingExcludes: { "/*": ["./.haneul/**/*", "./.env*"] },
};

export default nextConfig;
