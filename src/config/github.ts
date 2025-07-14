import type { GitHubAppConfigType } from '../types';

export function getGitHubConfig(): GitHubAppConfigType {
  const config = {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };

  // For development/testing, return mock config if GitHub config is not available
  if (!config.appId || !config.privateKey || !config.webhookSecret) {
    console.warn('GitHub config not found, using mock config');
    return getMockGitHubConfig();
  }

  return config as GitHubAppConfigType;
}

// For development/testing without GitHub App
export function getMockGitHubConfig(): GitHubAppConfigType {
  return {
    appId: 'mock-app-id',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMOCK_KEY\n-----END RSA PRIVATE KEY-----',
    webhookSecret: 'mock-webhook-secret',
    clientId: 'mock-client-id',
    clientSecret: 'mock-client-secret',
  };
}
