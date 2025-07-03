/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        "pino-pretty": false,
      }
    }
    return config
  },
  // Enable HTTPS in development
  ...(process.env.HTTPS === 'true' && {
    server: {
      https: {
        key: './.next-ssl/key.pem',
        cert: './.next-ssl/cert.pem',
      },
    },
  }),
}

export default nextConfig