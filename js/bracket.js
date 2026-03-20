// ============================================================
// BRACKET — logic and rendering for full bracket prediction
// Cross-conference format: R1 within conferences, R2+ cross
// ============================================================

// State
let picks = {};
let resultsData = {};
let currentUser = null;
let currentUserData = null;
let isLocked = false;
let bracketViewMode = 'picks'; // 'picks' | 'reality'

// ── Series tree (used for R3/Final only; R2 matchups are dynamic) ──
const SERIES_TREE = {
  's1': ['c1', 'c2'],
  's2': ['c3', 'c4'],
  'final': ['s1', 's2']
};

const ALL_SERIES_ORDERED = [
  'w1','w2','w3','w4','e1','e2','e3','e4',
  'c1','c2','c3','c4',
  's1','s2',
  'final'
];

// ── Re-seeding survivors after R1 ──────────────────────────
// Survivors are sorted by their ORIGINAL regular-season seed (lower = better).
// resultsData takes precedence over user picks so actual results are reflected.
function getSurvivors(conf) {
  const r1Series = conf === 'west' ? BRACKET.west.r1 : BRACKET.east.r1;
  return r1Series
    .map(s => {
      const winner = resultsData[s.id]?.winner || picks[s.id]?.winner || null;
      if (!winner) return null;
      // Guard: winner must be one of the current teams in this series.
      // Stale picks (saved before a bracket update) can reference teams that
      // are no longer in this series — those should be ignored.
      if (winner !== s.home && winner !== s.away) return null;
      const seriesNum = parseInt(s.id.slice(1));
      // home = higher seed (seriesNum), away = lower seed (9 - seriesNum)
      const teamSeed = winner === s.home ? seriesNum : (9 - seriesNum);
      return { teamSeed, winner };
    })
    .filter(s => s !== null)
    .sort((a, b) => a.teamSeed - b.teamSeed);
}

// ── Picks-only survivors (for prediction tree) ─────────────
function getSurvivorsPicks(conf) {
  const r1Series = conf === 'west' ? BRACKET.west.r1 : BRACKET.east.r1;
  return r1Series
    .map(s => {
      const winner = picks[s.id]?.winner || null;
      if (!winner || (winner !== s.home && winner !== s.away)) return null;
      const seriesNum = parseInt(s.id.slice(1));
      const teamSeed = winner === s.home ? seriesNum : (9 - seriesNum);
      return { teamSeed, winner };
    })
    .filter(Boolean)
    .sort((a, b) => a.teamSeed - b.teamSeed);
}

// ── Results-only survivors (for reality tree) ───────────────
function getSurvivorsResults(conf) {
  const r1Series = conf === 'west' ? BRACKET.west.r1 : BRACKET.east.r1;
  return r1Series
    .map(s => {
      const winner = resultsData[s.id]?.winner || null;
      if (!winner || (winner !== s.home && winner !== s.away)) return null;
      const seriesNum = parseInt(s.id.slice(1));
      const teamSeed = winner === s.home ? seriesNum : (9 - seriesNum);
      return { teamSeed, winner };
    })
    .filter(Boolean)
    .sort((a, b) => a.teamSeed - b.teamSeed);
}

// ── Shared R2 map helper ────────────────────────────────────
function r2Map(w, e) {
  return {
    'c1': [w[0].winner, e[3].winner],
    'c2': [e[1].winner, w[2].winner],
    'c3': [e[0].winner, w[3].winner],
    'c4': [w[1].winner, e[2].winner],
  };
}

// ── Teams for PREDICTION view (tree built from picks only) ──
function teamsForSeriesPicks(sid) {
  const r1W = BRACKET.west.r1.find(s => s.id === sid);
  if (r1W) return [r1W.home, r1W.away];
  const r1E = BRACKET.east.r1.find(s => s.id === sid);
  if (r1E) return [r1E.home, r1E.away];

  if (['c1','c2','c3','c4'].includes(sid)) {
    const w = getSurvivorsPicks('west');
    const e = getSurvivorsPicks('east');
    if (w.length < 4 || e.length < 4) return ['?', '?'];
    return r2Map(w, e)[sid] || ['?', '?'];
  }

  const children = SERIES_TREE[sid];
  if (!children) return ['?', '?'];
  return [picks[children[0]]?.winner || '?', picks[children[1]]?.winner || '?'];
}

// ── Teams for REALITY view (tree built from results only) ───
function teamsForSeriesResults(sid) {
  const r1W = BRACKET.west.r1.find(s => s.id === sid);
  if (r1W) return [r1W.home, r1W.away];
  const r1E = BRACKET.east.r1.find(s => s.id === sid);
  if (r1E) return [r1E.home, r1E.away];

  if (['c1','c2','c3','c4'].includes(sid)) {
    const w = getSurvivorsResults('west');
    const e = getSurvivorsResults('east');
    if (w.length < 4 || e.length < 4) return ['?', '?'];
    return r2Map(w, e)[sid] || ['?', '?'];
  }

  const children = SERIES_TREE[sid];
  if (!children) return ['?', '?'];
  return [resultsData[children[0]]?.winner || '?', resultsData[children[1]]?.winner || '?'];
}

// ── Legacy mixed tree (kept for getSurvivors used in leaderboard) ──
function teamsForSeries(sid) {
  return teamsForSeriesPicks(sid); // prediction view is now the default
}

function resultForSeries(sid) {
  return resultsData?.[sid] || null;
}

function roundOfSeries(sid) {
  if (['w1','w2','w3','w4','e1','e2','e3','e4'].includes(sid)) return 0;
  if (['c1','c2','c3','c4'].includes(sid)) return 1;
  if (['s1','s2'].includes(sid)) return 2;
  if (sid === 'final') return 3;
  return -1;
}

// Conference badge + seed number for a team — looks up team name in bracket config
function teamConfBadge(teamName) {
  if (!teamName || teamName === '?') return '';
  for (const s of BRACKET.west.r1) {
    if (s.home === teamName || s.away === teamName) {
      const n = parseInt(s.id.slice(1));
      const seed = s.home === teamName ? n : (9 - n);
      return `<span class="conf-badge west-badge">З${seed}</span>`;
    }
  }
  for (const s of BRACKET.east.r1) {
    if (s.home === teamName || s.away === teamName) {
      const n = parseInt(s.id.slice(1));
      const seed = s.home === teamName ? n : (9 - n);
      return `<span class="conf-badge east-badge">В${seed}</span>`;
    }
  }
  return '';
}

// ── Pick a winner ──────────────────────────────────────────
function pickWinner(sid, team) {
  if (isLocked) return;
  const result = resultForSeries(sid);
  if (result?.complete) return;
  const prev = picks[sid]?.winner;
  picks[sid] = { ...picks[sid], winner: team };
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

// ── Cascade invalidation ───────────────────────────────────
function invalidateDownstream(sid, oldWinner) {
  // R1 change: re-seeding may shift which teams appear in ANY c-series
  if (['w1','w2','w3','w4','e1','e2','e3','e4'].includes(sid)) {
    for (const csid of ['c1','c2','c3','c4']) {
      const [t1, t2] = teamsForSeries(csid);
      const cPick = picks[csid]?.winner;
      if (cPick && cPick !== t1 && cPick !== t2) {
        delete picks[csid];
        // Cascade from this c-series into s1/s2/final
        for (const [parent, children] of Object.entries(SERIES_TREE)) {
          if (children.includes(csid) && picks[parent]?.winner === cPick) {
            delete picks[parent];
            invalidateDownstream(parent, cPick);
          }
        }
      }
    }
    return;
  }
  // R2/R3: standard tree traversal
  for (const [parent, children] of Object.entries(SERIES_TREE)) {
    if (children.includes(sid) && picks[parent]?.winner === oldWinner) {
      delete picks[parent];
      invalidateDownstream(parent, oldWinner);
    }
  }
}

// ── Progress ───────────────────────────────────────────────
function countPicks() {
  return ALL_SERIES_ORDERED.filter(sid => picks[sid]?.winner).length;
}

function updateProgress() {
  const total = ALL_SERIES_ORDERED.length;
  const done  = countPicks();
  const pct   = Math.round((done / total) * 100);
  const fill  = document.getElementById('progress-fill');
  const info  = document.getElementById('save-info');
  if (fill) fill.style.width = pct + '%';
  if (info) info.textContent = `Заполнено: ${done} / ${total} серий`;
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) saveBtn.disabled = done < total;
}

// ── Save / Load ────────────────────────────────────────────
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

async function loadPrediction(uid) {
  const snap = await db.collection('predictions').doc(uid).get();
  if (snap.exists && snap.data().fullBracket) {
    picks = snap.data().fullBracket;
  }
}

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

function renderConnectors(pairCount, direction = 'ltr') {
  const pairs = Array.from({ length: pairCount }, () =>
    `<div class="connector-pair">
      <div class="connector-half top"></div>
      <div class="connector-half bottom"></div>
    </div>`
  ).join('');
  return `<div class="bracket-connectors ${direction}">
    <div class="round-label round-label-spacer" aria-hidden="true">&nbsp;</div>
    <div class="connector-pairs-area">${pairs}</div>
  </div>`;
}

function renderFinalConnector() {
  return `<div class="bracket-connector-final">
    <div class="round-label round-label-spacer" aria-hidden="true">&nbsp;</div>
    <div class="connector-final-line"></div>
  </div>`;
}

function renderBracket() {
  const container = document.getElementById('bracket-container');
  if (!container) return;

  const isReality = bracketViewMode === 'reality';
  const card = (sid, isFinal = false) =>
    isReality ? renderSeriesCardReality(sid, isFinal) : renderSeriesCard(sid, isFinal);

  const r1West = BRACKET.west.r1.map(s =>
    `<div class="series-wrapper">${card(s.id)}</div>`
  ).join('');
  const r1East = BRACKET.east.r1.map(s =>
    `<div class="series-wrapper">${card(s.id)}</div>`
  ).join('');

  container.innerHTML = `
    <div class="r1-section">
      <div class="r1-conference-block">
        <div class="conf-title">Запад — 1/8 финала</div>
        <div class="r1-series-col">${r1West}</div>
      </div>
      <div class="r1-conference-block">
        <div class="conf-title">Восток — 1/8 финала</div>
        <div class="r1-series-col">${r1East}</div>
      </div>
    </div>

    <div class="cross-separator">
      <span>↓ Перекрёстный плей-офф — пары определяются по итогам 1/8 финала ↓</span>
    </div>

    <div class="cross-bracket-row">
      <div class="conference-bracket half-a">
        <div class="conf-title">СЕТКА А</div>
        <div class="bracket-rounds">
          ${renderRound(['c1','c2'], 1)}
          ${renderConnectors(1, 'ltr')}
          ${renderRound(['s1'], 2)}
          ${renderFinalConnector()}
        </div>
      </div>

      <div class="final-center">
        <div class="conf-title conf-title-spacer">&nbsp;</div>
        <div class="final-rounds">
          <div class="round-label round-label-spacer" aria-hidden="true">&nbsp;</div>
          <div class="final-card-area">
            <div class="trophy-icon">🏆</div>
            <div class="final-label">КУБОК ГАГАРИНА</div>
            ${card('final', true)}
          </div>
        </div>
      </div>

      <div class="conference-bracket half-b">
        <div class="conf-title">СЕТКА Б</div>
        <div class="bracket-rounds">
          ${renderFinalConnector()}
          ${renderRound(['s2'], 2)}
          ${renderConnectors(1, 'rtl')}
          ${renderRound(['c3','c4'], 1)}
        </div>
      </div>
    </div>
  `;

  // Only attach pick listeners in prediction mode
  if (!isReality) {
    container.querySelectorAll('.series-team[data-sid]').forEach(el => {
      el.addEventListener('click', () => pickWinner(el.dataset.sid, el.dataset.team));
    });
    container.querySelectorAll('.games-btn').forEach(el => {
      el.addEventListener('click', () => pickScore(el.dataset.sid, el.dataset.score));
    });
  }

  renderBracketList();
}

// ── Mobile: vertical list view ─────────────────────────────
const BRACKET_ROUNDS_LIST = [
  { name: '1/8 финала', ids: ['w1','w2','w3','w4','e1','e2','e3','e4'] },
  { name: '1/4 финала (перекрёстный)', ids: ['c1','c2','c3','c4'] },
  { name: '1/2 финала', ids: ['s1','s2'] },
  { name: 'Кубок Гагарина', ids: ['final'] }
];

function renderBracketList() {
  const container = document.getElementById('bracket-list');
  if (!container) return;

  const isReality = bracketViewMode === 'reality';
  const card = (sid) =>
    isReality ? renderSeriesCardReality(sid, sid === 'final', true)
              : renderSeriesCard(sid, sid === 'final', true);

  container.innerHTML = BRACKET_ROUNDS_LIST.map(({ name, ids }) => {
    const cards = ids.map(sid => card(sid)).join('');
    return `<div class="round-section">
      <div class="round-section-title">${name}</div>
      <div class="series-grid">${cards}</div>
    </div>`;
  }).join('');

  if (!isReality) {
    container.querySelectorAll('.series-team[data-sid]').forEach(el => {
      el.addEventListener('click', () => pickWinner(el.dataset.sid, el.dataset.team));
    });
    container.querySelectorAll('.games-btn').forEach(el => {
      el.addEventListener('click', () => pickScore(el.dataset.sid, el.dataset.score));
    });
  }
}

function renderRound(seriesIds, roundIdx) {
  const label = ROUND_NAMES[roundIdx];
  const isReality = bracketViewMode === 'reality';
  const cardsHtml = seriesIds.map(sid => `
    <div class="series-wrapper">
      ${isReality ? renderSeriesCardReality(sid) : renderSeriesCard(sid)}
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
  const [t1, t2]  = teamsForSeriesPicks(sid);
  const pick      = picks[sid] || {};
  const result    = resultForSeries(sid);
  const complete  = result?.complete;
  const locked    = isLocked;

  const teamHtml = (team) => {
    if (!team || team === '?') {
      return `<div class="series-team disabled">
        <span class="team-name" style="color:var(--text-3)">TBD</span>
      </div>`;
    }
    const isSelected = !complete && pick.winner === team;
    const isWinner   = complete && result.winner === team;
    const isPicked   = complete && pick.winner === team;
    const isWrong    = isPicked && !isWinner;
    const cls = `series-team${locked || complete ? ' disabled':''}${isSelected?' selected':''}${isWinner?' winner':''}${isPicked?' user-pick':''}`;
    const badge = teamConfBadge(team);
    const hint = isWrong ? '<span class="pick-hint">ваш выбор</span>' : '';
    return `<div class="${cls}" data-sid="${sid}" data-team="${team}">
      <div class="team-pick-indicator"></div>
      ${badge}
      ${teamLogoHtml(team)}
      <span class="team-name">${team}</span>
      ${hint}
    </div>`;
  };

  const gamesRow = renderGamesRowHTML(sid, pick, result, t2);

  let ptsChip = '';
  if (complete && pick.winner) {
    let pts = 0;
    const rIdx = roundOfSeries(sid);
    if (pick.winner === result.winner) {
      pts += SCORING.winnerPoints[rIdx];
      if (pick.score && pick.score === result.score) pts += SCORING.seriesScoreBonus;
    }
    ptsChip = `<div class="series-pts ${pts > 0 ? 'pts-pos' : 'pts-zero'}">${pts > 0 ? '+' + pts : '0'} очк.</div>`;
  }

  const cardCls = `series-card${isFinal?' final-series-card':''}${complete?' complete':''}${locked?' locked':''}`;
  const idAttr = noId ? '' : ` id="card-${sid}"`;

  return `<div class="${cardCls}"${idAttr}>
    ${teamHtml(t1)}
    ${teamHtml(t2)}
    ${gamesRow}
    ${ptsChip}
  </div>`;
}

// ── Reality card: read-only, shows only actual results ──────
function renderSeriesCardReality(sid, isFinal = false, noId = false) {
  const [t1, t2] = teamsForSeriesResults(sid);
  const result   = resultsData[sid] || null;
  const complete = result?.complete;
  const REV      = {'4:0':'0:4','4:1':'1:4','4:2':'2:4','4:3':'3:4'};

  const teamHtml = (team) => {
    if (!team || team === '?') {
      return `<div class="series-team disabled">
        <span class="team-name" style="color:var(--text-3)">TBD</span>
      </div>`;
    }
    const isWinner = complete && result.winner === team;
    const badge = teamConfBadge(team);
    return `<div class="series-team disabled${isWinner ? ' winner' : ''}">
      <div class="team-pick-indicator"></div>
      ${badge}
      ${teamLogoHtml(team)}
      <span class="team-name">${team}</span>
    </div>`;
  };

  let scoreRow;
  if (complete && result.score) {
    const useReversed = result.winner === t2;
    const score = useReversed ? (REV[result.score] || result.score) : result.score;
    scoreRow = `<div class="series-games-row" style="justify-content:center;gap:.4rem">
      <span style="font-size:.75rem;color:var(--text-2)">Счёт:</span>
      <span style="font-weight:700;margin-left:.3rem;color:var(--gold)">${score}</span>
    </div>`;
  } else {
    const hasTeams = t1 && t1 !== '?' && t2 && t2 !== '?';
    scoreRow = `<div class="series-games-row" style="justify-content:center;color:var(--text-3);font-size:.75rem;font-style:italic">
      ${hasTeams ? 'Серия не сыграна' : 'Пары не определены'}
    </div>`;
  }

  const cardCls = `series-card${isFinal ? ' final-series-card' : ''}${complete ? ' complete' : ''}`;
  const idAttr  = noId ? '' : ` id="real-card-${sid}"`;

  return `<div class="${cardCls}"${idAttr}>
    ${teamHtml(t1)}
    ${teamHtml(t2)}
    ${scoreRow}
  </div>`;
}

// ── View toggle ─────────────────────────────────────────────
function switchBracketView(mode) {
  bracketViewMode = mode;
  document.getElementById('bv-tab-picks')?.classList.toggle('active', mode === 'picks');
  document.getElementById('bv-tab-reality')?.classList.toggle('active', mode === 'reality');
  // Hide save bar in reality view (can't predict from there)
  const saveBar = document.getElementById('save-bar');
  if (saveBar) saveBar.classList.toggle('hidden', mode === 'reality');
  renderBracket();
}

const SCORES = ['4:0','4:1','4:2','4:3'];
const SCORES_REVERSED = ['0:4','1:4','2:4','3:4'];

function renderGamesRowHTML(sid, pick, result, t2) {
  const useReversed   = pick.winner && t2 && pick.winner === t2;
  const displayScores = useReversed ? SCORES_REVERSED : SCORES;
  // Result score converted to t1's display perspective (reversed if actual winner is t2)
  const REV = Object.fromEntries(SCORES.map((s, i) => [s, SCORES_REVERSED[i]]));
  const resultDisplayed = result?.complete && result.score
    ? (result.winner === t2 ? (REV[result.score] || result.score) : result.score)
    : null;
  const btns = SCORES.map((s, i) => {
    let cls = 'games-btn';
    const isResult   = result?.complete && resultDisplayed === displayScores[i];
    const isUserPick = result?.complete && pick.score === s;
    if (isResult) cls += ' result';
    if (isUserPick && !isResult) cls += ' user-pick';
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
  const useReversed   = pick.winner && t2 && pick.winner === t2;
  const displayScores = useReversed ? SCORES_REVERSED : SCORES;
  const REV2 = Object.fromEntries(SCORES.map((s, i) => [s, SCORES_REVERSED[i]]));
  const resultDisplayed2 = result?.complete && result.score
    ? (result.winner === t2 ? (REV2[result.score] || result.score) : result.score)
    : null;
  row.innerHTML = SCORES.map((s, i) => {
    let cls = 'games-btn';
    const isResult   = result?.complete && resultDisplayed2 === displayScores[i];
    const isUserPick = result?.complete && pick.score === s;
    if (isResult) cls += ' result';
    if (isUserPick && !isResult) cls += ' user-pick';
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
