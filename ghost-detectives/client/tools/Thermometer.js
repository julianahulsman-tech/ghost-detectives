import { EVIDENCE } from '@shared/constants.js';

export class Thermometer {
  constructor(hud) {
    this.hud = hud;
    this._temp = null;
    this._active = false;
  }

  onEquip() {
    this._active = true;
    if (this._temp !== null) this.hud.setToolReadout(`${this._temp > 0 ? '+' : ''}${this._temp.toFixed(1)}°C`);
  }

  onUnequip() {
    this._active = false;
    this.hud.setToolReadout('');
    this.hud.setTemperature(null);
  }

  onTemperature(temp) {
    this._temp = temp;
    this.hud.setTemperature(temp);
    if (this._active) this.hud.setToolReadout(`${temp > 0 ? '+' : ''}${temp.toFixed(1)}°C`);
  }
}
