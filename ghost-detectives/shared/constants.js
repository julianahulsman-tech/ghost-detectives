export const EV = {
  // connection
  PLAYER_JOIN: 'player:join',
  PLAYER_LEAVE: 'player:leave',
  PLAYER_MOVE: 'player:move',
  STATE_PLAYERS: 'state:players',
  STATE_SANITY: 'state:sanity',
  STATE_GHOST: 'state:ghost',

  // game flow
  GAME_START: 'game:start',
  GAME_ENDED: 'game:ended',
  GAME_SUBMIT_GUESS: 'game:submitGuess',
  GAME_CORRECT: 'game:correct',
  GAME_INCORRECT: 'game:incorrect',

  // evidence
  EVIDENCE_EMF: 'evidence:emf',
  EVIDENCE_TEMPERATURE: 'evidence:temperature',
  EVIDENCE_GHOST_ORBS: 'evidence:ghostOrbs',
  EVIDENCE_FINGERPRINT_LOCATIONS: 'evidence:fingerprintLocations',
  EVIDENCE_WRITING: 'evidence:writing',
  EVIDENCE_MOTION_SENSOR: 'evidence:motionSensor',
  EVIDENCE_SPIRIT_BOX_RESPONSE: 'evidence:spiritBoxResponse',

  // tools
  TOOL_SPIRIT_BOX_ASK: 'tool:spiritBox:ask',
  TOOL_MOTION_SENSOR_PLACE: 'tool:motionSensor:place',
  TOOL_NOTEBOOK_PLACE: 'tool:notebook:place',
  TOOL_HELD: 'tool:held',

  // hunt
  EVENT_HUNT_WARNING: 'event:huntWarning',
  EVENT_HUNT_START: 'event:huntStart',
  EVENT_HUNT_END: 'event:huntEnd',
  EVENT_PLAYER_DIED: 'event:playerDied',
  EVENT_PHANTOM_LOOK: 'event:phantomLook',
  EVENT_POWER_TOGGLE: 'event:powerToggle',
};

export const EVIDENCE = {
  EMF5: 'emf5',
  FREEZING_TEMPS: 'freezingTemps',
  FINGERPRINTS: 'fingerprints',
  GHOST_ORBS: 'ghostOrbs',
  SPIRIT_BOX: 'spiritBox',
  WRITING: 'writing',
};

export const PHASE = {
  LOBBY: 'lobby',
  INVESTIGATION: 'investigation',
  HUNT: 'hunt',
  ENDED: 'ended',
};

export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.4;
export const DOOR_WIDTH = 1.8;
export const DOOR_HEIGHT = 2.2;
export const MAX_PLAYERS = 4;
