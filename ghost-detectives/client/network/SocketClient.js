import { io } from 'socket.io-client';
import { EV } from '@shared/constants.js';

export class SocketClient {
  constructor() {
    this.socket = io();
    this.id = null;
    this._handlers = {};

    this.socket.on('connect', () => {
      this.id = this.socket.id;
    });
  }

  on(event, cb) {
    this.socket.on(event, cb);
  }

  emit(event, data) {
    this.socket.emit(event, data);
  }

  join(name) {
    this.socket.emit(EV.PLAYER_JOIN, { name });
  }

  sendMove(position, rotationY, currentRoomId) {
    this.socket.emit(EV.PLAYER_MOVE, {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { y: rotationY },
      currentRoomId,
    });
  }

  sendToolHeld(toolId) {
    this.socket.emit(EV.TOOL_HELD, { toolId });
  }

  startGame() {
    this.socket.emit(EV.GAME_START);
  }

  submitGuess(ghostId) {
    this.socket.emit(EV.GAME_SUBMIT_GUESS, { ghostId });
  }

  askSpiritBox(question) {
    this.socket.emit(EV.TOOL_SPIRIT_BOX_ASK, { question });
  }

  placeMotionSensor(worldPos) {
    this.socket.emit(EV.TOOL_MOTION_SENSOR_PLACE, { worldPos });
  }

  placeNotebook(worldPos) {
    this.socket.emit(EV.TOOL_NOTEBOOK_PLACE, { worldPos });
  }

  sendHiding(hiding) {
    this.socket.emit('player:hide', { hiding });
  }

  togglePower() {
    this.socket.emit('player:togglePower');
  }
}
