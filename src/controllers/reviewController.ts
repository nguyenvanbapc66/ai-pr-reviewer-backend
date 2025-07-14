import { Request, Response } from 'express';
import { reviewCodeWithAI } from '../services';
import { getPromptTemplate, PROMPT_TEMPLATES } from '../prompts';
import { logMemoryUsage, forceGarbageCollection, checkMemoryThreshold } from '../utils/memoryMonitor';
import type { ReviewRequestType } from '../types';

export const reviewCode = async (req: Request, res: Response) => {
  try {
    logMemoryUsage('Review Request Start');

    const { diff, promptConfig }: ReviewRequestType = req.body;

    // Validate input
    if (!diff || typeof diff !== 'string' || diff.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid input: diff is required and must be a non-empty string',
      });
    }

    // Check if diff is too large (reduced from 10000 to 8000 to prevent memory issues)
    if (diff.length > 8000) {
      return res.status(400).json({
        error: 'Diff is too large. Please provide a smaller code diff (max 8,000 characters).',
      });
    }

    // Check memory usage before processing large diffs
    if (diff.length > 4000 && checkMemoryThreshold(800)) {
      console.warn('High memory usage detected, forcing garbage collection before processing large diff');
      forceGarbageCollection();
    }

    // Validate prompt configuration if provided
    if (promptConfig) {
      if (promptConfig.tone && !['professional', 'friendly', 'strict'].includes(promptConfig.tone)) {
        return res.status(400).json({
          error: 'Invalid tone. Must be one of: professional, friendly, strict',
        });
      }

      if (promptConfig.focus && !['general', 'security', 'performance', 'clean-code'].includes(promptConfig.focus)) {
        return res.status(400).json({
          error: 'Invalid focus. Must be one of: general, security, performance, clean-code',
        });
      }

      if (promptConfig.detail && !['brief', 'detailed', 'comprehensive'].includes(promptConfig.detail)) {
        return res.status(400).json({
          error: 'Invalid detail level. Must be one of: brief, detailed, comprehensive',
        });
      }
    }

    // Call OpenAI service
    const result = await reviewCodeWithAI({
      diff: diff.trim(),
      promptConfig,
    });

    // Force garbage collection
    forceGarbageCollection();
    logMemoryUsage('Review Request End');

    res.json(result);
  } catch (error) {
    console.error('Review controller error:', error);

    // Force garbage collection on error
    forceGarbageCollection();
    logMemoryUsage('Review Request Error');

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to review code',
    });
  }
};

// Debug endpoint to test OpenAI service
export const testOpenAI = async (req: Request, res: Response) => {
  try {
    console.log('Testing OpenAI service...');

    const testDiff = 'console.log("test");';
    const result = await reviewCodeWithAI({ diff: testDiff });

    res.json({
      success: true,
      result,
      message: 'OpenAI service test completed',
    });
  } catch (error) {
    console.error('OpenAI test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Endpoint to list available prompt templates
export const listPromptTemplates = async (req: Request, res: Response) => {
  try {
    const templates = Object.keys(PROMPT_TEMPLATES).map((name) => {
      const template = getPromptTemplate(name);
      return {
        name: template.name,
        description: template.description,
        key: name,
      };
    });

    res.json({
      templates,
      message: 'Available prompt templates',
    });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({
      error: 'Failed to list prompt templates',
    });
  }
};
