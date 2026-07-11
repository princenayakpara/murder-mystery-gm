import { generateRoomCode, generateId } from '../utils/ids.js';
import { avatarUrlFor } from '../gm/avatarGenerator.js';
import { sceneUrlFor, SCENE_KEYS } from '../gm/sceneGenerator.js';

/**
 * @typedef {Object} Player
 * @property {string} playerId - stable id persisted client-side, survives reconnects
 * @property {string} name
 * @property {string|null} socketId
 * @property {boolean} connected
 * @property {boolean} isHost
 * @property {number|null} slot - mystery player_slot, assigned at game start
 * @property {boolean} ready - has acknowledged their briefing
 */

const MIN_PLAYERS_TO_START = 4;
const MAX_PLAYERS = 8;
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

function normalizeDifficulty(difficulty) {
  return VALID_DIFFICULTIES.includes(difficulty) ? difficulty : 'medium';
}

/** In-memory room registry. Snapshotted to SQLite on major state changes by the caller. */
class RoomManager {
  constructor() {
    /** @type {Map<string, any>} */
    this.rooms = new Map();
  }

  createRoom(hostName) {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const hostPlayer = this._newPlayer(hostName, true);
    const room = {
      id: generateId('game'),
      code,
      status: 'lobby',
      theme: null,
      difficulty: 'medium',
      createdAt: Date.now(),
      finishedAt: null,
      players: [hostPlayer],
      mystery: null,
      transcript: [],
      clues: [],
      events: [],
      votes: {}, // slot -> targetSlot
      momentum: {
        messagesSinceEvent: 0,
        lastEventTs: Date.now(),
        accusations: {}, // targetSlot -> count since last cleared
        clearedSlots: [],
      },
      intervalHandle: null,
    };
    this.rooms.set(code, room);
    return { room, player: hostPlayer };
  }

  getRoom(code) {
    return this.rooms.get((code || '').toUpperCase());
  }

  registerFromSnapshot(snapshot) {
    // Rehydrate an in-progress room from a DB snapshot after a server restart.
    const room = {
      id: snapshot.id,
      code: snapshot.roomCode,
      status: snapshot.status,
      theme: snapshot.theme,
      difficulty: normalizeDifficulty(snapshot.difficulty),
      createdAt: snapshot.createdAt,
      finishedAt: snapshot.finishedAt,
      players: (snapshot.players || []).map((p) => ({ ...p, socketId: null, connected: false })),
      mystery: snapshot.mystery,
      transcript: snapshot.transcript || [],
      clues: snapshot.clues || [],
      events: snapshot.events || [],
      votes: (snapshot.votes || []).reduce((acc, v) => {
        acc[v.slot] = v.targetSlot;
        return acc;
      }, {}),
      momentum: {
        messagesSinceEvent: 0,
        lastEventTs: Date.now(),
        accusations: {},
        clearedSlots: [],
      },
      intervalHandle: null,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  _newPlayer(name, isHost) {
    return {
      playerId: generateId('p'),
      name: (name || 'Player').slice(0, 40),
      socketId: null,
      connected: false,
      isHost,
      slot: null,
      ready: false,
    };
  }

  /**
   * Join or reconnect a player to a room.
   * If playerId matches an existing player, treats it as a reconnect (keeps their slot).
   */
  joinRoom({ roomCode, name, playerId, socketId }) {
    const room = this.getRoom(roomCode);
    if (!room) return { error: 'Room not found.' };

    if (playerId) {
      const existing = room.players.find((p) => p.playerId === playerId);
      if (existing) {
        existing.connected = true;
        existing.socketId = socketId;
        if (name) existing.name = name.slice(0, 40);
        return { room, player: existing, reconnected: true };
      }
    }

    if (room.status !== 'lobby') {
      return { error: 'This game has already started. Ask the host for a new room.' };
    }
    if (room.players.length >= MAX_PLAYERS) {
      return { error: `Room is full (max ${MAX_PLAYERS} players).` };
    }

    const player = this._newPlayer(name, false);
    player.connected = true;
    player.socketId = socketId;
    room.players.push(player);
    return { room, player, reconnected: false };
  }

  markDisconnected(room, socketId) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) {
      player.connected = false;
      player.socketId = null;
    }
    return player;
  }

  canStart(room) {
    return room.status === 'lobby' && room.players.length >= MIN_PLAYERS_TO_START;
  }

  /**
   * Randomly assigns each joined player to a unique mystery player_slot.
   * If the mystery has more character slots than joined humans (e.g. 4 players
   * started a game generated for 5), the leftover slot(s) become GM-controlled
   * NPCs with no assigned player.
   */
  assignSlots(room) {
    const slots = room.mystery.players.map((p) => p.player_slot);
    const shuffled = [...slots].sort(() => Math.random() - 0.5);
    room.players.forEach((player, i) => {
      player.slot = i < shuffled.length ? shuffled[i] : null;
      player.ready = false;
    });
  }

  getCharacterFor(room, slot) {
    const full = room.mystery.players.find((p) => p.player_slot === slot);
    if (!full) return null;
    // Never leak is_murderer or true_whereabouts to the client.
    const { is_murderer, true_whereabouts, ...safe } = full;
    return {
      ...safe,
      avatarUrl: avatarUrlFor(room.mystery.case_id, full.character_name),
      avatarUrlPressure: avatarUrlFor(room.mystery.case_id, full.character_name, 'pressure'),
    };
  }

  publicPlayerList(room) {
    return room.players.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      connected: p.connected,
      isHost: p.isHost,
      slot: p.slot,
      ready: p.ready,
      characterName:
        p.slot && room.mystery ? room.mystery.players.find((m) => m.player_slot === p.slot)?.character_name : null,
    }));
  }

  /** Public roster of characters (for the vote panel / player list), no secrets. */
  publicCharacterRoster(room) {
    if (!room.mystery) return [];
    return room.mystery.players.map((c) => ({
      slot: c.player_slot,
      name: c.character_name,
      publicBio: c.public_bio,
      controlledBy: room.players.find((p) => p.slot === c.player_slot)?.name || null,
      avatarUrl: avatarUrlFor(room.mystery.case_id, c.character_name),
      avatarUrlPressure: avatarUrlFor(room.mystery.case_id, c.character_name, 'pressure'),
    }));
  }

  /** slot -> {neutral, pressure} avatarUrl map, so the frontend can decorate messages by authorSlot. */
  avatarMap(room) {
    if (!room.mystery) return {};
    return Object.fromEntries(
      room.mystery.players.map((c) => [
        c.player_slot,
        {
          neutral: avatarUrlFor(room.mystery.case_id, c.character_name),
          pressure: avatarUrlFor(room.mystery.case_id, c.character_name, 'pressure'),
        },
      ])
    );
  }

  /** sceneKey -> URL map for the VN background layer. */
  sceneMap(room) {
    if (!room.mystery) return {};
    const setting = encodeURIComponent(room.mystery.setting || '');
    return Object.fromEntries(
      SCENE_KEYS.map((key) => [key, `${sceneUrlFor(room.mystery.case_id, key)}?setting=${setting}`])
    );
  }

  toSnapshot(room) {
    return {
      id: room.id,
      roomCode: room.code,
      caseId: room.mystery?.case_id,
      caseTitle: room.mystery?.case_title,
      status: room.status,
      theme: room.theme,
      difficulty: room.difficulty,
      mystery: room.mystery,
      players: room.players.map(({ socketId, ...rest }) => rest),
      transcript: room.transcript,
      events: room.events,
      clues: room.clues,
      votes: Object.entries(room.votes).map(([slot, targetSlot]) => ({
        slot: Number(slot),
        targetSlot,
      })),
      reveal: room.reveal || null,
      createdAt: room.createdAt,
      finishedAt: room.finishedAt,
    };
  }
}

export const roomManager = new RoomManager();
export { MIN_PLAYERS_TO_START, MAX_PLAYERS, VALID_DIFFICULTIES, normalizeDifficulty };
