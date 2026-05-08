import { ROOMS } from '@server/data/house.js';

// Sensor state: sensorId → { roomId, active }
export class MapTablet {
  constructor() {
    this._el = document.getElementById('map-tablet');
    this._canvas = document.getElementById('map-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._sensors = new Map();
    this._currentFloor = 'ground';
    this._visible = false;

    document.getElementById('map-close').addEventListener('click', () => this.hide());
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyM') this.toggle();
      if (e.code === 'Escape' && this._visible) this.hide();
    });
    this._canvas.addEventListener('click', e => this._onCanvasClick(e));
  }

  addSensor(sensorId, roomId, worldPos) {
    this._sensors.set(sensorId, { roomId, worldPos, active: false });
    if (this._visible) this._render();
  }

  setSensorActive(sensorId, active) {
    const s = this._sensors.get(sensorId);
    if (s) { s.active = active; }
    if (this._visible) this._render();
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  show() {
    this._visible = true;
    this._el.style.display = 'flex';
    document.exitPointerLock?.();
    this._render();
  }

  hide() {
    this._visible = false;
    this._el.style.display = 'none';
  }

  _render() {
    const ctx = this._ctx;
    const W = this._canvas.width;
    const H = this._canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);

    const floorRooms = ROOMS.filter(r => r.floor === this._currentFloor);
    if (!floorRooms.length) return;

    // Find world bounds for the current floor
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of floorRooms) {
      minX = Math.min(minX, r.bounds.min.x);
      maxX = Math.max(maxX, r.bounds.max.x);
      minZ = Math.min(minZ, r.bounds.min.z);
      maxZ = Math.max(maxZ, r.bounds.max.z);
    }

    const margin = 20;
    const scaleX = (W - margin * 2) / (maxX - minX);
    const scaleZ = (H - margin * 2) / (maxZ - minZ);
    const scale = Math.min(scaleX, scaleZ);

    const toScreen = (wx, wz) => ({
      x: margin + (wx - minX) * scale,
      y: margin + (wz - minZ) * scale,
    });

    // Draw rooms
    for (const r of floorRooms) {
      const tl = toScreen(r.bounds.min.x, r.bounds.min.z);
      const br = toScreen(r.bounds.max.x, r.bounds.max.z);
      ctx.strokeStyle = '#2a3a2a';
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

      // Room label
      ctx.fillStyle = '#334433';
      ctx.font = '9px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, (tl.x + br.x) / 2, (tl.y + br.y) / 2);
    }

    // Draw sensors
    for (const [id, s] of this._sensors) {
      const sRoom = ROOMS.find(r => r.id === s.roomId);
      if (!sRoom || sRoom.floor !== this._currentFloor) continue;
      const pos = toScreen(s.worldPos?.x ?? (sRoom.bounds.min.x + sRoom.bounds.max.x) / 2,
                           s.worldPos?.z ?? (sRoom.bounds.min.z + sRoom.bounds.max.z) / 2);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = s.active ? '#ff3333' : '#ffffff';
      ctx.fill();
      if (s.active) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,50,50,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Floor selector tabs
    const floors = ['ground', 'top', 'basement'];
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'left';
    floors.forEach((f, i) => {
      const labelY = H - 10 - i * 18;
      if (f === this._currentFloor) {
        ctx.fillStyle = 'rgba(100,200,100,0.15)';
        ctx.fillRect(4, labelY - 12, 76, 15);
      }
      ctx.fillStyle = f === this._currentFloor ? '#7fcc7f' : '#446644';
      ctx.fillText(f.toUpperCase(), 8, labelY);
    });
  }

  _onCanvasClick(e) {
    const rect = this._canvas.getBoundingClientRect();
    const scaleY = this._canvas.height / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    const H = this._canvas.height;
    const floors = ['ground', 'top', 'basement'];
    for (let i = 0; i < floors.length; i++) {
      const labelY = H - 10 - i * 18;
      if (y >= labelY - 13 && y <= labelY + 3) {
        this._currentFloor = floors[i];
        this._render();
        return;
      }
    }
  }

  setFloor(floor) {
    this._currentFloor = floor;
    if (this._visible) this._render();
  }
}
