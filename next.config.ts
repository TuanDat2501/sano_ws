import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
module.exports = {
  allowedDevOrigins: ['postfebrile-nonabortively-lani.ngrok-free.dev'],
}