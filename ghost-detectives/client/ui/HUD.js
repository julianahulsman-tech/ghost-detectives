const TOOL_DEFS = [
  { id: 'emf',         key: '1', name: 'EMF' },
  { id: 'thermometer', key: '2', name: 'THERM' },
  { id: 'goggles',     key: '3', name: 'NVG' },
  { id: 'uv',          key: '4', name: 'UV' },
  { id: 'notebook',    key: '5', name: 'NOTEBOOK' },
  { id: 'sensor',      key: '6', name: 'SENSOR' },
  { id: 'spiritbox',   key: '7', name: 'SPIRIT' },
];

export class HUD {
  constructor() {
    this._sanityBar  = document.getElementById('sanity-bar');
    this._sanityPct  = document.getElementById('sanity-pct');
    this._toolBar    = document.getElementById('tool-bar');
    this._toolReadout = document.getElementById('tool-readout');
    this._roomName   = document.getElementById('room-name');
    this._tempDisplay = document.getElementById('temp-display');
    this._huntWarn   = document.getElementById('hunt-warning');
    this._spiritResp = document.getElementById('spirit-response');
    this._evPopup    = document.getElementById('evidence-popup');
    this._playerCount = document.getElementById('player-count');
    this._sessionId  = document.getElementById('session-id');
    this._interactPrompt = document.getElementById('interact-prompt');

    this._buildToolBar();
    this._activeToolId = null;
    this._evPopupTimer = null;
    this._spiritTimer = null;
  }

  show() {
    document.getElementById('hud').style.display = 'block';
  }

  _buildToolBar() {
    this._toolBar.innerHTML = '';
    for (const t of TOOL_DEFS) {
      const slot = document.createElement('div');
      slot.className = 'tool-slot';
      slot.id = `slot-${t.id}`;
      slot.innerHTML = `<span class="slot-key">[${t.key}]</span><span class="slot-name">${t.name}</span>`;
      this._toolBar.appendChild(slot);
    }
  }

  setActiveSlot(toolId) {
    this._activeToolId = toolId;
    for (const t of TOOL_DEFS) {
      const slot = document.getElementById(`slot-${t.id}`);
      if (slot) slot.classList.toggle('active', t.id === toolId);
    }
  }

  setToolReadout(text) {
    this._toolReadout.textContent = text || '';
  }

  setSanity(pct) {
    const p = Math.max(0, Math.min(100, pct));
    this._sanityBar.style.width = p + '%';
    this._sanityPct.textContent = Math.floor(p) + '%';
    // Color: green (100%) → yellow (50%) → red (0%)
    const r = p > 50 ? Math.round(200 * (1 - (p - 50) / 50)) : 200;
    const g = p < 50 ? Math.round(200 * p / 50) : 200;
    this._sanityBar.style.background = `rgb(${r},${g},0)`;
    this._sanityPct.style.color = p < 25 ? '#f44' : p < 50 ? '#fa4' : '#7f7';
  }

  setRoom(name) {
    this._roomName.textContent = name || '';
  }

  setTemperature(temp) {
    if (temp === null || temp === undefined) {
      this._tempDisplay.textContent = '';
      return;
    }
    const label = `${temp > 0 ? '+' : ''}${temp.toFixed(1)}°C`;
    this._tempDisplay.textContent = label;
    this._tempDisplay.style.color = temp <= 0 ? '#aaccff' : temp <= 5 ? '#88bbff' : '#6cf';
    // Frost vignette
    document.getElementById('frost-vignette').style.opacity = temp <= 0 ? '1' : temp <= 5 ? '0.5' : '0';
  }

  showHuntWarning(on, text) {
    this._huntWarn.style.display = on ? 'block' : 'none';
    if (text) this._huntWarn.textContent = text;
  }

  showSpiritResponse(text) {
    clearTimeout(this._spiritTimer);
    this._spiritResp.textContent = `👻 "${text}"`;
    this._spiritResp.style.display = 'block';
    this._spiritTimer = setTimeout(() => { this._spiritResp.style.display = 'none'; }, 4000);
  }

  showEvidencePopup(text) {
    clearTimeout(this._evPopupTimer);
    this._evPopup.textContent = text;
    this._evPopup.style.display = 'block';
    this._evPopupTimer = setTimeout(() => { this._evPopup.style.display = 'none'; }, 3000);
  }

  setPlayerCount(n, max) {
    this._playerCount.textContent = `Players: ${n}/${max}`;
  }

  setSessionId(id) {
    this._sessionId.textContent = `#${id}`;
  }

  setInteractPrompt(text) {
    const el = this._interactPrompt;
    if (text) {
      el.textContent = text;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }
}
