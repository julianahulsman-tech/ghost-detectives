import { EV } from '../shared/constants.js';

const PASSIVE_DRAIN = 0.3; // % per second
const PHANTOM_DRAIN = 0.5; // extra % per second while looking at Phantom

export default class SanityManager {
  constructor(session) {
    this.session = session;
    this._interval = null;
    this._phantomLookPlayers = new Set(); // socketIds currently looking at Phantom
  }

  start() {
    this._interval = setInterval(() => this._tick(), 1000);
  }

  stop() {
    clearInterval(this._interval);
  }

  setPhantomLook(socketId, looking) {
    if (looking) this._phantomLookPlayers.add(socketId);
    else this._phantomLookPlayers.delete(socketId);
  }

  _tick() {
    const sess = this.session;
    let totalSanity = 0;
    let count = 0;

    for (const [id, player] of Object.entries(sess.players)) {
      if (player.isDead || player.isHiding) continue;
      let drain = PASSIVE_DRAIN;

      // Phantom ability
      if (sess.ghostType()?.specialAbility === 'sanityDrainOnLook' && this._phantomLookPlayers.has(id)) {
        drain += PHANTOM_DRAIN;
      }

      // Yurei: higher base drain
      if (sess.ghostType()?.id === 'yurei') {
        drain += 0.2;
      }

      player.sanity = Math.max(0, player.sanity - drain);
      totalSanity += player.sanity;
      count++;
    }

    sess.teamAverageSanity = count > 0 ? totalSanity / count : 0;

    // Broadcast individual sanity to each player
    for (const [id, player] of Object.entries(sess.players)) {
      sess.emitTo(id, EV.STATE_SANITY, {
        personal: player.sanity,
        teamAverage: sess.teamAverageSanity,
      });
    }
  }
}
