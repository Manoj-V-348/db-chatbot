import OpenAI from 'openai';

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  console.error('VITE_OPENAI_API_KEY is not set in .env file');
}

export const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true, // Required for client-side usage
});

export const AI_MODEL = 'gpt-4o'; // Using GPT-4o for maximum accuracy
