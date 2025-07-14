import { Router } from 'express';
import { reviewCode, testOpenAI, listPromptTemplates } from '../controllers';

const router = Router();

// POST /review - Review code diff with AI
router.post('/review', reviewCode);

// GET /test-openai - Debug endpoint to test OpenAI service
router.get('/test-openai', testOpenAI);

// GET /prompt-templates - List available prompt templates
router.get('/prompt-templates', listPromptTemplates);

export default router;
