import * as THREE from 'three';
import { EVIDENCE } from '@shared/constants.js';

export class Notebook {
  constructor(scene, hud, network) {
    this.scene = scene;
    this.hud = hud;
    this.network = network;
    this._placed = false;
    this._mesh = null;
    this._notebookId = null;
    this._writingMessage = null;
    this._canRead = false;

    this._modal = this._buildModal();
  }

  _buildModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.85);display:none;
      align-items:center;justify-content:center;z-index:60;pointer-events:all;
      flex-direction:column;gap:16px;font-family:'Courier New',monospace;
    `;
    modal.innerHTML = `
      <div style="color:#c33;font-size:18px;letter-spacing:2px">GHOST WRITING</div>
      <div id="nb-message" style="color:#eee;font-size:24px;border:1px solid #444;padding:20px 40px;min-width:200px;text-align:center;"></div>
      <button id="nb-close" style="background:#333;color:#aaa;border:none;padding:8px 20px;cursor:pointer;font-family:'Courier New',monospace;">Close [E]</button>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#nb-close').addEventListener('click', () => this._closeModal());
    this._modal = modal;
    return modal;
  }

  onEquip() {
    this.hud.setToolReadout(this._placed ? 'NOTEBOOK: placed' : 'NOTEBOOK: [E] place');
  }

  onUnequip() {
    this.hud.setToolReadout('');
    this.hud.setInteractPrompt('');
  }

  onInteract(camera) {
    if (!this._placed) {
      this._placeNotebook(camera);
    } else if (this._canRead && this._writingMessage) {
      this._openModal();
    }
  }

  _placeNotebook(camera) {
    const dir = new THREE.Vector3(0, -0.5, -1).applyQuaternion(camera.quaternion).normalize();
    const pos = camera.position.clone().addScaledVector(dir, 1.2);
    pos.y = Math.max(pos.y - 0.5, -10);

    // Create simple notebook mesh
    const geo = new THREE.BoxGeometry(0.3, 0.02, 0.22);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b6c42, roughness: 0.9 });
    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.position.copy(pos);
    this.scene.add(this._mesh);
    this._placed = true;
    this.hud.setToolReadout('NOTEBOOK: placed');

    this.network.placeNotebook({ x: pos.x, y: pos.y, z: pos.z });
  }

  onNotebookPlaced(data) {
    this._notebookId = data.notebookId;
  }

  onWriting(data) {
    if (this._notebookId && data.notebookId === this._notebookId) {
      this._writingMessage = data.message;
      this._canRead = true;
      this.hud.setInteractPrompt('[E] Read notebook');
      // Animate mesh
      if (this._mesh) {
        this._mesh.material.color.set(0xffaa44);
        setTimeout(() => this._mesh?.material.color.set(0x8b6c42), 2000);
      }
    }
  }

  _openModal() {
    this._modal.querySelector('#nb-message').textContent = `"${this._writingMessage}"`;
    this._modal.style.display = 'flex';
    document.exitPointerLock?.();
  }

  _closeModal() {
    this._modal.style.display = 'none';
  }

  update() {
    if (this._placed && this._canRead && this._mesh) {
      this.hud.setInteractPrompt('[E] Read notebook');
    }
  }
}
