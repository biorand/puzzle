/* ── toggle masks ── */
const MASKS = [
  0x00B, 0x017, 0x026, 0x059, 0x0BA, 0x134, 0x0C8, 0x1D0, 0x1A0,
];
const DTMF_HIGH = [1209, 1336, 1477, 1209, 1336, 1477, 1209, 1336, 1477];
const DTMF_LOW  = [ 697,  697,  697,  770,  770,  770,  852,  852,  852];
const SOLVED = 0x1FF;
const SCORE_KEY = 'repuzzles-door-score';

/* ── BFS - precompute optimal distance for every state ── */
const dist = new Array(512).fill(-1);
const groups = Array.from({ length: 5 }, () => []);
let maxDist = 0;

{
  const q = [SOLVED];
  dist[SOLVED] = 0;
  groups[0].push(SOLVED);

  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    const nd = dist[cur] + 1;
    if (nd > maxDist) maxDist = nd;

    for (const mask of MASKS) {
      const next = cur ^ mask;
      if (dist[next] !== -1) continue;
      dist[next] = nd;
      q.push(next);
      if (nd < groups.length) groups[nd].push(next);
    }
  }
}

/* ── audio ── */
let audioCtx = null;

function initAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(idx) {
  initAudio();
  const now = audioCtx.currentTime;
  for (const freq of [DTMF_LOW[idx], DTMF_HIGH[idx]]) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

function playChime() {
  initAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(523, now);
  osc.frequency.setValueAtTime(659, now + 0.15);
  osc.frequency.setValueAtTime(784, now + 0.3);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

/* ── DOM refs ── */
const cells = Array.from(document.querySelectorAll('.cell'));
const movesNum = document.getElementById('moves-num');
const optimalNum = document.getElementById('optimal-num');
const scoreNum = document.getElementById('score-num');
const overlay = document.getElementById('complete-overlay');
const newBtn = document.getElementById('new-btn');
const resetBtn = document.getElementById('reset-btn');

/* ── game state ── */
let state = SOLVED;
let initialState = SOLVED;
let moves = 0;
let optimal = 0;
let playing = false;

/* ── render ── */
function render() {
  for (let i = 0; i < 9; i++)
    cells[i].classList.toggle('orange', !!(state & (1 << i)));
  movesNum.textContent = moves;
  optimalNum.textContent = optimal;
}

/* ── puzzle generation ── */
function generatePuzzle() {
  const maxD = Math.min(4, maxDist);
  const d = Math.floor(Math.random() * maxD) + 1;
  const pool = groups[d];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  initialState = pick;
  state = pick;
  moves = 0;
  optimal = d;
  render();
}

/* ── actions ── */
function press(idx) {
  if (playing) return;
  initAudio();
  state ^= MASKS[idx];
  moves++;
  playTone(idx);
  render();
  if (state === SOLVED) completeAnimation();
}

function resetPuzzle() {
  if (playing) return;
  state = initialState;
  moves = 0;
  render();
}

async function completeAnimation() {
  playing = true;
  playChime();

  for (let i = 8; i >= 0; i--) {
    await new Promise(r => setTimeout(r, 120));
    cells[i].classList.remove('orange');
  }

  overlay.classList.remove('hidden');
  await new Promise(r => setTimeout(r, 3000));
  overlay.classList.add('hidden');

  const next = parseInt(scoreNum.textContent, 10) + 1;
  scoreNum.textContent = next;
  localStorage.setItem(SCORE_KEY, next);

  generatePuzzle();
  playing = false;
}

/* ── init ── */
scoreNum.textContent = localStorage.getItem(SCORE_KEY) || '0';
generatePuzzle();

for (const cell of cells)
  cell.addEventListener('click', () => press(parseInt(cell.dataset.idx, 10)));

newBtn.addEventListener('click', () => { if (!playing) generatePuzzle(); });
resetBtn.addEventListener('click', resetPuzzle);
document.addEventListener('click', initAudio, { once: true });
