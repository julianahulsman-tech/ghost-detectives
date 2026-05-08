import * as THREE from 'three';

export class GhostRenderer {
  constructor(scene) {
    this.scene = scene;
    this._group = new THREE.Group();
    this._group.visible = false;
    scene.add(this._group);

    this._buildMesh();
    this._targetPos = new THREE.Vector3();
    this._visible = false;
  }

  _buildMesh() {
    // Simple translucent humanoid ghost shape
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 1.2, 6, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xaaccff,
      emissive: 0x334466,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this._body = new THREE.Mesh(bodyGeo, mat);
    this._body.position.y = 0.9;
    this._group.add(this._body);

    // Glow sphere at head
    const glowGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 1.8;
    this._group.add(glow);

    // Ghost light source
    this._light = new THREE.PointLight(0x6688ff, 0.8, 5);
    this._light.position.y = 1.0;
    this._group.add(this._light);
  }

  setVisible(on) {
    this._visible = on;
    this._group.visible = on;
  }

  setTarget(pos) {
    this._targetPos.set(pos.x, pos.y, pos.z);
  }

  update(delta) {
    if (!this._visible) return;
    // Lerp toward server-reported position
    this._group.position.lerp(this._targetPos, 0.15);

    // Subtle float animation
    const t = Date.now() / 1000;
    this._body.position.y = 0.9 + Math.sin(t * 1.3) * 0.08;
    this._light.intensity = 0.7 + Math.sin(t * 2.1) * 0.15;
  }

  getPosition() {
    return this._group.position;
  }
}
