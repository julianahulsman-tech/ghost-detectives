// Whittaker House — room graph with 3D AABB bounds.
// Coordinate system:
//   X: west(-) ← → east(+)
//   Z: north(-) ← → south(+) [south = toward exit/spawn]
//   Y: up(+)
//   Ground floor: y 0–3   Top floor: y 6–9   Basement: y -6 to -3
//
// Stair transitions are handled by trigger zones inside each stairwell room.

export const ROOMS = [
  // ── GROUND FLOOR ────────────────────────────────────────────────────────────
  {
    id: 'foyer',
    name: 'Foyer',
    type: 'entrance',
    floor: 'ground',
    bounds: { min: { x: -4, y: 0, z: -4 }, max: { x: 4, y: 3, z: 4 } },
    closetPos: { x: 3.3, y: 1.7, z: 3.3 },
    connections: ['living_room', 'dining_room', 'stairs_up', 'stairs_down'],
    isGhostEligible: false,
    spawnPoint: { x: 0, y: 1.7, z: 0 },
    exitDoorWall: 'south', // z = -4 face — locks during hunts
  },
  {
    id: 'living_room',
    name: 'Living Room',
    type: 'lounge',
    floor: 'ground',
    bounds: { min: { x: -12, y: 0, z: -4 }, max: { x: -4, y: 3, z: 4 } },
    closetPos: { x: -11.3, y: 1.7, z: 3.3 },
    connections: ['foyer', 'study'],
    isGhostEligible: true,
  },
  {
    id: 'study',
    name: 'Study',
    type: 'office',
    floor: 'ground',
    bounds: { min: { x: -20, y: 0, z: -2 }, max: { x: -12, y: 3, z: 4 } },
    closetPos: { x: -19.3, y: 1.7, z: 3.3 },
    connections: ['living_room'],
    isGhostEligible: true,
  },
  {
    id: 'dining_room',
    name: 'Dining Room',
    type: 'dining',
    floor: 'ground',
    bounds: { min: { x: 4, y: 0, z: -4 }, max: { x: 12, y: 3, z: 4 } },
    closetPos: { x: 4.7, y: 1.7, z: 3.3 },
    connections: ['foyer', 'kitchen'],
    isGhostEligible: true,
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    type: 'kitchen',
    floor: 'ground',
    bounds: { min: { x: 4, y: 0, z: 4 }, max: { x: 12, y: 3, z: 12 } },
    closetPos: { x: 11.3, y: 1.7, z: 11.3 },
    connections: ['dining_room', 'pantry'],
    isGhostEligible: true,
  },
  {
    id: 'pantry',
    name: 'Pantry',
    type: 'storage',
    floor: 'ground',
    bounds: { min: { x: 12, y: 0, z: 5 }, max: { x: 18, y: 3, z: 11 } },
    closetPos: { x: 17.3, y: 1.7, z: 10.3 },
    connections: ['kitchen'],
    isGhostEligible: true,
  },
  {
    id: 'stairs_up',
    name: 'Stairs (Up)',
    type: 'stairwell',
    floor: 'ground',
    bounds: { min: { x: -4, y: 0, z: -10 }, max: { x: 0, y: 3, z: -4 } },
    closetPos: { x: -3.3, y: 1.7, z: -9.3 },
    connections: ['foyer', 'landing_top'],
    isGhostEligible: false,
    stairDestId: 'landing_top',
    stairDestPos: { x: -2, y: 7.7, z: -12 },
    stairTriggerZ: -9, // player crosses this Z going north to trigger transition
  },
  {
    id: 'stairs_down',
    name: 'Stairs (Down)',
    type: 'stairwell',
    floor: 'ground',
    bounds: { min: { x: 0, y: 0, z: -10 }, max: { x: 4, y: 3, z: -4 } },
    closetPos: { x: 3.3, y: 1.7, z: -9.3 },
    connections: ['foyer', 'basement_landing'],
    isGhostEligible: false,
    stairDestId: 'basement_landing',
    stairDestPos: { x: 2, y: -4.3, z: -12 },
    stairTriggerZ: -9,
  },

  // ── TOP FLOOR ────────────────────────────────────────────────────────────────
  {
    id: 'landing_top',
    name: 'Top Floor Landing',
    type: 'hallway',
    floor: 'top',
    bounds: { min: { x: -4, y: 6, z: -16 }, max: { x: 4, y: 9, z: -10 } },
    closetPos: { x: 3.3, y: 7.7, z: -15.3 },
    connections: ['attic', 'guest_bedroom', 'bathroom_top', 'stairs_up'],
    isGhostEligible: false,
    stairDestId: 'foyer',
    stairDestPos: { x: -2, y: 1.7, z: -7 },
    stairTriggerZ: -10.5, // player crosses this Z going south to go back down
  },
  {
    id: 'attic',
    name: 'Attic Loft',
    type: 'storage',
    floor: 'top',
    bounds: { min: { x: -12, y: 6, z: -22 }, max: { x: -4, y: 9, z: -14 } },
    closetPos: { x: -11.3, y: 7.7, z: -21.3 },
    connections: ['landing_top', 'storage_closet'],
    isGhostEligible: true,
  },
  {
    id: 'storage_closet',
    name: 'Storage Closet',
    type: 'small_room',
    floor: 'top',
    bounds: { min: { x: 4, y: 6, z: -22 }, max: { x: 10, y: 9, z: -16 } },
    closetPos: { x: 9.3, y: 7.7, z: -21.3 },
    connections: ['attic', 'guest_bedroom'],
    isGhostEligible: true,
  },
  {
    id: 'guest_bedroom',
    name: 'Guest Bedroom',
    type: 'bedroom',
    floor: 'top',
    bounds: { min: { x: -12, y: 6, z: -30 }, max: { x: -4, y: 9, z: -22 } },
    closetPos: { x: -11.3, y: 7.7, z: -29.3 },
    connections: ['storage_closet', 'landing_top'],
    isGhostEligible: true,
  },
  {
    id: 'bathroom_top',
    name: 'Top Bathroom',
    type: 'bathroom',
    floor: 'top',
    bounds: { min: { x: 4, y: 6, z: -30 }, max: { x: 10, y: 9, z: -22 } },
    closetPos: { x: 9.3, y: 7.7, z: -29.3 },
    connections: ['landing_top'],
    isGhostEligible: true,
  },

  // ── BASEMENT ─────────────────────────────────────────────────────────────────
  {
    id: 'basement_landing',
    name: 'Basement Landing',
    type: 'hallway',
    floor: 'basement',
    bounds: { min: { x: -4, y: -6, z: -16 }, max: { x: 4, y: -3, z: -10 } },
    closetPos: { x: 3.3, y: -4.3, z: -15.3 },
    connections: ['boiler_room', 'cellar', 'laundry_room', 'hidden_room', 'stairs_down'],
    isGhostEligible: false,
    stairDestId: 'foyer',
    stairDestPos: { x: 2, y: 1.7, z: -7 },
    stairTriggerZ: -10.5,
  },
  {
    id: 'boiler_room',
    name: 'Boiler Room',
    type: 'utility',
    floor: 'basement',
    bounds: { min: { x: -12, y: -6, z: -22 }, max: { x: -4, y: -3, z: -14 } },
    closetPos: { x: -11.3, y: -4.3, z: -21.3 },
    connections: ['basement_landing'],
    isGhostEligible: true,
    hasFuseBox: true,
    fuseBoxPos: { x: -11, y: -4, z: -15 },
  },
  {
    id: 'cellar',
    name: 'Cellar',
    type: 'storage',
    floor: 'basement',
    bounds: { min: { x: 4, y: -6, z: -22 }, max: { x: 12, y: -3, z: -14 } },
    closetPos: { x: 11.3, y: -4.3, z: -21.3 },
    connections: ['basement_landing'],
    isGhostEligible: true,
  },
  {
    id: 'laundry_room',
    name: 'Laundry Room',
    type: 'utility',
    floor: 'basement',
    bounds: { min: { x: -12, y: -6, z: -30 }, max: { x: -4, y: -3, z: -22 } },
    closetPos: { x: -11.3, y: -4.3, z: -29.3 },
    connections: ['basement_landing'],
    isGhostEligible: true,
  },
  {
    id: 'hidden_room',
    name: 'Hidden Room',
    type: 'secret',
    floor: 'basement',
    bounds: { min: { x: 4, y: -6, z: -30 }, max: { x: 12, y: -3, z: -22 } },
    closetPos: { x: 11.3, y: -4.3, z: -29.3 },
    connections: ['basement_landing'],
    isGhostEligible: true,
  },
];

export const ROOM_MAP = Object.fromEntries(ROOMS.map(r => [r.id, r]));

export const GHOST_ELIGIBLE_ROOMS = ROOMS.filter(r => r.isGhostEligible).map(r => r.id);

// Weighted ghost room selection (hidden_room has 2× weight for atmosphere)
export const GHOST_ROOM_POOL = [
  ...GHOST_ELIGIBLE_ROOMS,
  'hidden_room', // double weight
];

// BFS-ready adjacency list (includes stair connections across floors)
export const ADJACENCY = Object.fromEntries(
  ROOMS.map(r => [r.id, r.connections])
);

export function findRoomAt(x, y, z) {
  return ROOMS.find(r =>
    x >= r.bounds.min.x && x <= r.bounds.max.x &&
    y >= r.bounds.min.y && y <= r.bounds.max.y &&
    z >= r.bounds.min.z && z <= r.bounds.max.z
  );
}

export function roomCenter(room) {
  return {
    x: (room.bounds.min.x + room.bounds.max.x) / 2,
    y: (room.bounds.min.y + room.bounds.max.y) / 2,
    z: (room.bounds.min.z + room.bounds.max.z) / 2,
  };
}

export function bfsPath(fromId, toId) {
  if (fromId === toId) return [fromId];
  const visited = new Set([fromId]);
  const queue = [[fromId, [fromId]]];
  while (queue.length) {
    const [cur, path] = queue.shift();
    for (const next of (ADJACENCY[cur] || [])) {
      if (next === toId) return [...path, next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, [...path, next]]);
      }
    }
  }
  return null;
}
