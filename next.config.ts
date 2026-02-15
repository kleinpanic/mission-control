import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React strict mode to prevent WebSocket double-mount issues in development
  reactStrictMode: false,
};

export default nextConfig;
