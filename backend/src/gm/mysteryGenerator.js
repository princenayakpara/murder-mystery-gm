import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { callStructured } from '../utils/anthropic.js';
import { MYSTERY_SCHEMA_TOOL, mysteryGenerationSystemPrompt, mysteryGenerationUserPrompt } from './prompts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'seeds', 'khoon_ki_baraat.json');

function loadSeedMystery() {
  const raw = fs.readFileSync(SEED_PATH, 'utf-8');
  return JSON.parse(raw);
}

function validateMystery(mystery) {
  const errors = [];
  if (!mystery || !Array.isArray(mystery.players)) {
    return ['Missing players array'];
  }
  if (mystery.players.length < 5 || mystery.players.length > 8) {
    errors.push(`player count out of range: ${mystery.players.length}`);
  }
  const murderers = mystery.players.filter((p) => p.is_murderer === true);
  if (murderers.length !== 1) {
    errors.push(`expected exactly 1 murderer, found ${murderers.length}`);
  }
  const slots = new Set(mystery.players.map((p) => p.player_slot));
  if (slots.size !== mystery.players.length) {
    errors.push('duplicate player_slot values');
  }
  for (const p of mystery.players) {
    if (!p.hidden_information || p.hidden_information.length < 2) {
      errors.push(`${p.character_name || p.player_slot} has fewer than 2 hidden_information items`);
    }
    if (!p.true_whereabouts) {
      errors.push(`${p.character_name || p.player_slot} missing true_whereabouts`);
    }
  }
  return errors;
}

/**
 * Generates a brand-new mystery via Claude, matching the required JSON schema exactly.
 * Falls back to the offline seed case when no API key is configured (or generation fails
 * after retries), so the app always runs end-to-end.
 */
export async function generateMystery({ theme, playerCount }) {
  if (!config.hasAI) {
    const seed = loadSeedMystery();
    return { mystery: seed, source: 'seed', reason: 'No ANTHROPIC_API_KEY configured' };
  }

  const clampedCount = Math.min(8, Math.max(5, playerCount || 5));
  const attempts = 2;
  let lastErrors = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const mystery = await callStructured({
        system: mysteryGenerationSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: mysteryGenerationUserPrompt({ theme, playerCount: clampedCount }),
          },
        ],
        tool: MYSTERY_SCHEMA_TOOL,
        maxTokens: 8000,
      });
      const errors = validateMystery(mystery);
      if (errors.length === 0) {
        return { mystery, source: 'ai', reason: null };
      }
      lastErrors = errors;
    } catch (err) {
      lastErrors = [err.message];
    }
  }

  console.warn(
    `[mysteryGenerator] AI generation failed validation after ${attempts} attempts (${lastErrors.join('; ')}), falling back to seed case.`
  );
  const seed = loadSeedMystery();
  return { mystery: seed, source: 'seed-fallback', reason: lastErrors.join('; ') };
}

export { loadSeedMystery, validateMystery };
