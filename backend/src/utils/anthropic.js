import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client = null;

function getClient() {
  if (!config.hasAI) return null;
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

/**
 * Calls Claude with a tool forced, so the model must return a structured
 * JSON object matching `tool.input_schema` instead of free-form prose.
 */
export async function callStructured({ system, messages, tool, maxTokens = 4096 }) {
  const anthropic = getClient();
  if (!anthropic) throw new Error('Anthropic client requested without an API key configured');

  const response = await anthropic.messages.create({
    model: config.gmModel,
    max_tokens: maxTokens,
    system,
    messages,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Model did not return a structured tool_use block');
  }
  return toolUse.input;
}

/** Calls Claude for plain narrative text (Q&A answers, event narration, reveal). */
export async function callText({ system, messages, maxTokens = 1024 }) {
  const anthropic = getClient();
  if (!anthropic) throw new Error('Anthropic client requested without an API key configured');

  const response = await anthropic.messages.create({
    model: config.gmModel,
    max_tokens: maxTokens,
    system,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
