import * as THREE from 'three';
import { EVIDENCE } from '@shared/constants.js';

export class NightVisionGoggles {
  constructor(hud, sceneManager, scene) {
    this.hud = hud;
    this.sceneManager = sceneManager;
    this.scene = scene;
    this._active = false;
    this._orbSystem = null;
    this._orbsVisible = false;
    this._buildOrbs();
  }

  _buildOrbs() {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xaaffcc,
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this._orbPoints = new THREE.Points(geo, mat);
    this._orbPoints.visible = false;
    this._orbCount = count;
    this._orbVelocities = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 0.3,
      y: 0.2 + Math.random() * 0.4,
      z: (Math.random() - 0.5) * 0.3,
    }));
    this._orbOrigin = new THREE.Vector3();
    this.scene.add(this._orbPoints);
  }

  toggle() {
    this._active = !this._active;
    this.sceneManager.setNightVision(this._active);
    this.hud.setToolReadout(this._active ? 'NVG: ON' : 'NVG: OFF');
  }

  onEquip() {
    this.hud.setToolReadout(this._active ? 'NVG: ON [3 to toggle]' : 'NVG: OFF [3 to toggle]');
  }

  onUnequip() {
    this.hud.setToolReadout('');
  }

  onGhostOrbs(active) {
    this._orbsVisible = active && this._active;
    this._orbPoints.visible = this._orbsVisible;
  }

  update(delta, currentRoomId) {
    if (!this._orbsVisible) return;

    // Animate orbs: drift upward and loop
    const pos = this._orbPoints.geometry.attributes.position;
    for (let i = 0; i < this._orbCount; i++) {
      pos.setX(i, pos.getX(i) + this._orbVelocities[i].x * delta);
      pos.setY(i, pos.getY(i) + this._orbVelocities[i].y * delta);
      pos.setZ(i, pos.getZ(i) + this._orbVelocities[i].z * delta);

      // Reset orb if it floats too high
      if (pos.getY(i) > this._orbOrigin.y + 2.5) {
        pos.setX(i, this._orbOrigin.x + (Math.random() - 0.5) * 4);
        pos.setY(i, this._orbOrigin.y + Math.random() * 0.5);
        pos.setZ(i, this._orbOrigin.z + (Math.random() - 0.5) * 4);
      }
    }
    pos.needsUpdate = true;
  }

  setOrbOrigin(pos) {
    this._orbOrigin.copy(pos);
    const posAttr = this._orbPoints.geometry.attributes.position;
    for (let i = 0; i < this._orbCount; i++) {
      posAttr.setX(i, pos.x + (Math.random() - 0.5) * 4);
      posAttr.setY(i, pos.y + Math.random() * 0.3);
      posAttr.setZ(i, pos.z + (Math.random() - 0.5) * 4);
    }
    posAttr.needsUpdate = true;
  }
}
