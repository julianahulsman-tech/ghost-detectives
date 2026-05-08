import { EV } from '../shared/constants.js';
import { ROOM_MAP } from './data/house.js';

const GHOST_RESPONSES = [
  'Leave...', 'Get out', 'You shouldn\'t be here', 'Help me', 'I\'m watching you',
  'Why are you here?', 'Run', 'You\'re next', 'I see you', 'Go away',
];

const WRITING_MESSAGES = [
  'Get out', 'You\'re next', "Don't look behind you",
  'I see you', 'Leave before it\'s too late', 'They\'re all dead',
  'Help me find peace', 'IT WAS ME', 'RUN',
];

export default class EvidenceManager {
  constructor(session) {
    this.session = session;
    this._intervals = [];
    this._motionSensorTimers = new Map(); // sensorId → timeout
    this._writingInterval = null;
    this._emfInterval = null;
    this._tempInterval = null;
    this._orbInterval = null;
  }

  start() {
    // Send fingerprint locations to all clients immediately
    const sess = this.session;
    sess.emit(EV.EVIDENCE_FINGERPRINT_LOCATIONS, sess.evidence.fingerprintLocations);

    // EMF ticks every 3-5s
    this._emfTick();

    // Temperature ticks every 2s
    this._tempInterval = setInterval(() => this._tempTick(), 2000);

    // Ghost orbs tick every 4s
    this._orbInterval = setInterval(() => this._orbTick(), 4000);

    // Writing tick every 12-20s
    this._scheduleWriting();
  }

  stop() {
    clearInterval(this._tempInterval);
    clearInterval(this._orbInterval);
    clearInterval(this._writingInterval);
    for (const t of this._motionSensorTimers.values()) clearTimeout(t);
  }

  handleSpiritBoxAsk(socketId, question) {
    const sess = this.session;
    if (!sess.evidence.spiritBoxAvailable) return;
    const player = sess.players[socketId];
    if (!player) return;

    // Must be alone in ghost room
    if (player.currentRoomId !== sess.ghostRoomId()) return;
    const inRoom = sess.playersInRoom(sess.ghostRoomId());
    if (inRoom.length !== 1) return;

    const response = GHOST_RESPONSES[Math.floor(Math.random() * GHOST_RESPONSES.length)];
    sess.emitTo(socketId, EV.EVIDENCE_SPIRIT_BOX_RESPONSE, { response, question });

    // Ghost may react (move toward player)
    // GhostController handles this separately
  }

  handleMotionSensorPlace(socketId, sensorData) {
    const sess = this.session;
    const sensorId = `sensor_${socketId}_${Date.now()}`;
    const player = sess.players[socketId];
    if (!player) return;

    player.placedItems.push({ toolId: 'motionSensor', roomId: player.currentRoomId, sensorId, worldPos: sensorData.worldPos });

    // Notify all clients of new sensor placement
    sess.emit('evidence:sensorPlaced', { sensorId, roomId: player.currentRoomId, worldPos: sensorData.worldPos });

    // Start motion sensor ticking for this sensor
    this._scheduleMotionSensorTick(sensorId, player.currentRoomId);
  }

  handleNotebookPlace(socketId, data) {
    const sess = this.session;
    const player = sess.players[socketId];
    if (!player) return;
    const notebookId = `nb_${socketId}_${Date.now()}`;
    player.placedItems.push({ toolId: 'notebook', roomId: player.currentRoomId, notebookId, worldPos: data.worldPos });
    sess.emit('evidence:notebookPlaced', { notebookId, roomId: player.currentRoomId, worldPos: data.worldPos });
  }

  _emfTick() {
    const sess = this.session;
    const delay = 3000 + Math.random() * 2000;
    setTimeout(() => {
      if (sess.phase !== 'investigation') return;

      // Check players in ghost room
      const playersInGhostRoom = sess.playersInRoom(sess.ghostRoomId()).length;
      if (!sess.canEmitEvidence(playersInGhostRoom)) {
        this._emfTick();
        return;
      }

      for (const [id, player] of Object.entries(sess.players)) {
        if (player.isDead) continue;
        if (player.currentRoomId === sess.ghostRoomId()) {
          const level = sess.evidence.emf5Available && Math.random() < 0.3 ? 5 : 2;
          sess.emitTo(id, EV.EVIDENCE_EMF, { level });
        } else {
          // Background EMF 1
          sess.emitTo(id, EV.EVIDENCE_EMF, { level: 1 });
        }
      }

      this._emfTick(); // reschedule
    }, delay);
  }

  _tempTick() {
    const sess = this.session;
    for (const [id, player] of Object.entries(sess.players)) {
      if (player.isDead) continue;
      let temp;
      if (player.currentRoomId === sess.ghostRoomId() && sess.evidence.freezingTempsAvailable) {
        temp = parseFloat((-10 + Math.random() * 15).toFixed(1)); // -10 to 5
      } else {
        temp = parseFloat((15 + Math.random() * 5).toFixed(1)); // 15 to 20
      }
      sess.emitTo(id, EV.EVIDENCE_TEMPERATURE, { temp, roomId: player.currentRoomId });
    }
  }

  _orbTick() {
    const sess = this.session;
    if (!sess.evidence.ghostOrbsAvailable) return;
    const playersInGhostRoom = sess.playersInRoom(sess.ghostRoomId());
    if (!sess.canEmitEvidence(playersInGhostRoom.length)) return;
    for (const p of playersInGhostRoom) {
      sess.emitTo(p.id, EV.EVIDENCE_GHOST_ORBS, { active: true });
    }
    // Turn off after 5s for players who've left
    setTimeout(() => {
      for (const [id] of Object.entries(sess.players)) {
        const pl = sess.players[id];
        if (!pl || pl.currentRoomId !== sess.ghostRoomId()) {
          sess.emitTo(id, EV.EVIDENCE_GHOST_ORBS, { active: false });
        }
      }
    }, 5000);
  }

  _scheduleWriting() {
    const delay = 12000 + Math.random() * 8000;
    setTimeout(() => {
      this._writingTick();
    }, delay);
  }

  _writingTick() {
    const sess = this.session;
    if (!sess.evidence.writingAvailable || sess.evidence.writingTriggered) return;

    // Check if any notebook is placed in ghost room
    const ghostRoomNotebooks = [];
    for (const player of Object.values(sess.players)) {
      for (const item of player.placedItems) {
        if (item.toolId === 'notebook' && item.roomId === sess.ghostRoomId()) {
          ghostRoomNotebooks.push(item);
        }
      }
    }

    const playersInGhostRoom = sess.playersInRoom(sess.ghostRoomId()).length;
    if (ghostRoomNotebooks.length > 0 && sess.canEmitEvidence(playersInGhostRoom)) {
      const nb = ghostRoomNotebooks[0];
      const message = WRITING_MESSAGES[Math.floor(Math.random() * WRITING_MESSAGES.length)];
      sess.evidence.writingTriggered = true;
      sess.emit(EV.EVIDENCE_WRITING, { notebookId: nb.notebookId, message });
    } else {
      this._scheduleWriting(); // retry
    }
  }

  _scheduleMotionSensorTick(sensorId, roomId) {
    const sess = this.session;
    const delay = 5000 + Math.random() * 5000;
    const timer = setTimeout(() => {
      if (roomId === sess.ghostRoomId()) {
        const duration = 1000 + Math.random() * 1000; // 1-2 seconds
        sess.emit(EV.EVIDENCE_MOTION_SENSOR, { sensorId, active: true });
        setTimeout(() => {
          sess.emit(EV.EVIDENCE_MOTION_SENSOR, { sensorId, active: false });
        }, duration);
      }
      this._scheduleMotionSensorTick(sensorId, roomId);
    }, delay);
    this._motionSensorTimers.set(sensorId, timer);
  }

  // Called when ghost room changes (not needed currently, ghost room is fixed per session)
}
