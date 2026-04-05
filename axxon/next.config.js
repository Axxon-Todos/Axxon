const { withSentryConfig } = require("@sentry/nextjs");

function normalizeOrigin(origin) {
  return origin.replace(/\/$/, '');
}

function parseEnvOrigins(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return normalizeOrigin(new URL(entry).origin);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function toSocketOrigin(origin) {
  try {
    const url = new URL(origin);

    if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    }

    return normalizeOrigin(url.origin);
  } catch {
    return null;
  }
}

function buildConnectSrc() {
  const connectOrigins = new Set(["'self'"]);
  const configuredOrigins = [
    ...parseEnvOrigins(process.env.CLIENT_URL),
    ...parseEnvOrigins(process.env.NEXT_PUBLIC_HOSTNAME),
    ...parseEnvOrigins(process.env.NEXT_PUBLIC_WS_URL),
  ];

  for (const origin of configuredOrigins) {
    connectOrigins.add(origin);
    const socketOrigin = toSocketOrigin(origin);

    if (socketOrigin) {
      connectOrigins.add(socketOrigin);
    }
  }

  connectOrigins.add('https://accounts.google.com');
  connectOrigins.add('https://www.googleapis.com');
  connectOrigins.add('https://browser.sentry-cdn.com');
  connectOrigins.add('https://js.sentry-cdn.com');

  return Array.from(connectOrigins);
}

function buildContentSecurityPolicy() {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://accounts.google.com',
    'https://browser.sentry-cdn.com',
    'https://js.sentry-cdn.com',
    'https://www.gstatic.com',
  ];

  if (process.env.NODE_ENV !== 'production') {
    scriptSrc.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${buildConnectSrc().join(' ')}`,
    "frame-src https://accounts.google.com",
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy(),
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=()',
  },
];

const nextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      oracledb: false, // keep existing fallback
    };

    if (!isServer) {
      // Prevent client-side bundle from trying to include Knex
      config.externals = config.externals || [];
      config.externals.push('knex');
    }

    return config;
  },
};

// Wrap with Sentry and export only once
module.exports = withSentryConfig(nextConfig, {
  org: "nanibro",
  project: "axxon",
  silent: !process.env.CI,
  disableLogger: true,
});
