import { Request, Response } from 'express';
// import {
//   verifyWebhookSignature,
//   hasBotReviewed,
//   getPRDiff,
//   getPRDetails,
//   postReviewComments,
//   getRepositoryInstallation,
//   reviewCodeWithAI,
// } from '../services';
import { GitHubService, reviewCodeWithAI } from '../services';
import type { GitHubWebhookEventType, GitHubCommentType, GitHubAppConfigType } from '../types';
import { getGitHubConfig } from '../config';

const githubService = new GitHubService(getGitHubConfig());
// Handler for GitHub webhook events
export const handleWebhook =
  (config: GitHubAppConfigType, botUsername: string) => async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const payload = JSON.stringify(req.body);

      // Verify webhook signature
      if (!githubService.verifyWebhookSignature(payload, signature)) {
        console.error('Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      console.log(`Received ${event} event`);

      // Handle different event types
      switch (event) {
        case 'pull_request':
          await handlePullRequestEvent(req.body as GitHubWebhookEventType, botUsername, res);
          break;
        case 'pull_request_review':
          await handlePullRequestReviewEvent(req.body as GitHubWebhookEventType);
          break;
        default:
          console.log(`Unhandled event type: ${event}`);
      }

      // Only send 200 if not already sent
      if (!res.headersSent) {
        res.status(200).json({ status: 'ok' });
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// Handle pull request events
export const handlePullRequestEvent = async (
  event: GitHubWebhookEventType,
  botUsername: string,
  res?: Response,
): Promise<void> => {
  const { action, pull_request, repository, installation } = event;

  // Only process opened, synchronize, or reopened PRs
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    console.log(`Skipping PR event with action: ${action}`);
    return;
  }

  if (!installation?.id) {
    console.error('No installation ID found in webhook payload');
    if (res) res.status(400).json({ error: 'No installation ID found in webhook payload' });
    return;
  }

  const { owner, name: repo } = repository;
  const pullNumber = pull_request.number;

  console.log(`Processing PR #${pullNumber} in ${owner.login}/${repo}`);

  try {
    // Check if bot has already reviewed this PR
    const hasReviewed = await githubService.hasBotReviewed(owner.login, repo, pullNumber, installation.id, botUsername);
    if (hasReviewed) {
      console.log(`Bot has already reviewed PR #${pullNumber}`);
      if (res) res.status(200).json({ message: 'Bot has already reviewed this PR' });
      return;
    }

    // Get head SHA from the webhook payload
    const headSha = pull_request.head.sha;

    // Fetch PR diff
    let diff: string;
    try {
      diff = await githubService.getPRDiff(owner.login, repo, pullNumber, installation.id);
    } catch (err: any) {
      console.error(`Error fetching PR diff for #${pullNumber}:`, err);
      if (res) res.status(500).json({ error: 'Failed to fetch PR diff', details: err.message });
      return;
    }
    if (!diff || diff.trim().length === 0) {
      console.log(`No diff found for PR #${pullNumber}`);
      if (res) res.status(404).json({ error: 'No diff found for this PR' });
      return;
    }

    // Process with AI
    let aiResponse;
    try {
      aiResponse = await reviewCodeWithAI({
        diff,
        promptConfig: {
          template: 'professional',
          tone: 'professional',
          focus: 'general',
          detail: 'detailed',
        },
      });
    } catch (err: any) {
      console.error(`AI review failed for PR #${pullNumber}:`, err);
      if (res) res.status(500).json({ error: 'AI review failed', details: err.message });
      return;
    }
    if (!aiResponse.comments || aiResponse.comments.length === 0) {
      console.log(`No AI comments generated for PR #${pullNumber}`);
      if (res) res.status(200).json({ message: 'No AI comments generated for this PR' });
      return;
    }

    // Convert AI comments to GitHub comments
    const githubComments = convertToGitHubComments(aiResponse.comments, diff, headSha);

    // Post review comments
    try {
      await githubService.postReviewComments(
        {
          owner: owner.login,
          repo,
          pull_number: pullNumber,
          event: 'COMMENT',
          body: `🤖 AI Code Review\n\n${aiResponse.comments.length} comments generated.`,
          comments: githubComments,
        },
        installation.id,
      );
      console.log(`Successfully posted ${githubComments.length} comments to PR #${pullNumber}`);
      if (res)
        res.status(200).json({ message: `Successfully posted ${githubComments.length} comments to PR #${pullNumber}` });
    } catch (err: any) {
      console.error(`Error posting review comments for PR #${pullNumber}:`, err);
      if (res) res.status(500).json({ error: 'Failed to post review comments', details: err.message });
    }
  } catch (error: any) {
    console.error(`Error processing PR #${pullNumber}:`, error);
    if (res) res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Handle pull request review events (for future features)
export const handlePullRequestReviewEvent = async (event: GitHubWebhookEventType): Promise<void> => {
  console.log('Pull request review event received:', event.action);
  // Future: Handle review events, respond to comments, etc.
};

// Convert AI review comments to GitHub comment format
export function convertToGitHubComments(aiComments: any[], diff: string, headSha?: string): GitHubCommentType[] {
  const githubComments: GitHubCommentType[] = [];

  // If no comments, return empty array
  if (!aiComments || aiComments.length === 0) {
    return githubComments;
  }

  // For now, let's create general comments without specific line positioning
  // This avoids the complex diff parsing and positioning issues
  for (const comment of aiComments) {
    // Skip comments that are too generic
    if (comment.content && comment.content.trim().length > 0) {
      githubComments.push({
        path: comment.fileName || '', // Use filename if available
        position: 1, // Default position
        body: comment.content,
        commit_id: headSha || '', // Use head SHA if provided
      });
    }
  }

  return githubComments;
}

// Manual trigger for PR review (for testing)
export const manualReview =
  (config: GitHubAppConfigType, botUsername: string) => async (req: Request, res: Response) => {
    try {
      console.log('Manual review request received:', req.body);

      const { owner, repo, pullNumber } = req.body;
      if (!owner || !repo || !pullNumber) {
        console.log('Missing required fields:', { owner, repo, pullNumber });
        res.status(400).json({ error: 'Missing required fields: owner, repo, pullNumber' });
        return;
      }

      console.log('Getting installation ID for:', owner, repo);
      // Get installation ID for the repository
      let installationId: number | null;
      try {
        installationId = await githubService.getRepositoryInstallation(owner, repo);
      } catch (err: any) {
        console.error('Error getting installation ID:', err);
        res.status(500).json({ error: 'Failed to get installation ID', details: err.message });
        return;
      }
      if (!installationId) {
        console.log('No installation found for:', owner, repo);
        res.status(404).json({ error: 'GitHub App not installed on this repository' });
        return;
      }
      console.log('Installation ID:', installationId);

      console.log('Fetching PR details...');
      // Fetch PR details to get head SHA
      let prDetails: any;
      try {
        prDetails = await githubService.getPRDetails(owner, repo, pullNumber, installationId);
      } catch (err: any) {
        console.error('Error fetching PR details:', err);
        res.status(500).json({ error: 'Failed to fetch PR details', details: err.message });
        return;
      }
      const headSha = prDetails.head.sha;
      console.log('Head SHA:', headSha);

      console.log('Fetching PR diff...');
      // Fetch PR diff
      let diff: string;
      try {
        diff = await githubService.getPRDiff(owner, repo, pullNumber, installationId);
      } catch (err: any) {
        console.error('Error fetching PR diff:', err);
        res.status(500).json({ error: 'Failed to fetch PR diff', details: err.message });
        return;
      }
      if (!diff || diff.trim().length === 0) {
        console.log('No diff found for PR');
        res.status(404).json({ error: 'No diff found for this PR' });
        return;
      }
      console.log('Diff length:', diff.length);

      console.log('Processing with AI...');
      // Process with AI
      let aiResponse;
      try {
        aiResponse = await reviewCodeWithAI({
          diff,
          promptConfig: {
            template: 'professional',
            tone: 'professional',
            focus: 'general',
            detail: 'detailed',
          },
        });
      } catch (err: any) {
        console.error('AI review failed:', err);
        res.status(500).json({ error: 'AI review failed', details: err.message });
        return;
      }
      console.log('AI response received, comments:', aiResponse.comments?.length || 0);

      // For now, let's just post a general review comment without line-specific comments
      // This avoids the complex comment positioning issues
      console.log('Posting general review comment...');
      const typeEmoji = {
        suggestion: '💡',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️',
      };
      try {
        await githubService.postReviewComments(
          {
            owner,
            repo,
            pull_number: pullNumber,
            event: 'COMMENT',
            body: `🤖 AI Code Reviewer\n\n${aiResponse.comments.length} comments generated:\n\n${aiResponse.comments.map((comment, index) => `${index + 1}. \`${comment.fileName || 'N/A'}\` - \`Line: ${comment.lineNumber || 'N/A'}\` \`${typeEmoji[comment.type as keyof typeof typeEmoji]} ${(comment.type || 'suggestion').toUpperCase()}\`\n    ${comment.content}`).join('\n\n')}`,
            comments: [], // Empty comments array to avoid positioning issues
          },
          installationId,
        );
        console.log('General review comment posted successfully');
      } catch (err: any) {
        console.error('Error posting review comments:', err);
        res.status(500).json({ error: 'Failed to post review comments', details: err.message });
        return;
      }

      res.json({
        success: true,
        commentsPosted: aiResponse.comments.length,
        message: `Successfully posted general review comment with ${aiResponse.comments.length} AI comments to PR #${pullNumber}`,
      });
    } catch (error: any) {
      console.error('Error in manual review:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };
