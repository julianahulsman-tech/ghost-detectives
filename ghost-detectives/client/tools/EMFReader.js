import { EVIDENCE } from '@shared/constants.js';

export class EMFReader {
  constructor(hud) {
    this.hud = hud;
    this._level = 1;
    this._active = false;
  }

  onEquip() {
    this._active = true;
    this.hud.setToolReadout(`EMF: ${this._level}`);
  }

  onUnequip() {
    this._active = false;
    this.hud.setToolReadout('');
  }

  onEMFUpdate(level) {
    this._level = level;
    if (this._active) this.hud.setToolReadout(`EMF: ${level}`);
  }
}
