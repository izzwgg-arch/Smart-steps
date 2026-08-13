/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Explicitly expose server-side env vars to Edge Runtime (middleware).
  // Next.js 14 Edge Runtime does not read .env at runtime, so these must
  // be inlined at build time.
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    APP_URL: process.env.APP_URL,
  },
}

module.exports = nextConfig
