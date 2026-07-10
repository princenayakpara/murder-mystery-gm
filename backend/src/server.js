import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { config } from './config.js';
import { createSocketServer } from './socket/index.js';
import { listFinishedGames, getGameById } from './db/index.js';
import { getOrCreateAvatarSvg, slugify } from './gm/avatarGenerator.js';

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasAI: config.hasAI, model: config.gmModel });
});

// Avatars are served by (slugified) case id + character name rather than raw text,
// so this doubles as the cache key and a safe URL segment. getOrCreateAvatarSvg()
// generates once and reuses the cached SVG on every subsequent request/replay.
app.get('/api/avatars/:caseSlug/:characterSlug.svg', (req, res) => {
  const { caseSlug, characterSlug } = req.params;
  // caseSlug/characterSlug are already slugified by the client via avatarUrlFor();
  // getOrCreateAvatarSvg re-slugifies internally, so we pass them through as the
  // "identity" strings — slugify() is idempotent, so this round-trips safely.
  const svg = getOrCreateAvatarSvg(caseSlug, characterSlug);
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
