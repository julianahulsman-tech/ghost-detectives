import { EVIDENCE } from './constants.js';

export const GHOST_TYPES = [
  {
    id: 'banshee',
    name: 'Banshee',
    evidence: [EVIDENCE.EMF5, EVIDENCE.FREEZING_TEMPS, EVIDENCE.FINGERPRINTS],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'A wailing spirit that heralds death.'
  },
  {
    id: 'demon',
    name: 'Demon',
    evidence: [EVIDENCE.FREEZING_TEMPS, EVIDENCE.SPIRIT_BOX, EVIDENCE.WRITING],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'One of the most vicious entities you can encounter.'
  },
  {
    id: 'mare',
    name: 'Mare',
    evidence: [EVIDENCE.FREEZING_TEMPS, EVIDENCE.GHOST_ORBS, EVIDENCE.SPIRIT_BOX],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'The source of all nightmares.'
  },
  {
    id: 'spirit',
    name: 'Spirit',
    evidence: [EVIDENCE.SPIRIT_BOX, EVIDENCE.WRITING, EVIDENCE.FINGERPRINTS],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'The most common ghost encountered by investigators.'
  },
  {
    id: 'poltergeist',
    name: 'Poltergeist',
    evidence: [EVIDENCE.SPIRIT_BOX, EVIDENCE.FINGERPRINTS, EVIDENCE.GHOST_ORBS],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'A noisy ghost capable of moving objects.'
  },
  {
    id: 'jinn',
    name: 'Jinn',
    evidence: [EVIDENCE.EMF5, EVIDENCE.GHOST_ORBS, EVIDENCE.SPIRIT_BOX],
    specialAbility: 'fasterWithoutPower',
    huntBehavior: { baseSpeed: 1.7, speedModifier: 2.5, modifierCondition: 'powerOff' },
    flavourText: 'A territorial ghost that uses the environment against prey.'
  },
  {
    id: 'shade',
    name: 'Shade',
    evidence: [EVIDENCE.EMF5, EVIDENCE.WRITING, EVIDENCE.GHOST_ORBS],
    specialAbility: 'withholdEvidenceInGroup',
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'A shy ghost — it hides when investigators gather.'
  },
  {
    id: 'yurei',
    name: 'Yurei',
    evidence: [EVIDENCE.FREEZING_TEMPS, EVIDENCE.GHOST_ORBS, EVIDENCE.WRITING],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'A ghost that has returned to the physical world.'
  },
  {
    id: 'oni',
    name: 'Oni',
    evidence: [EVIDENCE.EMF5, EVIDENCE.SPIRIT_BOX, EVIDENCE.WRITING],
    specialAbility: null,
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null },
    flavourText: 'A rare and aggressive variant of the Demon.'
  },
  {
    id: 'revenant',
    name: 'Revenant',
    evidence: [EVIDENCE.EMF5, EVIDENCE.WRITING, EVIDENCE.FINGERPRINTS],
    specialAbility: 'proximitySpeed',
    huntBehavior: { baseSpeed: 1.0, speedModifier: 3.0, modifierCondition: 'farFromPlayer', proximityThreshold: 5 },
    flavourText: 'Very fast when hunting but slows near its target.'
  },
  {
    id: 'phantom',
    name: 'Phantom',
    evidence: [EVIDENCE.EMF5, EVIDENCE.FREEZING_TEMPS, EVIDENCE.GHOST_ORBS],
    specialAbility: 'sanityDrainOnLook',
    huntBehavior: { baseSpeed: 1.7, speedModifier: null, modifierCondition: null, sanityDrainRate: 0.5 },
    flavourText: 'Sanity drains rapidly while looking at it during a hunt.'
  },
  {
    id: 'wendigo',
    name: 'Wendigo',
    evidence: [EVIDENCE.FINGERPRINTS, EVIDENCE.FREEZING_TEMPS, EVIDENCE.SPIRIT_BOX],
    specialAbility: 'fasterAtLowSanity',
    huntBehavior: { baseSpeed: 1.7, speedModifier: 2.5, modifierCondition: 'playerSanityBelow25' },
    flavourText: 'A cannibalistic entity that feeds on human fear.'
  },
  {
    id: 'upyr',
    name: 'Upyr',
    evidence: [EVIDENCE.EMF5, EVIDENCE.FREEZING_TEMPS, EVIDENCE.SPIRIT_BOX],
    specialAbility: 'permanentSpeedOnDeath',
    huntBehavior: { baseSpeed: 1.7, speedModifier: 0.8, modifierCondition: 'playerDied' },
    flavourText: 'Grows permanently faster each time a player dies.'
  },
  {
    id: 'egui',
    name: 'Egui',
    evidence: [EVIDENCE.GHOST_ORBS, EVIDENCE.WRITING, EVIDENCE.SPIRIT_BOX],
    specialAbility: 'fasterIfPlayerHoldsItem',
    huntBehavior: { baseSpeed: 1.7, speedModifier: 2.5, modifierCondition: 'playerHoldingTriggerItem' },
    flavourText: 'A predatory spirit fixated on a specific possession.'
  }
];

export const GHOST_MAP = Object.fromEntries(GHOST_TYPES.map(g => [g.id, g]));
