import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React strict mode to prevent WebSocket double-mount issues in development
  reactStrictMode: false,

  // Allow dev HMR from LAN machines (prevents 500 errors on remote dev access)
  allowedDevOrigins: [
    'http://10.0.0.27:3333',
    'http://10.0.0.27',
    'http://broklein.local:3333',
    'http://broklein.local',
  ],
};

export default nextConfig;
