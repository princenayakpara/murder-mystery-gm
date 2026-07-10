import { roomManager } from '../rooms/roomManager.js';
import { gameMaster } from '../gm/gameMaster.js';
import { saveSnapshot } from '../db/index.js';

const TIME_STALL_INTERVAL_MS = 20 * 1000;
const activeRoomIntervals = new Map();

function persist(room) {
  saveSnapshot(roomManager.toSnapshot(room));
}

function broadcastLobby(io, room) {
  io.to(room.code).emit('lobby:update', {
    roomCode: room.code,
    status: room.status,
    players: roomManager.publicPlayerList(room),
    canStart: roomManager.canStart(room),
  });
}

function sendPrivateCharacter(io, room, player) {
  if (!player.socketId || player.slot == null) return;
  const character = roomManager.getCharacterFor(room, player.slot);
  io.to(player.socketId).emit('game:character', character);
}

function broadcastMessage(io, room, message) {
  if (!message) return;
  io.to(room.code).emit('chat:message', message);
}

function broadcastClueIfAny(io, room, beforeClueCount) {
  if (room.clues.length > beforeClueCount) {
    const clue = room.clues[room.clues.length - 1];
    io.to(room.code).emit('clue:new', clue);
  }
}

function broadcastVoteStatus(io, room) {
  const votedSlots = Object.keys(room.votes).map(Number);
  const eligible = room.players.filter((p) => p.slot != null);
  io.to(room.code).emit('vote:update', {
    votedCount: votedSlots.length,
    totalEligible: eligible.length,
    votedSlots,
  });
}

async function runReveal(io, room) {
  if (room.status === 'revealed') return;
  room.status = 'revealed';
  room.finishedAt = Date.now();
  const reveal = await gameMaster.generateReveal(room);
  persist(room);
  io.to(room.code).emit('game:status', { status: room.status });
  io.to(room.code).emit('game:reveal', {
    reveal,
    roster: roomManager.publicCharacterRoster(room),
    votes: room.votes,
  });
  stopTimeStallInterval(room.code);
}

function maybeAutoReveal(io, room) {
  const eligible = room.players.filter((p) => p.slot != null);
  const votedCount = Object.keys(room.votes).length;
  if (eligible.length > 0 && votedCount >= eligible.length) {
    runReveal(io, room);
  }
}

function startTimeStallInterval(io, room) {
  if (activeRoomIntervals.has(room.code)) return;
  const handle = setInterval(async () => {
    if (room.status !== 'investigating') return;
    const beforeClueCount = room.clues.length;
    const event = await gameMaster.tickTimeStall(room);
    if (event) {
      broadcastMessage(io, room, event);
      broadcastClueIfAny(io, room, beforeClueCount);
      persist(room);
    }
  }, TIME_STALL_INTERVAL_MS);
  activeRoomIntervals.set(room.code, handle);
}

function stopTimeStallInterval(roomCode) {
  const handle = activeRoomIntervals.get(roomCode);
  if (handle) {
    clearInterval(handle);
    activeRoomIntervals.delete(roomCode);
  }
}

function fullStateForReconnect(room, player) {
  return {
    roomCode: room.code,
    status: room.status,
    players: roomManager.publicPlayerList(room),
    transcript: room.transcript,
    clues: room.clues,
    character: player.slot != null ? roomManager.getCharacterFor(room, player.slot) : null,
    roster: room.status === 'lobby' ? [] : roomManager.publicCharacterRoster(room),
    reveal: room.status === 'revealed' ? room.reveal : null,
    hasVoted: room.votes[player.slot] != null,
  };
}

export function registerHandlers(io, socket) {
  socket.on('room:create', ({ hostName } = {}, cb) => {
    try {
      const { room, player } = roomManager.createRoom(hostName);
      player.socketId = socket.id;
      player.connected = true;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.playerId = player.playerId;
      persist(room);
      cb?.({ ok: true, roomCode: room.code, playerId: player.playerId });
      broadcastLobby(io, room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on('room:join', ({ roomCode, name, playerId } = {}, cb) => {
    const result = roomManager.joinRoom({ roomCode: (roomCode || '').toUpperCase(), name, playerId, socketId: socket.id });
    if (result.error) {
      cb?.({ ok: false, error: result.error });
      return;
    }
    const { room, player, reconnected } = result;
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = player.playerId;

    cb?.({
      ok: true,
      roomCode: room.code,
      playerId: player.playerId,
      reconnected,
      state: fullStateForReconnect(room, player),
    });

    if (reconnected && player.slot != null) {
      sendPrivateCharacter(io, room, player);
    }
    broadcastLobby(io, room);
    persist(room);
  });

  socket.on('game:start', async ({ roomCode, theme } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return cb?.({ ok: false, error: 'Room not found.' });
    const requester = room.players.find((p) => p.socketId === socket.id);
    if (!requester?.isHost) return cb?.({ ok: false, error: 'Only the host can start the game.' });
    if (!roomManager.canStart(room)) return cb?.({ ok: false, error: 'Need at least 4 players to start.' });

    try {
      const playerCount = Math.min(8, Math.max(5, room.players.length));
      const { mystery, source, reason } = await gameMaster.generateMystery({ theme, playerCount });
      room.mystery = mystery;
      room.theme = theme || null;
      room.status = 'briefing';
      gameMaster.initRoom(room);
      roomManager.assignSlots(room);

      cb?.({ ok: true, source, reason });
      io.to(room.code).emit('game:status', { status: room.status, caseTitle: mystery.case_title, source });
      room.players.forEach((p) => sendPrivateCharacter(io, room, p));
      broadcastLobby(io, room);
      startTimeStallInterval(io, room);
      persist(room);
    } catch (err) {
      console.error('[game:start] failed:', err);
      cb?.({ ok: false, error: 'Failed to generate a mystery. Please try again.' });
    }
  });

  socket.on('briefing:ready', ({ roomCode } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== 'briefing') return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    player.ready = true;

    const assigned = room.players.filter((p) => p.slot != null);
    const allReady = assigned.every((p) => p.ready);
    io.to(room.code).emit('briefing:update', {
      readyCount: assigned.filter((p) => p.ready).length,
      total: assigned.length,
    });

    if (allReady) {
      room.status = 'investigating';
      io.to(room.code).emit('game:status', { status: room.status });
      io.to(room.code).emit('roster:reveal', roomManager.publicCharacterRoster(room));
      const opening = {
        id: `sys_${Date.now()}`,
        ts: Date.now(),
        type: 'system',
        authorSlot: null,
        authorName: 'Game Master',
        text: `The investigation into the death of ${room.mystery.victim.name} begins. Talk to each other, ask the Game Master to inspect anything, and vote when you're ready to name the killer.`,
      };
      room.transcript.push(opening);
      broadcastMessage(io, room, opening);
      persist(room);
    }
  });

  socket.on('chat:send', async ({ roomCode, text } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== 'investigating') return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || !text?.trim()) return;

    const beforeClueCount = room.clues.length;
    const { message, event } = await gameMaster.handleChatMessage(room, {
      slot: player.slot,
      name: player.name,
      text: text.trim().slice(0, 2000),
    });
    broadcastMessage(io, room, message);
    if (event) {
      broadcastMessage(io, room, event);
      broadcastClueIfAny(io, room, beforeClueCount);
    }
    persist(room);
  });

  socket.on('gm:ask', async ({ roomCode, question } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== 'investigating') return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || !question?.trim()) return;

    const { questionMsg, answerMsg } = await gameMaster.answerQuestion(room, {
      slot: player.slot,
      name: player.name,
      question: question.trim().slice(0, 500),
    });
    broadcastMessage(io, room, questionMsg);
    broadcastMessage(io, room, answerMsg);
    persist(room);
  });

  socket.on('player:accuse', async ({ roomCode, targetSlot } = {}) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== 'investigating') return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || targetSlot == null) return;

    const beforeClueCount = room.clues.length;
    const { message, event } = await gameMaster.handleAccusation(room, {
      slot: player.slot,
      name: player.name,
      targetSlot: Number(targetSlot),
    });
    broadcastMessage(io, room, message);
    if (event) {
      broadcastMessage(io, room, event);
      broadcastClueIfAny(io, room, beforeClueCount);
    }
    persist(room);
  });

  socket.on('player:vote', ({ roomCode, targetSlot } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.status !== 'investigating') return cb?.({ ok: false, error: 'Voting is not open.' });
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || player.slot == null) return cb?.({ ok: false, error: 'You are not an active player.' });

    room.votes[player.slot] = Number(targetSlot);
    const sysMsg = {
      id: `sys_${Date.now()}_${player.slot}`,
      ts: Date.now(),
      type: 'system',
      authorSlot: null,
      authorName: 'Game Master',
      text: `${player.name} has cast their final vote.`,
    };
    room.transcript.push(sysMsg);
    broadcastMessage(io, room, sysMsg);
    broadcastVoteStatus(io, room);
    persist(room);
    cb?.({ ok: true });
    maybeAutoReveal(io, room);
  });

  socket.on('game:end', async ({ roomCode } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return cb?.({ ok: false, error: 'Room not found.' });
    const requester = room.players.find((p) => p.socketId === socket.id);
    if (!requester?.isHost) return cb?.({ ok: false, error: 'Only the host can end the game.' });
    if (room.status !== 'investigating') return cb?.({ ok: false, error: 'Game is not in progress.' });

    await runReveal(io, room);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    roomManager.markDisconnected(room, socket.id);
    broadcastLobby(io, room);
    persist(room);
  });
}

export function resumeRoomTimers(io, rooms) {
  for (const room of rooms) {
    if (room.status === 'investigating') {
      startTimeStallInterval(io, room);
    }
  }
}
