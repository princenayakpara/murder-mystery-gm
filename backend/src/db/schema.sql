CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  case_id TEXT,
  case_title TEXT,
  status TEXT NOT NULL DEFAULT 'lobby',
  theme TEXT,
  mystery_json TEXT,
  players_json TEXT,
  transcript_json TEXT,
  events_json TEXT,
  clues_json TEXT,
  votes_json TEXT,
  reveal_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_games_room_code ON games (room_code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games (status);
