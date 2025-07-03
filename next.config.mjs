import withPWA from "next-pwa"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add other Next.js configurations here if needed
}

export default withPWA({
  dest: "public", // Service worker will be generated in the public directory
  register: true, // Register the service worker
  skipWaiting: true, // Activate the new service worker as soon as it's ready
  disable: process.env.NODE_ENV === "development", // Disable PWA in development mode
})(nextConfig)
