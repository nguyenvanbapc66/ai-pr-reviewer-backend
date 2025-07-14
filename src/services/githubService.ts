import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import type { GitHubCommentType, GitHubReviewRequestType, GitHubAppConfigType } from '../types';

export class GitHubService {
  private config: GitHubAppConfigType;

  constructor(config: GitHubAppConfigType) {
    this.config = config;
  }

  private createAppOctokit() {
    return new Octokit({ auth: `Bearer ${this.generateJWT()}` });
  }

  // Generate JWT for GitHub App authentication
  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now,
      exp: now + 600, // 10 minutes
      iss: this.config.appId,
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createSign('RSA-SHA256').update(data).sign(this.config.privateKey, 'base64url');
    return `${data}.${signature}`;
  }

  // Verify GitHub webhook signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = `sha256=${crypto.createHmac('sha256', this.config.webhookSecret).update(payload).digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  // Get installation access token
  private async getInstallationToken(installationId: number): Promise<string> {
    try {
      const octokit = this.createAppOctokit();
      const response = await octokit.rest.apps.createInstallationAccessToken({ installation_id: installationId });
      return response.data.token;
    } catch (error) {
      console.error('Error getting installation token:', error);
      throw new Error('Failed to get installation access token');
    }
  }

  // Create Octokit instance with installation token
  private async createInstallationOctokit(installationId: number): Promise<Octokit> {
    const token = await this.getInstallationToken(installationId);
    return new Octokit({ auth: token });
  }

  // Fetch PR diff
  async getPRDiff(owner: string, repo: string, pullNumber: number, installationId: number): Promise<string> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
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
  async getPRDetails(owner: string, repo: string, pullNumber: number, installationId: number): Promise<any> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      const response = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
      return response.data;
    } catch (error) {
      console.error('Error fetching PR details:', error);
      throw new Error(`Failed to fetch PR details: ${error}`);
    }
  }

  // Post review comments to GitHub
  async postReviewComments(reviewRequest: GitHubReviewRequestType, installationId: number): Promise<any> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
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
  async postPRComments(
    owner: string,
    repo: string,
    pullNumber: number,
    comments: GitHubCommentType[],
    installationId: number,
  ): Promise<any[]> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
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
  async hasBotReviewed(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number,
    botUsername: string,
  ): Promise<boolean> {
    try {
      const octokit = await this.createInstallationOctokit(installationId);
      const response = await octokit.rest.pulls.listReviews({ owner, repo, pull_number: pullNumber });
      const botReviews = response.data.filter((review) => review.user?.login === botUsername);
      return botReviews.length > 0;
    } catch (error) {
      console.error('Error checking bot reviews:', error);
      return false;
    }
  }

  // Get repository installation ID
  async getRepositoryInstallation(owner: string, repo: string): Promise<number | null> {
    try {
      const octokit = this.createAppOctokit();
      const response = await octokit.rest.apps.getRepoInstallation({ owner, repo });
      return response.data.id;
    } catch (error) {
      console.error('Error getting repository installation:', error);
      return null;
    }
  }
}
