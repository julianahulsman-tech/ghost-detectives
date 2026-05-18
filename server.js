import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const DIST = path.join(__dirname, 'dist');
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  if (req.url === '/lan') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ lan: true }));
    return;
  }
  let filePath = req.url === '/' ? '/ghost-detectives.html' : req.url;
  filePath = path.join(DIST, filePath.split('?')[0]);
  try {
    const data = fs.readFileSync(filePath);
    const ext  = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server });

// parties: Map<code, { code, hostId, players: Map<id, {id,name}>, wsMap: Map<id, ws> }>
const parties = new Map();
const wsToInfo = new Map(); // ws → { code, playerId }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  let code;
  do { code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (parties.has(code));
  return code;
}

function memberList(party) {
  return Array.from(party.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.id === party.hostId }));
}

function broadcastParty(code, msg, except = null) {
  const party = parties.get(code);
  if (!party) return;
  const data = JSON.stringify(msg);
  for (const [, ws] of party.wsMap) {
    if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'createParty') {
        const code = generateCode();
        const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const party = { code, hostId: playerId, players: new Map(), wsMap: new Map() };
        party.players.set(playerId, { id: playerId, name: msg.name || 'Detective' });
        party.wsMap.set(playerId, ws);
        parties.set(code, party);
        wsToInfo.set(ws, { code, playerId });
        ws.send(JSON.stringify({ type: 'partyCreated', code, playerId, members: memberList(party) }));
      }

      else if (msg.type === 'joinParty') {
        const code = (msg.code || '').toUpperCase().trim();
        const party = parties.get(code);
        if (!party) { ws.send(JSON.stringify({ type: 'error', message: 'Party not found. Check the code and try again.' })); return; }
        if (party.players.size >= 4) { ws.send(JSON.stringify({ type: 'error', message: 'Party is full (max 4 players).' })); return; }
        const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        party.players.set(playerId, { id: playerId, name: msg.name || 'Detective' });
        party.wsMap.set(playerId, ws);
        wsToInfo.set(ws, { code, playerId });
        ws.send(JSON.stringify({ type: 'partyJoined', code, playerId, hostId: party.hostId, members: memberList(party) }));
        broadcastParty(code, { type: 'partyUpdate', members: memberList(party) }, ws);
      }

      else if (msg.type === 'launchGame') {
        const info = wsToInfo.get(ws);
        if (!info) return;
        const party = parties.get(info.code);
        if (!party || party.hostId !== info.playerId) return;
        const payload = JSON.stringify({ type: 'gameStarted', params: msg.params });
        for (const [, client] of party.wsMap) {
          if (client.readyState === WebSocket.OPEN) client.send(payload);
        }
      }

      else if (msg.type === 'move') {
        const info = wsToInfo.get(ws);
        if (!info) return;
        broadcastParty(info.code, {
          type: 'playerMoved', playerId: info.playerId,
          position: msg.position, rotation: msg.rotation, currentRoomId: msg.currentRoomId,
        }, ws);
      }

    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => {
    const info = wsToInfo.get(ws);
    if (info) {
      const party = parties.get(info.code);
      if (party) {
        party.players.delete(info.playerId);
        party.wsMap.delete(info.playerId);
        if (party.players.size === 0) {
          parties.delete(info.code);
        } else {
          if (party.hostId === info.playerId) {
            party.hostId = party.players.keys().next().value;
          }
          broadcastParty(info.code, { type: 'partyUpdate', members: memberList(party) });
        }
      }
      wsToInfo.delete(ws);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n🎮 Ghost Detectives Server\n`);
  console.log(`Local:  http://localhost:${PORT}`);
  console.log(`LAN:    http://${localIP}:${PORT}`);
  console.log(`\nShare the LAN address with friends on your network.\n`);
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
