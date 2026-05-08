import * as THREE from 'three';

export class MotionSensor {
  constructor(scene, hud, network) {
    this.scene = scene;
    this.hud = hud;
    this.network = network;
    this._placed = false;
    this._sensorMeshes = new Map(); // sensorId → { mesh, light }
    this._mapTablet = null;
  }

  setMapTablet(tablet) { this._mapTablet = tablet; }

  onEquip() {
    this.hud.setToolReadout(this._placed ? 'SENSOR: placed' : 'SENSOR: [E] place');
  }

  onUnequip() {
    this.hud.setToolReadout('');
  }

  onInteract(camera) {
    if (this._placed) return;
    const dir = new THREE.Vector3(0, -0.5, -1).applyQuaternion(camera.quaternion).normalize();
    const pos = camera.position.clone().addScaledVector(dir, 1.5);
    pos.y -= 0.4;

    // Build sensor mesh
    const geo = new THREE.BoxGeometry(0.15, 0.25, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    // Indicator light
    const lightGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lightBall = new THREE.Mesh(lightGeo, lightMat);
    lightBall.position.set(pos.x, pos.y + 0.14, pos.z);
    this.scene.add(lightBall);

    const pointLight = new THREE.PointLight(0xffffff, 0.3, 2);
    pointLight.position.copy(lightBall.position);
    this.scene.add(pointLight);

    this._placed = true;
    const tempId = `local_${Date.now()}`;
    this._sensorMeshes.set(tempId, { mesh, lightBall, pointLight, mat: lightMat });

    this.network.placeMotionSensor({ x: pos.x, y: pos.y, z: pos.z });
    this.hud.setToolReadout('SENSOR: placed');
  }

  onSensorPlaced(data) {
    // Map server sensorId to local temp sensor
    const entry = [...this._sensorMeshes.values()].find(e => !e.serverId);
    if (entry) entry.serverId = data.sensorId;
    this._mapTablet?.addSensor(data.sensorId, data.roomId, data.worldPos);
  }

  onMotionSensorEvent(data) {
    const { sensorId, active } = data;
    this._mapTablet?.setSensorActive(sensorId, active);

    // Find local mesh for this sensor
    for (const [, entry] of this._sensorMeshes) {
      if (entry.serverId === sensorId) {
        const color = active ? 0xff2222 : 0xffffff;
        entry.lightBall.material.color.set(color);
        entry.pointLight.color.set(color);
        entry.pointLight.intensity = active ? 0.6 : 0.3;
      }
    }
  }
}
