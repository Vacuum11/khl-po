// ============================================================
// ROUNDS — round-by-round prediction logic
// ============================================================

let roundPicks     = {};   // { round: { sid: { winner, games } } }
let roundResults   = {};   // actual results from admin
let currentRound   = 1;    // which round is currently active (1–4)
let roundUser      = null;
let roundUserData  = null;
let roundSubmitted = {};   // { [roundIdx]: true } once user saves that round

const ROUND_SERIES = [
  ['w1','w2','w3','w4','e1','e2','e3','e4'],  // round 1
  ['w1w2','w3w4','e1e2','e3e4'],               // round 2
  ['wf','ef'],                                  // round 3
  ['final']                                     // round 4
];

// ── Load data ─────────────────────────────────────────────
async function loadRoundPredictions(uid) {
  const snap = await db.collection('predictions').doc(uid).get();
  if (snap.exists && snap.data().roundPredictions) {
    roundPicks = snap.data().roundPredictions;
    roundSubmitted = snap.data().roundSubmitted || {};
  }
}

async function loadRoundSettings() {
  const snap = await db.collection('settings').doc('results').get();
  if (snap.exists) {
    roundResults  = snap.data().series   || {};
    currentRound  = snap.data().currentRound || 1;
  }
}

// ── Get teams for a series in round view ──────────────────
function teamsForRoundSeries(sid, roundIdx) {
  // R1: from bracket config
  const r1W = BRACKET.west.r1.find(s => s.id === sid);
  if (r1W) return [r1W.home, r1W.away];
  const r1E = BRACKET.east.r1.find(s => s.id === sid);
  if (r1E) return [r1E.home, r1E.away];

  // Later rounds: from real results if available, otherwise from prev round picks
  const tree = {
    'w1w2': ['w1','w2'], 'w3w4': ['w3','w4'],
    'e1e2': ['e1','e2'], 'e3e4': ['e3','e4'],
    'wf':   ['w1w2','w3w4'], 'ef': ['e1e2','e3e4'],
    'final':['wf','ef']
  };
  const children = tree[sid];
  if (!children) return ['?','?'];

  const getWinner = (csid) =>
    roundResults[csid]?.winner || roundPicks[roundIdx - 1]?.[csid]?.winner || '?';

  return [getWinner(children[0]), getWinner(children[1])];
}

function isRoundLocked(roundIdx) {
  // Rounds before current are locked; future rounds not yet open
  return roundIdx < currentRound - 1;
}

function isRoundOpen(roundIdx) {
  return roundIdx === currentRound - 1;
}

// ── Pick ──────────────────────────────────────────────────
function roundPickWinner(roundIdx, sid, team) {
  if (!isRoundOpen(roundIdx) || roundSubmitted[roundIdx]) return;
  const result = roundResults[sid];
  if (result?.complete) return;
  if (!roundPicks[roundIdx]) roundPicks[roundIdx] = {};
  roundPicks[roundIdx][sid] = { ...roundPicks[roundIdx][sid], winner: team };
  renderRoundSection(roundIdx);
  updateRoundProgress(roundIdx);
}

function roundPickScore(roundIdx, sid, score) {
  if (!isRoundOpen(roundIdx) || roundSubmitted[roundIdx]) return;
  const result = roundResults[sid];
  if (result?.complete) return;
  if (!roundPicks[roundIdx]) roundPicks[roundIdx] = {};
  roundPicks[roundIdx][sid] = { ...roundPicks[roundIdx][sid], score };
  renderRoundSection(roundIdx);
}

// ── Save ──────────────────────────────────────────────────
async function saveRoundPrediction(roundIdx) {
  if (!roundUser) return;
  const btn = document.getElementById(`save-round-${roundIdx}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Сохранение…'; }
  try {
    roundSubmitted[roundIdx] = true;
    await db.collection('predictions').doc(roundUser.uid).set({
      roundPredictions: roundPicks,
      roundSubmitted: roundSubmitted,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      username: roundUserData?.username || ''
    }, { merge: true });
    showToast('Прогноз на раунд сохранён! Изменения больше невозможны.', 'success');
    renderRoundSection(roundIdx);
  } catch (e) {
    roundSubmitted[roundIdx] = false;
    showToast('Ошибка: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Сохранить прогноз на раунд'; }
  }
}

// ── Progress ──────────────────────────────────────────────
function updateRoundProgress(roundIdx) {
  const series = ROUND_SERIES[roundIdx];
  const done   = series.filter(sid => roundPicks[roundIdx]?.[sid]?.winner).length;
  const fill   = document.getElementById(`progress-${roundIdx}`);
  const info   = document.getElementById(`progress-info-${roundIdx}`);
  if (fill) fill.style.width = Math.round((done / series.length) * 100) + '%';
  if (info) info.textContent = `${done}/${series.length}`;

  const btn = document.getElementById(`save-round-${roundIdx}`);
  if (btn) btn.disabled = done < series.length || !isRoundOpen(roundIdx);
}

// ─────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────

function renderAllRounds() {
  const container = document.getElementById('rounds-container');
  if (!container) return;
  container.innerHTML = '';
  for (let r = 0; r < 4; r++) {
    container.appendChild(buildRoundSection(r));
  }
}

function renderRoundSection(roundIdx) {
  const old = document.getElementById(`round-section-${roundIdx}`);
  if (!old) return;
  const fresh = buildRoundSection(roundIdx);
  old.replaceWith(fresh);
}

function buildRoundSection(roundIdx) {
  const series  = ROUND_SERIES[roundIdx];
  const name    = ROUND_NAMES[roundIdx];
  const open    = isRoundOpen(roundIdx);
  const locked  = isRoundLocked(roundIdx);
  const future  = roundIdx > currentRound - 1;
  const done    = series.filter(sid => roundPicks[roundIdx]?.[sid]?.winner).length;

  const submitted = roundSubmitted[roundIdx] || false;

  let badgeCls  = 'round-badge';
  let badgeTxt  = '';
  if (open && !submitted) { badgeTxt = 'АКТИВЕН'; }
  if (open && submitted)  { badgeCls += ' locked-badge'; badgeTxt = 'ОТПРАВЛЕН'; }
  if (locked) { badgeCls += ' locked-badge'; badgeTxt = 'ЗАВЕРШЁН'; }
  if (future) { badgeCls += ' locked-badge'; badgeTxt = 'СКОРО'; }
  if (roundIdx === 3 && open && !submitted) badgeCls += ' gold';

  const seriesCards = series.map(sid => buildRoundSeriesCard(sid, roundIdx, open, locked, submitted)).join('');

  const section = document.createElement('div');
  section.className = 'round-section';
  section.id = `round-section-${roundIdx}`;

  section.innerHTML = `
    <div class="round-section-title">
      ${name}
      <span class="${badgeCls}">${badgeTxt}</span>
      ${open && !submitted ? `<span style="margin-left:auto;font-size:.8rem;color:var(--text-2)" id="progress-info-${roundIdx}">${done}/${series.length}</span>` : ''}
    </div>
    ${future ? `<div class="alert alert-info">Этот раунд пока не открыт для прогнозов.</div>` : ''}
    ${open && submitted ? `<div class="alert" style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);color:#6ee7b7;margin-bottom:1rem">✅ Прогноз на этот раунд уже отправлен. Изменения невозможны.</div>` : ''}
    ${open && !submitted ? `
      <div class="progress-bar" style="width:200px;margin-bottom:1rem">
        <div class="progress-fill" id="progress-${roundIdx}" style="width:${Math.round(done/series.length*100)}%"></div>
      </div>` : ''}
    <div class="series-grid">
      ${seriesCards}
    </div>
    ${open && !submitted ? `
      <div style="margin-top:1rem;display:flex;justify-content:flex-end">
        <button class="btn btn-primary" id="save-round-${roundIdx}"
          ${done < series.length ? 'disabled' : ''}>
          Сохранить прогноз на раунд
        </button>
      </div>` : ''}
  `;

  // Wire up events
  if (!future && !submitted) {
    section.querySelectorAll('.series-team[data-sid]').forEach(el => {
      el.addEventListener('click', () => roundPickWinner(roundIdx, el.dataset.sid, el.dataset.team));
    });
    section.querySelectorAll('.games-btn').forEach(el => {
      el.addEventListener('click', () => roundPickScore(roundIdx, el.dataset.sid, el.dataset.score));
    });
    const saveBtn = section.querySelector(`#save-round-${roundIdx}`);
    saveBtn?.addEventListener('click', () => saveRoundPrediction(roundIdx));
  }

  return section;
}

function buildRoundSeriesCard(sid, roundIdx, open, locked, submitted) {
  const [t1, t2] = teamsForRoundSeries(sid, roundIdx);
  const pick     = roundPicks[roundIdx]?.[sid] || {};
  const result   = roundResults[sid];
  const complete = result?.complete;
  const editable = open && !complete && !submitted;

  const teamRow = (team) => {
    if (!team || team === '?') {
      return `<div class="series-team disabled"><span class="team-name" style="color:var(--text-3)">TBD</span></div>`;
    }
    const isSelected = !complete && pick.winner === team;
    const isWinner   = complete && result.winner === team;
    const dis = !editable ? ' disabled' : '';
    return `<div class="series-team${dis}${isSelected?' selected':''}${isWinner?' winner':''}" data-sid="${sid}" data-team="${team}">
      <div class="team-pick-indicator"></div>
      <span class="team-name">${team}</span>
    </div>`;
  };

  const useReversed = pick.winner && t2 && pick.winner === t2;
  const scores = ['4:0','4:1','4:2','4:3'];
  const displayScores = useReversed ? ['0:4','1:4','2:4','3:4'] : scores;

  const gamesRow = scores.map((s, i) => {
    let cls = 'games-btn';
    if (complete && result.score === s) cls += ' result';
    else if (!complete && pick.score === s) cls += ' selected';
    const dis = !editable ? ' disabled' : '';
    return `<button class="${cls}" data-sid="${sid}" data-score="${s}"${dis}>${displayScores[i]}</button>`;
  }).join('');

  return `
    <div class="series-card${complete?' complete':''}${!open || submitted?' locked':''}">
      ${teamRow(t1)}
      ${teamRow(t2)}
      <div class="series-games-row">${gamesRow}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
async function initRounds(user, userData) {
  roundUser     = user;
  roundUserData = userData;
  await Promise.all([loadRoundPredictions(user.uid), loadRoundSettings()]);
  renderAllRounds();
}
