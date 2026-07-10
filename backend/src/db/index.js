import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses Node's built-in `node:sqlite` (bundled SQLite, no native compilation required)
// instead of better-sqlite3, since this avoids needing node-gyp/Python build tooling
// on the host machine. Requires Node >= 22.5 (stable in 24+).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_DIR lets a deployment (e.g. a Railway Volume) point persistence at a mounted,
// durable path instead of the source tree's local backend/data folder.
const dataDir = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.resolve(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'games.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

const upsertStmt = db.prepare(`
  INSERT INTO games (
    id, room_code, case_id, case_title, status, theme,
    mystery_json, players_json, transcript_json, events_json, clues_json, votes_json, reveal_json,
    created_at, updated_at, finished_at
  ) VALUES (
    :id, :roomCode, :caseId, :caseTitle, :status, :theme,
    :mysteryJson, :playersJson, :transcriptJson, :eventsJson, :cluesJson, :votesJson, :revealJson,
    :createdAt, :updatedAt, :finishedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    room_code = excluded.room_code,
    case_id = excluded.case_id,
    case_title = excluded.case_title,
    status = excluded.status,
    theme = excluded.theme,
    mystery_json = excluded.mystery_json,
    players_json = excluded.players_json,
    transcript_json = excluded.transcript_json,
    events_json = excluded.events_json,
    clues_json = excluded.clues_json,
    votes_json = excluded.votes_json,
    reveal_json = excluded.reveal_json,
    updated_at = excluded.updated_at,
    finished_at = excluded.finished_at
`);

/** Persist a full snapshot of a room's game state. Called on every major state change. */
export function saveSnapshot(snapshot) {
  upsertStmt.run({
    id: snapshot.id,
    roomCode: snapshot.roomCode,
    caseId: snapshot.caseId || null,
    caseTitle: snapshot.caseTitle || null,
    status: snapshot.status,
    theme: snapshot.theme || null,
    mysteryJson: JSON.stringify(snapshot.mystery || null),
    playersJson: JSON.stringify(snapshot.players || []),
    transcriptJson: JSON.stringify(snapshot.transcript || []),
    eventsJson: JSON.stringify(snapshot.events || []),
    cluesJson: JSON.stringify(snapshot.clues || []),
    votesJson: JSON.stringify(snapshot.votes || []),
    revealJson: JSON.stringify(snapshot.reveal || null),
    createdAt: snapshot.createdAt,
    updatedAt: Date.now(),
    finishedAt: snapshot.finishedAt || null,
  });
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomCode: row.room_code,
    caseId: row.case_id,
    caseTitle: row.case_title,
    status: row.status,
    theme: row.theme,
    mystery: JSON.parse(row.mystery_json || 'null'),
    players: JSON.parse(row.players_json || '[]'),
    transcript: JSON.parse(row.transcript_json || '[]'),
    events: JSON.parse(row.events_json || '[]'),
    clues: JSON.parse(row.clues_json || '[]'),
    votes: JSON.parse(row.votes_json || '[]'),
    reveal: JSON.parse(row.reveal_json || 'null'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

/** Finished games only, newest first — powers the replay/past-games screen. */
export function listFinishedGames() {
  const rows = db
    .prepare('SELECT * FROM games WHERE status = ? ORDER BY finished_at DESC')
    .all('revealed');
  return rows.map(rowToRecord).map((g) => ({
    id: g.id,
    roomCode: g.roomCode,
    caseTitle: g.caseTitle,
    theme: g.theme,
    playerCount: g.players.length,
    createdAt: g.createdAt,
    finishedAt: g.finishedAt,
  }));
}

export function getGameById(id) {
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  return rowToRecord(row);
}

/** All non-finished games, used on server startup to rehydrate in-memory rooms. */
export function loadUnfinishedGames() {
  const rows = db.prepare("SELECT * FROM games WHERE status != 'revealed'").all();
  return rows.map(rowToRecord);
}

export default db;
