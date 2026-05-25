import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Browser bundle mein node: modules ignore karo
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;