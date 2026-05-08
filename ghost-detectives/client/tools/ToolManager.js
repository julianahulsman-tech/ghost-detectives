import * as THREE from 'three';
import { EMFReader } from './EMFReader.js';
import { Thermometer } from './Thermometer.js';
import { NightVisionGoggles } from './NightVisionGoggles.js';
import { UVFlashlight } from './UVFlashlight.js';
import { Notebook } from './Notebook.js';
import { MotionSensor } from './MotionSensor.js';
import { SpiritBox } from './SpiritBox.js';

const SLOT_KEYS = { Digit1:'emf', Digit2:'thermometer', Digit3:'goggles', Digit4:'uv', Digit5:'notebook', Digit6:'sensor', Digit7:'spiritbox' };

export class ToolManager {
  constructor(camera, scene, hud, sceneManager, network) {
    this.camera = camera;
    this.scene = scene;
    this.hud = hud;
    this.network = network;
    this._activeTool = null;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3;

    // Instantiate all tools
    this.tools = {
      emf:         new EMFReader(hud),
      thermometer: new Thermometer(hud),
      goggles:     new NightVisionGoggles(hud, sceneManager, scene),
      uv:          new UVFlashlight(camera, scene, hud),
      notebook:    new Notebook(scene, hud, network),
      sensor:      new MotionSensor(scene, hud, network),
      spiritbox:   new SpiritBox(hud, network),
    };

    document.addEventListener('keydown', e => this._onKey(e));
    document.addEventListener('keydown', e => { if (e.code === 'KeyE') this._onInteract(); });
  }

  _onKey(e) {
    const toolId = SLOT_KEYS[e.code];
    if (!toolId) return;
    if (this._activeTool === toolId) {
      // Toggle off for goggles
      if (toolId === 'goggles') {
        this.tools.goggles.toggle();
      }
      return;
    }
    this._equip(toolId);
  }

  _equip(toolId) {
    if (this._activeTool && this.tools[this._activeTool]?.onUnequip) {
      this.tools[this._activeTool].onUnequip();
    }
    this._activeTool = toolId;
    this.hud.setActiveSlot(toolId);
    if (this.tools[toolId]?.onEquip) {
      this.tools[toolId].onEquip();
    }
    this.network.sendToolHeld(toolId);
  }

  getActiveTool() { return this._activeTool; }

  update(delta, currentRoomId) {
    // Update active tool readout
    const tool = this.tools[this._activeTool];
    if (tool?.update) tool.update(delta, currentRoomId);

    // Raycast for interactions
    this._checkInteractions();
  }

  _checkInteractions() {
    // UV flashlight fingerprint reveal is handled inside UVFlashlight.update()
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.raycaster.set(this.camera.position, dir);
    // Future: interactive objects (fuse box, etc.)
  }

  _onInteract() {
    const tool = this.tools[this._activeTool];
    if (tool?.onInteract) {
      tool.onInteract(this.camera);
    }
  }

  // Called by server events
  onEMFUpdate(level) { this.tools.emf?.onEMFUpdate(level); }
  onTemperature(temp) { this.tools.thermometer?.onTemperature(temp); }
  onGhostOrbs(active) { this.tools.goggles?.onGhostOrbs(active); }
  onFingerprintLocations(locs) { this.tools.uv?.onFingerprintLocations(locs); }
  onWriting(data) { this.tools.notebook?.onWriting(data); }
  onMotionSensor(data) { this.tools.sensor?.onMotionSensorEvent(data); }
  onSpiritBoxResponse(data) { this.tools.spiritbox?.onResponse(data); }
  onSensorPlaced(data) { this.tools.sensor?.onSensorPlaced(data); }
  onNotebookPlaced(data) { this.tools.notebook?.onNotebookPlaced(data); }
}
