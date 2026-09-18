/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 3 note: wrap this export with next-pwa once the PWA layer is added.
  // const withPWA = require('next-pwa')({ dest: 'public' });
  // module.exports = withPWA(nextConfig);
};

module.exports = nextConfig;
