// ============================================================
// BRACKET — logic and rendering for full bracket prediction
// ============================================================

// State: map of seriesId → { winner, games }
let picks = {};
let resultsData = {};   // actual results loaded from Firestore
let currentUser = null;
let currentUserData = null;
let isLocked = false;   // true after admin locks full-bracket submissions

// ── Series ID helpers ─────────────────────────────────────

// Round 2 series derived from round 1 pairs
// w1/w2 → w1w2, w3/w4 → w3w4, e1/e2 → e1e2, e3/e4 → e3e4
// Round 3 (conf finals)
// w1w2 vs w3w4 → wf    |   e1e2 vs e3e4 → ef
// Round 4 (Gagarin Cup)
// wf vs ef → final

const SERIES_TREE = {
  // id → [child1, child2]  (children are the R1 series whose winners meet here)
  'w1w2': ['w1','w2'],
  'w3w4': ['w3','w4'],
  'wf':   ['w1w2','w3w4'],
  'e1e2': ['e1','e2'],
  'e3e4': ['e3','e4'],
  'ef':   ['e1e2','e3e4'],
  'final':['wf','ef']
};

// All series in bracket order
const ALL_SERIES_ORDERED = [
  'w1','w2','w3','w4',          // West R1
  'e1','e2','e3','e4',          // East R1
  'w1w2','w3w4',                // West R2
  'e1e2','e3e4',                // East R2
  'wf','ef',                    // Conf finals
  'final'                       // Gagarin Cup
];

// ── Which teams can appear in a series (based on picks so far) ─
function teamsForSeries(sid) {
  // R1: teams come from BRACKET config
  const r1W = BRACKET.west.r1.find(s => s.id === sid);
  if (r1W) return [r1W.home, r1W.away];
  const r1E = BRACKET.east.r1.find(s => s.id === sid);
  if (r1E) return [r1E.home, r1E.away];

  // Later rounds: winners of child series
  const children = SERIES_TREE[sid];
  if (!children) return ['?','?'];

  const t1 = picks[children[0]]?.winner || '?';
  const t2 = picks[children[1]]?.winner || '?';
  return [t1, t2];
}

// ── Get real result for a series (from admin data) ────────
function resultForSeries(sid) {
  return resultsData?.[sid] || null;
}

function roundOfSeries(sid) {
  if (['w1','w2','w3','w4','e1','e2','e3','e4'].includes(sid)) return 0;
  if (['w1w2','w3w4','e1e2','e3e4'].includes(sid)) return 1;
  if (['wf','ef'].includes(sid)) return 2;
  if (sid === 'final') return 3;
  return -1;
}

// ── Pick a winner for a series ────────────────────────────
function pickWinner(sid, team) {
  if (isLocked) return;
  const result = resultForSeries(sid);
  if (result?.complete) return;        // series already finished, no editing

  const prev = picks[sid]?.winner;
  picks[sid] = { ...picks[sid], winner: team };

  // Cascade: if this series' winner changes, invalidate downstream picks
  if (prev && prev !== team) {
    invalidateDownstream(sid, prev);
  }

  renderBracket();
  updateProgress();
}

function pickScore(sid, score) {
  if (isLocked) return;
  const result = resultForSeries(sid);
  if (result?.complete) return;
  picks[sid] = { ...picks[sid], score };
  renderSeriesGamesRow(sid);
  renderBracketList();
}

function invalidateDownstream(sid, oldWinner) {
  for (const [parent, children] of Object.entries(SERIES_TREE)) {
    if (children.includes(sid) && picks[parent]?.winner === oldWinner) {
      delete picks[parent];
      invalidateDownstream(parent, oldWinner);
    }
  }
}

// ── Count completed picks ─────────────────────────────────
function countPicks() {
  return ALL_SERIES_ORDERED.filter(sid => picks[sid]?.winner).length;
}

function updateProgress() {
  const total  = ALL_SERIES_ORDERED.length;   // 15
  const done   = countPicks();
  const pct    = Math.round((done / total) * 100);

  const fill = document.getElementById('progress-fill');
  const info = document.getElementById('save-info');
  if (fill) fill.style.width = pct + '%';
  if (info) info.textContent = `Заполнено: ${done} / ${total} серий`;

  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = done < total;
}

// ── Save to Firestore ─────────────────────────────────────
async function savePrediction() {
  if (!currentUser) return;
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Сохранение…';
  try {
    await db.collection('predictions').doc(currentUser.uid).set({
      fullBracket: picks,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      username: currentUserData?.username || ''
    }, { merge: true });
    showToast('Прогноз сохранён! Можно редактировать до старта ПО.', 'success');
    btn.disabled = false;
    btn.textContent = 'Сохранить прогноз';
    updateProgress();
  } catch (e) {
    showToast('Ошибка сохранения: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Сохранить прогноз';
  }
}

// ── Load user's previous prediction ──────────────────────
async function loadPrediction(uid) {
  const snap = await db.collection('predictions').doc(uid).get();
  if (snap.exists && snap.data().fullBracket) {
    picks = snap.data().fullBracket;
  }
}

// ── Load results from Firestore ───────────────────────────
async function loadResults() {
  const snap = await db.collection('settings').doc('results').get();
  if (snap.exists) {
    resultsData = snap.data().series || {};
    isLocked    = snap.data().fullBracketLocked || false;
  }
}

// ─────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────

// ── Build bracket connector column (n pairs of top+bottom halves) ─
function renderConnectors(pairCount) {
  const pairs = Array.from({ length: pairCount }, () =>
    `<div class="connector-pair">
      <div class="connector-half top"></div>
      <div class="connector-half bottom"></div>
    </div>`
  ).join('');
  return `<div class="bracket-connectors">${pairs}</div>`;
}

function renderBracket() {
  const container = document.getElementById('bracket-container');
  if (!container) return;

  container.innerHTML = `
    <div class="conference-bracket west">
      <div class="conf-title">ЗАПАДНАЯ КОНФЕРЕНЦИЯ</div>
      <div class="bracket-rounds">
        ${renderRound(['w1','w2','w3','w4'], 0)}
        ${renderConnectors(2)}
        ${renderRound(['w1w2','w3w4'], 1)}
        ${renderConnectors(1)}
        ${renderRound(['wf'], 2)}
        <div class="bracket-connector-final"></div>
      </div>
    </div>

    <div class="final-center">
      <div class="trophy-icon">🏆</div>
      <div class="final-label">Кубок Гагарина</div>
      ${renderSeriesCard('final', true)}
    </div>

    <div class="conference-bracket east">
      <div class="conf-title">ВОСТОЧНАЯ КОНФЕРЕНЦИЯ</div>
      <div class="bracket-rounds">
        ${renderRound(['e1','e2','e3','e4'], 0)}
        ${renderConnectors(2)}
        ${renderRound(['e1e2','e3e4'], 1)}
        ${renderConnectors(1)}
        ${renderRound(['ef'], 2)}
        <div class="bracket-connector-final"></div>
      </div>
    </div>
  `;

  // Attach event listeners
  container.querySelectorAll('.series-team[data-sid]').forEach(el => {
    el.addEventListener('click', () => {
      pickWinner(el.dataset.sid, el.dataset.team);
    });
  });
  container.querySelectorAll('.games-btn').forEach(el => {
    el.addEventListener('click', () => pickScore(el.dataset.sid, el.dataset.score));
  });

  renderBracketList();
}

// ── Mobile: vertical list view of the full bracket ───────
const BRACKET_ROUNDS_LIST = [
  { name: '1/8 финала',    ids: ['w1','w2','w3','w4','e1','e2','e3','e4'] },
  { name: '1/4 финала',    ids: ['w1w2','w3w4','e1e2','e3e4'] },
  { name: '1/2 финала',    ids: ['wf','ef'] },
  { name: 'Кубок Гагарина', ids: ['final'] }
];

function renderBracketList() {
  const container = document.getElementById('bracket-list');
  if (!container) return;

  container.innerHTML = BRACKET_ROUNDS_LIST.map(({ name, ids }) => {
    const cards = ids.map(sid => renderSeriesCard(sid, sid === 'final', true)).join('');
    return `<div class="round-section">
      <div class="round-section-title">${name}</div>
      <div class="series-grid">${cards}</div>
    </div>`;
  }).join('');

  container.querySelectorAll('.series-team[data-sid]').forEach(el => {
    el.addEventListener('click', () => pickWinner(el.dataset.sid, el.dataset.team));
  });
  container.querySelectorAll('.games-btn').forEach(el => {
    el.addEventListener('click', () => pickScore(el.dataset.sid, el.dataset.score));
  });
}

function renderRound(seriesIds, roundIdx) {
  const label = ROUND_NAMES[roundIdx];
  const cardsHtml = seriesIds.map(sid => `
    <div class="series-wrapper">
      ${renderSeriesCard(sid)}
    </div>
  `).join('');

  return `
    <div class="bracket-round">
      <div class="round-label">${label}</div>
      <div class="bracket-series-col">
        ${cardsHtml}
      </div>
    </div>
  `;
}

function renderSeriesCard(sid, isFinal = false, noId = false) {
  const [t1, t2]  = teamsForSeries(sid);
  const pick      = picks[sid] || {};
  const result    = resultForSeries(sid);
  const complete  = result?.complete;
  const locked    = isLocked;

  const teamHtml = (team, isT1) => {
    if (!team || team === '?') {
      return `<div class="series-team disabled">
        <span class="team-name" style="color:var(--text-3)">TBD</span>
      </div>`;
    }
    const isSelected = !complete && pick.winner === team;
    const isWinner   = complete && result.winner === team;
    const cls = `series-team${locked || complete ? ' disabled':''}${isSelected?' selected':''}${isWinner?' winner':''}`;
    return `<div class="${cls}" data-sid="${sid}" data-team="${team}">
      <div class="team-pick-indicator"></div>
      <span class="team-name">${team}</span>
    </div>`;
  };

  const gamesRow = renderGamesRowHTML(sid, pick, result, t2);

  const cardCls = `series-card${isFinal?' final-series-card':''}${complete?' complete':''}${locked?' locked':''}`;
  const idAttr = noId ? '' : ` id="card-${sid}"`;

  return `<div class="${cardCls}"${idAttr}>
    ${teamHtml(t1, true)}
    ${teamHtml(t2, false)}
    ${gamesRow}
  </div>`;
}

const SCORES = ['4:0','4:1','4:2','4:3'];
const SCORES_REVERSED = ['0:4','1:4','2:4','3:4'];

function renderGamesRowHTML(sid, pick, result, t2) {
  const useReversed = pick.winner && t2 && pick.winner === t2;
  const displayScores = useReversed ? SCORES_REVERSED : SCORES;
  const btns = SCORES.map((s, i) => {
    let cls = 'games-btn';
    if (result?.complete && result.score === s) cls += ' result';
    else if (!result?.complete && pick.score === s) cls += ' selected';
    return `<button class="${cls}" data-sid="${sid}" data-score="${s}">${displayScores[i]}</button>`;
  }).join('');
  return `<div class="series-games-row">${btns}</div>`;
}

function renderSeriesGamesRow(sid) {
  const row = document.querySelector(`#card-${sid} .series-games-row`);
  if (!row) return;
  const pick   = picks[sid] || {};
  const result = resultForSeries(sid);
  const [, t2] = teamsForSeries(sid);
  const useReversed = pick.winner && t2 && pick.winner === t2;
  const displayScores = useReversed ? SCORES_REVERSED : SCORES;
  row.innerHTML = SCORES.map((s, i) => {
    let cls = 'games-btn';
    if (result?.complete && result.score === s) cls += ' result';
    else if (!result?.complete && pick.score === s) cls += ' selected';
    return `<button class="${cls}" data-sid="${sid}" data-score="${s}">${displayScores[i]}</button>`;
  }).join('');
  row.querySelectorAll('.games-btn').forEach(el => {
    el.addEventListener('click', () => pickScore(el.dataset.sid, el.dataset.score));
  });
}

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
async function initBracket(user, userData) {
  currentUser     = user;
  currentUserData = userData;

  await Promise.all([loadPrediction(user.uid), loadResults()]);

  renderBracket();
  updateProgress();

  if (isLocked) {
    const banner = document.getElementById('locked-banner');
    if (banner) banner.classList.remove('hidden');
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.disabled = true;
  }

  document.getElementById('save-btn')?.addEventListener('click', savePrediction);
}
