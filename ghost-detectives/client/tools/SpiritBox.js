import { EVIDENCE } from '@shared/constants.js';

const QUESTIONS = [
  { id: 'q1', text: 'Are you here?' },
  { id: 'q2', text: 'What do you want?' },
  { id: 'q3', text: 'How did you die?' },
  { id: 'q4', text: 'Are you angry?' },
  { id: 'q5', text: 'Did you die here?' },
];

export class SpiritBox {
  constructor(hud, network) {
    this.hud = hud;
    this.network = network;
    this._active = false;
    this._modal = this._buildModal();
  }

  _buildModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.85);border:1px solid #333;
      padding:16px 24px;display:none;z-index:55;pointer-events:all;
      font-family:'Courier New',monospace;min-width:280px;
    `;
    modal.innerHTML = `
      <div style="color:#888;font-size:11px;margin-bottom:10px;letter-spacing:1px">SPIRIT BOX — ASK A QUESTION:</div>
      <div id="sb-questions"></div>
      <div style="color:#666;font-size:10px;margin-top:8px">[Esc] or click outside to close</div>
    `;
    const qDiv = modal.querySelector('#sb-questions');
    for (const q of QUESTIONS) {
      const btn = document.createElement('button');
      btn.textContent = q.text;
      btn.style.cssText = `
        display:block;width:100%;text-align:left;background:none;
        border:none;border-bottom:1px solid #222;color:#bbb;
        padding:7px 0;cursor:pointer;font-family:'Courier New',monospace;font-size:13px;
      `;
      btn.addEventListener('mouseover', () => btn.style.color = '#fff');
      btn.addEventListener('mouseout', () => btn.style.color = '#bbb');
      btn.addEventListener('click', () => this._ask(q));
      qDiv.appendChild(btn);
    }
    document.body.appendChild(modal);
    document.addEventListener('keydown', e => { if (e.code === 'Escape') this._closeModal(); });
    return modal;
  }

  onEquip() {
    this.hud.setToolReadout('SPIRIT BOX: [E] ask');
    this._active = true;
  }

  onUnequip() {
    this.hud.setToolReadout('');
    this._active = false;
    this._closeModal();
  }

  onInteract() {
    if (!this._active) return;
    if (this._modal.style.display === 'none') {
      this._modal.style.display = 'block';
      document.exitPointerLock?.();
    } else {
      this._closeModal();
    }
  }

  _ask(question) {
    this._closeModal();
    this.hud.setToolReadout(`SPIRIT BOX: "${question.text}"`);
    this.network.askSpiritBox(question.id);
  }

  _closeModal() {
    this._modal.style.display = 'none';
  }

  onResponse(data) {
    this.hud.showSpiritResponse(data.response);
  }
}
