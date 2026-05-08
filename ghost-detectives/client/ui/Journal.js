import { GHOST_TYPES } from '@shared/ghostData.js';
import { EVIDENCE } from '@shared/constants.js';

const EVIDENCE_LABELS = {
  [EVIDENCE.EMF5]: 'EMF Level 5',
  [EVIDENCE.FREEZING_TEMPS]: 'Freezing Temperatures',
  [EVIDENCE.FINGERPRINTS]: 'Fingerprints',
  [EVIDENCE.GHOST_ORBS]: 'Ghost Orbs',
  [EVIDENCE.SPIRIT_BOX]: 'Spirit Box',
  [EVIDENCE.WRITING]: 'Ghost Writing',
};

// States: 0=unknown, 1=confirmed, 2=ruled out
const STATE_ICONS = ['?', '✓', '✗'];
const STATE_CLASSES = ['', 'confirmed', 'ruledout'];

export class Journal {
  constructor(onSubmit) {
    this._onSubmit = onSubmit;
    this._states = {}; // evidenceId → 0|1|2
    this._visible = false;
    this._guessGhostId = null;

    for (const key of Object.values(EVIDENCE)) {
      this._states[key] = 0;
    }

    this._el = document.getElementById('journal');
    this._buildUI();

    document.getElementById('journal-close').addEventListener('click', () => this.hide());
    document.getElementById('journal-submit').addEventListener('click', () => this._onSubmitClick());
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyJ') this.toggle();
      if (e.code === 'Escape' && this._visible) this.hide();
    });
  }

  _buildUI() {
    // Evidence list
    const evList = document.getElementById('evidence-list');
    evList.innerHTML = '<h3>EVIDENCE</h3>';
    for (const [key, label] of Object.entries(EVIDENCE_LABELS)) {
      const row = document.createElement('div');
      row.className = 'evidence-row';
      row.dataset.ev = key;
      row.innerHTML = `
        <div class="ev-state" id="ev-state-${key}">${STATE_ICONS[0]}</div>
        <span class="ev-label">${label}</span>`;
      row.addEventListener('click', () => this._cycleState(key));
      evList.appendChild(row);
    }

    // Ghost list
    const ghostList = document.getElementById('ghost-list');
    ghostList.innerHTML = '<h3>GHOST TYPE</h3>';
    for (const g of GHOST_TYPES) {
      const div = document.createElement('div');
      div.className = 'ghost-entry';
      div.id = `ghost-entry-${g.id}`;
      div.textContent = g.name;
      div.title = g.evidence.map(e => EVIDENCE_LABELS[e] || e).join(', ');
      div.addEventListener('click', () => this._selectGhost(g.id));
      ghostList.appendChild(div);
    }
  }

  _cycleState(evKey) {
    this._states[evKey] = (this._states[evKey] + 1) % 3;
    const stateEl = document.getElementById(`ev-state-${evKey}`);
    const s = this._states[evKey];
    stateEl.textContent = STATE_ICONS[s];
    stateEl.className = `ev-state ${STATE_CLASSES[s]}`;
    const row = document.querySelector(`[data-ev="${evKey}"]`);
    if (s === 2) row.classList.add('ruledout');
    else row.classList.remove('ruledout');
    this._updateGhostList();
  }

  _updateGhostList() {
    const confirmed = Object.entries(this._states)
      .filter(([, s]) => s === 1).map(([k]) => k);
    const ruledOut = Object.entries(this._states)
      .filter(([, s]) => s === 2).map(([k]) => k);

    let candidates = [];
    for (const g of GHOST_TYPES) {
      const el = document.getElementById(`ghost-entry-${g.id}`);
      if (!el) continue;
      el.classList.remove('eliminated', 'candidate', 'sole-candidate');

      const hasAllConfirmed = confirmed.every(ev => g.evidence.includes(ev));
      const hasNoRuledOut = ruledOut.every(ev => !g.evidence.includes(ev));
      const isCandidate = hasAllConfirmed && hasNoRuledOut;

      if (!isCandidate) {
        el.classList.add('eliminated');
      } else {
        candidates.push(g.id);
        el.classList.add('candidate');
      }
    }

    if (candidates.length === 1) {
      this._guessGhostId = candidates[0];
      document.getElementById(`ghost-entry-${candidates[0]}`).classList.add('sole-candidate');
    } else {
      this._guessGhostId = null;
    }

    document.getElementById('journal-submit').disabled = candidates.length === 0;
  }

  _selectGhost(ghostId) {
    this._guessGhostId = ghostId;
    // Highlight selection
    for (const g of GHOST_TYPES) {
      const el = document.getElementById(`ghost-entry-${g.id}`);
      if (el && el.classList.contains('candidate')) {
        el.style.fontWeight = g.id === ghostId ? 'bold' : 'normal';
      }
    }
  }

  _onSubmitClick() {
    if (!this._guessGhostId) {
      // If multiple candidates, require explicit selection
      const candidates = GHOST_TYPES.filter(g => {
        const el = document.getElementById(`ghost-entry-${g.id}`);
        return el && el.classList.contains('candidate');
      });
      if (candidates.length > 1) {
        alert('Multiple ghost candidates remain. Click on the ghost name you want to identify.');
        return;
      }
      if (candidates.length === 1) this._guessGhostId = candidates[0].id;
    }
    if (this._guessGhostId) {
      this._onSubmit(this._guessGhostId);
      this.hide();
    }
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  show() {
    this._visible = true;
    this._el.style.display = 'block';
    // Release pointer lock so player can interact with journal
    document.exitPointerLock?.();
  }

  hide() {
    this._visible = false;
    this._el.style.display = 'none';
  }

  isVisible() { return this._visible; }
}
