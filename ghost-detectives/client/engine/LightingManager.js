import * as THREE from 'three';
import { ROOMS } from '@server/data/house.js';

export class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this._roomLights = new Map(); // roomId → PointLight
    this._flickerTimers = new Map();
    this._powerEnabled = true;

    scene.add(new THREE.AmbientLight(0x111111, 0.3));
    this._buildRoomLights();
  }

  _buildRoomLights() {
    const colorByFloor = {
      ground: 0xffcc88,
      top: 0xddaacc,
      basement: 0x88aacc,
    };
    for (const room of ROOMS) {
      const { min, max } = room.bounds;
      const cx = (min.x + max.x) / 2;
      const cz = (min.z + max.z) / 2;
      const lightY = max.y - 0.4;

      const light = new THREE.PointLight(colorByFloor[room.floor] || 0xffcc88, 1.2, 10, 2);
      light.position.set(cx, lightY, cz);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.radius = 4;
      this.scene.add(light);
      this._roomLights.set(room.id, light);

      // Start flicker for each light
      this._scheduleFlicker(room.id);
    }
  }

  _scheduleFlicker(roomId) {
    const light = this._roomLights.get(roomId);
    if (!light) return;
    const delay = 3000 + Math.random() * 8000;
    const timer = setTimeout(() => {
      if (!this._powerEnabled) return;
      this._doFlicker(roomId, 3 + Math.floor(Math.random() * 3));
    }, delay);
    this._flickerTimers.set(roomId, timer);
  }

  _doFlicker(roomId, count) {
    if (count <= 0) {
      this._scheduleFlicker(roomId);
      return;
    }
    const light = this._roomLights.get(roomId);
    if (!light) return;
    const baseIntensity = light.userData.baseIntensity ?? 1.2;
    const on = light.intensity > 0.1;
    light.intensity = on ? 0 : baseIntensity;
    setTimeout(() => this._doFlicker(roomId, count - 1), 60 + Math.random() * 80);
  }

  setPower(enabled) {
    this._powerEnabled = enabled;
    for (const [, light] of this._roomLights) {
      if (!enabled) {
        light.userData.baseIntensity = light.intensity;
        light.intensity = 0;
      } else {
        light.intensity = light.userData.baseIntensity ?? 1.2;
        // Restart flickers
      }
    }
    if (enabled) {
      for (const roomId of this._roomLights.keys()) {
        this._scheduleFlicker(roomId);
      }
    }
  }

  isPowerEnabled() { return this._powerEnabled; }
}
