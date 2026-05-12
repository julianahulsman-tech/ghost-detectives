import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Serve HTML client
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'ghost-detectives.html')));
  } else if (req.url === '/lan') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ lan: true }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server });

// Game sessions: map sessionId → {players, gameState, lastUpdate}
const sessions = new Map();
const wsToSession = new Map(); // Track which session each WebSocket belongs to

function findOrCreateSession() {
  for (const [id, sess] of sessions) {
    if (sess.gameState.phase === 'INVESTIGATION' && Object.keys(sess.players).length < 4) {
      return id;
    }
  }
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  sessions.set(id, {
    players: {},
    gameState: { phase: 'LOBBY', players: {} },
    lastUpdate: Date.now(),
  });
  return id;
}

wss.on('connection', (ws) => {
  let playerId = null, sessionId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'join') {
        sessionId = findOrCreateSession();
        wsToSession.set(ws, sessionId);
        playerId = `p_${Date.now()}_${Math.random()}`;
        const sess = sessions.get(sessionId);

        sess.players[playerId] = {
          id: playerId,
          name: msg.name || 'Player',
          position: {x:0, y:1.7, z:9},
          rotation: {y:0},
          sanity: 100,
          isDead: false,
          isHiding: false,
          currentRoomId: 'van',
          heldToolId: null,
        };

        // Send join response
        ws.send(JSON.stringify({
          type: 'joined',
          sessionId,
          playerId,
          players: Object.values(sess.players),
        }));

        // Broadcast to others in session
        broadcast(sessionId, {
          type: 'playerJoined',
          playerId,
          player: sess.players[playerId],
        }, ws);
      }

      else if (msg.type === 'move') {
        const sess = sessions.get(sessionId);
        if (sess && sess.players[playerId]) {
          const p = sess.players[playerId];
          p.position = msg.position;
          p.rotation = msg.rotation;
          p.currentRoomId = msg.currentRoomId;
        }
      }

      else if (msg.type === 'state') {
        const sess = sessions.get(sessionId);
        if (sess) sess.gameState = msg.state;
      }

      else if (msg.type === 'broadcast') {
        broadcast(sessionId, msg.data);
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => {
    if (sessionId && playerId) {
      const sess = sessions.get(sessionId);
      if (sess) {
        delete sess.players[playerId];
        broadcast(sessionId, { type: 'playerLeft', playerId });
        if (Object.keys(sess.players).length === 0) sessions.delete(sessionId);
      }
    }
    wsToSession.delete(ws);
  });
});

function broadcast(sessionId, msg, except = null) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client !== except && wsToSession.get(client) === sessionId && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n🎮 Ghost Detectives LAN Server\n`);
  console.log(`Local:  http://localhost:${PORT}`);
  console.log(`LAN:    http://${localIP}:${PORT}`);
  console.log(`\nShare the LAN address with players on your network.\n`);
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
