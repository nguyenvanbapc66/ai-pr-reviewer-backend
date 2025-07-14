# AI PR Reviewer Backend

Backend API for the AI PR Reviewer application with OpenAI integration.

## Features

- **POST /api/review** - Review code diffs using OpenAI GPT-4o
- **POST /api/github/manual-review** - Manually trigger AI review for a GitHub PR
- CORS enabled for frontend integration
- Input validation and error handling
- Structured JSON responses

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment variables:**
   Create a `.env` file in the root directory:

   ```env
   PORT=3000
   NODE_ENV=development
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Get OpenAI API Key:**
   - Sign up at [OpenAI](https://platform.openai.com/)
   - Create an API key in your dashboard
   - Add it to your `.env` file

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### 1. POST /api/review

**Purpose:**
Submit a code diff for AI-powered review. This is a general-purpose endpoint for your own frontend or tools (not tied to GitHub webhooks).

**Request:**

```json
{
  "diff": "your code diff here",
  "promptConfig": {
    "tone": "professional|friendly|strict",
    "focus": "general|security|performance|clean-code",
    "detail": "brief|detailed|comprehensive",
    "template": "optional-template-name"
  }
}
```

- `diff` (string, required): The code diff to review.
- `promptConfig` (object, optional): Customize the review style.

**Response:**

```json
{
  "comments": [
    {
      "id": "unique_id",
      "fileName": "filename.ext",
      "lineNumber": 123,
      "content": "Review comment",
      "type": "error|warning|suggestion|info"
    }
  ],
  "metadata": {
    "templateUsed": "professional",
    "reviewMode": "general",
    "totalComments": 1,
    "commentTypes": { "suggestion": 1 }
  }
}
```

---

### 2. POST /api/github/manual-review

**Purpose:**
Manually trigger an AI review for a GitHub Pull Request. This is useful for admins, testing, or when you want to review a PR on demand (outside of automatic webhook triggers).

**Request:**

```json
{
  "owner": "github-username-or-org",
  "repo": "repository-name",
  "pullNumber": 123
}
```

- `owner` (string, required): GitHub username or organization.
- `repo` (string, required): Repository name.
- `pullNumber` (number, required): Pull request number.

**Response:**

```json
{
  "success": true,
  "commentsPosted": 3,
  "message": "Successfully posted general review comment with 3 AI comments to PR #123"
}
```

**What happens:**

- The backend fetches the PR diff from GitHub.
- The diff is reviewed by the AI.
- A general review comment is posted to the PR, summarizing all AI comments in a readable format (including file name, line number, type, and content, with emoji and markdown for clarity).

**Example of posted comment:**

```
🤖 AI Code Reviewer

3 comments generated:

1. `src/app.ts` - `Line: 12` `💡 SUGGESTION`
    Consider using async/await for better readability.

2. `src/server.ts` - `Line: 5` `⚠️ WARNING`
    Potential memory leak detected in server initialization.

3. `N/A` - `Line: N/A` `ℹ️ INFO`
    No major issues found.
```

---

## Error Handling

- **400 Bad Request** - Invalid input (missing fields, too large, etc.)
- **404 Not Found** - PR or installation not found (for manual review)
- **500 Internal Server Error** - OpenAI API errors or server issues

## Rate Limiting

Consider implementing rate limiting for production use to manage OpenAI API costs.
