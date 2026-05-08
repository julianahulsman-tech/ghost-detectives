import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { ROOMS, ROOM_MAP } from '@server/data/house.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@shared/constants.js';

const MOVE_SPEED = 4.5; // m/s
const STAIR_COOLDOWN = 2000; // ms between floor transitions

export class PlayerController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.isLocked = false;
    this.isHiding = false;
    this.isDead = false;
    this.isSpectator = false;

    this._keys = { w: false, a: false, s: false, d: false };
    this._lastStairTime = 0;
    this._onStairTransition = null; // callback(destRoomId, destPos)

    this.controls.addEventListener('lock', () => { this.isLocked = true; });
    this.controls.addEventListener('unlock', () => { this.isLocked = false; });

    document.addEventListener('keydown', e => this._onKey(e, true));
    document.addEventListener('keyup', e => this._onKey(e, false));

    // Build solid wall list for collision
    this._walls = this._buildWalls();
  }

  _onKey(e, down) {
    switch (e.code) {
      case 'KeyW': this._keys.w = down; break;
      case 'KeyA': this._keys.a = down; break;
      case 'KeyS': this._keys.s = down; break;
      case 'KeyD': this._keys.d = down; break;
    }
  }

  lock() { this.controls.lock(); }
  unlock() { this.controls.unlock(); }

  onStairTransition(cb) { this._onStairTransition = cb; }

  setPosition(pos) {
    this.camera.position.set(pos.x, pos.y, pos.z);
  }

  getPosition() { return this.camera.position; }

  update(delta, currentRoomId) {
    if (!this.isLocked || this.isHiding || this.isDead) return;

    const speed = MOVE_SPEED * delta;
    const dir = new THREE.Vector3();

    if (this._keys.w) dir.z -= 1;
    if (this._keys.s) dir.z += 1;
    if (this._keys.a) dir.x -= 1;
    if (this._keys.d) dir.x += 1;

    if (dir.lengthSq() === 0) return;

    dir.normalize();

    // Transform direction by camera yaw only (no pitch for movement)
    const yaw = new THREE.Quaternion();
    this.camera.getWorldQuaternion(yaw);
    const euler = new THREE.Euler().setFromQuaternion(yaw, 'YXZ');
    const yawOnly = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0));
    dir.applyQuaternion(yawOnly);

    const oldPos = this.camera.position.clone();
    const newPos = oldPos.clone().addScaledVector(dir, speed);

    // Resolve axis-by-axis AABB wall collision
    const resolved = this._resolveCollision(oldPos, newPos);
    this.camera.position.copy(resolved);

    // Check stair triggers
    this._checkStairs(currentRoomId);
  }

  _resolveCollision(oldPos, newPos) {
    const p = newPos.clone();

    // Collect walls of current room and all adjacent rooms on same floor
    const curRoom = this._findRoomContaining(oldPos);
    const checkRooms = new Set();
    if (curRoom) {
      checkRooms.add(curRoom.id);
      for (const cid of curRoom.connections) {
        if (ROOM_MAP[cid]) checkRooms.add(cid);
      }
    } else {
      // Fallback: check all rooms
      for (const r of ROOMS) checkRooms.add(r.id);
    }

    for (const rid of checkRooms) {
      const room = ROOM_MAP[rid];
      if (!room) continue;
      const solidWalls = this._walls.get(rid) || [];
      for (const wall of solidWalls) {
        // Expand wall box by player radius on penetration axis
        const exp = wall.clone().expandByScalar(PLAYER_RADIUS);
        if (!exp.containsPoint(p)) continue;

        // Resolve by pushing out on the axis of least penetration
        const center = new THREE.Vector3();
        exp.getCenter(center);
        const size = new THREE.Vector3();
        exp.getSize(size);

        const overlapX = size.x / 2 - Math.abs(p.x - center.x);
        const overlapZ = size.z / 2 - Math.abs(p.z - center.z);

        if (overlapX < overlapZ) {
          p.x = p.x > center.x ? center.x + size.x / 2 : center.x - size.x / 2;
        } else {
          p.z = p.z > center.z ? center.z + size.z / 2 : center.z - size.z / 2;
        }
      }
    }

    // Clamp Y to floor (no falling)
    const roomAtNew = this._findRoomContaining(p) || this._findRoomContaining(oldPos);
    if (roomAtNew) {
      const minY = roomAtNew.bounds.min.y + PLAYER_HEIGHT;
      const maxY = roomAtNew.bounds.max.y - 0.1;
      p.y = Math.max(minY, Math.min(maxY, p.y));
    }

    return p;
  }

  _checkStairs(currentRoomId) {
    const now = Date.now();
    if (now - this._lastStairTime < STAIR_COOLDOWN) return;

    const room = ROOM_MAP[currentRoomId];
    if (!room || !room.stairDestId) return;

    const pos = this.camera.position;
    const trigger = this._inStairTrigger(room, pos);
    if (trigger) {
      this._lastStairTime = now;
      const destRoom = ROOM_MAP[room.stairDestId];
      if (destRoom && this._onStairTransition) {
        this._onStairTransition(room.stairDestId, room.stairDestPos);
      }
    }
  }

  _inStairTrigger(room, pos) {
    if (!room.stairTriggerZ) return false;
    const { min, max } = room.bounds;
    const inXBounds = pos.x >= min.x && pos.x <= max.x;
    // Trigger when player moves beyond the stair threshold Z
    if (room.stairDestId) {
      const goingNorth = room.stairTriggerZ < (min.z + max.z) / 2;
      if (goingNorth) return inXBounds && pos.z <= room.stairTriggerZ;
      return inXBounds && pos.z >= room.stairTriggerZ;
    }
    return false;
  }

  _findRoomContaining(pos) {
    for (const room of ROOMS) {
      const { min, max } = room.bounds;
      if (
        pos.x >= min.x && pos.x <= max.x &&
        pos.y >= min.y + PLAYER_HEIGHT * 0.5 && pos.y <= max.y &&
        pos.z >= min.z && pos.z <= max.z
      ) return room;
    }
    return null;
  }

  // Build solid wall Box3 list per room (only exterior walls, not doorway faces)
  _buildWalls() {
    const wallMap = new Map();
    for (const room of ROOMS) {
      const { min, max } = room.bounds;
      const walls = [];
      const t = 0.1; // wall half-thickness for collision box

      // Helper: does this face have a connecting room?
      const hasConn = (face) => {
        for (const cid of room.connections) {
          const c = ROOM_MAP[cid];
          if (!c) continue;
          const cb = c.bounds;
          const xOverlap = min.x < cb.max.x && cb.min.x < max.x;
          const zOverlap = min.z < cb.max.z && cb.min.z < max.z;
          switch (face) {
            case 'north': if (Math.abs(cb.max.z - min.z) < 0.2 && xOverlap) return true; break;
            case 'south': if (Math.abs(cb.min.z - max.z) < 0.2 && xOverlap) return true; break;
            case 'west':  if (Math.abs(cb.max.x - min.x) < 0.2 && zOverlap) return true; break;
            case 'east':  if (Math.abs(cb.min.x - max.x) < 0.2 && zOverlap) return true; break;
          }
        }
        return false;
      };

      // For doorway faces: only create narrow side-strip walls (leaving the door gap unblocked)
      const addWallBox = (box3) => walls.push(box3);

      // North (z = min.z)
      if (!hasConn('north')) {
        addWallBox(new THREE.Box3(
          new THREE.Vector3(min.x, min.y, min.z - t),
          new THREE.Vector3(max.x, max.y, min.z + t)
        ));
      }
      // South (z = max.z)
      if (!hasConn('south')) {
        addWallBox(new THREE.Box3(
          new THREE.Vector3(min.x, min.y, max.z - t),
          new THREE.Vector3(max.x, max.y, max.z + t)
        ));
      }
      // West (x = min.x)
      if (!hasConn('west')) {
        addWallBox(new THREE.Box3(
          new THREE.Vector3(min.x - t, min.y, min.z),
          new THREE.Vector3(min.x + t, max.y, max.z)
        ));
      }
      // East (x = max.x)
      if (!hasConn('east')) {
        addWallBox(new THREE.Box3(
          new THREE.Vector3(max.x - t, min.y, min.z),
          new THREE.Vector3(max.x + t, max.y, max.z)
        ));
      }

      wallMap.set(room.id, walls);
    }
    return wallMap;
  }

  enterCloset(room) {
    this.isHiding = true;
    const cp = room.closetPos;
    this.camera.position.set(cp.x, cp.y, cp.z);
    if (this.isLocked) this.controls.unlock();
  }

  exitCloset() {
    this.isHiding = false;
    this.controls.lock();
  }

  becomeSpectator() {
    this.isDead = true;
    this.isSpectator = true;
  }
}
