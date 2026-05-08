import * as THREE from 'three';

export class PlayerRenderer {
  constructor(scene) {
    this.scene = scene;
    this._players = new Map(); // socketId → { mesh, targetPos, targetRotY }
  }

  update(playersState, localId) {
    const activeIds = new Set();

    for (const [id, data] of Object.entries(playersState)) {
      if (id === localId) continue;
      if (data.isDead) continue;
      activeIds.add(id);

      if (!this._players.has(id)) {
        this._addPlayer(id);
      }
      const p = this._players.get(id);
      p.targetPos.set(data.position.x, data.position.y, data.position.z);
      p.targetRotY = data.rotation.y;
    }

    // Remove players that left
    for (const [id] of this._players) {
      if (!activeIds.has(id)) {
        this.scene.remove(this._players.get(id).group);
        this._players.delete(id);
      }
    }
  }

  tick() {
    for (const p of this._players.values()) {
      p.group.position.lerp(p.targetPos, 0.2);
      p.group.rotation.y = THREE.MathUtils.lerp(p.group.rotation.y, p.targetRotY, 0.2);
    }
  }

  _addPlayer(id) {
    const group = new THREE.Group();

    // Capsule body
    const mat = new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), mat);
    body.position.y = 0.85;
    group.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x998877, roughness: 0.7 })
    );
    head.position.y = 1.6;
    group.add(head);

    // Name label could go here in a future pass

    this.scene.add(group);
    this._players.set(id, {
      group,
      targetPos: new THREE.Vector3(),
      targetRotY: 0,
    });
  }
}
