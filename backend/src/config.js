import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  gmModel: process.env.GM_MODEL || 'claude-sonnet-5',
  get hasAI() {
    return Boolean(this.anthropicApiKey);
  },
};
