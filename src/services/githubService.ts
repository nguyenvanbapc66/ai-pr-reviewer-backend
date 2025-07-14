import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import type { GitHubCommentType, GitHubReviewRequestType, GitHubAppConfigType } from '../types';

// Helper to create a new Octokit instance with a JWT
const createAppOctokit = (config: GitHubAppConfigType) => new Octokit({ auth: `Bearer ${generateJWT(config)}` });

// Generate JWT for GitHub App authentication
export function generateJWT(config: GitHubAppConfigType): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 600, // 10 minutes
    iss: config.appId,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createSign('RSA-SHA256').update(data).sign(config.privateKey, 'base64url');
  return `${data}.${signature}`;
}

// Verify GitHub webhook signature
export function verifyWebhookSignature(payload: string, signature: string, config: GitHubAppConfigType): boolean {
  const expectedSignature = `sha256=${crypto.createHmac('sha256', config.webhookSecret).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Get installation access token
export async function getInstallationToken(installationId: number, config: GitHubAppConfigType): Promise<string> {
  try {
    const octokit = createAppOctokit(config);
    const response = await octokit.rest.apps.createInstallationAccessToken({ installation_id: installationId });
    return response.data.token;
  } catch (error) {
    console.error('Error getting installation token:', error);
    throw new Error('Failed to get installation access token');
  }
}

// Create Octokit instance with installation token
export async function createInstallationOctokit(installationId: number, config: GitHubAppConfigType): Promise<Octokit> {
  const token = await getInstallationToken(installationId, config);
  return new Octokit({ auth: token });
}

// Fetch PR diff
export async function getPRDiff(
  owner: string,
  repo: string,
  pullNumber: number,
  installationId: number,
  config: GitHubAppConfigType,
): Promise<string> {
  try {
    const octokit = await createInstallationOctokit(installationId, config);
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      mediaType: { format: 'diff' },
    });
    return response.data as unknown as string;
  } catch (error) {
    console.error('Error fetching PR diff:', error);
    throw new Error(`Failed to fetch PR diff: ${error}`);
  }
}

// Get PR details
export async function getPRDetails(
  owner: string,
  repo: string,
  pullNumber: number,
  installationId: number,
  config: GitHubAppConfigType,
): Promise<any> {
  try {
    const octokit = await createInstallationOctokit(installationId, config);
    const response = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
    return response.data;
  } catch (error) {
    console.error('Error fetching PR details:', error);
    throw new Error(`Failed to fetch PR details: ${error}`);
  }
}

// Post review comments to GitHub
export async function postReviewComments(
  reviewRequest: GitHubReviewRequestType,
  installationId: number,
  config: GitHubAppConfigType,
): Promise<any> {
  try {
    const octokit = await createInstallationOctokit(installationId, config);
    const response = await octokit.rest.pulls.createReview({
      owner: reviewRequest.owner,
      repo: reviewRequest.repo,
      pull_number: reviewRequest.pull_number,
      event: reviewRequest.event || 'COMMENT',
      body: reviewRequest.body || 'AI Code Review',
      comments: reviewRequest.comments || [],
    });
    return response.data;
  } catch (error) {
    console.error('Error posting review comments:', error);
    throw new Error(`Failed to post review comments: ${error}`);
  }
}

// Post individual comments to PR
export async function postPRComments(
  owner: string,
  repo: string,
  pullNumber: number,
  comments: GitHubCommentType[],
  installationId: number,
  config: GitHubAppConfigType,
): Promise<any[]> {
  try {
    const octokit = await createInstallationOctokit(installationId, config);
    const results = [];
    for (const comment of comments) {
      const response = await octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        ...comment,
      });
      results.push(response.data);
    }
    return results;
  } catch (error) {
    console.error('Error posting PR comments:', error);
    throw new Error(`Failed to post PR comments: ${error}`);
  }
}

// Check if bot has already reviewed this PR
export async function hasBotReviewed(
  owner: string,
  repo: string,
  pullNumber: number,
  installationId: number,
  config: GitHubAppConfigType,
  botUsername: string,
): Promise<boolean> {
  try {
    const octokit = await createInstallationOctokit(installationId, config);
    const response = await octokit.rest.pulls.listReviews({ owner, repo, pull_number: pullNumber });
    const botReviews = response.data.filter((review) => review.user?.login === botUsername);
    return botReviews.length > 0;
  } catch (error) {
    console.error('Error checking bot reviews:', error);
    return false;
  }
}

// Get repository installation ID
export async function getRepositoryInstallation(
  owner: string,
  repo: string,
  config: GitHubAppConfigType,
): Promise<number | null> {
  try {
    const octokit = createAppOctokit(config);
    const response = await octokit.rest.apps.getRepoInstallation({ owner, repo });
    return response.data.id;
  } catch (error) {
    console.error('Error getting repository installation:', error);
    return null;
  }
}
