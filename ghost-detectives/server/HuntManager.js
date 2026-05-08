import { EV, PHASE } from '../shared/constants.js';

const HUNT_DURATION = 30000;
const WARNING_TIME = 10000;
const BASE_INTERVAL = 120000; // ms
const MIN_INTERVAL = 30000;

export default class HuntManager {
  constructor(session) {
    this.session = session;
    this._huntTimeout = null;
    this._warningTimeout = null;
    this._huntEndTimeout = null;
  }

  start() {
    this._scheduleNextHunt();
  }

  stop() {
    clearTimeout(this._huntTimeout);
    clearTimeout(this._warningTimeout);
    clearTimeout(this._huntEndTimeout);
  }

  _nextInterval() {
    const avgSanity = this.session.teamAverageSanity;
    const interval = BASE_INTERVAL - ((100 - avgSanity) * 0.8 * 1000);
    return Math.max(MIN_INTERVAL, interval);
  }

  _scheduleNextHunt() {
    const delay = this._nextInterval();
    this.session.huntState.nextHuntTime = Date.now() + delay;

    // Warning fires WARNING_TIME ms before hunt
    this._warningTimeout = setTimeout(() => {
      if (this.session.phase !== PHASE.INVESTIGATION) return;
      this.session.emit(EV.EVENT_HUNT_WARNING, { secsRemaining: WARNING_TIME / 1000 });
    }, delay - WARNING_TIME);

    this._huntTimeout = setTimeout(() => {
      if (this.session.phase !== PHASE.INVESTIGATION) return;
      this._startHunt();
    }, delay);
  }

  _startHunt() {
    const sess = this.session;
    sess.phase = PHASE.HUNT;
    sess.huntState.isActive = true;
    sess.huntState.startTime = Date.now();

    sess.emit(EV.EVENT_HUNT_START, {});
    sess._ghost?.startHunt();

    this._huntEndTimeout = setTimeout(() => {
      this._endHunt();
    }, HUNT_DURATION);
  }

  _endHunt() {
    const sess = this.session;
    if (sess.phase === PHASE.ENDED) return;
    sess.phase = PHASE.INVESTIGATION;
    sess.huntState.isActive = false;
    sess._ghost?.stopHunt();
    sess.emit(EV.EVENT_HUNT_END, {});
    this._scheduleNextHunt();
  }
}
