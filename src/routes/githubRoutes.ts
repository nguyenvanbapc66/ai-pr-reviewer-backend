import { Router } from 'express';
import { handleWebhook, manualReview } from '../controllers/githubController';
import { getGitHubConfig } from '../config';

const router = Router();

// Get GitHub config (for dependency injection)
const githubConfig = getGitHubConfig();
const botUsername = process.env.GITHUB_BOT_USERNAME || 'ai-pr-reviewer-bot';

// POST /github/webhook - Handle GitHub webhook events
router.post('/github/webhook', handleWebhook(githubConfig, botUsername));

// POST /github/manual-review - Manual trigger for PR review (for testing)
router.post('/github/manual-review', manualReview(githubConfig, botUsername));

export default router;
