export type ReviewCommentType = {
  id: string;
  fileName?: string;
  lineNumber?: number;
  content: string;
  type: 'suggestion' | 'warning' | 'error' | 'info';
};

export type ReviewRequestType = {
  diff: string;
  promptConfig?: {
    template?: string;
    tone?: 'professional' | 'friendly' | 'strict';
    focus?: 'general' | 'security' | 'performance' | 'clean-code';
    detail?: 'brief' | 'detailed' | 'comprehensive';
  };
};

export type ReviewResponseType = {
  comments: ReviewCommentType[];
  metadata?: {
    templateUsed: string;
    reviewMode: string;
    totalComments: number;
    commentTypes: Record<string, number>;
  };
};

export type OpenAIMessageType = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OpenAIReviewResponseType = {
  comments: Array<{
    id: string;
    fileName?: string;
    lineNumber?: number;
    content: string;
    type: 'suggestion' | 'warning' | 'error' | 'info';
  }>;
};
