import { Server } from 'socket.io';
import { config } from '../config.js';
import { registerHandlers, resumeRoomTimers } from './handlers.js';
import { roomManager } from '../rooms/roomManager.js';
import { loadUnfinishedGames } from '../db/index.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    registerHandlers(io, socket);
  });

  // Rehydrate in-progress rooms from SQLite so a server restart doesn't lose active games.
  const unfinished = loadUnfinishedGames();
  const rooms = unfinished.map((snapshot) => roomManager.registerFromSnapshot(snapshot));
  if (rooms.length) {
    console.log(`[socket] Rehydrated ${rooms.length} in-progress room(s) from disk: ${rooms.map((r) => r.code).join(', ')}`);
  }
  resumeRoomTimers(io, rooms);

  return io;
}
