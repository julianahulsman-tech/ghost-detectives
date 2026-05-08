import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager.js';
import { RoomManager } from './engine/RoomManager.js';
import { PlayerController } from './engine/PlayerController.js';
import { LightingManager } from './engine/LightingManager.js';
import { GhostRenderer } from './engine/GhostRenderer.js';
import { PlayerRenderer } from './engine/PlayerRenderer.js';
import { SocketClient } from './network/SocketClient.js';
import { HUD } from './ui/HUD.js';
import { Journal } from './ui/Journal.js';
import { MapTablet } from './ui/MapTablet.js';
import { DeathScreen, showEndScreen } from './ui/DeathScreen.js';
import { ToolManager } from './tools/ToolManager.js';
import { EV, PLAYER_HEIGHT, MAX_PLAYERS } from '@shared/constants.js';
import { ROOMS, ROOM_MAP } from '@server/data/house.js';

// ── Init systems ────────────────────────────────────────────────────────────
const scene = new SceneManager();
const rooms = new RoomManager(scene.scene);
const lights = new LightingManager(scene.scene);
const ghostRenderer = new GhostRenderer(scene.scene);
const playerRenderer = new PlayerRenderer(scene.scene);
const network = new SocketClient();
const hud = new HUD();
const mapTablet = new MapTablet();
const clock = new THREE.Clock();

// Player controller — spawns at foyer center
const player = new PlayerController(scene.camera, scene.renderer.domElement);
scene.camera.position.set(0, PLAYER_HEIGHT, 0);

const journal = new Journal((ghostId) => {
  network.submitGuess(ghostId);
});

const deathScreen = new DeathScreen(() => {
  player.becomeSpectator();
  deathScreen.hide();
});

const toolMgr = new ToolManager(scene.camera, scene.scene, hud, scene, network);
toolMgr.tools.sensor.setMapTablet(mapTablet);

// ── Lobby UI ────────────────────────────────────────────────────────────────
let localId = null;
let gameStarted = false;
let isHost = false;
let currentRoomId = 'foyer';

const nameInput = document.getElementById('name-input');
const startBtn = document.getElementById('start-btn');

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter' && nameInput.value.trim()) connectToGame();
});

function connectToGame() {
  const name = nameInput.value.trim() || 'Detective';
  network.join(name);
  nameInput.disabled = true;
  startBtn.textContent = 'Waiting for host...';
}

network.on('connect', () => {
  localId = network.socket.id;
  startBtn.disabled = false;
  startBtn.textContent = 'JOIN GAME';
  startBtn.onclick = () => {
    if (!nameInput.value.trim()) return;
    connectToGame();
    startBtn.disabled = true;
  };
});

network.on('session:info', (data) => {
  isHost = data.isHost;
  hud.setSessionId(data.sessionId);
  if (data.isHost) {
    startBtn.textContent = 'START INVESTIGATION';
    startBtn.disabled = false;
    startBtn.onclick = () => network.startGame();
  } else {
    startBtn.textContent = 'Waiting for host...';
    startBtn.disabled = true;
  }
  // Pre-receive fingerprint locations
  if (data.fingerprintLocations?.length) {
    toolMgr.onFingerprintLocations(data.fingerprintLocations);
  }
});

network.on('lobby:update', (data) => {
  const list = document.getElementById('player-list');
  list.innerHTML = data.players.map(p => `<div style="color:#888">${p.name}</div>`).join('');
  hud.setPlayerCount(data.players.length, MAX_PLAYERS);
});

// ── Game start ──────────────────────────────────────────────────────────────
network.on(EV.GAME_START, () => {
  gameStarted = true;
  document.getElementById('lobby').style.display = 'none';
  hud.show();
  const clickStart = document.getElementById('click-start');
  clickStart.style.display = 'flex';
  clickStart.addEventListener('click', () => {
    clickStart.style.display = 'none';
    player.lock();
  }, { once: true });
});

// ── Server events ────────────────────────────────────────────────────────────
let moveThrottle = 0;

network.on(EV.STATE_PLAYERS, (players) => {
  playerRenderer.update(players, localId);
});

network.on(EV.STATE_SANITY, (data) => {
  hud.setSanity(data.personal);
});

network.on(EV.STATE_GHOST, (data) => {
  ghostRenderer.setTarget(data.position);
  ghostRenderer.setVisible(data.isVisible);
});

network.on(EV.EVIDENCE_EMF, (data) => {
  toolMgr.onEMFUpdate(data.level);
});

network.on(EV.EVIDENCE_TEMPERATURE, (data) => {
  toolMgr.onTemperature(data.temp);
  // Update map floor if temperature is very cold (possible ghost room hint)
  const roomData = ROOM_MAP[data.roomId];
  if (roomData) mapTablet.setFloor(roomData.floor);
});

network.on(EV.EVIDENCE_GHOST_ORBS, (data) => {
  toolMgr.onGhostOrbs(data.active);
  const pos = scene.camera.position;
  toolMgr.tools.goggles.setOrbOrigin(pos);
});

network.on(EV.EVIDENCE_FINGERPRINT_LOCATIONS, (locs) => {
  toolMgr.onFingerprintLocations(locs);
});

network.on(EV.EVIDENCE_WRITING, (data) => {
  toolMgr.onWriting(data);
});

network.on(EV.EVIDENCE_MOTION_SENSOR, (data) => {
  toolMgr.onMotionSensor(data);
});

network.on(EV.EVIDENCE_SPIRIT_BOX_RESPONSE, (data) => {
  toolMgr.onSpiritBoxResponse(data);
});

network.on('evidence:sensorPlaced', (data) => {
  toolMgr.onSensorPlaced(data);
});

network.on('evidence:notebookPlaced', (data) => {
  toolMgr.onNotebookPlaced(data);
});

// ── Hunt events ──────────────────────────────────────────────────────────────
network.on(EV.EVENT_HUNT_WARNING, (data) => {
  hud.showHuntWarning(true, `⚠ HUNT IN ${data.secsRemaining}s ⚠`);
  setTimeout(() => hud.showHuntWarning(false), (data.secsRemaining - 0.5) * 1000);
});

network.on(EV.EVENT_HUNT_START, () => {
  hud.showHuntWarning(true, '⚠ HUNT IN PROGRESS ⚠');
  // Journal closes during hunt
  journal.hide();
  mapTablet.hide();
});

network.on(EV.EVENT_HUNT_END, () => {
  hud.showHuntWarning(false);
  ghostRenderer.setVisible(false);
  network.sendHiding(false);
  player.exitCloset();
});

network.on(EV.EVENT_PLAYER_DIED, (data) => {
  if (data.playerId === localId) {
    deathScreen.show();
    player.isDead = true;
  } else {
    hud.showEvidencePopup(`${data.name} has died.`);
  }
});

// ── Power toggle ─────────────────────────────────────────────────────────────
network.on(EV.EVENT_POWER_TOGGLE, (data) => {
  lights.setPower(data.enabled);
  hud.showEvidencePopup(data.enabled ? 'Power restored.' : 'Power cut!');
});

// ── Fuse box interaction (E key near boiler_room fuse box) ───────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && currentRoomId === 'boiler_room' && !journal.isVisible()) {
    const pos = scene.camera.position;
    const fuseBox = ROOM_MAP['boiler_room'].fuseBoxPos;
    if (fuseBox) {
      const dist = Math.sqrt((pos.x - fuseBox.x) ** 2 + (pos.z - fuseBox.z) ** 2);
      if (dist < 2.5) {
        network.togglePower();
      }
    }
  }
});

// ── Closet hiding (E key near closet during hunt) ───────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !journal.isVisible()) {
    const pos = scene.camera.position;
    const room = ROOM_MAP[currentRoomId];
    if (!room) return;

    if (player.isHiding) {
      player.exitCloset();
      network.sendHiding(false);
      return;
    }

    // Check distance to closet
    const cp = room.closetPos;
    const dist = Math.sqrt((pos.x - cp.x) ** 2 + (pos.z - cp.z) ** 2);
    if (dist < 1.2) {
      player.enterCloset(room);
      network.sendHiding(true);
      hud.setInteractPrompt('[E] Exit closet');
    }
  }
});

// ── Win/Loss ─────────────────────────────────────────────────────────────────
network.on('game:ended', (data) => {
  showEndScreen(data);
  journal.hide();
  mapTablet.hide();
});

network.on(EV.GAME_INCORRECT, () => {
  hud.showEvidencePopup('Incorrect identification — keep investigating.');
});

// ── Game loop ─────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (gameStarted) {
    player.onStairTransition((destId, destPos) => {
      scene.camera.position.set(destPos.x, destPos.y, destPos.z);
      currentRoomId = destId;
    });

    player.update(delta, currentRoomId);
    currentRoomId = rooms.updateCurrentRoom(
      scene.camera.position.x,
      scene.camera.position.y,
      scene.camera.position.z
    );

    // Throttle move broadcast to 20Hz
    moveThrottle += delta;
    if (moveThrottle >= 0.05) {
      moveThrottle = 0;
      if (!player.isDead) {
        const euler = new THREE.Euler().setFromQuaternion(scene.camera.quaternion, 'YXZ');
        network.sendMove(scene.camera.position, euler.y, currentRoomId);
      }
    }

    const roomData = rooms.getRoomData(currentRoomId);
    if (roomData) hud.setRoom(roomData.name);

    toolMgr.update(delta, currentRoomId);
    ghostRenderer.update(delta);
    playerRenderer.tick();

    // Interact prompt: fuse box
    if (currentRoomId === 'boiler_room') {
      const pos = scene.camera.position;
      const fb = ROOM_MAP['boiler_room'].fuseBoxPos;
      if (fb) {
        const dist = Math.sqrt((pos.x - fb.x) ** 2 + (pos.z - fb.z) ** 2);
        if (dist < 2.5) hud.setInteractPrompt('[E] Toggle power');
        else hud.setInteractPrompt('');
      }
    } else if (!player.isHiding) {
      // Closet prompt
      const room = ROOM_MAP[currentRoomId];
      if (room) {
        const pos = scene.camera.position;
        const cp = room.closetPos;
        const dist = Math.sqrt((pos.x - cp.x) ** 2 + (pos.z - cp.z) ** 2);
        if (dist < 1.2) hud.setInteractPrompt('[E] Hide in closet');
        else hud.setInteractPrompt('');
      }
    }
  }

  scene.render();
}

animate();
