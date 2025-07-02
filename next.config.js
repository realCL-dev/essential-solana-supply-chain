/** @type {import('next').NextConfig} */
const nextConfig = {
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