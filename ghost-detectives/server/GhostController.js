import { EV, PHASE } from '../shared/constants.js';
import { ROOM_MAP, ADJACENCY, roomCenter, bfsPath } from './data/house.js';

const WANDER_INTERVAL = 20000; // ms between random room hops
const HUNT_UPDATE_INTERVAL = 100; // ms between ghost position updates during hunt

export default class GhostController {
  constructor(session) {
    this.session = session;
    this._wanderTimer = null;
    this._huntInterval = null;
    this._speedMultiplierBonus = 0; // for Upyr cumulative speed gains
  }

  start() {
    this._scheduleWander();
  }

  stop() {
    clearTimeout(this._wanderTimer);
    clearInterval(this._huntInterval);
  }

  startHunt() {
    clearInterval(this._huntInterval);
    this.session.ghost.isVisible = true;
    this._huntInterval = setInterval(() => this._huntTick(), HUNT_UPDATE_INTERVAL);
  }

  stopHunt() {
    clearInterval(this._huntInterval);
    this.session.ghost.isVisible = false;
    this.session.ghost.targetPlayerId = null;
    this._scheduleWander();
  }

  onPlayerDied() {
    // Upyr: permanent speed increase
    if (this.session.ghostType()?.specialAbility === 'permanentSpeedOnDeath') {
      this._speedMultiplierBonus += this.session.ghostType().huntBehavior.speedModifier;
      this.session.ghost.speedMultiplier = 1 + this._speedMultiplierBonus;
    }
  }

  _computeSpeed(targetPlayer) {
    const sess = this.session;
    const ghost = sess.ghostType();
    if (!ghost) return 1.7;

    const base = ghost.huntBehavior.baseSpeed + this._speedMultiplierBonus;
    const mod = ghost.huntBehavior.speedModifier ?? 0;
    const cond = ghost.huntBehavior.modifierCondition;

    if (!cond || !mod) return base;

    switch (cond) {
      case 'powerOff':
        return !sess.powerEnabled ? base + mod : base;

      case 'farFromPlayer': {
        if (!targetPlayer) return base;
        const g = sess.ghost.position;
        const p = targetPlayer.position;
        const dist = Math.sqrt((g.x - p.x) ** 2 + (g.z - p.z) ** 2);
        return dist > (ghost.huntBehavior.proximityThreshold ?? 5) ? base + mod : base;
      }

      case 'playerSanityBelow25':
        if (!targetPlayer) return base;
        return targetPlayer.sanity < 25 ? base + mod : base;

      case 'playerHoldingTriggerItem':
        if (!targetPlayer) return base;
        return targetPlayer.heldToolId === sess.triggerItemId ? base + mod : base;

      default:
        return base;
    }
  }

  _findNearestPlayer() {
    const sess = this.session;
    const living = sess.livingPlayers().filter(p => !p.isHiding);
    if (!living.length) return null;

    const g = sess.ghost.position;
    let nearest = null, minDist = Infinity;
    for (const p of living) {
      const d = (g.x - p.position.x) ** 2 + (g.z - p.position.z) ** 2;
      if (d < minDist) { minDist = d; nearest = p; }
    }
    return nearest;
  }

  _huntTick() {
    const sess = this.session;
    if (sess.phase !== PHASE.HUNT && sess.phase !== PHASE.INVESTIGATION) return;
    if (!sess.ghost.isVisible) return;

    const target = this._findNearestPlayer();
    if (!target) return;

    sess.ghost.targetPlayerId = target.id;
    const speed = this._computeSpeed(target) * (HUNT_UPDATE_INTERVAL / 1000);

    // Move ghost toward target's room (via BFS)
    const ghostRoom = sess.ghost.currentRoomId;
    const targetRoom = target.currentRoomId;

    if (ghostRoom !== targetRoom) {
      const path = bfsPath(ghostRoom, targetRoom);
      if (path && path.length > 1) {
        const nextRoom = ROOM_MAP[path[1]];
        if (nextRoom) {
          const nc = roomCenter(nextRoom);
          this._moveToward(nc, speed);
          if (this._inRoom(sess.ghost.position, nextRoom)) {
            sess.ghost.currentRoomId = nextRoom.id;
          }
        }
      }
    } else {
      // In same room: move directly toward player
      this._moveToward(target.position, speed);
    }

    // Check kill
    const g = sess.ghost.position;
    const tp = target.position;
    const dist = Math.sqrt((g.x - tp.x) ** 2 + (g.z - tp.z) ** 2);
    if (dist < 0.8) {
      this._killPlayer(target);
    }

    // Check Phantom LOS for sanity drain
    if (sess.ghostType()?.specialAbility === 'sanityDrainOnLook') {
      this._checkPhantomLOS();
    }

    // Broadcast ghost state
    sess.emit(EV.STATE_GHOST, {
      position: sess.ghost.position,
      isVisible: sess.ghost.isVisible,
    });
  }

  _moveToward(target, speed) {
    const g = this.session.ghost.position;
    const dx = target.x - g.x;
    const dz = target.z - g.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return;
    g.x += (dx / len) * speed;
    g.z += (dz / len) * speed;
  }

  _inRoom(pos, room) {
    const { min, max } = room.bounds;
    return pos.x >= min.x && pos.x <= max.x && pos.z >= min.z && pos.z <= max.z;
  }

  _killPlayer(player) {
    const sess = this.session;
    player.isDead = true;
    sess.emit(EV.EVENT_PLAYER_DIED, { playerId: player.id, name: player.name });
    this.onPlayerDied();
    sess.checkEndConditions();
  }

  _checkPhantomLOS() {
    const sess = this.session;
    const g = sess.ghost.position;
    for (const [id, player] of Object.entries(sess.players)) {
      if (player.isDead || player.isHiding) continue;
      const angle = Math.atan2(g.x - player.position.x, g.z - player.position.z);
      const diff = Math.abs(angle - player.rotation.y);
      const normalized = Math.min(diff, Math.PI * 2 - diff);
      const looking = normalized < (35 * Math.PI / 180);
      sess._sanity?.setPhantomLook(id, looking);
      if (looking) sess.emitTo(id, EV.EVENT_PHANTOM_LOOK, { looking: true });
    }
  }

  _scheduleWander() {
    const delay = WANDER_INTERVAL * (0.5 + Math.random());
    this._wanderTimer = setTimeout(() => {
      this._wanderToAdjacentRoom();
      this._scheduleWander();
    }, delay);
  }

  _wanderToAdjacentRoom() {
    const sess = this.session;
    const curId = sess.ghost.currentRoomId;
    const adj = ADJACENCY[curId] || [];
    if (!adj.length) return;
    const nextId = adj[Math.floor(Math.random() * adj.length)];
    const nextRoom = ROOM_MAP[nextId];
    if (!nextRoom) return;
    const nc = roomCenter(nextRoom);
    sess.ghost.position = { x: nc.x, y: nc.y, z: nc.z };
    sess.ghost.currentRoomId = nextId;
  }
}
