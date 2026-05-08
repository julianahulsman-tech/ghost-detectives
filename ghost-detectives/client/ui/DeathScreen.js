export class DeathScreen {
  constructor(onSpectate) {
    this._el = document.getElementById('death-screen');
    document.getElementById('spectate-btn').addEventListener('click', () => {
      this.hide();
      onSpectate?.();
    });
  }

  show() {
    this._el.style.display = 'flex';
  }

  hide() {
    this._el.style.display = 'none';
  }
}

export function showEndScreen(result) {
  const el = document.getElementById('end-screen');
  const title = document.getElementById('end-title');
  const ghostEl = document.getElementById('end-ghost');
  const roomEl = document.getElementById('end-room');
  const detail = document.getElementById('end-detail');

  title.textContent = result.result === 'success' ? 'IDENTIFIED!' : 'INVESTIGATION FAILED';
  title.className = result.result === 'success' ? 'win' : 'lose';
  ghostEl.textContent = `Ghost: ${result.ghostType?.name ?? '?'}`;
  roomEl.textContent = `Haunted Room: ${result.ghostRoom ?? '?'}`;
  if (result.result === 'success') {
    detail.textContent = `Solved by ${result.solvedBy ?? 'the team'}`;
  } else {
    detail.textContent = result.reason ?? 'Better luck next time.';
  }

  el.style.display = 'flex';
}
