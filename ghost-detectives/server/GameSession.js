import { GHOST_TYPES } from '../shared/ghostData.js';
import { GHOST_ROOM_POOL, ROOM_MAP, ROOMS, bfsPath, roomCenter } from './data/house.js';
import { PHASE, EVIDENCE } from '../shared/constants.js';
import SanityManager from './SanityManager.js';
import EvidenceManager from './EvidenceManager.js';
import GhostController from './GhostController.js';
import HuntManager from './HuntManager.js';

export default class GameSession {
  constructor(sessionId, io) {
    this.id = sessionId;
    this.io = io;
    this.phase = PHASE.LOBBY;

    // Hidden from clients
    this._ghostType = null;
    this._ghostRoomId = null;

    this.powerEnabled = true;
    this.triggerItemId = null; // for Egui ability

    this.players = {}; // socketId → player state

    this.ghost = {
      position: { x: 0, y: 1.7, z: 0 },
      currentRoomId: null,
      isVisible: false,
      speedMultiplier: 1,
      targetPlayerId: null,
    };

    this.evidence = {
      emf5Available: false,
      freezingTempsAvailable: false,
      fingerprintsAvailable: false,
      ghostOrbsAvailable: false,
      spiritBoxAvailable: false,
      writingAvailable: false,
      motionSensorActive: false,
      writingTriggered: false,
      fingerprintLocations: [],
    };

    this.huntState = {
      isActive: false,
      startTime: 0,
      duration: 30000,
      nextHuntTime: Date.now() + 120000,
    };

    this.teamAverageSanity = 100;

    // Sub-managers created when game starts
    this._sanity = null;
    this._evidence = null;
    this._ghost = null;
    this._hunt = null;
  }

  addPlayer(socketId, name) {
    this.players[socketId] = {
      id: socketId,
      name: name || `Player ${Object.keys(this.players).length + 1}`,
      position: { x: 0, y: 1.7, z: 0 },
      rotation: { y: 0 },
      sanity: 100,
      isDead: false,
      isHiding: false,
      currentRoomId: 'foyer',
      heldToolId: null,
      placedItems: [],
    };
  }

  removePlayer(socketId) {
    delete this.players[socketId];
  }

  playerCount() {
    return Object.keys(this.players).length;
  }

  livingPlayers() {
    return Object.values(this.players).filter(p => !p.isDead);
  }

  playersInRoom(roomId) {
    return Object.values(this.players).filter(p => p.currentRoomId === roomId && !p.isDead);
  }

  start() {
    this.phase = PHASE.INVESTIGATION;

    // Pick ghost type and room
    this._ghostType = GHOST_TYPES[Math.floor(Math.random() * GHOST_TYPES.length)];
    this._ghostRoomId = GHOST_ROOM_POOL[Math.floor(Math.random() * GHOST_ROOM_POOL.length)];

    // For Egui: pick a random trigger item
    const tools = ['emf', 'thermometer', 'goggles', 'uv', 'notebook', 'motionSensor'];
    this.triggerItemId = tools[Math.floor(Math.random() * tools.length)];

    // Set evidence availability
    const ev = this._ghostType.evidence;
    this.evidence.emf5Available = ev.includes(EVIDENCE.EMF5);
    this.evidence.freezingTempsAvailable = ev.includes(EVIDENCE.FREEZING_TEMPS);
    this.evidence.fingerprintsAvailable = ev.includes(EVIDENCE.FINGERPRINTS);
    this.evidence.ghostOrbsAvailable = ev.includes(EVIDENCE.GHOST_ORBS);
    this.evidence.spiritBoxAvailable = ev.includes(EVIDENCE.SPIRIT_BOX);
    this.evidence.writingAvailable = ev.includes(EVIDENCE.WRITING);

    // Seed fingerprint locations in and near ghost room
    if (this.evidence.fingerprintsAvailable) {
      this.evidence.fingerprintLocations = this._seedFingerprints();
    }

    // Place ghost at ghost room center
    const ghostRoom = ROOM_MAP[this._ghostRoomId];
    const gc = roomCenter(ghostRoom);
    this.ghost.position = { x: gc.x, y: gc.y, z: gc.z };
    this.ghost.currentRoomId = this._ghostRoomId;

    // Start sub-managers
    this._sanity = new SanityManager(this);
    this._evidence = new EvidenceManager(this);
    this._ghost = new GhostController(this);
    this._hunt = new HuntManager(this);

    this._sanity.start();
    this._evidence.start();
    this._ghost.start();
    this._hunt.start();

    console.log(`[Session ${this.id}] Started. Ghost: ${this._ghostType.name} in ${this._ghostRoomId}`);
  }

  stop() {
    this._sanity?.stop();
    this._evidence?.stop();
    this._ghost?.stop();
    this._hunt?.stop();
    this.phase = PHASE.ENDED;
  }

  _seedFingerprints() {
    // Place fingerprints on wall surfaces in the ghost room and 1 adjacent room
    const room = ROOM_MAP[this._ghostRoomId];
    const locs = [];
    const { min, max } = room.bounds;
    const floorY = min.y + 1.2;

    // 4 fingerprint spots on the 4 walls of the ghost room
    locs.push(
      { roomId: this._ghostRoomId, worldPos: { x: (min.x + max.x) / 2, y: floorY, z: min.z + 0.05 } },
      { roomId: this._ghostRoomId, worldPos: { x: (min.x + max.x) / 2, y: floorY, z: max.z - 0.05 } },
      { roomId: this._ghostRoomId, worldPos: { x: min.x + 0.05, y: floorY, z: (min.z + max.z) / 2 } },
      { roomId: this._ghostRoomId, worldPos: { x: max.x - 0.05, y: floorY, z: (min.z + max.z) / 2 } },
    );

    // 1-2 fingerprints in an adjacent room
    for (const adjId of room.connections.slice(0, 2)) {
      const adj = ROOM_MAP[adjId];
      if (!adj) continue;
      const { min: am, max: ax } = adj.bounds;
      locs.push({ roomId: adjId, worldPos: { x: (am.x + ax.x) / 2, y: am.y + 1.2, z: (am.z + ax.z) / 2 } });
    }

    return locs;
  }

  // Called by EvidenceManager — checks Shade ability
  canEmitEvidence(playersInGhostRoom) {
    if (this._ghostType?.specialAbility === 'withholdEvidenceInGroup') {
      return playersInGhostRoom < 2;
    }
    return true;
  }

  // Called by HuntManager/GhostController
  ghostRoomId() { return this._ghostRoomId; }
  ghostType() { return this._ghostType; }

  emit(event, data) {
    this.io.to(this.id).emit(event, data);
  }

  emitTo(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }

  broadcastPlayersState() {
    const pub = {};
    for (const [id, p] of Object.entries(this.players)) {
      pub[id] = {
        id: p.id,
        name: p.name,
        position: p.position,
        rotation: p.rotation,
        isDead: p.isDead,
        isHiding: p.isHiding,
        currentRoomId: p.currentRoomId,
        heldToolId: p.heldToolId,
      };
    }
    return pub;
  }

  checkEndConditions() {
    const living = this.livingPlayers();
    if (living.length === 0 && this.playerCount() > 0) {
      this.phase = PHASE.ENDED;
      this.stop();
      this.emit('game:ended', {
        result: 'failure',
        ghostType: this._ghostType,
        ghostRoom: this._ghostRoomId,
        reason: 'All investigators perished.',
      });
    }
  }
}
