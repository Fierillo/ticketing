/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  env: {
    NEXT_SIGNER_PRIVATE_KEY: process.env.SIGNER_PRIVATE_KEY,
    NEXT_ADMIN_PUBLIC_KEY: process.env.ADMIN_PUBLIC_KEY,
    NEXT_POS_WALIAS: process.env.POS_WALIAS,
    NEXT_TICKET_PRICE_ARS: process.env.TICKET_PRICE_ARS,
    NEXT_SENDY_API_URL: process.env.SENDY_API_URL,
    NEXT_SENDY_API_KEY: process.env.SENDY_API_KEY,
    NEXT_SENDY_LIST_ID: process.env.SENDY_LIST_ID,
    NEXT_AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    NEXT_AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    NEXT_DISCOUNT_CODES: process.env.DISCOUNT_CODES,
    NEXT_MAX_TICKETS: process.env.MAX_TICKETS,
    NEXT_PUBLIC_TICKET: process.env.NEXT_PUBLIC_TICKET,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

const configWithSentry = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: false,
  telemetry: false,
});

export default configWithSentry;
