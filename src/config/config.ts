import dotenv from 'dotenv';

dotenv.config();

type Config = {
  port: number;
  nodeEnv: string;
  openaiApiKey: string;
};

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};

// Validate required environment variables
if (!config.openaiApiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set. AI review functionality will not work.');
}

export default config;
