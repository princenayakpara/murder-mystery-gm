import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { config } from './config.js';
import { createSocketServer } from './socket/index.js';
import { listFinishedGames, getGameById } from './db/index.js';
import { getOrCreateAvatarSvg, AVATAR_MOODS } from './gm/avatarGenerator.js';
import { getOrCreateSceneSvg, SCENE_KEYS } from './gm/sceneGenerator.js';

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasAI: config.hasAI, model: config.gmModel });
});

// Avatars are served by (slugified) case id + character name rather than raw text,
// so this doubles as the cache key and a safe URL segment. getOrCreateAvatarSvg()
// generates once and reuses the cached SVG on every subsequent request/replay.
// characterSlug may carry an optional ".<mood>" suffix (e.g. "kavita-rathore.pressure")
// produced by avatarUrlFor() — split it back out here.
app.get('/api/avatars/:caseSlug/:characterSlug.svg', (req, res) => {
  const { caseSlug, characterSlug } = req.params;
  let name = characterSlug;
  let mood = 'neutral';
  for (const m of AVATAR_MOODS) {
    if (m !== 'neutral' && characterSlug.endsWith(`.${m}`)) {
      mood = m;
      name = characterSlug.slice(0, -(m.length + 1));
      break;
    }
  }
  const svg = getOrCreateAvatarSvg(caseSlug, name, mood);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(svg);
});

// VN scene backgrounds — one of SCENE_KEYS per case, cached the same way as avatars.
// sceneSetting is passed as a query param since the server needs the case's freeform
// `setting` text to theme-detect on first generation (it isn't derivable from the URL).
app.get('/api/scenes/:caseSlug/:sceneKey.svg', (req, res) => {
  const { caseSlug, sceneKey } = req.params;
  if (!SCENE_KEYS.includes(sceneKey)) return res.status(404).json({ error: 'Unknown scene key' });
  const setting = typeof req.query.setting === 'string' ? req.query.setting : '';
  const svg = getOrCreateSceneSvg(caseSlug, setting, sceneKey);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(svg);
});

app.get('/api/games', (req, res) => {
  res.json(listFinishedGames());
});

app.get('/api/games/:id', (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`AI Game Master server listening on port ${config.port}`);
  console.log(`AI generation: ${config.hasAI ? `enabled (model: ${config.gmModel})` : 'DISABLED — using offline seed mystery + template narration'}`);
  console.log(`Accepting connections from: ${config.clientOrigin}`);
});
