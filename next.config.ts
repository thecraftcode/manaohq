import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // --- AKTIFKAN MODE STANDALONE ---
  output: 'standalone',
  distDir: '.build',

  // Konfigurasi bawaan lo
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;