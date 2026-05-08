import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { EV, MAX_PLAYERS, PHASE } from '../shared/constants.js';
import GameSession from './GameSession.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Serve built client in production
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));

// ── Session management ───────────────────────────────────────────────────────
const sessions = new Map(); // sessionId → GameSession

function findOrCreateSession() {
  for (const [id, sess] of sessions) {
    if (sess.phase === PHASE.LOBBY && sess.playerCount() < MAX_PLAYERS) {
      return sess;
    }
  }
  const id = Math.random().toString(36).slice(2, 7).toUpperCase();
  const sess = new GameSession(id, io);
  sessions.set(id, sess);
  return sess;
}

function cleanupSession(sess) {
  if (sess.playerCount() === 0) {
    sess.stop();
    sessions.delete(sess.id);
    console.log(`[Session ${sess.id}] Cleaned up`);
  }
}

// ── Socket.io event handling ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  let mySession = null;

  // ── Join ────────────────────────────────────────────────────────
  socket.on(EV.PLAYER_JOIN, ({ name }) => {
    mySession = findOrCreateSession();
    mySession.addPlayer(socket.id, name);
    socket.join(mySession.id);

    socket.emit('session:info', {
      sessionId: mySession.id,
      isHost: mySession.playerCount() === 1,
      fingerprintLocations: mySession.evidence.fingerprintLocations,
    });

    broadcastLobby(mySession);
    console.log(`[${mySession.id}] ${name} joined (${mySession.playerCount()}/${MAX_PLAYERS})`);
  });

  // ── Movement ───────────────────────────────────────────────────
  socket.on(EV.PLAYER_MOVE, (data) => {
    if (!mySession) return;
    const p = mySession.players[socket.id];
    if (!p || p.isDead) return;
    p.position = data.position;
    p.rotation = data.rotation;
    p.currentRoomId = data.currentRoomId || p.currentRoomId;
  });

  // ── Tool changes ───────────────────────────────────────────────
  socket.on(EV.TOOL_HELD, (data) => {
    if (!mySession) return;
    const p = mySession.players[socket.id];
    if (p) p.heldToolId = data.toolId;
  });

  // ── Game start ─────────────────────────────────────────────────
  socket.on(EV.GAME_START, () => {
    if (!mySession) return;
    if (mySession.phase !== PHASE.LOBBY) return;
    // Only host (first player) can start
    const ids = Object.keys(mySession.players);
    if (ids[0] !== socket.id) return;
    if (ids.length === 0) return;
    mySession.start();
    io.to(mySession.id).emit(EV.GAME_START, {
      ghostRoomHint: null, // server never reveals ghost room
      egui_triggerItemId: mySession.triggerItemId,
    });
  });

  // ── Guess submission ───────────────────────────────────────────
  socket.on(EV.GAME_SUBMIT_GUESS, ({ ghostId }) => {
    if (!mySession) return;
    if (mySession.phase === PHASE.ENDED) return;
    const correct = mySession.ghostType()?.id === ghostId;
    if (correct) {
      mySession.phase = PHASE.ENDED;
      mySession.stop();
      mySession.emit('game:ended', {
        result: 'success',
        ghostType: mySession.ghostType(),
        ghostRoom: mySession.ghostRoomId(),
        solvedBy: mySession.players[socket.id]?.name,
      });
    } else {
      socket.emit(EV.GAME_INCORRECT, { guess: ghostId });
    }
  });

  // ── Spirit box ─────────────────────────────────────────────────
  socket.on(EV.TOOL_SPIRIT_BOX_ASK, ({ question }) => {
    if (!mySession) return;
    mySession._evidence?.handleSpiritBoxAsk(socket.id, question);
  });

  // ── Item placement ─────────────────────────────────────────────
  socket.on(EV.TOOL_MOTION_SENSOR_PLACE, (data) => {
    if (!mySession) return;
    mySession._evidence?.handleMotionSensorPlace(socket.id, data);
  });

  socket.on(EV.TOOL_NOTEBOOK_PLACE, (data) => {
    if (!mySession) return;
    mySession._evidence?.handleNotebookPlace(socket.id, data);
  });

  // ── Hiding ─────────────────────────────────────────────────────
  socket.on('player:hide', ({ hiding }) => {
    if (!mySession) return;
    const p = mySession.players[socket.id];
    if (p) p.isHiding = hiding;
  });

  // ── Power toggle ───────────────────────────────────────────────
  socket.on('player:togglePower', () => {
    if (!mySession) return;
    mySession.powerEnabled = !mySession.powerEnabled;
    io.to(mySession.id).emit(EV.EVENT_POWER_TOGGLE, { enabled: mySession.powerEnabled });
  });

  // ── Disconnect ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!mySession) return;
    const name = mySession.players[socket.id]?.name || 'Unknown';
    mySession.removePlayer(socket.id);
    broadcastLobby(mySession);
    console.log(`[${mySession.id}] ${name} left (${mySession.playerCount()} remaining)`);
    cleanupSession(mySession);
  });

  // ── Heartbeat: broadcast player states 20Hz ────────────────────
  // (done in a global interval below rather than per-socket)
});

// ── Global state broadcast loop (20Hz) ──────────────────────────────────────
setInterval(() => {
  for (const sess of sessions.values()) {
    if (sess.phase === PHASE.LOBBY || sess.phase === PHASE.ENDED) continue;
    io.to(sess.id).emit(EV.STATE_PLAYERS, sess.broadcastPlayersState());
  }
}, 50);

function broadcastLobby(sess) {
  io.to(sess.id).emit('lobby:update', {
    players: Object.values(sess.players).map(p => ({ id: p.id, name: p.name })),
    phase: sess.phase,
    sessionId: sess.id,
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Ghost Detectives server running on :${PORT}`));
