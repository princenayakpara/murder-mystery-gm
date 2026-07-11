import { io } from 'socket.io-client';

const SERVER = 'http://localhost:4000';
const NAMES = ['Priya', 'Rohan', 'Zara', 'Vikram'];

function connect() {
  return new Promise((resolve) => {
    const s = io(SERVER, { reconnection: false });
    s.on('connect', () => resolve(s));
  });
}
function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function main() {
  const sockets = [];
  for (const name of NAMES) sockets.push({ name, socket: await connect() });
  const host = sockets[0];
  const { roomCode, playerId } = await emit(host.socket, 'room:create', { hostName: host.name });
  const joinResults = [{ roomCode, playerId, name: host.name }];
  for (let i = 1; i < sockets.length; i++) {
    const res = await emit(sockets[i].socket, 'room:join', { roomCode, name: sockets[i].name });
    joinResults.push({ roomCode, playerId: res.playerId, name: sockets[i].name });
  }

  await emit(host.socket, 'game:start', { roomCode, theme: '', difficulty: 'medium' });
  await new Promise((r) => setTimeout(r, 800));
  sockets.forEach(({ socket }) => socket.emit('briefing:ready', { roomCode }));
  await new Promise((r) => setTimeout(r, 800));

  sockets[0].socket.emit('chat:send', { roomCode, text: 'Where was everyone during the blackout?' });
  await new Promise((r) => setTimeout(r, 600));
  sockets[1].socket.emit('chat:send', { roomCode, text: 'I was near the sangeet the whole time, honestly.' });
  await new Promise((r) => setTimeout(r, 600));

  console.log(JSON.stringify(joinResults, null, 2));
  await new Promise((r) => setTimeout(r, 120000));
}
main().catch((e) => { console.error(e); process.exit(1); });
