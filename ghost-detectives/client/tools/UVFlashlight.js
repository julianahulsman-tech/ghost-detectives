import * as THREE from 'three';
import { EVIDENCE } from '@shared/constants.js';

export class UVFlashlight {
  constructor(camera, scene, hud) {
    this.camera = camera;
    this.scene = scene;
    this.hud = hud;
    this._active = false;
    this._fingerprints = []; // { mesh, worldPos, revealed }
    this._anyRevealed = false;

    // UV spotlight
    this._uvLight = new THREE.SpotLight(0x9900ff, 0, 8, Math.PI / 10, 0.3);
    this._uvLight.position.set(0, 0, 0);
    scene.add(this._uvLight);
    scene.add(this._uvLight.target);
  }

  onEquip() {
    this._active = true;
    this.hud.setToolReadout('UV: ON');
  }

  onUnequip() {
    this._active = false;
    this._uvLight.intensity = 0;
    this.hud.setToolReadout('');
  }

  onFingerprintLocations(locations) {
    for (const loc of locations) {
      this._addFingerprint(loc);
    }
  }

  _addFingerprint(loc) {
    const geo = new THREE.PlaneGeometry(0.3, 0.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8800ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const wp = loc.worldPos;
    mesh.position.set(wp.x, wp.y, wp.z);
    // Face the camera approximately (flat on wall)
    mesh.lookAt(wp.x, wp.y + 2, wp.z + 1);
    this.scene.add(mesh);
    this._fingerprints.push({ mesh, worldPos: new THREE.Vector3(wp.x, wp.y, wp.z), revealed: false });
  }

  update(delta) {
    if (!this._active) return;

    // Position UV light at camera
    this._uvLight.position.copy(this.camera.position);
    this._uvLight.intensity = 2.5;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const target = this.camera.position.clone().addScaledVector(dir, 4);
    this._uvLight.target.position.copy(target);
    this._uvLight.target.updateMatrixWorld();

    // Reveal fingerprints in UV cone
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const cosAngle = Math.cos(Math.PI / 10 + 0.2);

    for (const fp of this._fingerprints) {
      const toFP = fp.worldPos.clone().sub(this.camera.position);
      const dist = toFP.length();
      if (dist > 4) {
        if (fp.revealed) fp.mesh.material.opacity = Math.max(0, fp.mesh.material.opacity - delta * 0.5);
        continue;
      }
      toFP.normalize();
      const dot = toFP.dot(camDir);
      if (dot > cosAngle) {
        fp.mesh.material.opacity = Math.min(0.9, fp.mesh.material.opacity + delta * 1.5);
        if (!fp.revealed && fp.mesh.material.opacity > 0.3) {
          fp.revealed = true;
        }
      } else {
        fp.mesh.material.opacity = Math.max(0, fp.mesh.material.opacity - delta * 0.8);
      }
    }
  }
}
