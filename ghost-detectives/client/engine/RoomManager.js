import * as THREE from 'three';
import { ROOMS, ROOM_MAP, findRoomAt } from '@server/data/house.js';
import { DOOR_WIDTH, DOOR_HEIGHT } from '@shared/constants.js';

const WALL_THICKNESS = 0.05;

// Room materials keyed by type
const MATERIALS = {
  floor: {
    ground: new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1 }),
    top:    new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 1 }),
    basement: new THREE.MeshStandardMaterial({ color: 0x111008, roughness: 1 }),
  },
  ceiling: {
    ground: new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 1 }),
    top:    new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 1 }),
    basement: new THREE.MeshStandardMaterial({ color: 0x0a0a08, roughness: 1 }),
  },
  wall: {
    entrance: new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.9 }),
    lounge:   new THREE.MeshStandardMaterial({ color: 0x28201a, roughness: 0.95 }),
    office:   new THREE.MeshStandardMaterial({ color: 0x1e1a14, roughness: 0.95 }),
    dining:   new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 }),
    kitchen:  new THREE.MeshStandardMaterial({ color: 0x1a1c14, roughness: 0.9 }),
    storage:  new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 1 }),
    hallway:  new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.95 }),
    utility:  new THREE.MeshStandardMaterial({ color: 0x121210, roughness: 1 }),
    bedroom:  new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 0.9 }),
    bathroom: new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.85 }),
    small_room: new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 1 }),
    stairwell:  new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 1 }),
    secret:   new THREE.MeshStandardMaterial({ color: 0x100e0c, roughness: 1 }),
  }
};

// Build solid wall plane, optionally with a door gap
function wallPlane(w, h, mat, doorGap = false) {
  if (!doorGap) {
    const geo = new THREE.PlaneGeometry(w, h);
    return new THREE.Mesh(geo, mat);
  }
  // Wall with centered doorway: left strip + right strip + header
  const dw = Math.min(DOOR_WIDTH, w - 0.4);
  const dh = Math.min(DOOR_HEIGHT, h - 0.1);
  const sideW = (w - dw) / 2;
  const headerH = h - dh;
  const group = new THREE.Group();

  if (sideW > 0.05) {
    const leftGeo = new THREE.PlaneGeometry(sideW, h);
    const left = new THREE.Mesh(leftGeo, mat);
    left.position.x = -(dw / 2 + sideW / 2);
    group.add(left);

    const rightGeo = new THREE.PlaneGeometry(sideW, h);
    const right = new THREE.Mesh(rightGeo, mat);
    right.position.x = dw / 2 + sideW / 2;
    group.add(right);
  }
  if (headerH > 0.05) {
    const headGeo = new THREE.PlaneGeometry(dw, headerH);
    const header = new THREE.Mesh(headGeo, mat);
    header.position.y = (h - headerH) / 2;
    group.add(header);
  }
  return group;
}

function addWall(group, object, px, py, pz, rotY = 0) {
  object.position.set(px, py, pz);
  object.rotation.y = rotY;
  group.add(object);
}

export class RoomManager {
  constructor(scene) {
    this.scene = scene;
    this._roomGroup = new THREE.Group();
    this._roomGroup.name = 'rooms';
    scene.add(this._roomGroup);
    this._currentRoomId = 'foyer';
    this._buildAll();

    // Closet indicator meshes (small glowing box at closet positions)
    this._closetMeshes = [];
    this._buildClosetMarkers();
  }

  _buildAll() {
    for (const room of ROOMS) {
      const g = this._buildRoom(room);
      g.name = room.id;
      this._roomGroup.add(g);
    }
  }

  _buildRoom(room) {
    const { min, max } = room.bounds;
    const W = max.x - min.x;
    const H = max.y - min.y;
    const D = max.z - min.z;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    const cz = (min.z + max.z) / 2;
    const floorY = min.y;
    const ceilY = max.y;
    const mat = MATERIALS.wall[room.type] || MATERIALS.wall.storage;
    const fmat = MATERIALS.floor[room.floor] || MATERIALS.floor.ground;
    const cmat = MATERIALS.ceiling[room.floor] || MATERIALS.ceiling.ground;

    const group = new THREE.Group();

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), fmat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, floorY, cz);
    floor.receiveShadow = true;
    group.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), cmat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, ceilY, cz);
    group.add(ceil);

    // Determine which walls have doorways to connected rooms
    const hasDoorNorth = this._sharesFace(room, 'north'); // z = min.z face
    const hasDoorSouth = this._sharesFace(room, 'south'); // z = max.z face
    const hasDoorWest  = this._sharesFace(room, 'west');  // x = min.x face
    const hasDoorEast  = this._sharesFace(room, 'east');  // x = max.x face

    // North wall (z = min.z, faces south → rotation 0)
    const northWall = wallPlane(W, H, mat, hasDoorNorth);
    addWall(group, northWall, cx, cy, min.z, 0);

    // South wall (z = max.z, faces north → rotation π)
    const southWall = wallPlane(W, H, mat, hasDoorSouth);
    addWall(group, southWall, cx, cy, max.z, Math.PI);

    // West wall (x = min.x, faces east → rotation π/2)
    const westWall = wallPlane(D, H, mat, hasDoorWest);
    addWall(group, westWall, min.x, cy, cz, Math.PI / 2);

    // East wall (x = max.x, faces west → rotation -π/2)
    const eastWall = wallPlane(D, H, mat, hasDoorEast);
    addWall(group, eastWall, max.x, cy, cz, -Math.PI / 2);

    return group;
  }

  _sharesFace(room, face) {
    const { min, max } = room.bounds;
    for (const cid of room.connections) {
      const c = ROOM_MAP[cid];
      if (!c) continue;
      const cb = c.bounds;
      switch (face) {
        case 'north':
          if (Math.abs(cb.max.z - min.z) < 0.1 && this._zRangeOverlap(min.x, max.x, cb.min.x, cb.max.x)) return true;
          break;
        case 'south':
          if (Math.abs(cb.min.z - max.z) < 0.1 && this._zRangeOverlap(min.x, max.x, cb.min.x, cb.max.x)) return true;
          break;
        case 'west':
          if (Math.abs(cb.max.x - min.x) < 0.1 && this._zRangeOverlap(min.z, max.z, cb.min.z, cb.max.z)) return true;
          break;
        case 'east':
          if (Math.abs(cb.min.x - max.x) < 0.1 && this._zRangeOverlap(min.z, max.z, cb.min.z, cb.max.z)) return true;
          break;
      }
    }
    return false;
  }

  _zRangeOverlap(a0, a1, b0, b1) {
    return a0 < b1 && b0 < a1;
  }

  _buildClosetMarkers() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x334433, wireframe: true });
    for (const room of ROOMS) {
      const cp = room.closetPos;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), mat);
      mesh.position.set(cp.x, cp.y - 0.1, cp.z);
      mesh.userData = { roomId: room.id, type: 'closet' };
      this._roomGroup.add(mesh);
      this._closetMeshes.push(mesh);
    }
  }

  getClosetMeshes() {
    return this._closetMeshes;
  }

  updateCurrentRoom(x, y, z) {
    const r = findRoomAt(x, y, z);
    if (r) this._currentRoomId = r.id;
    return this._currentRoomId;
  }

  getCurrentRoomId() { return this._currentRoomId; }

  getRoomData(id) { return ROOM_MAP[id]; }
}
