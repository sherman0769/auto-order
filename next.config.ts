/** @type {import('next').NextConfig} */
const nextConfig = {
  // ❶ build 時不要因 ESLint error 中斷
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ❷ build 時不要因 TypeScript error 中斷
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
