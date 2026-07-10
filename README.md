# Khoon Ki Baraat — AI Game Master Murder Mystery

A multiplayer, browser-based murder mystery party game. 4-8 players join a room from
their own devices, each gets a private character with secrets and objectives, and an
AI **Game Master** narrates the investigation — observing quietly, stepping in only when
the table stalls or a player directly asks it to inspect something, and delivering a
full narrated reveal at the end.

Players talk to each other over voice (Discord/Meet/Zoom/in person) outside the app.
The app itself handles rooms, private character delivery, the shared chat/clue timeline,
accusations, voting, and the AI narration.

## Architecture at a glance

```
backend/                     Node.js + Express + Socket.io
  src/
    server.js                Express app + REST (past games) + boots Socket.io
    config.js                env var loading (ANTHROPIC_API_KEY, GM_MODEL, PORT, CLIENT_ORIGIN)
    rooms/roomManager.js      in-memory room/player registry, slot assignment, reconnect
    socket/
      index.js                Socket.io server setup + rehydrates in-progress rooms from SQLite
      handlers.js              all socket event handlers (create/join/start/chat/ask/accuse/vote/end)
    gm/                        <-- the AI Game Master, as its own module (not inline in sockets)
      mysteryGenerator.js      calls Claude (schema-forced tool call) or falls back to the seed case
      stallDetector.js         momentum tracking + stall/intervention decisions
      gameMaster.js             orchestrator: chat handling, Q&A, event injection, reveal generation
      prompts.js                all system/user prompts, isolated from orchestration logic
      templates.js               non-AI narration fallback (used when no API key is configured)
    db/                        node:sqlite persistence (schema + snapshot/load)
    seeds/khoon_ki_baraat.json  offline/default mystery, used verbatim when no API key is set

frontend/                    React + Vite
  src/
    state/GameContext.jsx     single source of truth: socket wiring + game state (useReducer)
    pages/                    Home, Lobby, Briefing, Investigation, Reveal, PastGames
    components/                ChatPanel, ClueBoard, PlayerList (suspects), VotePanel
```

### How the AI Game Master behaves

1. **Momentum tracker** (`stallDetector.js`) — every room tracks messages-since-last-clue
   and time-since-last-clue, plus which characters have been mentioned recently.
2. **Stall detection** — triggers when: (a) 6 messages pass with no new suspect/lead
   mentioned, (b) 4 minutes pass with no new clue while the table is still actively
   chatting, or (c) a suspect whose evidence has already been fully surfaced gets accused
   3+ times in a row (a "beating a dead lead" loop).
3. **Event injection** — on trigger, the GM picks the next unrevealed `hidden_information`
   item (prioritizing whoever is currently most-accused) and narrates it in-fiction (a
   witness, CCTV, a diary page, a phone record...) via Claude, or a flavored template if
   no API key is configured. Every intervention is logged with a one-line reason
   (`room.events`) for the replay report.
4. **Direct Q&A** — "Ask GM" messages call Claude with the full mystery (minus who's
   asking), the room transcript, and clues already revealed, and answer in-world without
   ever naming the murderer.
5. **Reveal** — once every active player has voted (or the host ends the game early), the
   GM generates a full narrated solution: the timeline, which clues mattered, what was
   missed, who lied, and why the killer was identifiable — referencing the actual
   transcript.

The AI never regenerates the story from scratch on each call — it always reasons over the
stored mystery JSON + the live transcript + the clue log, per the structured-state
requirement.

### Privacy

The full mystery (including `is_murderer` and everyone's `true_whereabouts`) only ever
exists on the server. `roomManager.getCharacterFor()` strips those two fields before a
character is ever emitted to a socket, and each character is sent only via
`io.to(socketId).emit(...)` to that one player's private socket channel — never
broadcast to the room.

## Setup

Requires **Node.js >= 22.5** (the backend uses the built-in `node:sqlite` module — see
"Engineering decisions" below for why).

```bash
# 1. Backend
cd backend
cp .env.example .env      # then fill in ANTHROPIC_API_KEY (optional — see below)
npm install
npm run dev                # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
cp .env.example .env       # defaults to http://localhost:4000, only change if backend port differs
npm install
npm run dev                # http://localhost:5173
```

Open `http://localhost:5173` in 4+ browser tabs/devices, create a room in one, join it
from the others with the room code, and have the host click **Start Game**.

### Environment variables (`backend/.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No | _(unset)_ | Without it, the app runs fully offline: the seed mystery (`khoon_ki_baraat.json`) is used and all GM narration falls back to templates. **Set this to get freshly generated mysteries and AI narration.** |
| `GM_MODEL` | No | `claude-sonnet-5` | Any current Claude model id. |
| `PORT` | No | `4000` | Backend port. |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Used for CORS + Socket.io. |

### Generating a brand-new mystery (judging flow)

With `ANTHROPIC_API_KEY` set, click **Start Game** in a fresh room — the backend calls
Claude with a schema-forced tool call (`generate_mystery` in `gm/prompts.js`) requesting
5-8 unique characters, exactly one murderer, and a mutually consistent timeline. The
result is validated (`mysteryGenerator.js`) and, if it fails validation, retried once
before falling back to the seed case — so the app **never** hard-fails at game start. No
code changes are needed between runs; every "Start Game" click can produce a different
case, theme, and cast.

## Functional coverage vs. the spec

- ✅ Lobby: create/join by room code, host-gated start, 4+ player minimum.
- ✅ Mystery generation matches the required JSON schema exactly (schema-forced tool call).
- ✅ Per-player private delivery — never leaks `is_murderer` or others' private data.
- ✅ Public chat, "Ask the GM", accusations (visible, non-terminal), final one-per-player vote.
- ✅ AI GM as a distinct module: momentum tracker, stall detection, event injection, Q&A, reveal.
- ✅ Clean reconnect: a `playerId` is persisted in `localStorage` and used to rejoin the
  same slot (and re-hydrate the full transcript/clue/character state) after a refresh or
  dropped socket.
- ✅ SQLite persistence: every major state change snapshots the room; a server restart
  rehydrates in-progress rooms from disk (`socket/index.js` → `loadUnfinishedGames()`).
- ✅ Replay/report stretch goal: finished games are listed via `GET /api/games` and viewable
  (full transcript + reveal) via `GET /api/games/:id`, surfaced in the "Past Games" screen.
- ✅ Theme variation stretch goal: host can pick Haunted House / Space Station / Cyber Crime
  / Ancient Kingdom / default Indian wedding from the lobby.
- ✅ Mobile-responsive: the investigation screen collapses to a tabbed Chat / Clues /
  Suspects layout under 900px.

## Engineering decisions worth knowing about

- **`node:sqlite` instead of `better-sqlite3`.** The spec calls for `better-sqlite3`, but
  it requires native compilation (node-gyp + Python), which wasn't available in the build
  environment. Node's built-in `node:sqlite` module (stable since Node 22-24) gives the
  same synchronous, embedded-SQLite experience with zero native build steps — same
  schema, same snapshot-on-major-change persistence model, just a different driver. If
  your deployment target has working native build tooling, swapping back to
  `better-sqlite3` is a ~10-line change confined to `backend/src/db/index.js`.
- **`GM_MODEL` default is `claude-sonnet-5`**, not `claude-sonnet-4-6` as originally
  suggested — the latter isn't a current model id. Override via the env var if you need
  a specific model.
- **Minimum players to start (4) vs. mystery cast size (5-8).** If the host starts with
  exactly 4 players, the backend requests a 5-character mystery and one slot is left
  unassigned to a human — that character becomes a GM-controlled NPC the table can still
  ask about via "Ask GM", rather than blocking start on a stricter minimum.
- **Stall detection heuristics.** "No new lead" is approximated by scanning chat text for
  character name mentions (first/full name match) rather than full NLP topic modeling —
  simple, fast, and good enough for a live party game; see `stallDetector.js` for the
  exact thresholds (6 messages / 4 minutes / 3 repeated accusations of an evidence-
  exhausted suspect).
- **GM answers and injected events are broadcast to the whole room**, not whispered to
  the asking player — this was a deliberate call to keep players talking to each other
  about what the GM just revealed, rather than DM-ing the AI in isolation (a judging
  criterion: "players stay engaged... not just talking to the AI").

## Project structure

```
murder-mystery-gm/
  backend/
    .env.example
    package.json
    src/  (see architecture section above)
    data/games.db        (created on first run, gitignored)
  frontend/
    .env.example
    package.json
    src/
  README.md
```
