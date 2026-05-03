import type {NextConfig} from 'next';

// Build info: generate at build time
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || process.env.GIT_COMMIT_SHA?.slice(0, 7)
  || new Date().toISOString().slice(0, 10).replace(/-/g, '');
const buildDate = new Date().toISOString();

const nextConfig: NextConfig = {
  /* config options here */
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/core',
    '@genkit-ai/googleai',
    '@genkit-ai/next',
    '@opentelemetry/instrumentation',
    '@opentelemetry/sdk-node',
    'dotprompt',
    'handlebars',
  ],
  env: {
    // Exposed to client as NEXT_PUBLIC_ equivalent via env object
    BUILD_ID: buildId,
    BUILD_DATE: buildDate,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
