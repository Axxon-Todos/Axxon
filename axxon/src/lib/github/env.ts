// Resolves the GitHub integration environment settings and canonical callback/setup URLs.
const GITHUB_API_BASE_URL = 'https://api.github.com';
const GITHUB_OAUTH_BASE_URL = 'https://github.com';

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getGitHubApiBaseUrl() {
  return GITHUB_API_BASE_URL;
}

export function getGitHubOauthBaseUrl() {
  return GITHUB_OAUTH_BASE_URL;
}

export function getGitHubAppId() {
  return requireEnv('GITHUB_APP_ID');
}

export function getGitHubAppClientId() {
  return requireEnv('GITHUB_APP_CLIENT_ID');
}

export function getGitHubAppClientSecret() {
  return requireEnv('GITHUB_APP_CLIENT_SECRET');
}

export function getGitHubAppPrivateKey() {
  return requireEnv('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
}

export function getGitHubWebhookSecret() {
  return requireEnv('GITHUB_WEBHOOK_SECRET');
}

export function getAppBaseUrl() {
  return trimTrailingSlash(requireEnv('APP_BASE_URL'));
}

export function getGitHubCallbackUrl() {
  return `${getAppBaseUrl()}/api/integrations/github/callback`;
}

export function getGitHubSetupBridgeUrl() {
  return `${getAppBaseUrl()}/dashboard/integrations/github/setup`;
}
