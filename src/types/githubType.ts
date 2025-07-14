export type GitHubWebhookEventType = {
  action: string;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    html_url: string;
    diff_url: string;
    patch_url: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  installation?: {
    id: number;
  };
};

export type GitHubPRDiffType = {
  url: string;
  html_url: string;
  diff_url: string;
  patch: string;
  base_commit: {
    sha: string;
  };
  merge_base_commit: {
    sha: string;
  };
  status: string;
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: Array<{
    sha: string;
    commit: {
      message: string;
    };
  }>;
  files: Array<{
    sha: string;
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    blob_url: string;
    raw_url: string;
    contents_url: string;
    patch?: string;
  }>;
};

export type GitHubCommentType = {
  path: string;
  position: number;
  body: string;
  commit_id: string;
  line?: number;
  side?: 'LEFT' | 'RIGHT';
  start_line?: number;
  start_side?: 'LEFT' | 'RIGHT';
};

export type GitHubReviewRequestType = {
  owner: string;
  repo: string;
  pull_number: number;
  event?: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body?: string;
  comments?: GitHubCommentType[];
};

export type GitHubAppConfigType = {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
};

export type GitHubInstallationTokenType = {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: string;
};
