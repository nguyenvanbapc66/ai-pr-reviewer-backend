import OpenAI from 'openai';
import type { ReviewRequestType, ReviewResponseType, OpenAIMessageType } from '../types/reviewType';
import { getPromptTemplate, buildCustomPrompt, formatPrompt, type ReviewPromptConfig } from '../prompts';

// Lazy-load OpenAI client to avoid initialization issues during testing
let openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Configure for OpenRouter
    openaiClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
        'X-Title': 'AI PR Reviewer', // Optional but recommended
      },
    });
  }
  return openaiClient;
};

// Use cheaper model for development/testing to reduce costs
const getModel = (): string => {
  const env = process.env.NODE_ENV;
  const preferredModel = process.env.OPENAI_MODEL;

  if (preferredModel) {
    return preferredModel;
  }

  // Use cheaper model in development/testing
  if (env === 'development' || env === 'test') {
    return 'openai/gpt-3.5-turbo'; // OpenRouter model format
  }

  // Use a more reliable model for production
  return 'openai/gpt-4o-mini'; // OpenRouter model format - more reliable than free models
};

// Helper function to extract JSON from markdown response
const extractJSONFromResponse = (response: string): any => {
  try {
    // First, try to parse as direct JSON
    return JSON.parse(response);
  } catch (error) {
    console.log('Direct JSON parsing failed, attempting to extract JSON from response...');

    // Limit logging to prevent memory issues with large responses
    const responsePreview = response.length > 500 ? response.substring(0, 500) + '...' : response;
    console.log('Raw response preview:', responsePreview);

    // If that fails, try to extract JSON from markdown
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extractedJson = jsonMatch[0];
        // Limit logging of extracted JSON
        const jsonPreview = extractedJson.length > 200 ? extractedJson.substring(0, 200) + '...' : extractedJson;
        console.log('Extracted JSON preview:', jsonPreview);
        return JSON.parse(extractedJson);
      } catch (parseError) {
        console.error('Failed to parse extracted JSON:', parseError);
        throw new Error('Invalid JSON format in response');
      }
    }

    // If no JSON found, try to create a fallback response
    console.log('No JSON found in response, creating fallback...');
    return {
      comments: [
        {
          id: 'fallback_1',
          content: 'Unable to parse AI response. Please try again.',
          type: 'warning',
        },
      ],
    };
  }
};

// Function to get the appropriate prompt template
const getPromptForRequest = (request: ReviewRequestType) => {
  const { promptConfig } = request;

  // If a specific template is requested, use it
  if (promptConfig?.template) {
    try {
      return getPromptTemplate(promptConfig.template);
    } catch (error) {
      console.warn(`Template '${promptConfig.template}' not found, using default`);
    }
  }

  // If custom configuration is provided, build a custom prompt
  if (promptConfig?.tone || promptConfig?.focus || promptConfig?.detail) {
    const config: ReviewPromptConfig = {
      tone: promptConfig.tone || 'professional',
      focus: promptConfig.focus || 'general',
      detail: promptConfig.detail || 'detailed',
    };
    return buildCustomPrompt(config);
  }

  // Default to professional template
  return getPromptTemplate('professional');
};

export const reviewCodeWithAI = async (request: ReviewRequestType): Promise<ReviewResponseType> => {
  try {
    const openai = getOpenAIClient();
    const model = getModel();

    // Get the appropriate prompt template
    const promptTemplate = getPromptForRequest(request);
    const { system: systemPrompt, user: userPrompt } = formatPrompt(promptTemplate, request.diff);

    console.log('Using prompt template:', promptTemplate.name);
    console.log('Using model:', model);
    console.log('Diff length:', request.diff.length);

    const messages: OpenAIMessageType[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.1, // Lower temperature for more consistent JSON
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      // Limit logging to prevent memory issues
      const responsePreview =
        responseContent.length > 300 ? responseContent.substring(0, 300) + '...' : responseContent;
      console.log('Raw AI response preview:', responsePreview);

      // Try to parse the response as JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseContent);
        // Limit logging of parsed response to prevent memory issues
        const parsedPreview = JSON.stringify(parsedResponse, null, 2);
        const logPreview = parsedPreview.length > 500 ? parsedPreview.substring(0, 500) + '...' : parsedPreview;
        console.log('Successfully parsed JSON response preview:', logPreview);
      } catch (parseError) {
        console.warn('Failed to parse response as JSON, attempting to extract JSON from markdown:', parseError);
        parsedResponse = extractJSONFromResponse(responseContent);
      }

      // Validate the response structure
      if (!parsedResponse) {
        throw new Error('No response data received');
      }

      if (!parsedResponse.comments) {
        console.log('No comments array found, creating fallback response');
        return {
          comments: [
            {
              id: 'no_comments',
              content: 'No review comments generated. Please try again.',
              type: 'info',
            },
          ],
          metadata: {
            templateUsed: promptTemplate.name,
            reviewMode: 'fallback',
            totalComments: 1,
            commentTypes: { info: 1 },
          },
        };
      }

      if (!Array.isArray(parsedResponse.comments)) {
        console.log('Comments is not an array, creating fallback response');
        return {
          comments: [
            {
              id: 'invalid_comments',
              content: 'Invalid response format. Please try again.',
              type: 'warning',
            },
          ],
          metadata: {
            templateUsed: promptTemplate.name,
            reviewMode: 'fallback',
            totalComments: 1,
            commentTypes: { warning: 1 },
          },
        };
      }

      // Ensure each comment has required fields
      const validatedComments = parsedResponse.comments.map((comment: any, index: number) => ({
        id: comment.id || `comment_${index}`,
        fileName: comment.fileName,
        lineNumber: comment.lineNumber,
        content: comment.content || 'No content provided',
        type: ['error', 'warning', 'suggestion', 'info'].includes(comment.type) ? comment.type : 'suggestion',
      }));

      // Calculate metadata
      const commentTypes = validatedComments.reduce(
        (acc: Record<string, number>, comment: any) => {
          acc[comment.type] = (acc[comment.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      console.log(`Generated ${validatedComments.length} comments`);

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      return {
        comments: validatedComments,
        metadata: {
          templateUsed: promptTemplate.name,
          reviewMode: request.promptConfig?.focus || 'general',
          totalComments: validatedComments.length,
          commentTypes,
        },
      };
    } catch (apiError: any) {
      console.error('OpenAI API call failed:', apiError);

      // Handle rate limiting specifically
      if (apiError?.status === 429 || apiError?.code === 429) {
        return {
          comments: [
            {
              id: 'rate_limit_error',
              content: 'AI service is currently busy. Please wait a moment and try again.',
              type: 'warning',
            },
          ],
          metadata: {
            templateUsed: 'error',
            reviewMode: 'error',
            totalComments: 1,
            commentTypes: { warning: 1 },
          },
        };
      }

      // Re-throw other API errors to be handled by the outer catch
      throw apiError;
    }
  } catch (error: any) {
    console.error('OpenAI API error:', error);

    // Handle specific OpenAI errors
    if (error?.code === 'insufficient_quota') {
      return {
        comments: [
          {
            id: 'quota_error',
            content:
              'OpenAI API quota exceeded. Please check your billing or upgrade your plan. You can also try again later when your quota resets.',
            type: 'error',
          },
        ],
        metadata: {
          templateUsed: 'error',
          reviewMode: 'error',
          totalComments: 1,
          commentTypes: { error: 1 },
        },
      };
    }

    if (error?.status === 429) {
      return {
        comments: [
          {
            id: 'rate_limit_error',
            content: 'OpenAI API rate limit exceeded. Please wait a moment and try again.',
            type: 'warning',
          },
        ],
        metadata: {
          templateUsed: 'error',
          reviewMode: 'error',
          totalComments: 1,
          commentTypes: { warning: 1 },
        },
      };
    }

    if (error?.code === 'invalid_api_key') {
      return {
        comments: [
          {
            id: 'api_key_error',
            content: 'Invalid OpenAI API key. Please check your configuration.',
            type: 'error',
          },
        ],
        metadata: {
          templateUsed: 'error',
          reviewMode: 'error',
          totalComments: 1,
          commentTypes: { error: 1 },
        },
      };
    }

    // Handle JSON parsing errors
    if (error.message?.includes('JSON') || error.message?.includes('Unexpected token')) {
      return {
        comments: [
          {
            id: 'json_parse_error',
            content: 'Received invalid response format from AI service. Please try again.',
            type: 'error',
          },
        ],
        metadata: {
          templateUsed: 'error',
          reviewMode: 'error',
          totalComments: 1,
          commentTypes: { error: 1 },
        },
      };
    }

    // Generic fallback response
    return {
      comments: [
        {
          id: 'fallback_1',
          content: 'Unable to analyze code at the moment. Please try again later.',
          type: 'warning',
        },
      ],
      metadata: {
        templateUsed: 'error',
        reviewMode: 'error',
        totalComments: 1,
        commentTypes: { warning: 1 },
      },
    };
  }
};
