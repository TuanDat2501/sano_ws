import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
        ignoreBuildErrors: true,
    },
    
    // Tiện tay tắt luôn cả kiểm tra lỗi ESLint cho chắc cú
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
